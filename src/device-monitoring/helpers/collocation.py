import copy
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from bson import ObjectId
from google.cloud import bigquery

from app import cache

# from app import cache
from config.constants import Config
from helpers.collocation_utils import (
    compute_data_completeness,
    compute_intra_sensor_correlation,
    compute_statistics,
    compute_inter_sensor_correlation,
    compute_differences,
    populate_missing_columns,
)
from helpers.exceptions import CollocationBatchNotFound
from models import (
    CollocationBatchStatus,
    CollocationBatch,
    CollocationBatchResult,
    MongoBDBaseModel,
    CollocationSummary,
    CollocationDeviceStatus,
    CollocationBatchResultSummary,
    DataCompletenessResult,
    DataCompleteness,
    IntraSensorCorrelationResult,
    IntraSensorCorrelation,
    BaseResult,
)


def doc_to_collocation_data(doc) -> CollocationBatch:
    return CollocationBatch(
        batch_id=str(doc["_id"]),
        batch_name=str(doc["batch_name"]),
        devices=doc["devices"],
        start_date=doc["start_date"],
        end_date=doc["end_date"],
        date_created=doc["date_created"],
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
        created_by=doc["created_by"],
        base_device=doc["base_device"],
        status=CollocationBatchStatus[doc["status"]],
        results=CollocationBatchResult(
            data_completeness=DataCompletenessResult(
                failed_devices=doc["results"]["data_completeness"]["failed_devices"],
                passed_devices=doc["results"]["data_completeness"]["passed_devices"],
                neutral_devices=doc["results"]["data_completeness"]["neutral_devices"],
                results=[
                    DataCompleteness(
                        device_name=record["device_name"],
                        expected=record["expected"],
                        actual=record["actual"],
                        completeness=record["completeness"],
                        missing=record["missing"],
                        passed=record["passed"],
                    )
                    for record in doc["results"]["data_completeness"]["results"]
                ],
            ),
            intra_sensor_correlation=IntraSensorCorrelationResult(
                failed_devices=doc["results"]["intra_sensor_correlation"][
                    "failed_devices"
                ],
                passed_devices=doc["results"]["intra_sensor_correlation"][
                    "passed_devices"
                ],
                neutral_devices=doc["results"]["intra_sensor_correlation"][
                    "neutral_devices"
                ],
                results=[
                    IntraSensorCorrelation(
                        device_name=record["device_name"],
                        pm2_5_pearson=record["pm2_5_pearson"],
                        pm10_pearson=record["pm10_pearson"],
                        pm2_5_r2=record["pm2_5_r2"],
                        pm10_r2=record["pm10_r2"],
                        passed=record["passed"],
                    )
                    for record in doc["results"]["intra_sensor_correlation"]["results"]
                ],
            ),
            differences=BaseResult(
                failed_devices=doc["results"]["differences"]["failed_devices"],
                passed_devices=doc["results"]["differences"]["passed_devices"],
                neutral_devices=doc["results"]["differences"]["neutral_devices"],
                results=[
                    dict(record) for record in doc["results"]["differences"]["results"]
                ],
            ),
            inter_sensor_correlation=BaseResult(
                failed_devices=doc["results"]["inter_sensor_correlation"][
                    "failed_devices"
                ],
                passed_devices=doc["results"]["inter_sensor_correlation"][
                    "passed_devices"
                ],
                neutral_devices=doc["results"]["inter_sensor_correlation"][
                    "neutral_devices"
                ],
                results=[
                    dict(record)
                    for record in doc["results"]["inter_sensor_correlation"]["results"]
                ],
            ),
            statistics=doc["results"]["statistics"],
            data_source=doc["results"]["data_source"],
        ),
        summary=[
            CollocationBatchResultSummary(
                device=record["device"],
                status=CollocationDeviceStatus[record["status"]],
            )
            for record in doc.get("summary", [])
        ],
    )


def docs_to_collocation_data_list(docs: list) -> list[CollocationBatch]:
    data: list[CollocationBatch] = []
    for doc in docs:
        doc_data = doc_to_collocation_data(doc)
        data.append(doc_data)
    return data


