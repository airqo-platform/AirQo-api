from datetime import datetime, timedelta

import math
import numpy as np
import pandas as pd
from bson import ObjectId
from google.cloud import bigquery
from pymongo.errors import DuplicateKeyError

from app import cache
from config.constants import Config
from helpers.collocation_utils import (
    compute_data_completeness,
    compute_intra_sensor_correlation,
    compute_statistics,
    compute_inter_sensor_correlation,
    compute_differences,
    populate_missing_columns,
)
from helpers.convert_dates import date_to_str, format_date
from models import (
    BaseModel,
    CollocationStatus,
    CollocationData,
    CollocationResult,
    MongoBDBaseModel,
    BaseResult,
    IntraSensorCorrelationResult,
    DataCompletenessResult,
    CollocationSummary,
    DeviceCollocationStatus,
)


def doc_to_collocation_data(doc) -> CollocationData:
    return CollocationData(
        id=str(doc["_id"]),
        devices=doc["devices"],
        start_date=doc["start_date"],
        end_date=doc["end_date"],
        date_added=doc["date_added"],
        expected_hourly_records=doc["expected_hourly_records"],
        inter_correlation_threshold=doc["inter_correlation_threshold"],
        differences_threshold=doc["differences_threshold"],
        intra_correlation_threshold=doc["intra_correlation_threshold"],
        inter_correlation_r2_threshold=doc["inter_correlation_r2_threshold"],
        intra_correlation_r2_threshold=doc["intra_correlation_r2_threshold"],
        data_completeness_threshold=doc["data_completeness_threshold"],
        data_completeness_parameter=doc["data_completeness_parameter"],
        inter_correlation_parameter=doc["inter_correlation_parameter"],
        inter_correlation_additional_parameters=doc[
            "inter_correlation_additional_parameters"
        ],
        intra_correlation_parameter=doc["intra_correlation_parameter"],
        differences_parameter=doc["differences_parameter"],
        added_by=doc["added_by"],
        base_device=doc["base_device"],
        status=CollocationStatus[doc["status"]],
        results=CollocationResult(
            data_completeness=doc["results"]["data_completeness"],
            statistics=doc["results"]["statistics"],
            differences=doc["results"]["differences"],
            intra_sensor_correlation=doc["results"]["intra_sensor_correlation"],
            inter_sensor_correlation=doc["results"]["inter_sensor_correlation"],
            data_source=doc["results"]["data_source"],
            failed_devices=doc["results"]["failed_devices"],
            passed_devices=doc["results"]["passed_devices"],
            neutral_devices=doc["results"]["neutral_devices"],
        ),
    )


def docs_to_collocation_data_list(docs: list) -> list[CollocationData]:
    data: list[CollocationData] = []
    for doc in docs:
        doc_data = doc_to_collocation_data(doc)
        data.append(doc_data)
    return data


