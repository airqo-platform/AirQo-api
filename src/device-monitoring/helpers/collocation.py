import copy
import json
import os
import tempfile
import traceback
from datetime import datetime

import numpy as np
import pandas as pd
import pymongo
from bson import ObjectId
from bson.errors import InvalidId
from google.cloud import bigquery

from app import cache
from config.constants import Config
from helpers.collocation_utils import (
    compute_data_completeness,
    compute_intra_sensor_correlation,
    compute_statistics,
    compute_inter_sensor_correlation,
    compute_differences,
    populate_missing_columns,
    map_data_to_api_format,
    compute_hourly_intra_sensor_correlation,
)
from helpers.exceptions import CollocationBatchNotFound
from models import (
    CollocationBatchStatus,
    CollocationBatch,
    CollocationBatchResult,
    CollocationSummary,
    CollocationBatchResultSummary,
    DataCompletenessResult,
    DataCompleteness,
    IntraSensorCorrelationResult,
    IntraSensorCorrelation,
    BaseResult,
    BaseModel,
)


def doc_to_collocation_batch(doc) -> CollocationBatch:
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
        status=CollocationBatchStatus.get_status(doc["status"]),
        results=CollocationBatchResult(
            data_completeness=DataCompletenessResult(
                failed_devices=doc["results"]["data_completeness"]["failed_devices"],
                passed_devices=doc["results"]["data_completeness"]["passed_devices"],
                errors=doc["results"]["data_completeness"].get("errors", []),
                error_devices=doc["results"]["data_completeness"].get(
                    "error_devices", []
                ),
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
                error_devices=doc["results"]["intra_sensor_correlation"].get(
                    "error_devices", []
                ),
                errors=doc["results"]["intra_sensor_correlation"].get("errors", []),
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
                error_devices=doc["results"]["differences"].get("error_devices", []),
                errors=doc["results"]["differences"].get("errors", []),
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
                error_devices=doc["results"]["inter_sensor_correlation"].get(
                    "error_devices", []
                ),
                errors=doc["results"]["inter_sensor_correlation"].get("errors", []),
                results=[
                    dict(record)
                    for record in doc["results"]["inter_sensor_correlation"]["results"]
                ],
            ),
            statistics=doc["results"]["statistics"],
            data_source=doc["results"]["data_source"],
            errors=doc["results"].get("errors", []),
        ),
        errors=doc.get("errors", []),
    )


def docs_to_collocation_batch_list(docs: list) -> list[CollocationBatch]:
    data: list[CollocationBatch] = []
    for doc in docs:
        try:
            doc_data = doc_to_collocation_batch(doc)
            data.append(doc_data)
        except Exception as ex:
            print("error")
            print(ex)
            traceback.print_exc()

    return data


