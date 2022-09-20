from enum import Enum


class DeviceCategory(Enum):
    """
    LOW_COST -> Reference monitors
    BAM -> Low cost senors
    """

    LOW_COST = 1
    BAM = 2
    NONE = 20

    def __str__(self):
        if self == self.BAM:
            return "bam"
        else:
            return "lowcost"

    @staticmethod
    def from_str(string: str):
        if string.lower() == str(DeviceCategory.BAM):
            return DeviceCategory.BAM
        else:
            return DeviceCategory.LOW_COST


class Frequency(Enum):
    """
    LOW_COST -> Raw data returned from the devices
    HOURLY -> Aggregated hourly data
    DAILY -> Aggregated daily data
    """

    RAW = 1
    HOURLY = 2
    DAILY = 3

    def __str__(self) -> str:
        if self == self.RAW:
            return "raw"
        elif self == self.HOURLY:
            return "hourly"
        elif self == self.DAILY:
            return "daily"
        else:
            return ""


class DataSource(Enum):
    THINGSPEAK = 1
    CLARITY = 2
    PLUME_LABS = 3
    AIRNOW = 4
    TAHMO = 5
    AIRQO = 6
    PURPLE_AIR = 7
    BIGQUERY = 8


class QueryType(Enum):
    GET = 1
    DELETE = 2


class Tenant(Enum):
    NASA = 1
    URBAN_BETTER = 2
    AIRQO = 3
    US_EMBASSY = 4
    KCCA = 5
    ALL = 20

    def __str__(self) -> str:
        if self == self.NASA:
            return "nasa"
        elif self == self.URBAN_BETTER:
            return "urban_better"
        elif self == self.AIRQO:
            return "airqo"
        elif self == self.KCCA:
            return "kcca"
        elif self == self.US_EMBASSY:
            return "us_embassy"
        else:
            return ""


class JobAction(Enum):
    APPEND = 1
    OVERWRITE = 2

    def get_name(self):
        if self == self.APPEND:
            return "WRITE_APPEND"
        elif self == self.OVERWRITE:
            return "WRITE_TRUNCATE"
        else:
            return "WRITE_EMPTY"


class ColumnDataType(Enum):
    TIMESTAMP = 1
    FLOAT = 2
    TIMESTAMP_STR = 3
    STRING = 4
    INTEGER = 5
    NONE = 6

    def __str__(self):
        if self == self.TIMESTAMP:
            return "TIMESTAMP"
        elif self == self.FLOAT:
            return "FLOAT"
        elif self == self.INTEGER:
            return "INTEGER"
        elif self == self.STRING:
            return "STRING"
        elif self == self.TIMESTAMP_STR:
            return "TIMESTAMP_STR"
        else:
            return "NONE"


class AirQuality(Enum):
    GOOD = 1
    MODERATE = 2
    UNHEALTHY_FSGs = 3
    UNHEALTHY = 4
    VERY_UNHEALTHY = 5
    HAZARDOUS = 6

    def __str__(self) -> str:
        if self == self.GOOD:
            return "Good"
        elif self == self.MODERATE:
            return "Moderate"
        if self == self.UNHEALTHY_FSGs:
            return "Unhealthy for Sensitive Groups"
        elif self == self.UNHEALTHY:
            return "Unhealthy"
        if self == self.VERY_UNHEALTHY:
            return "Very Unhealthy"
        elif self == self.HAZARDOUS:
            return "Hazardous"
        else:
            return ""

    def abbr(self) -> str:
        if self == self.GOOD:
            return "GOOD"
        elif self == self.MODERATE:
            return "MODERATE"
        if self == self.UNHEALTHY_FSGs:
            return "UFSGS"
        elif self == self.UNHEALTHY:
            return "UNHEALTHY"
        if self == self.VERY_UNHEALTHY:
            return "VERY_UNHEALTHY"
        elif self == self.HAZARDOUS:
            return "HAZARDOUS"
        else:
            return ""


class Pollutant(Enum):
    PM2_5 = 1
    PM10 = 2
    NO2 = 3

    def __str__(self) -> str:
        if self == self.PM2_5:
            return "pm2.5"
        elif self == self.PM10:
            return "pm10"
        elif self == self.NO2:
            return "no2"
        else:
            return ""


class DataType(Enum):
    UNCLEAN_BAM_DATA = 0
    CLEAN_BAM_DATA = 1
    UNCLEAN_LOW_COST_DATA = 2
    CLEAN_LOW_COST_DATA = 3
    AGGREGATED_LOW_COST_DATA = 3