class CollocationScheduling(MongoBDBaseModel):
    def __init__(
        self,
    ):
        super().__init__("results")
        self.results_collection = "results"
        # self.db.collocation.create_index([("devices", pymongo.TEXT), ("start_date", pymongo.ASCENDING), ("end_date", pymongo.ASCENDING)],
        #                                  unique=True, name='unique_entries')

    def __query_by_status(self, status: CollocationStatus) -> list[CollocationData]:
        docs = self.db.results.find(
            {
                "status": str(status),
            }
        )

        return docs_to_collocation_data_list(docs)

    def __query_all_data(self) -> list[CollocationData]:
        docs = self.db.results.find()
        return docs_to_collocation_data_list(docs)

    def __delete_by_id(self, x_id: str):
        filter_set = {"_id": ObjectId(x_id)}
        self.db.results.delete_one(filter_set)
        print(f"Deleted {x_id}")

    def __query_by_id(self, x_id: str) -> CollocationData:
        filter_set = {"_id": ObjectId(x_id)}
        result = self.db.results.find_one(filter_set)
        return doc_to_collocation_data(result)

    def __override(self, data: CollocationData):
        filter_set = {"_id": ObjectId(data.id)}
        update_set = {"$set": data.to_dict()}
        self.db.results.update_one(filter_set, update_set)

    def __query_complete_devices(
        self, status: CollocationStatus
    ) -> list[CollocationData]:
        docs = self.db.results.find(
            {
                "status": str(status),
                "end_date": {"$lte": datetime.utcnow()},
            }
        )

        return docs_to_collocation_data_list(docs)

    def __update_status(self, data: CollocationData):
        filter_set = {"_id": ObjectId(data.id)}
        update_set = {"$set": {"status": str(data.status)}}
        self.db.results.update_one(filter_set, update_set)
        print(f"updated status for {repr(data)} to {data.status}")

    def __update_results(self, results: CollocationResult, doc_id: str):
        filter_set = {"_id": ObjectId(doc_id)}
        update_set = {"$set": {"results": results.to_dict()}}
        self.db.results.update_one(filter_set, update_set)

    def create_collocation_data(self, data: CollocationData):
        count = self.db.results.count_documents(
            {
                "devices": data.devices,
                "start_date": data.start_date,
                "end_date": data.end_date,
            }
        )

        if count != 0:
            print("Data already saved")
            return
        try:
            self.db.results.insert_one(data.to_dict())
        except DuplicateKeyError as db_error:
            print(db_error)

    @staticmethod
    def change_status_to_running(x: CollocationData) -> CollocationData:
        now = datetime.utcnow()
        updated = x
        if now >= updated.start_date:
            updated.status = CollocationStatus.RUNNING
        return updated

    def update_status_from_scheduled_to_running(self):
        records = self.__query_by_status(CollocationStatus.SCHEDULED)
        records = list(map(self.change_status_to_running, records))
        for record in records:
            self.__update_status(record)

    def update_results(self, data: list[CollocationData] = None):
        if data is None:
            records = self.__query_by_status(CollocationStatus.RUNNING)
        else:
            records = data
        results = list(map(self.compute_results, records))
        for result in results:
            self.__update_results(results=result[0], doc_id=result[1])

    def update_completed_devices(self):
        records = self.__query_complete_devices(CollocationStatus.RUNNING)
        if len(records) == 0:
            return

        self.update_results(records)

        for record in records:
            record.status = CollocationStatus.COMPLETED
            self.__update_status(record)

    def summary(self) -> list[CollocationSummary]:
        records: list[CollocationData] = self.__query_all_data()
        summary: list[CollocationSummary] = []
        for record in records:
            x_start_date = record.start_date
            x_end_date = record.end_date
            x_id = record.id
            date_added = record.date_added
            added_by = f"{record.added_by.get('first_name', '')} {record.added_by.get('last_name', '')}"

            if (
                record.status == CollocationStatus.SCHEDULED
                or record.status == CollocationStatus.RUNNING
            ):
                summary.extend(
                    map(
                        lambda device_name: CollocationSummary(
                            id=x_id,
                            device_name=device_name,
                            added_by=added_by,
                            start_date=x_start_date,
                            end_date=x_end_date,
                            status=str(record.status),
                            date_added=date_added,
                        ),
                        set(record.devices),
                    )
                )
            elif record.status == CollocationStatus.COMPLETED:
                summary.extend(
                    map(
                        lambda device_name: CollocationSummary(
                            id=x_id,
                            device_name=device_name,
                            added_by=added_by,
                            start_date=x_start_date,
                            end_date=x_end_date,
                            status=str(DeviceCollocationStatus.PASSED),
                            date_added=date_added,
                        ),
                        set(record.results.failed_devices),
                    )
                )

                summary.extend(
                    map(
                        lambda device_name: CollocationSummary(
                            id=x_id,
                            device_name=device_name,
                            added_by=added_by,
                            start_date=x_start_date,
                            end_date=x_end_date,
                            status=str(DeviceCollocationStatus.FAILED),
                            date_added=date_added,
                        ),
                        set(record.results.failed_devices),
                    )
                )

                summary.extend(
                    map(
                        lambda device_name: CollocationSummary(
                            id=x_id,
                            device_name=device_name,
                            added_by=added_by,
                            start_date=x_start_date,
                            end_date=x_end_date,
                            status=str(DeviceCollocationStatus.RE_RUN_REQUIRED),
                            date_added=date_added,
                        ),
                        set(record.results.neutral_devices),
                    )
                )

            else:
                pass

        return summary

    def delete(self, x_id: str, devices: list):
        if len(devices) == 0:
            self.__delete_by_id(x_id)
        else:
            data: CollocationData = self.__query_by_id(x_id)
            data.devices = list(set(data.devices).difference(devices))
            data.status = CollocationStatus.SCHEDULED
            data.results = None
            self.__override(data)

    def get_hourly_data(self, x_id: str, devices: list) -> dict[str, list[dict]]:
        collocation_data: CollocationData = self.__query_by_id(x_id=x_id)
        raw_data, _ = CollocationScheduling.get_data(
            devices=devices,
            start_date_time=collocation_data.start_date,
            end_date_time=collocation_data.end_date,
        )
        hourly_data: dict[str, list[dict]] = {}
        for device, device_data in raw_data:
            hourly_device_data = device_data.resample("1H", on="timestamp").mean()
            hourly_device_data = hourly_device_data.replace(np.nan, None)
            hourly_data[device] = hourly_device_data.to_dict("records")

        return hourly_data

    @staticmethod
    @cache.memoize(timeout=1800)
    def get_data(
        devices: list[str], start_date_time: datetime, end_date_time: datetime
    ) -> tuple[dict[str, pd.DataFrame], str]:
        client = bigquery.Client()
        cols = [
            "timestamp",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "device_temperature as internal_temperature",
            "device_humidity as internal_humidity",
            "temperature as external_temperature",
            "humidity as external_humidity",
            "battery as battery_voltage",
        ]

        data_table = f"`{Config.BIGQUERY_RAW_DATA}`"
        devices_table = f"`{Config.BIGQUERY_DEVICES}`"

        query = (
            f" SELECT {', '.join(map(str, set(cols)))}, {devices_table}.device_id AS device_name , "
            f" FROM {data_table} "
            f" JOIN {devices_table} ON {devices_table}.device_id = {data_table}.device_id "
            f" WHERE {data_table}.timestamp >= '{str(start_date_time)}' "
            f" AND {data_table}.timestamp <= '{str(end_date_time)}' "
            f" AND {devices_table}.device_id IN UNNEST({devices}) "
        )

        query = f"select distinct * from ({query})"

        dataframe = client.query(query=query).result().to_dataframe()
        raw_data: dict[str, pd.DataFrame] = {}

        floats = [
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "internal_temperature",
            "external_temperature",
            "external_humidity",
            "battery_voltage",
        ]
        columns = list(floats)
        columns.extend(["timestamp", "device_name", "pm2_5", "pm10"])

        for device in devices:
            raw_data[device] = pd.DataFrame(columns=columns)

        for _, by_device in dataframe.groupby("device_name"):
            device_name = by_device.iloc[0]["device_name"]
            by_device = populate_missing_columns(by_device, cols=floats)

            by_device["pm2_5"] = by_device[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
            by_device["pm10"] = by_device[["s1_pm10", "s2_pm10"]].mean(axis=1)

            by_device[floats] = by_device[floats].apply(pd.to_numeric, errors="coerce")
            by_device[["timestamp"]] = by_device[["timestamp"]].apply(
                pd.to_datetime, errors="coerce"
            )

            by_device.drop_duplicates(inplace=True, keep="first", subset=["timestamp"])
            by_device.dropna(subset=["timestamp"], inplace=True)
            raw_data[device_name] = by_device

        return raw_data, query

    @staticmethod
    def compute_results(
        collocation_data: CollocationData,
    ) -> tuple[CollocationResult, str]:
        data, data_source = CollocationScheduling.get_data(
            devices=collocation_data.devices,
            start_date_time=collocation_data.start_date,
            end_date_time=collocation_data.end_date,
        )

        now = datetime.utcnow()
        end_date_time = (
            now if now < collocation_data.end_date else collocation_data.end_date
        )

        data_completeness = compute_data_completeness(
            data=data,
            devices=collocation_data.devices,
            expected_hourly_records=collocation_data.expected_hourly_records,
            parameter=collocation_data.data_completeness_parameter,
            start_date_time=collocation_data.start_date,
            end_date_time=end_date_time,
            threshold=collocation_data.data_completeness_threshold,
        )

        intra_sensor_correlation = compute_intra_sensor_correlation(
            data=data,
            threshold=collocation_data.intra_correlation_threshold,
            parameter=collocation_data.intra_correlation_parameter,
            devices=collocation_data.devices,
            r2_threshold=collocation_data.intra_correlation_r2_threshold,
        )
        statistics = compute_statistics(data=data)
        inter_sensor_correlation = compute_inter_sensor_correlation(
            data=data,
            threshold=collocation_data.inter_correlation_threshold,
            devices=collocation_data.devices,
            parameter=collocation_data.inter_correlation_parameter,
            other_parameters=collocation_data.inter_correlation_additional_parameters,
            base_device=collocation_data.base_device,
            r2_threshold=collocation_data.inter_correlation_r2_threshold,
        )
        differences = compute_differences(
            statistics=statistics,
            base_device=collocation_data.base_device,
            devices=collocation_data.devices,
            parameter=collocation_data.differences_parameter,
            threshold=collocation_data.differences_threshold,
        )

        if len(collocation_data.devices) > 1:
            passed_devices = (
                set(data_completeness.passed_devices)
                .intersection(set(intra_sensor_correlation.passed_devices))
                .intersection(set(inter_sensor_correlation.passed_devices))
                .intersection(set(differences.passed_devices))
            )
            failed_devices = (
                set(data_completeness.failed_devices)
                .union(set(intra_sensor_correlation.failed_devices))
                .union(set(inter_sensor_correlation.failed_devices))
                .union(set(differences.failed_devices))
            )
        else:
            passed_devices = set(data_completeness.passed_devices).intersection(
                set(intra_sensor_correlation.passed_devices)
            )
            failed_devices = set(collocation_data.devices).difference(passed_devices)

        neutral_devices = (
            set(collocation_data.devices)
            .difference(passed_devices)
            .difference(failed_devices)
        )

        return (
            CollocationResult(
                data_completeness=data_completeness,
                intra_sensor_correlation=intra_sensor_correlation,
                data_source=data_source,
                statistics=statistics,
                inter_sensor_correlation=inter_sensor_correlation,
                differences=differences,
                passed_devices=list(passed_devices),
                failed_devices=list(failed_devices),
                neutral_devices=list(neutral_devices),
            ),
            collocation_data.id,
        )

    def __get_running_records(self):
        results = self.db.collocation.find(
            {
                "start_date": {"$lte": datetime.utcnow()},
                "end_date": {"$gte": datetime.utcnow()},
            }
        )
        return results

    def __get_scheduled_records(self):
        results = self.db.collocation.find(
            {
                "scheduled_date": {"$lte": datetime.utcnow()},
                "status": str(CollocationStatus.SCHEDULED),
            }
        )
        return results

    def __replace_record(self, record_id, data):
        self.db.collocation.replace_one(
            {
                "_id": record_id,
            },
            data,
        )
        # self.db.collocation.delete_many(
        #     {
        #         "start_date": data["start_date"],
        #         "end_date": data["end_date"],
        #         "devices": data["devices"],
        #     }
        # )

    def run_scheduled_collocated_devices(self):
        results = self.__get_scheduled_records()
        for result in results:
            data = dict(result)
            devices = data.get("devices")
            start_date = data.get("start_date")
            end_date = data.get("end_date")
            completeness_threshold = data.get("completeness_threshold")
            expected_records_per_day = data.get("expected_records_per_day")
            correlation_threshold = data.get("threshold")
            added_by = data.get("added_by")
            record_id = data.get("_id")

            collocation = Collocation(
                devices=list(set(devices)),
                start_date=start_date,
                end_date=end_date,
                correlation_threshold=correlation_threshold,
                completeness_threshold=completeness_threshold,
                parameters=None,  # Temporarily disabled parameters
                expected_records_per_day=expected_records_per_day,
                verbose=True,
                added_by=added_by,
            )
            collocation_results = collocation.collocate()
            if len(collocation_results) != 0:
                self.__replace_record(record_id, collocation_results)

    def update_scheduled_status(self):
        results = self.__get_running_records()
        for result in results:
            data = dict(result)
            record_id = data.pop("_id")
            data["status"] = str(CollocationStatus.RUNNING)
            self.__replace_record(record_id, data)


def get_status(passed: bool):
    if passed:
        return "passed"

    return "failed"


class Collocation(BaseModel):
    @staticmethod
    def valid_parameters():
        return [
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "internal_temperature",
            "internal_humidity",
            "external_temperature",
            "external_humidity",
            "battery_voltage",
        ]

    def __init__(
        self,
        devices: list,
        start_date: datetime,
        end_date: datetime,
        correlation_threshold: float,
        completeness_threshold: float,
        expected_records_per_day: int,
        added_by: dict,
        verbose: bool = False,
        parameters: list = None,
    ):
        super().__init__("airqo", "collocation")

        if parameters is None:
            parameters = self.valid_parameters()
        self.__client = bigquery.Client()
        self.__raw_data_table = f"`{Config.BIGQUERY_RAW_DATA}`"
        self.__devices = devices
        self.__correlation_threshold = correlation_threshold
        self.__completeness_threshold = completeness_threshold
        self.__expected_records_per_day = expected_records_per_day
        self.__parameters = parameters
        self.__start_date = start_date
        self.__end_date = end_date
        self.__verbose = verbose

        self.__data = pd.DataFrame()
        self.__intra_sensor_correlation = pd.DataFrame()
        self.__inter_sensor_correlation = pd.DataFrame()
        self.__data_completeness = pd.DataFrame()
        self.__statistics = pd.DataFrame()
        self.__differences = pd.DataFrame()
        self.__summary = pd.DataFrame()
        self.__data_query = ""
        self.__results = {}
        self.__added_by = added_by
        self.__errors = []

    def __save_collocation(self, results):
        return self.db.collocation.insert_one(results.copy())

    def summary(self):
        if self.__start_date and self.__end_date:
            results = self.db.collocation.find(
                {
                    "start_date": self.__start_date,
                    "end_date": self.__end_date,
                }
            ).sort("date_added", -1)
        else:
            results = self.db.collocation.find().sort("date_added", -1)

        documents = list(results)
        summary = []

        for document in documents:
            status = document.get("status", "")
            added_by = (
                f'{document.get("added_by", {}).get("first_name", "")} '
                f'{document.get("added_by", {}).get("last_name", "")}'
            )
            if status == "running" or status == "scheduled":
                for device in document.get("devices", []):
                    summary.append(
                        {
                            "device_name": device,
                            "added_by": added_by,
                            "start_date": document.get("start_date"),
                            "end_date": document.get("end_date"),
                            "status": document.get("status"),
                            "passed_intra_sensor_correlation": False,
                            "passed_data_completeness": False,
                            "date_added": document.get("date_added"),
                        }
                    )

            elif status == "completed":
                doc_summary = list(document.get("summary", []))
                summary.extend(doc_summary)

        return summary

    def get_collocation_results(self):
        results = self.results()

        data_completeness = []
        intra_sensor_correlation = []
        inter_sensor_correlation = []
        self.__load_device_data()
        data = self.__data
        if data.empty:
            return None
        data = data.replace(np.nan, None)
        if results.get("status", "") != str(CollocationStatus.PASSED):
            self.compute_data_completeness()
            data_completeness = self.__data_completeness.to_dict("records")
        else:
            devices_data_completeness = list(
                filter(
                    lambda x: x["device_name"] in self.__devices,
                    results.get("data_completeness", []),
                )
            )
            for device_data_completeness in devices_data_completeness:
                data_completeness.append(
                    {
                        **device_data_completeness,
                        **{
                            "start_date": results.get("start_date"),
                            "end_date": results.get("end_date"),
                        },
                    }
                )

        for device in self.__devices:
            device_data = data[data["device_name"] == device]
            correlation_data = device_data.copy()
            data_groups = correlation_data.set_index("timestamp", drop=False).groupby(
                pd.Grouper(freq="D")
            )
            device_intra_sensor_correlation = {"device_name": device, "data": []}
            device_inter_sensor_correlation = {"device_name": device, "data": []}

            for _, group in data_groups:
                if group.empty:
                    continue
                device_inter_sensor_correlation["data"].extend(group.to_dict("records"))

                timestamp = group.iloc[0]["timestamp"]
                pm2_5_pearson_correlation = (
                    group[["s1_pm2_5", "s2_pm2_5"]].corr().round(4)
                )
                pm10_pearson_correlation = group[["s1_pm10", "s2_pm10"]].corr().round(4)
                device_intra_sensor_correlation["data"].append(
                    {
                        "timestamp": date_to_str(
                            timestamp, str_format="%Y-%m-%dT%H:00:00.000000Z"
                        ),
                        "pm2_5_pearson_correlation": pm2_5_pearson_correlation.iloc[0][
                            "s2_pm2_5"
                        ],
                        "pm10_pearson_correlation": pm10_pearson_correlation.iloc[0][
                            "s2_pm10"
                        ],
                        "pm2_5_r2": math.sqrt(
                            pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]
                        ),
                        "pm10_r2": math.sqrt(
                            pm10_pearson_correlation.iloc[0]["s2_pm10"]
                        ),
                    }
                )
            intra_sensor_correlation.append(device_intra_sensor_correlation)
            inter_sensor_correlation.append(device_inter_sensor_correlation)

        return {
            "data_completeness": data_completeness,
            "intra_sensor_correlation": intra_sensor_correlation,
            "inter_sensor_correlation": inter_sensor_correlation,
        }

    def results(self):
        if len(self.__devices) == 1:
            results = self.db.collocation.find_one(
                {
                    "start_date": self.__start_date,
                    "end_date": self.__end_date,
                    "devices": {"$in": self.__devices},
                }
            )
        else:
            results = self.db.collocation.find_one(
                {
                    "start_date": self.__start_date,
                    "end_date": self.__end_date,
                    "devices": self.__devices,
                }
            )

        if results is None:
            return {}

        data = dict(results)
        data.pop("_id")
        return data

    def __create_results_object(self, status: CollocationStatus):
        return {
            "devices": self.__devices,
            "start_date": self.__start_date,
            "end_date": self.__end_date,
            "threshold": self.__correlation_threshold,
            "completeness_threshold": self.__completeness_threshold,
            "expected_records_per_day": self.__expected_records_per_day,
            "added_by": self.__added_by,
            "date_added": datetime.utcnow(),
            "status": str(status),
            "scheduled_date": self.__end_date + timedelta(hours=2),
            "data_completeness": self.__data_completeness.to_dict("records"),
            "summary": self.__summary.to_dict("records"),
            "statistics": self.__statistics.to_dict("records"),
            "differences": self.__differences.to_dict("records"),
            "intra_sensor_correlation": self.__intra_sensor_correlation.to_dict(
                "records"
            ),
            "inter_sensor_correlation": self.__inter_sensor_correlation.to_dict(
                "records"
            ),
            "errors": self.__errors,
            "data_source": self.__data_query,
        }

    def schedule(self):
        results = self.db.collocation.find_one(
            {
                "start_date": self.__start_date,
                "end_date": self.__end_date,
                "devices": {"$in": self.__devices},
            }
        )

        if results:
            del results["_id"]
            return results

        results = self.__create_results_object(status=CollocationStatus.SCHEDULED)
        self.__save_collocation(results)
        return results

    def collocate(self):
        self.__load_device_data()

        if not self.__data.empty:
            self.__aggregate_data()
            self.compute_data_completeness()
            self.compute_inter_sensor_correlation()
            self.compute_intra_sensor_correlation()
            self.compute_statistics()
            self.compute_differences()
            self.compute_summary()

            self.__data_completeness = self.__data_completeness.replace(np.nan, None)
            self.__statistics = self.__statistics.replace(np.nan, None)
            self.__intra_sensor_correlation = self.__intra_sensor_correlation.replace(
                np.nan, None
            )
            self.__inter_sensor_correlation = self.__inter_sensor_correlation.replace(
                np.nan, None
            )
            self.__differences = self.__differences.replace(np.nan, None)
            self.__summary = self.__summary.replace(np.nan, None)

            return self.__create_results_object(status=CollocationStatus.PASSED)

        return {}

    def __aggregate_data(self) -> pd.DataFrame:
        data = self.__data
        aggregated_data = pd.DataFrame()
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)

        for _, group in data.groupby("device_name"):
            device_name = group.iloc[0]["device_name"]
            del group["device_name"]

            averages = group.resample("1H", on="timestamp").mean()
            averages["timestamp"] = averages.index
            averages["device_name"] = device_name

            aggregated_data = pd.concat([aggregated_data, averages], ignore_index=True)

        self.__data = aggregated_data
        return self.__data

    @staticmethod
    @cache.memoize()
    def get_data(
        devices: list, start_date_time: datetime, end_date_time: datetime
    ) -> tuple[dict, dict]:
        client = bigquery.Client()
        cols = [
            "timestamp",
            "device_id as device_name",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "device_temperature as internal_temperature",
            "device_humidity as internal_humidity",
            "temperature as external_temperature",
            "humidity as external_humidity",
            "battery as battery_voltage",
        ]

        data_table = f"`{Config.BIGQUERY_RAW_DATA}`"

        query = (
            f" SELECT {', '.join(map(str, set(cols)))} "
            f" FROM {data_table} "
            f" WHERE {data_table}.timestamp >= '{str(start_date_time)}' "
            f" AND {data_table}.timestamp <= '{str(end_date_time)}' "
            f" AND device_id IN UNNEST({devices}) "
        )

        dataframe = client.query(query=query).result().to_dataframe()
        raw_data = {}
        resampled_data = {}

        if dataframe.empty:
            for device in devices:
                raw_data[device] = {}
                resampled_data[device] = {}
            return raw_data, resampled_data

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        dataframe.drop_duplicates(
            subset=["timestamp", "device_name"], keep="first", inplace=True
        )

        cols = set(dataframe.columns.to_list()).difference({"device_name", "timestamp"})

        for _, by_device in dataframe.groupby("device_name"):
            device_data = by_device.copy()
            device_name = device_data.iloc[0]["device_name"]
            del device_data["device_name"]

            raw_data[device_name] = device_data.replace(
                to_replace=np.nan, value=None
            ).to_dict("records")

            device_averages = device_data.resample("1H", on="timestamp").mean()
            device_averages["timestamp"] = device_averages.index
            device_averages.dropna(subset=list(cols), inplace=True, how="all")
            device_averages.replace(to_replace=np.nan, value=None, inplace=True)
            resampled_data[device_name] = device_averages.to_dict("records")

        return raw_data, resampled_data

    @staticmethod
    def format_collocation_data(data_dict: dict):
        data = pd.DataFrame()

        for device, device_data in data_dict.items():
            device_data_df = pd.DataFrame(device_data)
            device_data_df["device_name"] = device
            data = pd.concat([data, device_data_df])

        data["timestamp"] = data["timestamp"].apply(date_to_str)
        devices = set(data["device_name"].tolist())
        timestamps = set(data["timestamp"].tolist())

        results = []
        for timestamp in timestamps:
            result = {"timestamp": timestamp}
            for device in devices:
                result[device] = {
                    "s1_pm10": None,
                    "s1_pm2_5": None,
                    "s2_pm10": None,
                    "s2_pm2_5": None,
                }
            results.append(result)

        for _, row in data.iterrows():
            device_timestamp = list(
                filter(lambda x: x["timestamp"] == row["timestamp"], results)
            )[0]
            results.remove(device_timestamp)
            device_timestamp[row["device_name"]] = {
                "s1_pm10": row["s1_pm10"],
                "s1_pm2_5": row["s1_pm2_5"],
                "s2_pm10": row["s2_pm10"],
                "s2_pm2_5": row["s2_pm2_5"],
            }
            results.append(device_timestamp)

        return results

    @staticmethod
    def get_inter_sensor_correlation(raw_data: dict, threshold) -> list:
        device_pairs = Collocation.get_device_pairs(list(raw_data.keys()))

        correlation = []

        cols = []

        for device_pair in device_pairs:
            device_x = device_pair[0]
            device_y = device_pair[1]

            device_x_data = pd.DataFrame(raw_data.get(device_x))
            cols.extend(device_x_data.columns.to_list())
            device_x_data = device_x_data.add_prefix(f"{device_x}_")
            device_x_data.rename(
                columns={f"{device_x}_timestamp": "timestamp"}, inplace=True
            )

            device_y_data = pd.DataFrame(raw_data.get(device_y))
            cols.extend(device_y_data.columns.to_list())
            device_y_data = device_y_data.add_prefix(f"{device_y}_")
            device_y_data.rename(
                columns={f"{device_y}_timestamp": "timestamp"}, inplace=True
            )

            device_pair_data = pd.merge(
                left=device_x_data,
                right=device_y_data,
                on=["timestamp"],
            )

            device_pair_correlation = {}

            for col in set(cols):
                try:
                    cols = [f"{device_x}_{col}", f"{device_y}_{col}"]
                    device_pair_correlation_data = (
                        device_pair_data[cols].corr().round(4)
                    )
                    device_pair_correlation_data.replace(np.nan, None, inplace=True)
                    correlation_value = device_pair_correlation_data.iloc[0][cols[1]]
                    device_pair_correlation[col] = correlation_value

                except Exception as ex:
                    print(ex)
                    pass

            correlation.append(
                {
                    **{
                        "devices": device_pair,
                        "threshold": threshold,
                    },
                    **device_pair_correlation,
                    **{
                        "criteria": "Passed if s1_pm2_5, s2_pm2_5, s1_pm10 and s2_pm10 are greater than the threshold",
                        "passed": bool(device_pair_correlation["s1_pm2_5"] > threshold)
                        and bool(device_pair_correlation["s2_pm2_5"] > threshold)
                        and bool(device_pair_correlation["s1_pm10"] > threshold)
                        and bool(device_pair_correlation["s2_pm10"] > threshold),
                    },
                }
            )

        return correlation

    @staticmethod
    def get_intra_sensor_correlation(raw_data: dict) -> dict:
        correlation = {}

        for device in raw_data.keys():
            device_data = pd.DataFrame(raw_data.get(device))
            pm2_5_pearson_correlation = (
                device_data[["s1_pm2_5", "s2_pm2_5"]].corr().round(4)
            )
            pm10_pearson_correlation = (
                device_data[["s1_pm10", "s2_pm10"]].corr().round(4)
            )
            correlation[device] = {
                "pm2_5_pearson_correlation": pm2_5_pearson_correlation.iloc[0][
                    "s2_pm2_5"
                ],
                "pm10_pearson_correlation": pm10_pearson_correlation.iloc[0]["s2_pm10"],
                "pm2_5_r2": math.sqrt(pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]),
                "pm10_r2": math.sqrt(pm10_pearson_correlation.iloc[0]["s2_pm10"]),
            }

        return correlation

    @staticmethod
    def get_results(
        devices: list,
        data_completeness: dict,
        intra_sensor_threshold,
        intra_sensor_correlation: dict,
        data_completeness_threshold,
    ) -> dict:
        data_completeness_results = {}
        for device, device_data in data_completeness.items():
            status = (
                "passed"
                if bool(device_data["completeness"] > data_completeness_threshold)
                else "failed"
            )
            data_completeness_results[device] = {
                **device_data,
                "status": status,
                "threshold": data_completeness_threshold,
                "criteria": "Passed if completeness is greater than threshold",
            }

        intra_sensor_results = {}
        for device, device_data in intra_sensor_correlation.items():
            status = (
                "passed"
                if (
                    bool(
                        device_data["pm2_5_pearson_correlation"]
                        > intra_sensor_threshold
                    )
                    and bool(
                        device_data["pm10_pearson_correlation"] > intra_sensor_threshold
                    )
                )
                else "failed"
            )

            intra_sensor_results[device] = {
                **device_data,
                "status": status,
                "threshold": intra_sensor_threshold,
                "criteria": "Passed if pm2_5_pearson_correlation is greater than threshold "
                "and pm10_pearson_correlation is greater than threshold",
            }

        results = {}
        for device in devices:
            correlation_status = intra_sensor_results[device]["status"]
            completeness_status = data_completeness_results[device]["status"]
            status = (
                "passed"
                if correlation_status == "passed" and completeness_status == "passed"
                else "failed"
            )
            results[device] = {
                "status": status,
                "criteria": "passed if passed intra_sensor_correlation and data_completeness",
            }

        return results

    @staticmethod
    def get_data_completeness(
        raw_data: dict,
        start_date_time: datetime,
        end_date_time: datetime,
        expected_records_per_hour,
    ) -> dict:
        completeness_report = {}

        hours_diff = int(((end_date_time - start_date_time).total_seconds()) / 3600)
        expected_records = expected_records_per_hour * hours_diff

        for device in raw_data.keys():
            device_data = pd.DataFrame(raw_data[device])
            device_data.drop_duplicates(
                inplace=True, keep="first", subset=["timestamp"]
            )
            actual_number_of_records = len(device_data.index)
            completeness = 1
            missing = 0

            if actual_number_of_records < expected_records:
                completeness = actual_number_of_records / expected_records
                missing = 1 - completeness

            completeness_report[device] = {
                "expected_number_of_records": expected_records,
                "start_date": start_date_time,
                "end_date": end_date_time,
                "actual_number_of_records": actual_number_of_records,
                "completeness": completeness,
                "missing": missing,
            }

        return completeness_report

    @staticmethod
    def get_statistics(
        raw_data: dict,
    ) -> dict:
        statistics = {}

        for device, device_data in raw_data.items():
            device_data_df = pd.DataFrame(device_data)
            cols = device_data_df.columns.to_list()
            cols.remove("timestamp")

            device_statistics = {}

            for col in cols:
                col_statistics = device_data_df[col].describe()

                device_statistics = {
                    **device_statistics,
                    **{
                        f"{col}_mean": col_statistics.get("mean", None),
                        f"{col}_std": col_statistics.get("std", None),
                        f"{col}_min": col_statistics.get("min", None),
                        f"{col}_max": col_statistics.get("max", None),
                        f"{col}_25_percentile": col_statistics.get("25%", None),
                        f"{col}_50_percentile": col_statistics.get("50%", None),
                        f"{col}_75_percentile": col_statistics.get("75%", None),
                    },
                }

            statistics[device] = device_statistics

        return statistics

    @staticmethod
    def get_differences(statistics: dict) -> list:
        differences = []

        device_pairs = Collocation.get_device_pairs(list(statistics.keys()))

        for device_pair in device_pairs:
            device_x = device_pair[0]
            device_y = device_pair[1]

            device_x_data = pd.DataFrame([statistics.get(device_x)])
            device_y_data = pd.DataFrame([statistics.get(device_y)])

            differences_df = abs(device_x_data - device_y_data)
            differences_df.replace(np.nan, None, inplace=True)

            differences.append(
                {
                    "devices": device_pair,
                    "abs_differences": differences_df.to_dict("records"),
                }
            )

        return differences

    @staticmethod
    def flatten_completeness(
        data: dict,
    ) -> list:
        completeness_report = []

        for device, device_data in data.items():
            completeness_report.append({**{"device_name": device}, **device_data})

        return completeness_report

    @cache.memoize()
    def query_data(self, query):
        dataframe = self.__client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            return pd.DataFrame()

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        dataframe.drop_duplicates(
            subset=["timestamp", "device_id"], keep="first", inplace=True
        )
        dataframe.rename(columns={"device_id": "device_name"}, inplace=True)

        self.__data = dataframe
        return self.__data

    def __load_device_data(self):
        """
        SELECT
        timestamp, device_name, s1_pm2_5, s2_pm2_5, s1_pm10,
        s2_pm10, device_temperature as internal_temperature, device_humidity as internal_humidity,
        temperature as external_temperature, humidity as external_humidity, altitude, vapor_pressure
        FROM `airqo-250220.averaged_data.hourly_device_measurements`
        WHERE DATE(timestamp) >= "2023-01-15" and
        device_name in UNNEST(["aq_g5_38", "aq_g519", "aq_g5_63"])
        """

        col_mappings = {
            "s1_pm2_5": "s1_pm2_5",
            "s2_pm2_5": "s2_pm2_5",
            "s1_pm10": "s1_pm10",
            "s2_pm10": "s2_pm10",
            "internal_temperature": "device_temperature as internal_temperature",
            "internal_humidity": "device_humidity as internal_humidity",
            "external_temperature": "temperature as external_temperature",
            "external_humidity": "humidity as external_humidity",
            "battery_voltage": "battery as battery_voltage",
        }
        cols = []
        for parameter in self.__parameters:
            if parameter in col_mappings.keys():
                cols.append(col_mappings[parameter])

        query = (
            f" SELECT timestamp, device_id, {', '.join(map(str, set(cols)))} "
            f" FROM {self.__raw_data_table} "
            f" WHERE {self.__raw_data_table}.timestamp >= '{date_to_str(self.__start_date, str_format='%Y-%m-%d')}' "
            f" AND {self.__raw_data_table}.timestamp <= '{date_to_str(self.__end_date, str_format='%Y-%m-%d')}' "
            f" AND device_id IN UNNEST({self.__devices}) "
        )

        self.__data_query = query

        dataframe = self.__client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            self.__errors.append(
                f"{', '.join(self.__devices)} dont have data between {self.__start_date} and {self.__end_date}"
            )
            return

        devices = dataframe["device_id"].tolist()
        devices_without_data = set(self.__devices).difference(set(devices))

        if len(devices_without_data) != 0:
            error = (
                f"{', '.join(devices_without_data) } does not have data between "
                f"{self.__start_date} and {self.__end_date}"
            )
            if len(devices_without_data) > 1:
                error = f"{devices_without_data} dont have data between {self.__start_date} and {self.__end_date}"
            self.__errors.append(error)
            return

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        dataframe.drop_duplicates(
            subset=["timestamp", "device_id"], keep="first", inplace=True
        )
        dataframe.rename(columns={"device_id": "device_name"}, inplace=True)

        self.__data = dataframe
        return self.__data

    def compute_intra_sensor_correlation(self) -> pd.DataFrame:
        """
        Compute correlation of a device
        inputs: data (Columns => device, parameters)
        parameters: []
        outputs:
            device | pm2_5_pearson_correlation | pm10_pearson_correlation | r2 | s1_pm2_5 | s2_pm2_5 | s1_pm10 | s2_pm10

        Steps:
        1. For each device, Use pandas to compute pm2.5 and pm 10 pearson correlation
            pd.correlation()
            NB: Take note of null values.
        2. For each device, Compute r2 => square pm2_5_pearson_correlation => r2

        """
        correlation = []
        device_groups = self.__data.groupby("device_name")
        for _, group in device_groups:
            device_name = group.iloc[0].device_name
            pm2_5_pearson_correlation = (
                self.__data[["s1_pm2_5", "s2_pm2_5"]].corr().round(4)
            )
            pm10_pearson_correlation = (
                self.__data[["s1_pm10", "s2_pm10"]].corr().round(4)
            )
            correlation.append(
                {
                    "device_name": device_name,
                    "pm2_5_pearson_correlation": pm2_5_pearson_correlation.iloc[0][
                        "s2_pm2_5"
                    ],
                    "pm10_pearson_correlation": pm10_pearson_correlation.iloc[0][
                        "s2_pm10"
                    ],
                    "pm2_5_r2": math.sqrt(
                        pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]
                    ),
                    "pm10_r2": math.sqrt(pm10_pearson_correlation.iloc[0]["s2_pm10"]),
                    "passed": pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]
                    > self.__correlation_threshold,
                }
            )
        self.__intra_sensor_correlation = pd.DataFrame(correlation)
        return self.__intra_sensor_correlation

    def compute_data_completeness(self):
        """
        Docs: https://docs.google.com/document/d/1RrHfHmRrxYGFtkMFyeBlbba8jmqmsFGI1QYsEaJcMLk/edit
        inputs:
            a list of devices,
            start date
            expected number of records in an hour
            number of days
            end date?
            completeness_threshold? : 0 - 100 (default value 80)
            -----------
            end date => end date is null ?? start date + number of days

        outputs: Dataframe
         device | % completeness | % missing | expected_records | hourly_actual_records_count | recommendation

        Steps:
        1. Querying tha data from the API or data warehouse
            user devices, start date, end date
            NB: remove duplicates (timestamp, device_name or name)
                Use hourly data
        2. Calculate number of expected records in the period for all devices. 24 * number of days (expected)
        3. Calculate number of Hourly Actual records that we sent by each device (actual)
        4. Compute completeness for each device => (actual/expected )* 100 (completeness)
        5. Compute Missing for each device => 100 - completeness (Missing)
        6. Compute Recommendation => Passed if completeness > completenessThreshold else Failed
        """

        completeness_report = []
        data = self.__data.drop_duplicates(subset=["device_name", "timestamp"])
        date_diff = (self.__end_date - self.__start_date).days
        expected_records = (
            self.__expected_records_per_day
            if date_diff <= 0
            else self.__expected_records_per_day * date_diff
        )

        device_groups = data.groupby("device_name")
        for _, group in device_groups:
            actual_number_of_records = len(group.index)
            completeness = 1
            missing = 0

            if actual_number_of_records < expected_records:
                completeness = actual_number_of_records / expected_records
                missing = 1 - completeness

            completeness_report.append(
                {
                    "device_name": group.iloc[0].device_name,
                    "expected_number_of_records": expected_records,
                    "actual_number_of_records": actual_number_of_records,
                    "completeness": completeness,
                    "missing": missing,
                    "passed": completeness > self.__completeness_threshold,
                }
            )
        self.__data_completeness = pd.DataFrame(completeness_report)
        return self.__data_completeness

    def compute_statistics(self):
        """
        Ref : https://docs.google.com/document/d/14Lli_xCeCq1a1JM2JkbCuF2FSqX3BtqkacxQWs9HCPc/edit#heading=h.3jnb6ajjwl2
        Compute correlation of a device
        inputs: data (Columns => device, s1_pm2_5 , s2_pm2_5 , s1_pm10 , s2_pm10, battery_voltage,
                        internal_temperature, internal_humidity and external_humidity, altitude, external_pressure
                        and external_temperature )
        outputs:
            device and  (mean, std, max, min) for s1_pm2_5, s2_pm2_5, s1_pm10 and s2_pm10, battery_voltage,
            internal  and external temperature, internal and external humidity, altitude, external pressure

        Steps:
        1. For each device, compute the statistics

        """

        statistics = []
        device_groups = self.__data.groupby("device_name")
        for _, group in device_groups:
            device_name = group.iloc[0].device_name
            device_statistics = {}

            for col in self.__parameters:
                col_statistics = group[col].describe()
                device_statistics = {
                    **device_statistics,
                    **{
                        f"{col}_mean": col_statistics["mean"],
                        f"{col}_std": col_statistics["std"],
                        f"{col}_min": col_statistics["min"],
                        f"{col}_max": col_statistics["max"],
                        f"{col}_25_percentile": col_statistics["25%"],
                        f"{col}_50_percentile": col_statistics["50%"],
                        f"{col}_75_percentile": col_statistics["75%"],
                    },
                }

            statistics.append({**{"device_name": device_name}, **device_statistics})
        self.__statistics = pd.DataFrame(statistics)
        return self.__statistics

    def compute_inter_sensor_correlation(self):
        """
        Compute correlation between devices
        inputs: statistics (device, s1_pm2_5 | s2_pm2_5 | s1_pm10 | s2_pm10, external_humidity, internal_humidity)
        outputs:
            a dataframe with the correlated data

        Steps:
        Use pandas to compute the correlation
        """
        correlation = []
        device_pairs = self.device_pairs(self.__data)

        for device_pair in device_pairs:
            device_x_data = self.__data[self.__data["device_name"] == device_pair[0]]
            device_x_data = device_x_data.add_prefix(f"{device_pair[0]}_")
            device_x_data.rename(
                columns={f"{device_pair[0]}_timestamp": "timestamp"}, inplace=True
            )

            device_y_data = self.__data[self.__data["device_name"] == device_pair[1]]
            device_y_data = device_y_data.add_prefix(f"{device_pair[1]}_")
            device_y_data.rename(
                columns={f"{device_pair[1]}_timestamp": "timestamp"}, inplace=True
            )

            device_pair_data = pd.merge(
                left=device_x_data,
                right=device_y_data,
                on=["timestamp"],
                how="left",
            )

            device_pair_correlation = {}

            for col in self.__parameters:
                cols = [f"{device_pair[0]}_{col}", f"{device_pair[1]}_{col}"]
                device_pair_correlation_data = device_pair_data[cols].corr().round(4)
                device_pair_correlation[col] = device_pair_correlation_data.iloc[0][
                    cols[1]
                ]

            correlation.append(
                {
                    **{
                        "devices": device_pair,
                    },
                    **device_pair_correlation,
                    **{
                        "passed": device_pair_correlation["s1_pm2_5"]
                        > self.__correlation_threshold,
                    },
                }
            )
        self.__inter_sensor_correlation = pd.DataFrame(correlation)
        return self.__inter_sensor_correlation

    @staticmethod
    def device_pairs(data: pd.DataFrame) -> list:
        devices = list(set(data["device_name"].tolist()))
        device_pairs = []
        for device_x in devices:
            for device_y in devices:
                if (device_x == device_y) or ((device_y, device_x) in device_pairs):
                    continue
                device_pairs.append([device_x, device_y])

        return device_pairs

    @staticmethod
    def get_device_pairs(devices: list) -> list:
        device_pairs = []
        pairing_devices = set(devices.copy())
        for device in set(devices):
            pairing_devices.remove(device)
            for pair_device in pairing_devices:
                device_pairs.append([device, pair_device])

        return device_pairs

    def compute_summary(self) -> pd.DataFrame:
        """
        Computes summary
        """

        data = pd.merge(
            left=self.__data_completeness,
            right=self.__intra_sensor_correlation,
            on="device_name",
            suffixes=("_data_completeness", "_intra_sensor_correlation"),
        )

        data["status"] = (
            data["passed_data_completeness"] & data["passed_intra_sensor_correlation"]
        )
        data["status"] = data["status"].apply(lambda x: get_status(x))
        data["start_date"] = self.__start_date
        data["end_date"] = self.__end_date
        data[
            "added_by"
        ] = f"{self.__added_by.get('first_name', '')} {self.__added_by.get('last_name', '')}".strip()

        self.__summary = data[
            [
                "status",
                "start_date",
                "end_date",
                "device_name",
                "added_by",
                "passed_intra_sensor_correlation",
                "passed_data_completeness",
            ]
        ]

        return self.__summary

    def compute_differences(self) -> pd.DataFrame:
        """
        Computes differences
        inputs: statistics
        outputs:
            differences

        Steps:
        1. Use pandas to compute the differences
        """
        differences = []

        data = self.__statistics

        if data.empty:
            data = self.compute_statistics()

        device_pairs = self.device_pairs(data)

        for device_pair in device_pairs:
            device_x_data = data[data["device_name"] == device_pair[0]]
            device_x_data = device_x_data.add_prefix(f"{device_pair[0]}_")
            device_x_data = device_x_data.reset_index()

            device_y_data = data[data["device_name"] == device_pair[1]]
            device_y_data = device_y_data.add_prefix(f"{device_pair[1]}_")
            device_y_data = device_y_data.reset_index()

            device_pair_data = pd.merge(
                device_x_data, device_y_data, left_index=True, right_index=True
            )
            differences_map = {}

            for col in data.columns.to_list():
                if col == "device_name":
                    continue
                cols = [f"{device_pair[0]}_{col}", f"{device_pair[1]}_{col}"]

                device_pair_data[col] = (
                    device_pair_data[cols[0]] - device_pair_data[cols[1]]
                )

                differences_map[col] = abs(device_pair_data.iloc[0][col])

            differences.append(
                {
                    **{
                        "devices": device_pair,
                    },
                    **differences_map,
                }
            )

        self.__differences = pd.DataFrame(differences)
        return self.__differences


