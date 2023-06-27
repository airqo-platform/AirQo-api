from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Union

import pandas as pd
from google.cloud import bigquery
from pymongo import DESCENDING

from app import cache
from config.constants import Config
from config.db_connection import connect_mongo
from helpers.convert_dates import date_to_str


class BaseModel:
    __abstract__ = True

    def __init__(self, tenant, collection_name):
        self.tenant = tenant.lower()
        self.collection_name = collection_name
        self.db = self._connect()
        self.collection = self.db[collection_name]

    def _connect(self):
        return connect_mongo(self.tenant)

    def __repr__(self):
        return f"{self.__class__.__name__}({self.tenant}, {self.collection_name})"


class DeviceStatus(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, "device_status")

    @cache.memoize()
    def get_device_status(self, start_date, end_date, limit):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}

        if limit:
            return list(
                self.collection.find(db_filter).sort("created_at", DESCENDING).limit(1)
            )

        return list(self.collection.find(db_filter).sort("created_at", DESCENDING))


class NetworkUptime(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, "network_uptime")

    @cache.memoize()
    def get_network_uptime(self, start_date, end_date):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}
        return list(
            self.collection.aggregate(
                [
                    {"$match": db_filter},
                    {
                        "$project": {
                            "_id": {"$toString": "$_id"},
                            "created_at": {
                                "$dateToString": {
                                    "date": "$created_at",
                                    "format": "%Y-%m-%dT%H:%M:%S%z",
                                    "timezone": "Africa/Kampala",
                                }
                            },
                            "network_name": 1,
                            "uptime": 1,
                        }
                    },
                ]
            )
        )


class DeviceUptime(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, "device_uptime")

    @cache.memoize()
    def get_uptime_leaderboard(self, start_date, end_date):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}

        return list(
            self.collection.aggregate(
                [
                    {"$match": db_filter},
                    {
                        "$group": {
                            "_id": "$device_name",
                            "device_name": {"$first": "$device_name"},
                            "downtime": {"$avg": "$downtime"},
                            "uptime": {"$avg": "$uptime"},
                        }
                    },
                ]
            )
        )

    @cache.memoize()
    def get_device_uptime(self, start_date, end_date, device_name):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}

        if device_name:
            db_filter["device_name"] = device_name

        return list(
            self.collection.aggregate(
                [
                    {"$match": db_filter},
                    {
                        "$group": {
                            "_id": "$device_name",
                            "values": {
                                "$push": {
                                    "_id": {"$toString": "$_id"},
                                    "battery_voltage": "$battery_voltage",
                                    "channel_id": "$channel_id",
                                    "created_at": {
                                        "$dateToString": {
                                            "date": "$created_at",
                                            "format": "%Y-%m-%dT%H:%M:%S%z",
                                            "timezone": "Africa/Kampala",
                                        }
                                    },
                                    "device_name": "$device_name",
                                    "downtime": "$downtime",
                                    "sensor_one_pm2_5": "$sensor_one_pm2_5",
                                    "sensor_two_pm2_5": "$sensor_two_pm2_5",
                                    "uptime": "$uptime",
                                }
                            },
                        }
                    },
                ]
            )
        )


class DeviceBattery:
    @staticmethod
    @cache.memoize(timeout=1800)
    def get_device_battery(device: str, start_date_time: str, end_date_time: str) -> []:
        client = bigquery.Client()
        cols = [
            "timestamp",
            "device_id as device_name",
            "battery as voltage",
        ]

        data_table = f"`{Config.BIGQUERY_RAW_DATA}`"

        query = (
            f" SELECT {', '.join(cols)}, "
            f" FROM {data_table} "
            f" WHERE {data_table}.timestamp >= '{str(start_date_time)}' "
            f" AND {data_table}.timestamp <= '{str(end_date_time)}' "
            f" AND {data_table}.device_id = '{device}' "
            f" AND {data_table}.battery is not null "
        )

        query = f"select distinct * from ({query})"

        dataframe = client.query(query=query).result().to_dataframe()

        return dataframe.to_dict("records")

    @staticmethod
    def format_device_battery(
        data: list, rounding: Union[int, None], minutes_average: Union[int, None]
    ):
        formatted_data = pd.DataFrame(data)
        if len(formatted_data.index) == 0:
            return data

        if minutes_average:
            data_df = pd.DataFrame(formatted_data)
            formatted_data = pd.DataFrame()

            data_df["timestamp"] = pd.to_datetime(data_df["timestamp"])
            data_df.set_index("timestamp", inplace=True)

            for device_name, group in data_df.groupby("device_name"):
                resampled = group[["voltage"]].resample(f"{minutes_average}Min").mean()
                resampled["device_name"] = device_name
                resampled["timestamp"] = resampled.index
                formatted_data = pd.concat(
                    [formatted_data, resampled], ignore_index=True
                )

        if rounding:
            formatted_data["voltage"] = formatted_data["voltage"].apply(float)
            formatted_data["voltage"] = formatted_data["voltage"].round(rounding)

        formatted_data["timestamp"] = formatted_data["timestamp"].apply(date_to_str)

        return formatted_data.to_dict("records")


