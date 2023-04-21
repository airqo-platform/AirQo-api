from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from pymongo import DESCENDING

from app import cache
from config.db_connection import connect_mongo, connect_mongo_db


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


class MongoBDBaseModel:
    __abstract__ = True

    def __init__(self, collection_name):
        self.collection_name = collection_name
        self.db = connect_mongo_db()
        self.collection = self.db[collection_name]

    def __repr__(self):
        return f"{self.__class__.__name__}({self.collection_name})"


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


class CollocationStatus(Enum):
    SCHEDULED = 1
    RUNNING = 2
    PASSED = 3
    FAILED = 4
    RE_RUN_REQUIRED = 5
    UNKNOWN = 6

    def __str__(self) -> str:
        if self == self.SCHEDULED:
            return "scheduled"
        elif self == self.RUNNING:
            return "running"
        elif self == self.PASSED:
            return "passed"
        elif self == self.FAILED:
            return "failed"
        elif self == self.RE_RUN_REQUIRED:
            return "re-run required"
        elif self == self.UNKNOWN:
            return "unknown"
        else:
            return ""


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
class InterSensorCorrelation:
    results: dict
    passed_devices: list[str]
    failed_devices: list[str]
    neutral_devices: list[str]


@dataclass
class CollocationResult:
    data_completeness: list[DataCompleteness]
    statistics: list
    differences: dict
    intra_sensor_correlation: list[IntraSensorCorrelation]
    inter_sensor_correlation: InterSensorCorrelation
    data_source: str


@dataclass
class CollocationData:
    id: str
    devices: list
    base_device: str

    start_date: datetime
    end_date: datetime
    date_added: datetime

    expected_daily_data_points: int

    expected_hourly_records: int
    inter_correlation_threshold: float
    intra_correlation_threshold: float
    differences_threshold: float

    data_completeness_parameter: str
    inter_correlation_parameter: str
    intra_correlation_parameter: str
    differences_parameter: str
    statistics_parameters: list

    inter_correlation_additional_parameters: list[str]

    added_by: dict
    data_source: str

    status: CollocationStatus
    results: CollocationResult
