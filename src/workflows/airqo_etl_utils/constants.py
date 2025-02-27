import os
from enum import Enum


class DeviceCategory(Enum):
    """
    LOW_COST -> Reference monitors
    BAM -> Low cost sensors
    GAS -> Gaseous sensors
    WEATHER -> Weather sensors
    GENERAL -> All the sensors
    """

    LOWCOST = 1
    BAM = 2
    GAS = 3
    WEATHER = 4
    GENERAL = 5
    NONE = 20

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self):
        """
        Returns the string representation of the device category.
        Access via instance.str.
        """
        return self.__str__()


class DeviceNetwork(Enum):
    """
    METONE -> Us embassy
    AIRQO -> Airqo
    URBANBETTER -> Urban Better
    IQAIR -> Iqair
    NASA -> (TBD)
    KCCA -> (TBD)
    """

    METONE = 1
    AIRQO = 2
    URBANBETTER = 3
    IQAIR = 4
    NASA = 5
    KCCA = 6

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the device network.

        Usage:
            instance.str
        """
        return self.__str__()


class DataType(Enum):
    """
    RAW -> Raw/unprocessed data.(raw_data table).
    AVERAGED -> Processed(averaged), duplicates dropped.(averaged_data table)
    CONSOLIDATED -> Air quality data merged for both lowcost(hourly) and bam data(hourly), weather data as well as site data.(datawarehouse table)
    """

    RAW = 1
    AVERAGED = 2
    CONSOLIDATED = 3

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the data type.

        Usage:
            instance.str
        """
        return self.__str__()


class MetaDataType(Enum):
    """
    Enumeration representing metadata types.

    Attributes:
        DEVICES: Sensors data.
        SITES: Installation locations and related details.
        AIRQLOUDS: (TBD)
        GRIDS: (TBD)
        COHORTS: (TBD)
    """

    DEVICES = 1
    SITES = 2
    AIRQLOUDS = 3
    GRIDS = 4
    COHORTS = 5

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the metadata type.

        Usage:
            instance.str
        """
        return self.__str__()


class Frequency(Enum):
    """
    RAW -> Raw current data returned from all devices
    RAW-LOW-COST -> Raw data returned from the low-cost devices
    HOURLY -> Aggregated hourly data
    DAILY -> Aggregated daily data
    WEEKLY -> Aggregated weekly data
    MONTHLY -> Aggregated monthly data
    YEARLY -> Aggregated yearly data
    HISTORICAL -> Raw data returned from the devices
    """

    RAW = 0
    RAW_LOW_COST = 1
    HOURLY = 2
    DAILY = 3
    WEEKLY = 4
    MONTHLY = 5
    YEARLY = 6
    HISTORICAL = 7

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the frequency.

        Usage:
            instance.str
        """
        return self.__str__()


class DataSource(Enum):
    THINGSPEAK = 1
    CLARITY = 2
    PLUME_LABS = 3
    AIRNOW = 4
    TAHMO = 5
    AIRQO = 6
    PURPLE_AIR = 7
    BIGQUERY = 8

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the data source.

        Usage:
            instance.str
        """
        return self.__str__()


class QueryType(Enum):
    GET = 1
    DELETE = 2


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

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the Column data type.

        Usage:
            instance.str
        """
        return self.__str__()


class QualityCategorization(Enum):
    GOOD = 1
    MODERATE = 2
    UNHEALTHY_FSGs = 3
    UNHEALTHY = 4
    VERY_UNHEALTHY = 5
    HAZARDOUS = 6

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the QualityCategorization type.

        Usage:
            instance.str
        """
        return self.__str__()


class Pollutant(Enum):
    PM2_5 = 1
    PM10 = 2
    NO2 = 3

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the pollutant.

        Usage:
            instance.str
        """
        return self.__str__()


class CityModels(Enum):
    NAIROBI = "nairobi"
    KAMPALA = "kampala"
    MOMBASA = "mombasa"
    DEFAULT = "default"

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the CityModel.

        Usage:
            instance.str
        """
        return self.__str__()


class CountryModels(Enum):
    KENYA = "kenya"
    UGANDA = "uganda"
    NIGERIA = "nigeria"
    GHANA = "ghana"
    MADAGASCAR = "madagascar"
    DEFAULT = "default"

    def __str__(self) -> str:
        return self.name.lower()

    @property
    def str(self) -> str:
        """
        Returns the string representation of the CountryModels.

        Usage:
            instance.str
        """
        return self.__str__()