class Collocation(MongoBDBaseModel):
    def __init__(
        self,
    ):
        super().__init__("collocation")

    @staticmethod
    def compute_batch_results(
        collocation_batch: CollocationBatch,
    ) -> CollocationBatchResult:
        data, data_source = Collocation.get_data(
            devices=collocation_batch.devices,
            start_date_time=collocation_batch.start_date,
            end_date_time=collocation_batch.end_date,
        )

        now = datetime.utcnow()
        end_date_time = (
            now if now < collocation_batch.end_date else collocation_batch.end_date
        )

        data_completeness = compute_data_completeness(
            data=data,
            devices=collocation_batch.devices,
            expected_hourly_records=collocation_batch.expected_hourly_records,
            parameter=collocation_batch.data_completeness_parameter,
            start_date_time=collocation_batch.start_date,
            end_date_time=end_date_time,
            threshold=collocation_batch.data_completeness_threshold,
        )

        intra_sensor_correlation = compute_intra_sensor_correlation(
            data=data,
            threshold=collocation_batch.intra_correlation_threshold,
            parameter=collocation_batch.intra_correlation_parameter,
            devices=collocation_batch.devices,
            r2_threshold=collocation_batch.intra_correlation_r2_threshold,
        )

        inter_sensor_correlation = compute_inter_sensor_correlation(
            data=data,
            threshold=collocation_batch.inter_correlation_threshold,
            devices=collocation_batch.devices,
            parameter=collocation_batch.inter_correlation_parameter,
            other_parameters=collocation_batch.inter_correlation_additional_parameters,
            base_device=collocation_batch.base_device,
            r2_threshold=collocation_batch.inter_correlation_r2_threshold,
        )
        statistics = compute_statistics(data=data)
        differences = compute_differences(
            statistics=copy.deepcopy(statistics),
            base_device=collocation_batch.base_device,
            devices=collocation_batch.devices,
            parameter=collocation_batch.differences_parameter,
            threshold=collocation_batch.differences_threshold,
        )

        return CollocationBatchResult(
            data_completeness=data_completeness,
            intra_sensor_correlation=intra_sensor_correlation,
            data_source=data_source,
            statistics=statistics,
            inter_sensor_correlation=inter_sensor_correlation,
            differences=differences,
        )

    @staticmethod
    def compute_batch_results_summary(
        collocation_batch: CollocationBatch,
    ) -> list[CollocationBatchResultSummary]:
        if collocation_batch.status == CollocationBatchStatus.SCHEDULED:
            return [
                CollocationBatchResultSummary(
                    device=device, status=CollocationDeviceStatus.SCHEDULED
                )
                for device in collocation_batch.devices
            ]

        if collocation_batch.status == CollocationBatchStatus.RUNNING:
            return [
                CollocationBatchResultSummary(
                    device=device, status=CollocationDeviceStatus.RUNNING
                )
                for device in collocation_batch.devices
            ]

        data_completeness = collocation_batch.results.data_completeness
        intra_sensor_correlation = collocation_batch.results.intra_sensor_correlation
        inter_sensor_correlation = collocation_batch.results.inter_sensor_correlation
        differences = collocation_batch.results.differences

        if len(collocation_batch.devices) > 1:
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
            failed_devices = set(collocation_batch.devices).difference(passed_devices)

        neutral_devices = (
            set(collocation_batch.devices)
            .difference(passed_devices)
            .difference(failed_devices)
        )

        summary: list[CollocationBatchResultSummary] = []
        summary.extend(
            CollocationBatchResultSummary(
                device=device, status=CollocationDeviceStatus.PASSED
            )
            for device in passed_devices
        )
        summary.extend(
            CollocationBatchResultSummary(
                device=device, status=CollocationDeviceStatus.FAILED
            )
            for device in failed_devices
        )
        summary.extend(
            CollocationBatchResultSummary(
                device=device, status=CollocationDeviceStatus.RE_RUN_REQUIRED
            )
            for device in neutral_devices
        )

        return summary

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

    def save_batch(self, batch: CollocationBatch) -> CollocationBatch:
        devices = batch.devices
        start_date = batch.start_date
        end_date = batch.end_date

        count = self.db.collocation.count_documents(
            {
                "devices": {"$all": devices},
                "start_date": {"$eq": start_date},
                "end_date": {"$eq": end_date},
            }
        )

        if count == 0:
            data = batch
            data.summary = self.compute_batch_results_summary(batch)
            self.db.collocation.insert_one(data.to_dict())

        return self.__query_by_devices_and_collocation_dates(
            devices=devices, end_date=end_date, start_date=start_date
        )

    def __update_batch_status(self, data: CollocationBatch):
        data_dict = data.to_dict()
        filter_set = {"_id": ObjectId(data.batch_id)}
        update_set = {"$set": {"status": data_dict["status"]}}
        self.db.collocation.update_one(filter_set, update_set)
        print(f"updated status for batch {data.batch_id} to {data.status.value}")

    def __update_batch_summary(self, data: CollocationBatch):
        data_dict = data.to_dict()
        filter_set = {"_id": ObjectId(data.batch_id)}
        update_set = {"$set": {"summary": data_dict["summary"]}}
        self.db.collocation.update_one(filter_set, update_set)
        print(f"updated summary for batch {data.batch_id}")

    def __query_by_status(
        self, status: CollocationBatchStatus
    ) -> list[CollocationBatch]:
        docs = self.db.collocation.find(
            {
                "status": status.value,
            }
        )

        return docs_to_collocation_data_list(docs)

    def __query_by_devices_and_collocation_dates(
        self, devices: list[str], start_date: datetime, end_date: datetime
    ) -> CollocationBatch:
        doc = self.db.collocation.find_one(
            {
                "devices": {"$all": devices},
                "start_date": {"$eq": start_date},
                "end_date": {"$eq": end_date},
            }
        )

        return doc_to_collocation_data(doc)

    def get_scheduled_batches(self) -> list[CollocationBatch]:
        records = self.__query_by_status(CollocationBatchStatus.SCHEDULED)
        return records

    def get_running_batches(self) -> list[CollocationBatch]:
        records = self.__query_by_status(CollocationBatchStatus.RUNNING)
        return records

    def get_overdue_batches(self) -> list[CollocationBatch]:
        records = self.__query_by_status(CollocationBatchStatus.OVERDUE)
        return records

    def update_scheduled_batches_to_running(self):
        records = self.get_scheduled_batches()
        for record in records:
            if record.is_running():
                record.status = CollocationBatchStatus.RUNNING
                record.summary = self.compute_batch_results_summary(record)
                self.__update_batch_status(record)
                self.__update_batch_summary(record)

    def update_running_batches_to_completed(self):
        records = self.get_running_batches()
        for record in records:
            if record.is_completed():
                record.status = CollocationBatchStatus.COMPLETED
                record.summary = self.compute_batch_results_summary(record)
                self.__update_batch_status(record)
                self.__update_batch_summary(record)

    def update_overdue_batches_to_running(self):
        records = self.get_overdue_batches()
        for record in records:
            record.status = CollocationBatchStatus.RUNNING
            record.summary = self.compute_batch_results_summary(record)
            self.__update_batch_status(record)
            self.__update_batch_summary(record)

    def update_batch_results(
        self, batch_tuple: tuple[str, CollocationBatchResult]
    ) -> CollocationBatch:
        _batch_id, _results = batch_tuple
        filter_set = {"_id": ObjectId(_batch_id)}
        update_set = {"$set": {"results": _results.to_dict()}}
        self.db.collocation.update_one(filter_set, update_set)
        print(f"updated results for batch {_batch_id}")
        return self.__query_by_batch_id(_batch_id)

    def update_batch_summary(
        self, batch_tuple: tuple[str, list[CollocationBatchResultSummary]]
    ):
        _batch_id, _batch_summary = batch_tuple
        _summary = []
        for record in _batch_summary:
            _summary.append(record.to_dict())

        filter_set = {"_id": ObjectId(_batch_id)}
        update_set = {"$set": {"summary": _summary}}
        self.db.collocation.update_one(filter_set, update_set)
        print(f"updated summary for batch {_batch_id}")

    """
    API functions
    """

    def delete_batch(self, batch_id: str, devices: list) -> CollocationBatch:
        if len(devices) == 0:
            self.__delete_by_batch_id(batch_id)
            return None
        else:
            data: CollocationBatch = self.__query_by_batch_id(batch_id)
            remaining_devices = list(set(data.devices).difference(devices))
            if len(remaining_devices) == 0:
                self.__delete_by_batch_id(batch_id)
                return None
            data.devices = remaining_devices
            return self.__reset_batch(data)

    def __reset_batch(self, data: CollocationBatch) -> CollocationBatch:
        reset_batch: CollocationBatch = data

        if reset_batch.is_running() or reset_batch.is_completed():
            reset_batch.status = CollocationBatchStatus.RUNNING
        else:
            reset_batch.status = CollocationBatchStatus.SCHEDULED

        reset_batch.results = CollocationBatchResult.empty_results()
        reset_batch.summary = self.compute_batch_results_summary(reset_batch)
        filter_set = {"_id": ObjectId(reset_batch.batch_id)}
        update_set = {"$set": reset_batch.to_dict()}
        self.db.collocation.update_one(filter_set, update_set)
        reset_batch = self.__query_by_batch_id(reset_batch.batch_id)
        return reset_batch

    def __delete_by_batch_id(self, batch_id: str):
        filter_set = {"_id": ObjectId(batch_id)}
        self.db.collocation.delete_one(filter_set)
        print(f"Deleted {batch_id}")

    def __query_by_batch_id(self, batch_id: str) -> CollocationBatch:
        filter_set = {"_id": ObjectId(batch_id)}
        result = self.db.collocation.find_one(filter_set)
        if result is None:
            raise CollocationBatchNotFound(batch_id=batch_id)
        return doc_to_collocation_data(result)

    def __query_all_batches(self) -> list[CollocationBatch]:
        docs = self.db.collocation.find()
        return docs_to_collocation_data_list(docs)

    def summary(self) -> list[CollocationSummary]:
        batches: list[CollocationBatch] = self.__query_all_batches()
        summary: list[CollocationSummary] = []
        for batch in batches:
            batch_start_date = batch.start_date
            batch_end_date = batch.end_date
            batch_id = batch.batch_id
            date_added = batch.date_created
            created_by = f"{batch.created_by.get('first_name', '')} {batch.created_by.get('last_name', '')}"

            summary.extend(
                CollocationSummary(
                    batch_id=batch_id,
                    device_name=result_summary.device,
                    added_by=created_by,
                    start_date=batch_start_date,
                    end_date=batch_end_date,
                    status=result_summary.status.value,
                    date_added=date_added,
                )
                for result_summary in batch.summary
            )

        return summary

    def get_hourly_data(self, batch_id: str, devices: list) -> dict[str, list[dict]]:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = devices
        raw_data, _ = Collocation.get_data(
            devices=batch_devices,
            start_date_time=batch.start_date,
            end_date_time=batch.end_date,
        )
        hourly_data: dict[str, list[dict]] = {}
        for device, device_data in raw_data.items():
            hourly_device_data = device_data.resample("1H", on="timestamp").mean()
            hourly_device_data = hourly_device_data.replace(np.nan, None)
            hourly_data[device] = hourly_device_data.to_dict("records")

        return hourly_data

    def get_data_completeness(self, batch_id: str, devices: list) -> list:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = devices

        data_completeness = list(
            filter(
                lambda x: x.device_name in batch_devices,
                batch.results.data_completeness.results,
            )
        )
        return [
            {
                "expected_number_of_records": result.expected,
                "start_date": batch.start_date,
                "end_date": batch.end_date,
                "actual_number_of_records": result.actual,
                "completeness": result.completeness,
                "missing": result.missing,
            }
            for result in data_completeness
        ]

    def get_statistics(self, batch_id: str, devices: list) -> list:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = devices

        return list(
            filter(
                lambda x: x["device_name"] in batch_devices, batch.results.statistics
            )
        )

    def get_intra_sensor_correlation(self, batch_id: str, devices: list) -> list:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = devices

        intra_sensor_correlation = list(
            filter(
                lambda x: x.device_name in batch_devices,
                batch.results.intra_sensor_correlation.results,
            )
        )

        return [
            {
                "pm2_5_pearson_correlation": result.pm2_5_pearson,
                "pm10_pearson_correlation": result.pm10_pearson,
                "pm2_5_r2": result.pm2_5_r2,
                "pm10_r2": result.pm10_r2,
            }
            for result in intra_sensor_correlation
        ]


if __name__ == "__main__":
    collocation = Collocation()

    # update statuses
    collocation.update_scheduled_batches_to_running()
    collocation.update_overdue_batches_to_running()

    # get running batches
    x_batches: list[CollocationBatch] = collocation.get_running_batches()

    # compute and save results and summary
    for x_batch in x_batches:
        batch_results = collocation.compute_batch_results(x_batch)
        updated_batch = collocation.update_batch_results(
            (x_batch.batch_id, batch_results)
        )
        batch_summary = collocation.compute_batch_results_summary(updated_batch)
        collocation.update_batch_summary((updated_batch.batch_id, batch_summary))

    # update status for completed batches
    collocation.update_running_batches_to_completed()
