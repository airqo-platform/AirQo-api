import os
from enum import Enum, unique, IntEnum


@unique
class DeviceCategory(IntEnum):
    """
    LOW_COST -> Reference monitors
    BAM -> Low cost sensors
    GAS -> Gaseous sensors
    WEATHER -> Weather sensors
    GENERAL -> All the sensors - low cost, gaseous, weather, reference monitors especially for the consolidated data
    """

    LOWCOST = 1
    BAM = 2
    GAS = 3
    WEATHER = 4
    GENERAL = 5
    MOBILE = 6
    SATELLITE = 7
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


@unique
class DeviceNetwork(IntEnum):
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
    AIRBEAM = 7
    PLUMELABS = 8
    TAHMO = 9
    PURPLEAIR = 10
    NONE = 11

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


@unique
class DataType(IntEnum):
    """
    RAW -> Raw/unprocessed data.(raw_data table).
    AVERAGED -> Processed(averaged), duplicates dropped.(averaged_data table)
    CONSOLIDATED -> Air quality data merged for both lowcost(hourly) and bam data(hourly), weather data as well as site data.(datawarehouse table)
    """

    RAW = 1
    AVERAGED = 2
    CONSOLIDATED = 3
    EXTRAS = 4

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


@unique
class MetaDataType(IntEnum):
    """
    Enumeration representing metadata types.

    Attributes:
        DEVICES: Sensors data.
        SITES: Installation locations and related details.
        AIRQLOUDS: (TBD)
        GRIDS: (TBD)
        COHORTS: (TBD)
        SENSORPOSITIONS: (TBD)
        DATAQUALITYCHECKS: Data quality checks metadata. Can be device or site specific.
    """

    DEVICES = 1
    SITES = 2
    AIRQLOUDS = 3
    GRIDS = 4
    COHORTS = 5
    SENSORPOSITIONS = 6
    DATAQUALITYCHECKS = 7

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


@unique
class Frequency(IntEnum):
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
    WEEKLY = 7  # 7 days in a week //Don't change value
    MONTHLY = 30  # 30 days in a month //Don't change value
    YEARLY = 365  # 365 days in a year //Don't change value
    HISTORICAL = 4
    NONE = 8

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


@unique
class DataSource(IntEnum):
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


@unique
class QueryType(IntEnum):
    GET = 1
    DELETE = 2


@unique
class JobAction(IntEnum):
    APPEND = 1
    OVERWRITE = 2

    def get_name(self):
        if self == self.APPEND:
            return "WRITE_APPEND"
        elif self == self.OVERWRITE:
            return "WRITE_TRUNCATE"
        else:
            return "WRITE_EMPTY"


@unique
class ColumnDataType(IntEnum):
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


@unique
class QualityCategorization(IntEnum):
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


@unique
class Pollutant(IntEnum):
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


@unique
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


@unique
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