class CollocationBatchStatus(Enum):
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"


class CollocationDeviceStatus(Enum):
    ERROR = "ERROR"
    FAILED = "FAILED"
    PASSED = "PASSED"
    RUNNING = "RUNNING"
    SCHEDULED = "SCHEDULED"
    OVERDUE = "OVERDUE"


@dataclass
class DataCompleteness:
    device_name: str
    expected: int
    actual: int
    completeness: float
    missing: float
    passed: bool


@dataclass
class IntraSensorCorrelation:
    device_name: str
    pm2_5_pearson: float
    pm10_pearson: float
    pm2_5_r2: float
    pm10_r2: float
    passed: bool


@dataclass
class BaseResult:
    results: list[dict]
    passed_devices: list[str]
    failed_devices: list[str]
    error_devices: list[str]
    errors: list[str]


@dataclass
class DataCompletenessResult:
    results: list[DataCompleteness]
    passed_devices: list[str]
    failed_devices: list[str]
    error_devices: list[str]
    errors: list[str]


@dataclass
class IntraSensorCorrelationResult:
    results: list[IntraSensorCorrelation]
    passed_devices: list[str]
    failed_devices: list[str]
    error_devices: list[str]
    errors: list[str]


@dataclass
class CollocationBatchResultSummary:
    device: str
    status: CollocationDeviceStatus

    def to_dict(self):
        data = asdict(self)
        data["status"] = self.status.value
        return data


@dataclass
class CollocationBatchResult:
    data_completeness: DataCompletenessResult
    statistics: list
    differences: BaseResult
    intra_sensor_correlation: IntraSensorCorrelationResult
    inter_sensor_correlation: BaseResult
    data_source: str
    errors: list[str]

    def to_dict(self):
        return asdict(self)

    @staticmethod
    def empty_results():
        return CollocationBatchResult(
            data_completeness=DataCompletenessResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            statistics=[],
            differences=BaseResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            intra_sensor_correlation=IntraSensorCorrelationResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            inter_sensor_correlation=BaseResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            data_source="",
            errors=[],
        )


@dataclass
class CollocationBatch:
    batch_id: str
    batch_name: str
    devices: list
    base_device: str

    start_date: datetime
    end_date: datetime
    date_created: datetime

    expected_hourly_records: int
    inter_correlation_threshold: float
    intra_correlation_threshold: float
    inter_correlation_r2_threshold: float
    intra_correlation_r2_threshold: float
    data_completeness_threshold: float
    differences_threshold: int

    data_completeness_parameter: str
    inter_correlation_parameter: str
    intra_correlation_parameter: str
    differences_parameter: str

    inter_correlation_additional_parameters: list[str]

    created_by: dict

    status: CollocationBatchStatus
    results: CollocationBatchResult
    summary: list[CollocationBatchResultSummary]
    errors: list[str]

    def to_dict(self, retain_batch_id=False):
        data = asdict(self)
        if not retain_batch_id:
            del data["batch_id"]
        summary = []
        for record in self.summary:
            summary.append(record.to_dict())
        data["status"] = self.status.value
        data["summary"] = summary
        return data

    def logical_end_date(self) -> datetime:
        return self.end_date + timedelta(minutes=90)

    def summary_to_dict(self) -> dict:
        data = asdict(self)
        del data["batch_id"]
        data["status"] = self.status.value
        return data

    def update_status(self):
        now = datetime.utcnow()
        if (
            now >= self.logical_end_date()
            and self.status != CollocationBatchStatus.COMPLETED
        ):
            self.status = CollocationBatchStatus.OVERDUE
        elif self.start_date > now:
            self.status = CollocationBatchStatus.SCHEDULED
        elif self.logical_end_date() > now >= self.start_date:
            self.status = CollocationBatchStatus.RUNNING
        elif self.logical_end_date() >= now:
            self.status = CollocationBatchStatus.COMPLETED


@dataclass
class IntraSensorData:
    device_name: str
    pm2_5_pearson: float
    pm10_pearson: float
    pm2_5_r2: float
    pm10_r2: float
    passed: bool
    timestamp: datetime

    def to_dict(self):
        return asdict(self)


@dataclass
class CollocationSummary:
    batch_id: str
    batch_name: str
    device_name: str
    added_by: str
    start_date: datetime
    end_date: datetime
    status: str
    date_added: datetime
    errors: list[str]

    def to_dict(self):
        return asdict(self)