if __name__ == "__main__":
    start_date = format_date(
        datetime.utcnow() - timedelta(hours=24), str_format="%Y-%m-%dT%H:00:00.000Z"
    )
    end_date = format_date(
        datetime.utcnow() - timedelta(hours=1), str_format="%Y-%m-%dT%H:00:00.000Z"
    )

    test_data: CollocationData = CollocationData(
        id="",
        status=CollocationStatus.SCHEDULED,
        start_date=start_date,
        end_date=end_date,
        added_by={},
        devices=["aq_g518"],
        base_device=None,
        date_added=datetime.utcnow(),
        expected_hourly_records=12,
        inter_correlation_threshold=0.79,
        intra_correlation_threshold=0.79,
        inter_correlation_r2_threshold=0.78,
        intra_correlation_r2_threshold=0.78,
        differences_threshold=5,
        data_completeness_parameter="timestamp",
        inter_correlation_parameter="pm2_5",
        intra_correlation_parameter="pm2_5",
        differences_parameter="pm2_5",
        data_completeness_threshold=0.8,
        inter_correlation_additional_parameters=["pm10"],
        results=CollocationResult(
            data_completeness=DataCompletenessResult(
                failed_devices=[],
                passed_devices=[],
                neutral_devices=[],
                results=[],
            ),
            statistics=[],
            differences=BaseResult(
                failed_devices=[], passed_devices=[], neutral_devices=[], results=[]
            ),
            intra_sensor_correlation=IntraSensorCorrelationResult(
                failed_devices=[],
                passed_devices=[],
                neutral_devices=[],
                results=[],
            ),
            inter_sensor_correlation=BaseResult(
                failed_devices=[], passed_devices=[], neutral_devices=[], results=[]
            ),
            data_source="",
            failed_devices=[],
            passed_devices=[],
            neutral_devices=[],
        ),
    )

    collocation = CollocationScheduling()
    collocation.create_collocation_data(test_data)
    collocation.update_status_from_scheduled_to_running()
    collocation.update_results()
    collocation.update_completed_devices()