class Collocation(BaseModel):
    def __init__(
        self,
    ):
        super().__init__("airqo", "collocation")

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
        errors = []
        errors.extend(inter_sensor_correlation.errors)
        errors.extend(differences.errors)
        errors.extend(intra_sensor_correlation.errors)
        errors.extend(data_completeness.errors)

        return CollocationBatchResult(
            data_completeness=data_completeness,
            intra_sensor_correlation=intra_sensor_correlation,
            data_source=data_source,
            statistics=statistics,
            inter_sensor_correlation=inter_sensor_correlation,
            differences=differences,
            errors=errors,
        )

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

        count = self.collection.count_documents(
            {
                "devices": {"$all": devices},
                "start_date": {"$eq": start_date},
                "end_date": {"$eq": end_date},
            }
        )

        if count == 0:
            self.collection.insert_one(batch.to_dict())

        return self.__query_by_devices_and_collocation_dates(
            devices=devices, end_date=end_date, start_date=start_date
        )

    def export_collection(self) -> str:
        docs = self.collection.find()
        data = []
        for doc in docs:
            data.append({**doc, **{"_id": str(doc["_id"])}})

        json_data = json.dumps(data, default=str)
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, "collocation_collection.json")
        with open(file_path, "w") as file:
            file.write(json_data)

        return file_path

    def __update_batch_status(self, data: CollocationBatch) -> CollocationBatch:
        data_dict = data.to_dict()
        filter_set = {"_id": ObjectId(data.batch_id)}
        update_set = {"$set": {"status": data_dict["status"]}}
        self.collection.update_one(filter_set, update_set)
        print(f"updated status for batch {data.batch_id} to {data.status.value}")
        return self.__query_by_batch_id(data.batch_id)

    def __update_batch_summary(self, data: CollocationBatch):
        data_dict = data.to_dict()
        filter_set = {"_id": ObjectId(data.batch_id)}
        update_set = {"$set": {"summary": data_dict["summary"]}}
        self.collection.update_one(filter_set, update_set)
        print(f"updated summary for batch {data.batch_id}")

    def __query_by_status(
        self, status: CollocationBatchStatus
    ) -> list[CollocationBatch]:
        docs = self.collection.find({"status": {"$eq": status.value}})

        return docs_to_collocation_batch_list(docs)

    def __query_incomplete_batches(self) -> list[CollocationBatch]:
        docs = self.collection.find(
            {"status": {"$ne": CollocationBatchStatus.COMPLETED.value}}
        )
        return docs_to_collocation_batch_list(docs)

    def __query_by_devices_and_collocation_dates(
        self, devices: list[str], start_date: datetime, end_date: datetime
    ) -> CollocationBatch:
        doc = self.collection.find_one(
            {
                "devices": {"$all": devices},
                "start_date": {"$eq": start_date},
                "end_date": {"$eq": end_date},
            }
        )

        return doc_to_collocation_batch(doc)

    def get_running_batches(self) -> list[CollocationBatch]:
        records = self.__query_by_status(CollocationBatchStatus.RUNNING)
        return records

    def update_batches_statues(self):
        incomplete_batches = self.__query_incomplete_batches()

        for batch in incomplete_batches:
            batch.set_status()
            self.__update_batch_status(batch)

    def compute_and_update_results(self, batches: list[CollocationBatch]):
        for batch in batches:
            results = self.compute_batch_results(batch)
            self.__update_batch_results((batch.batch_id, results))

    def __update_batch_results(
        self, batch_tuple: tuple[str, CollocationBatchResult]
    ) -> CollocationBatch:
        _batch_id, _results = batch_tuple
        filter_set = {"_id": ObjectId(_batch_id)}
        update_set = {"$set": {"results": _results.to_dict()}}
        self.collection.update_one(filter_set, update_set)
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
        self.collection.update_one(filter_set, update_set)
        print(f"updated summary for batch {_batch_id}")

    """
    API functions
    """

    def get_batch(self, batch_id: str) -> CollocationBatch:
        return self.__query_by_batch_id(batch_id)

    def delete_batch(self, batch_id: str, devices: list) -> CollocationBatch:
        if len(devices) == 0:
            self.__delete_by_batch_id(batch_id)
        else:
            data: CollocationBatch = self.__query_by_batch_id(batch_id)
            remaining_devices = list(set(data.devices).difference(devices))
            if len(remaining_devices) == 0:
                self.__delete_by_batch_id(batch_id)
            data.devices = remaining_devices
            return self.reset_batch(data)

    def reset_batch(self, data: CollocationBatch) -> CollocationBatch:
        reset_batch: CollocationBatch = data
        reset_batch.results = CollocationBatchResult.empty_results()
        reset_batch.set_status()

        filter_set = {"_id": ObjectId(reset_batch.batch_id)}
        update_set = {"$set": reset_batch.to_dict()}
        self.collection.update_one(filter_set, update_set)
        reset_batch = self.__query_by_batch_id(reset_batch.batch_id)
        return reset_batch

    def __delete_by_batch_id(self, batch_id: str):
        try:
            filter_set = {"_id": ObjectId(batch_id)}
        except InvalidId:
            raise CollocationBatchNotFound(batch_id=batch_id)

        self.collection.delete_one(filter_set)
        print(f"Deleted {batch_id}")

    def __query_by_batch_id(self, batch_id: str) -> CollocationBatch:
        try:
            filter_set = {"_id": {"$eq": ObjectId(batch_id)}}
        except InvalidId:
            raise CollocationBatchNotFound(batch_id=batch_id)
        result = self.collection.find_one(filter_set)
        if result is None:
            raise CollocationBatchNotFound(batch_id=batch_id)
        return doc_to_collocation_batch(result)

    def __query_all_batches(self) -> list[CollocationBatch]:
        docs = self.collection.find().sort("date_created", pymongo.DESCENDING)
        return docs_to_collocation_batch_list(docs)

    def summary(self) -> list[CollocationSummary]:
        batches: list[CollocationBatch] = self.__query_all_batches()
        summary: list[CollocationSummary] = []
        for batch in batches:
            created_by = f"{batch.created_by.get('first_name', '')} {batch.created_by.get('last_name', '')}"
            summary.extend(
                CollocationSummary(
                    batch_id=batch.batch_id,
                    device_name=result_summary.device,
                    added_by=created_by,
                    start_date=batch.start_date,
                    end_date=batch.end_date,
                    status=result_summary.status.value,
                    date_added=batch.date_created,
                    batch_name=batch.batch_name,
                    errors=batch.results.errors,
                )
                for result_summary in batch.get_summary()
            )

        return summary

    def get_hourly_data(self, batch_id: str, devices: list) -> list[dict]:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = batch.devices
        raw_data, _ = Collocation.get_data(
            devices=batch_devices,
            start_date_time=batch.start_date,
            end_date_time=batch.end_date,
        )
        hourly_data: pd.DataFrame = pd.DataFrame()

        for device, device_data in raw_data.items():
            if len(device_data.index) == 0:
                continue
            hourly_device_data = device_data.resample("1H", on="timestamp").mean(
                numeric_only=True
            )
            hourly_device_data["timestamp"] = hourly_device_data.index
            hourly_device_data["device_name"] = device
            hourly_device_data.reset_index(drop=True, inplace=True)
            hourly_data = pd.concat(
                [hourly_data, hourly_device_data], ignore_index=True
            )

        if len(hourly_data.index) == 0:
            return []

        timestamps = set(hourly_data["timestamp"].to_list())
        devices = set(list(hourly_data["device_name"].to_list()))
        data_columns = list(
            set(hourly_data.columns.to_list()).difference(["timestamp", "device_name"])
        )
        data: list[dict] = []

        for timestamp in timestamps:
            row_data = {"timestamp": str(timestamp)}
            timestamp_data = hourly_data[hourly_data["timestamp"] == timestamp]
            for device in devices:
                device_data = pd.DataFrame(
                    timestamp_data[timestamp_data["device_name"] == device]
                )
                if len(device_data.index) == 0:
                    device_data = pd.DataFrame(columns=data_columns)
                    device_data.loc[0] = [None] * len(data_columns)
                    device_data.reset_index(drop=True, inplace=True)

                device_data.replace(np.nan, None, inplace=True)
                row_data[device] = device_data[data_columns].to_dict("records")[0]

            data.append(row_data)

        return data

    def get_results(self, batch_id: str) -> CollocationBatchResult:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        return batch.results

    def get_data_completeness(self, batch_id: str, devices: list) -> dict[str, dict]:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)

        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = batch.devices

        data_completeness = list(
            filter(
                lambda x: x.device_name in batch_devices,
                batch.results.data_completeness.results,
            )
        )
        data = [
            {
                "expected_number_of_records": result.expected,
                "start_date": batch.start_date,
                "end_date": batch.end_date,
                "actual_number_of_records": result.actual,
                "device_name": result.device_name,
                "completeness": result.completeness,
                "missing": result.missing,
                "errors": batch.errors,
            }
            for result in data_completeness
        ]

        return map_data_to_api_format(data)

    def get_statistics(self, batch_id: str, devices: list) -> dict[str, dict]:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = batch.devices

        statistics = list(
            filter(
                lambda x: x["device_name"] in batch_devices, batch.results.statistics
            )
        )

        return map_data_to_api_format(statistics)

    def get_intra_sensor_correlation(
        self, batch_id: str, devices: list
    ) -> dict[str, dict]:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = batch.devices

        intra_sensor_correlation = list(
            filter(
                lambda x: x.device_name in batch_devices,
                batch.results.intra_sensor_correlation.results,
            )
        )

        data = [
            {
                "pm2_5_pearson_correlation": result.pm2_5_pearson,
                "pm10_pearson_correlation": result.pm10_pearson,
                "pm2_5_r2": result.pm2_5_r2,
                "pm10_r2": result.pm10_r2,
                "device_name": result.device_name,
            }
            for result in intra_sensor_correlation
        ]

        return map_data_to_api_format(data)

    def get_hourly_intra_sensor_correlation(
        self, batch_id: str, devices: list
    ) -> list[dict]:
        batch: CollocationBatch = self.__query_by_batch_id(batch_id=batch_id)
        if len(devices) != 0:
            batch_devices = list(set(batch.devices).intersection(set(devices)))
        else:
            batch_devices = batch.devices

        raw_data, _ = Collocation.get_data(
            devices=batch_devices,
            start_date_time=batch.start_date,
            end_date_time=batch.end_date,
        )
        data = compute_hourly_intra_sensor_correlation(
            raw_data=raw_data,
            devices=batch_devices,
            threshold=batch.intra_correlation_threshold,
            parameter=batch.intra_correlation_parameter,
            r2_threshold=batch.intra_correlation_r2_threshold,
        )
        return data


if __name__ == "__main__":
    collocation = Collocation()
    collocation.update_batches_statues()
    x_running_batches: list[CollocationBatch] = collocation.get_running_batches()
    collocation.compute_and_update_results(x_running_batches)
    collocation.update_batches_statues()
