from enum import Enum


class Entity(Enum):
    DEVICES = "devices"
    SITES = "sites"

    def __str__(self) -> str:
        return self.value


class DeviceCategory(Enum):
    """
    LOW_COST -> Reference monitors
    BAM -> Low cost sensors
    GAS -> Gaseous sensors
    WEATHER -> Weather sensors
    GENERAL -> All the sensors
    """

    LOWCOST = 0
    BAM = 1
    GAS = 2
    GENERAL = 3

    def __str__(self) -> str:
        return self.value


class DataType(Enum):
    """
    RAW -> Raw/unprocessed data.(raw_data table).
    AVERAGED -> Processed(averaged), duplicates dropped.(averaged_data table)
    CONSOLIDATED -> Air quality data merged for both lowcost(hourly) and bam data(hourly), weather data as well as site data.(datawarehouse table)
    """

    RAW = 0
    AVERAGED = 1
    CALIBRATED = 2
    CONSOLIDATED = 3
    EXTRAS = 4

    def __str__(self) -> str:
        return self.value


class DeviceNetwork(Enum):
    """
    METONE -> Us embassy
    AIRQO -> Airqo
    URBANBETTER -> Urban Better
    IQAIR -> Iqair
    NASA -> (TBD)
    KCCA -> (TBD)
    """

    METONE = "metone"
    AIRQO = "airqo"
    URBANBETTER = "urbanbetter"
    IQAIR = "iqair"

    def __str__(self) -> str:
        return self.value


class Frequency(Enum):
    """
    RAW -> Raw current data returned from all devices
    RAW-LOW-COST -> Raw data returned from the low-cost devices
    HOURLY -> Aggregated hourly data
    DAILY -> Aggregated daily data
    WEEKLY -> Aggregated weekly data
    MONTHLY -> Aggregated monthly data
    YEARLY -> Aggregated yearly data
    """

    RAW = "raw"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

    def __str__(self) -> str:
        return self.value


class DataExportStatus(Enum):
    SCHEDULED = "scheduled"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    NO_DATA = "no_data"

    def __str__(self) -> str:
        return self.value


class ColumnDataType(Enum):
    TIMESTAMP = "timestamp"
    FLOAT = "float"
    STRING = "string"
    INTEGER = "integer"
    NONE = "none"

    def __str__(self) -> str:
        return self.value


class DataExportFormat(Enum):
    JSON = "json"
    CSV = "csv"

    def __str__(self) -> str:
        return self.value


class QueryType(Enum):
    GET = 1
    DELETE = 2
