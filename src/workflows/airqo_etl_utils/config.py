import os
from pathlib import Path

from .constants import (
    DataType,
    MetaDataType,
    DeviceCategory,
    DeviceNetwork,
    Frequency,
    QualityCategorization,
    Pollutant,
)
import pymongo as pm
import tweepy
import urllib3
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

urllib3.disable_warnings()


class Config:
    # TODO
    # -----------------------------------------------
    # Top level settings
    # -----------------------------------------------
    # DataBase
    # Create default database configs
    # Transport Backend configs
    # Data streaming configs
    # Data quality tests configs
    # -----------------------------------------------

    CPU_COUNT = os.cpu_count() or 2
    MAX_WORKERS = min(20, CPU_COUNT * 10)
    SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key")
    # Kcca
    CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
    CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")

    # Thingspeak
    THINGSPEAK_API_KEY = os.getenv("THINGSPEAK_API_KEY")
    THINGSPEAK_CHANNEL_URL = os.getenv("THINGSPEAK_CHANNEL_URL")

    # Aggregated data
    BIGQUERY_HOURLY_EVENTS_TABLE = os.getenv("BIGQUERY_HOURLY_EVENTS_TABLE")
    BIGQUERY_HOURLY_UNCALIBRATED_EVENTS_TABLE = os.getenv(
        "BIGQUERY_HOURLY_UNCALIBRATED_EVENTS_TABLE"
    )
    BIGQUERY_HOURLY_EVENTS_TABLE_PROD = os.getenv("BIGQUERY_PROD_HOURLY_EVENTS_TABLE")
    BIGQUERY_DAILY_EVENTS_TABLE = os.getenv("BIGQUERY_DAILY_EVENTS_TABLE")
    BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE = os.getenv(
        "BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE"
    )
    BIGQUERY_DAILY_FORECAST_EVENTS_TABLE = os.getenv(
        "BIGQUERY_DAILY_FORECAST_EVENTS_TABLE"
    )
    BIGQUERY_HOURLY_WEATHER_TABLE = os.getenv("BIGQUERY_HOURLY_WEATHER_TABLE")
    BIGQUERY_OPENWEATHERMAP_TABLE = os.getenv("BIGQUERY_OPENWEATHERMAP_TABLE")
    BIGQUERY_ANALYTICS_TABLE = os.getenv("BIGQUERY_ANALYTICS_TABLE")
    BIGQUERY_SATELLITE_DATA_TABLE = os.getenv("BIGQUERY_SATELLITE_DATA_TABLE")
    BIGQUERY_AIRQO_MOBILE_EVENTS_AVERAGED_TABLE = os.getenv(
        "BIGQUERY_AIRQO_MOBILE_EVENTS_AVERAGED_TABLE"
    )

    # Bam data
    BIGQUERY_RAW_BAM_DATA_TABLE = os.getenv("BIGQUERY_RAW_BAM_DATA_TABLE")
    BIGQUERY_HOURLY_BAM_EVENTS_TABLE = os.getenv("BIGQUERY_BAM_EVENTS_TABLE")

    # Raw data
    BIGQUERY_AIRQO_MOBILE_EVENTS_RAW_TABLE = os.getenv(
        "BIGQUERY_AIRQO_MOBILE_EVENTS_RAW_TABLE"
    )
    BIGQUERY_RAW_EVENTS_TABLE = os.getenv("BIGQUERY_RAW_EVENTS_TABLE")
    BIGQUERY_SATELLITE_COPERNICUS_RAW_EVENTS_TABLE = os.getenv(
        "BIGQUERY_SATELLITE_COPERNICUS_RAW_EVENTS_TABLE"
    )
    BIGQUERY_LATEST_EVENTS_TABLE = os.getenv("BIGQUERY_LATEST_EVENTS_TABLE")
    BIGQUERY_CLEAN_RAW_MOBILE_EVENTS_TABLE = os.getenv(
        "BIGQUERY_CLEAN_RAW_MOBILE_EVENTS_TABLE"
    )
    BIGQUERY_UNCLEAN_RAW_MOBILE_EVENTS_TABLE = os.getenv(
        "BIGQUERY_UNCLEAN_RAW_MOBILE_EVENTS_TABLE"
    )
    BIGQUERY_DEVICES_SUMMARY_TABLE = os.getenv("BIGQUERY_DEVICES_SUMMARY_TABLE")
    BIGQUERY_RAW_WEATHER_TABLE = os.getenv("BIGQUERY_RAW_WEATHER_TABLE")
    SENSOR_POSITIONS_TABLE = os.getenv("SENSOR_POSITIONS_TABLE")

    # Meta data
    BIGQUERY_DEVICES_TABLE = os.getenv("BIGQUERY_DEVICES_TABLE")
    BIGQUERY_DEVICES_DEVICES_TABLE = os.getenv("BIGQUERY_DEVICES_DEVICES_TABLE")
    BIGQUERY_DEVICES_DATA_TABLE = os.getenv("BIGQUERY_DEVICES_DATA_TABLE")
    BIGQUERY_SITES_TABLE = os.getenv("BIGQUERY_SITES_TABLE")
    BIGQUERY_SITES_SITES_TABLE = os.getenv("BIGQUERY_SITES_SITES_TABLE")
    BIGQUERY_SITES_META_DATA_TABLE = os.getenv("BIGQUERY_SITES_META_DATA_TABLE")
    BIGQUERY_AIRQLOUDS_TABLE = os.getenv("BIGQUERY_AIRQLOUDS_TABLE")
    BIGQUERY_AIRQLOUDS_SITES_TABLE = os.getenv("BIGQUERY_AIRQLOUDS_SITES_TABLE")
    BIGQUERY_GRIDS_TABLE = os.getenv("BIGQUERY_GRIDS_TABLE")
    BIGQUERY_COHORTS_TABLE = os.getenv("BIGQUERY_COHORTS_TABLE")
    BIGQUERY_GRIDS_SITES_TABLE = os.getenv("BIGQUERY_GRIDS_SITES_TABLE")
    BIGQUERY_COHORTS_DEVICES_TABLE = os.getenv("BIGQUERY_COHORTS_DEVICES_TABLE")

    # Data Checks
    BIGQUERY_GX_RESULTS_TABLE = os.getenv("BIGQUERY_GX_RESULTS_TABLE")
    BIGQUERY_GX_MEASUREMENTS_BASELINE = os.getenv("BIGQUERY_GX_MEASUREMENTS_BASELINE")
    BIGQUERY_GX_DEVICE_COMPUTED_METADATA = os.getenv(
        "BIGQUERY_GX_DEVICE_COMPUTED_METADATA"
    )
    BIGQUERY_GX_SITE_COMPUTED_METADATA = os.getenv("BIGQUERY_GX_SITE_COMPUTED_METADATA")

    # AirQo
    POST_EVENTS_BODY_SIZE = os.getenv("POST_EVENTS_BODY_SIZE", 10)
    POST_WEATHER_BODY_SIZE = os.getenv("POST_EVENTS_BODY_SIZE", 10)
    CALIBRATION_BASE_URL = os.getenv("CALIBRATION_BASE_URL")
    AIRQO_BASE_URL_V2 = os.getenv("AIRQO_BASE_URL_V2")
    AIRQO_API_KEY = os.getenv("AIRQO_API_KEY")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_CLOUD_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    AIRQO_API_TOKEN = os.getenv("AIRQO_API_TOKEN")

    # Tahmo
    TAHMO_BASE_URL = os.getenv("TAHMO_API_BASE_URL")
    TAHMO_API_MAX_PERIOD = os.getenv("TAHMO_API_MAX_PERIOD")
    TAHMO_API_KEY = os.getenv("TAHMO_API_CREDENTIALS_USERNAME")
    TAHMO_API_SECRET = os.getenv("TAHMO_API_CREDENTIALS_PASSWORD")

    # OpenWeather
    OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
    OPENWEATHER_BASE_URL = os.getenv("OPENWEATHER_BASE_URL")
    OPENWEATHER_DATA_BATCH_SIZE = os.getenv("OPENWEATHER_DATA_BATCH_SIZE")
    # Kafka
    BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS", "localhost:9092")
    TOPIC_PARTITIONS = os.getenv("TOPIC_PARTITIONS", "0,1,2").split(",")
    SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL")

    # Kafka Topics
    WEATHER_MEASUREMENTS_TOPIC = os.getenv("WEATHER_MEASUREMENTS_TOPIC")
    INSIGHTS_MEASUREMENTS_TOPIC = os.getenv("INSIGHTS_MEASUREMENTS_TOPIC")
    HOURLY_MEASUREMENTS_TOPIC = os.getenv("HOURLY_MEASUREMENTS_TOPIC")
    BAM_MEASUREMENTS_TOPIC = os.getenv("BAM_MEASUREMENTS_TOPIC")
    DEVICES_TOPIC = os.getenv("DEVICES_TOPIC")
    CALIBRATED_HOURLY_MEASUREMENTS_TOPIC = os.getenv(
        "CALIBRATED_HOURLY_MEASUREMENTS_TOPIC"
    )
    AVERAGED_HOURLY_MEASUREMENTS_TOPIC = os.getenv("AVERAGED_HOURLY_MEASUREMENTS_TOPIC")

    # Airnow
    AIRNOW_BASE_URL = os.getenv("AIRNOW_BASE_URL")
    AIRNOW_API_KEY = os.getenv("AIRNOW_API_KEY")

    # US Embassy
    US_EMBASSY_API_KEY = os.getenv("US_EMBASSY_API_KEY")

    # FIREBASE
    FIREBASE_AIR_QUALITY_READINGS_COLLECTION = os.getenv(
        "FIREBASE_AIR_QUALITY_READINGS_COLLECTION"
    )
    APP_USERS_DATABASE = os.getenv("APP_USERS_DATABASE")
    FIREBASE_USERS_COLLECTION = os.getenv("FIREBASE_USERS_COLLECTION")
    APP_NOTIFICATION_TEMPLATES_DATABASE = os.getenv(
        "APP_NOTIFICATION_TEMPLATES_DATABASE"
    )
    FIREBASE_TYPE = os.getenv("FIREBASE_TYPE")
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
    FIREBASE_PRIVATE_KEY_ID = os.getenv("FIREBASE_PRIVATE_KEY_ID")
    FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY")
    FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")
    FIREBASE_CLIENT_ID = os.getenv("FIREBASE_CLIENT_ID")
    FIREBASE_AUTH_URI = os.getenv("FIREBASE_AUTH_URI")
    FIREBASE_TOKEN_URI = os.getenv("FIREBASE_TOKEN_URI")
    FIREBASE_AUTH_PROVIDER_X509_CERT_URL = os.getenv(
        "FIREBASE_AUTH_PROVIDER_X509_CERT_URL"
    )
    FIREBASE_CLIENT_X509_CERT_URL = os.getenv("FIREBASE_CLIENT_X509_CERT_URL")
    FIREBASE_UNIVERSE_DOMAIN = os.getenv("FIREBASE_UNIVERSE_DOMAIN")
    FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL")

    # Plume labs
    PLUME_LABS_BASE_URL = os.getenv("PLUME_LABS_BASE_URL")
    PLUME_LABS_ORGANISATIONS_CRED = os.getenv("PLUME_LABS_ORGANISATIONS_CRED")

    # Air Beam
    AIR_BEAM_USERNAMES = os.getenv("AIR_BEAM_USERNAMES")
    AIR_BEAM_BASE_URL = os.getenv("AIR_BEAM_BASE_URL")

    # Purple Air
    PURPLE_AIR_BASE_URL = os.getenv("PURPLE_AIR_BASE_URL")
    PURPLE_AIR_API_KEY = os.getenv("PURPLE_AIR_API_KEY")

    # Integrations:
    INTEGRATION_DETAILS = {
        "airqo": {
            "url": AIRQO_BASE_URL_V2,
            "auth": {"Authorization": f"JWT {AIRQO_API_KEY}"},
            "secret": {"token": AIRQO_API_TOKEN},
            "endpoints": {},
        },
        "metone": {
            "url": AIRNOW_BASE_URL,
            "auth": {"API_KEY": US_EMBASSY_API_KEY},
            "endpoints": {"get_data": "/aq/data"},
            "extras": {
                "boundary_box": "-16.9530804676,-33.957634112,54.8058474018,37.2697926495",
                "parameters": "pm25,pm10,ozone,co,no2,so2",
            },
        },
        "plumelabs": {
            "url": PLUME_LABS_BASE_URL,
        },
        "airbeam": {"url": AIR_BEAM_BASE_URL},
        "tahmo": {
            "url": TAHMO_BASE_URL,
            "auth": {"api_key": TAHMO_API_KEY},
            "secret": {"secret": TAHMO_API_SECRET},
            "endpoints": {},
        },
        "openweather": {
            "url": OPENWEATHER_BASE_URL,
            "auth": {"appid": OPENWEATHER_API_KEY},
            "endpoints": {},
        },
    }

    # ---------------------------------------------------------------------
    # Mapping
    # ----------------------------------------------------------------------
    # AirQuality Categories
    AIR_QUALITY_CATEGORY = {
        Pollutant.PM10: [
            (55, QualityCategorization.GOOD),
            (155, QualityCategorization.MODERATE),
            (255, QualityCategorization.UNHEALTHY_FSGs),
            (355, QualityCategorization.UNHEALTHY),
            (425, QualityCategorization.VERY_UNHEALTHY),
            (float("inf"), QualityCategorization.HAZARDOUS),
        ],
        Pollutant.PM2_5: [
            (12.1, QualityCategorization.GOOD),
            (35.5, QualityCategorization.MODERATE),
            (55.5, QualityCategorization.UNHEALTHY_FSGs),
            (150.5, QualityCategorization.UNHEALTHY),
            (250.5, QualityCategorization.VERY_UNHEALTHY),
            (float("inf"), QualityCategorization.HAZARDOUS),
        ],
        Pollutant.NO2: [
            (54, QualityCategorization.GOOD),
            (101, QualityCategorization.MODERATE),
            (361, QualityCategorization.UNHEALTHY_FSGs),
        ],
    }

    AIRQO_BAM_MAPPING_NEW = {
        "field8": {
            0: "timestamp",
            1: "realtime_conc",
            2: "hourly_conc",
            3: "short_time_conc",
            4: "air_flow",
            5: "wind_speed",
            6: "wind_direction",
            7: "temperature",
            8: "humidity",
            9: "barometric_pressure",
            10: "filter_temperature",
            11: "filter_humidity",
            12: "status",
        },
    }

    AIRQO_BAM_MAPPING = {"hourly_conc": "pm2_5", "air_flow": "airflow"}

    AIRQO_LOW_COST_GAS_FIELD_MAPPING = {
        "field1": "pm2_5",
        "field2": "tvoc",
        "field3": "hcho",
        "field4": "co2",
        "field5": "intaketemperature",
        "field6": "intakehumidity",
        "field7": "battery",
        "created_at": "timestamp",
        "field8": {
            0: "latitude",
            1: "longitude",
            2: "altitude",
            3: "wind_speed",  # For mobile devices (Velocity)
            4: "satellites",  # Number of satelites tracked
            5: "hdop",  # For mobile devices
            6: "device_temperature",  # Internal
            7: "device_humidity",  # Internal
            8: "temperature",  # Internal
            9: "humidity",
            10: "vapor_pressure",
        },
    }

    AIRQO_LOW_COST_FIELD_MAPPING = {
        "field1": "s1_pm2_5",
        "field2": "s1_pm10",
        "field3": "s2_pm2_5",
        "field4": "s2_pm10",
        "field7": "battery",
        "created_at": "timestamp",
        "field8": {
            0: "latitude",
            1: "longitude",
            2: "altitude",
            3: "wind_speed",  # For mobile devices (Velocity)
            4: "satellites",  # Number of satelites tracked
            5: "hdop",  # For mobile devices
            6: "device_temperature",  # Internal
            7: "device_humidity",  # Internal
            8: "temperature",  # Internal
            9: "humidity",
            10: "vapor_pressure",
        },
    }
    URBANBETTER_LOW_COST_FIELD_MAPPING = {
        "pollutants.no2.value": "no2",
        "pollutants.voc.value": "voc",
        "pollutants.pm25.value": "pm2_5",
        "pollutants.pm10.value": "pm10",
        "pollutants.pm1.value": "pm1",
        "pollutants.no2.pi": "no2_pi",
        "pollutants.voc.pi": "voc_pi",
        "pollutants.pm25.pi": "pm2_5_pi",
        "pollutants.pm10.pi": "pm10_pi",
        "pollutants.pm1.pi": "pm1_pi",
        "date": "timestamp",
    }

    IQAIR_LOW_COST_FIELD_MAPPING = {
        "pm25": {"key": "pm2_5", "value": "conc"},
        "pm10": {"key": "pm10", "value": "conc"},
        "pm1": {"key": "pm1", "value": "conc"},
        "pr": "pressure",
        "hm": "humidity",
        "tp": "temperature",
        "ts": "timestamp",
    }

    AIRBEAM_BAM_FIELD_MAPPING = {"pm2.5": "pm2_5", "pm10": "pm10", "no2": "no2"}

    DATA_RESOLUTION_MAPPING = {
        "iqair": {"hourly": "instant", "raw": "instant", "current": "current"}
    }

    AIRQO_DATA_COLUMN_NAME_MAPPING = {
        "pm2_5": "pm2_5",
        "s1_pm2_5": "pm2_5",
        "s2_pm2_5": "pm2_5",
        "pm2_5_pi": "pm2_5",
        "pm2_5_raw_value": "pm2_5",
        "pm2_5_calibrated_value": "pm2_5",
        "pm10": "pm10",
        "s1_pm10": "pm10",
        "s2_pm10": "pm10",
        "pm10_pi": "pm10",
        "pm10_raw_value": "pm10",
        "pm10_calibrated_value": "pm10",
        "device_humidity": "humidity",
        "humidity": "humidity",
        "device_temperature": "temperature",
        "temperature": "temperature",
        "no2": "no2",
        "no2_raw_value": "no2",
        "no2_calibrated_value": "no2",
        "pm1": "pm1",
        "pm1_raw_value": "pm1",
        "pm1_pi": "pm1",
    }

    VALID_SENSOR_RANGES = {
        "pm2_5": (0, 1000),
        "pm10": (0, 1000),
        "pm2_5_calibrated_value": (0, 1000),
        "pm2_5_raw_value": (0, 1000),
        "pm10_calibrated_value": (0, 1000),
        "pm10_raw_value": (0, 1000),
        "latitude": (-90, 90),
        "longitude": (-180, 180),
        "battery": (2.7, 5),
        "no2": (0, 2049),
        "no2_calibrated_value": (0, 2049),
        "no2_raw_value": (0, 2049),
        "altitude": (0, float("inf")),
        "hdop": (0, float("inf")),
        "satellites": (1, 50),
        "temperature": (0, 45),
        "humidity": (0, 99),
        "pressure": (30, 110),
        "tvoc": (0, 10),
        "co2": (400, 3000),
        "hcho": (0, float("inf")),
        "intaketemperature": (0, 45),
        "intakehumidity": (0, 99),
    }

    device_config_mapping = {
        "bam": {
            "field_8_cols": list(AIRQO_BAM_MAPPING_NEW.get("field8", {}).values()),
            "mapping": {
                "airqo": AIRQO_BAM_MAPPING_NEW,
                "airbeam": AIRBEAM_BAM_FIELD_MAPPING,
                "metone": AIRBEAM_BAM_FIELD_MAPPING,
            },
            "other_fields_cols": [],
        },
        "gas": {
            "field_8_cols": list(
                AIRQO_LOW_COST_GAS_FIELD_MAPPING.get("field8", {}).values()
            ),
            "mapping": {"airqo": AIRQO_LOW_COST_GAS_FIELD_MAPPING},
            "other_fields_cols": [
                "pm2_5",
                "tvoc",
                "hcho",
                "co2",
                "intaketemperature",
                "intakehumidity",
                "battery",
            ],
        },
        "lowcost": {
            "field_8_cols": list(
                AIRQO_LOW_COST_FIELD_MAPPING.get("field8", {}).values()
            ),
            "mapping": {
                "airqo": AIRQO_LOW_COST_FIELD_MAPPING,
                "iqair": IQAIR_LOW_COST_FIELD_MAPPING,
            },
            "other_fields_cols": [
                "s1_pm2_5",
                "s1_pm10",
                "s2_pm2_5",
                "s2_pm10",
                "battery",
            ],
        },
        "mobile": {
            "field_8_cols": list(
                AIRQO_LOW_COST_FIELD_MAPPING.get("field8", {}).values()
            ),
            "mapping": {
                "airqo": AIRQO_LOW_COST_FIELD_MAPPING,
            },
            "other_fields_cols": [
                "s1_pm2_5",
                "s1_pm10",
                "s2_pm2_5",
                "s2_pm10",
                "battery",
            ],
        },
    }

    # Schema files mapping
    SCHEMA_FILE_MAPPING = {
        BIGQUERY_HOURLY_EVENTS_TABLE: "measurements.json",
        BIGQUERY_HOURLY_UNCALIBRATED_EVENTS_TABLE: "measurements.json",
        BIGQUERY_DAILY_EVENTS_TABLE: "measurements.json",
        BIGQUERY_RAW_EVENTS_TABLE: "raw_measurements.json",
        BIGQUERY_HOURLY_WEATHER_TABLE: "weather_data.json",
        BIGQUERY_RAW_WEATHER_TABLE: "weather_data.json",
        BIGQUERY_LATEST_EVENTS_TABLE: "latest_measurements.json",
        BIGQUERY_ANALYTICS_TABLE: "data_warehouse.json",
        BIGQUERY_AIRQLOUDS_TABLE: "airqlouds.json",
        BIGQUERY_AIRQLOUDS_SITES_TABLE: "airqlouds_sites.json",
        BIGQUERY_GRIDS_TABLE: "grids.json",
        BIGQUERY_COHORTS_TABLE: "cohorts.json",
        BIGQUERY_GRIDS_SITES_TABLE: "grids_sites.json",
        BIGQUERY_COHORTS_DEVICES_TABLE: "cohorts_devices.json",
        BIGQUERY_SITES_TABLE: "sites.json",
        BIGQUERY_SITES_SITES_TABLE: "sites.json",
        BIGQUERY_SITES_META_DATA_TABLE: "sites_meta_data.json",
        SENSOR_POSITIONS_TABLE: "sensor_positions.json",
        BIGQUERY_DEVICES_TABLE: "devices.json",
        BIGQUERY_DEVICES_DEVICES_TABLE: "devices.json",
        BIGQUERY_CLEAN_RAW_MOBILE_EVENTS_TABLE: "mobile_measurements.json",
        BIGQUERY_UNCLEAN_RAW_MOBILE_EVENTS_TABLE: "mobile_measurements.json",
        BIGQUERY_AIRQO_MOBILE_EVENTS_AVERAGED_TABLE: "airqo_mobile_measurements.json",
        BIGQUERY_AIRQO_MOBILE_EVENTS_RAW_TABLE: "airqo_mobile_measurements.json",
        BIGQUERY_HOURLY_BAM_EVENTS_TABLE: "bam_measurements.json",
        BIGQUERY_RAW_BAM_DATA_TABLE: "bam_raw_measurements.json",
        BIGQUERY_DAILY_FORECAST_EVENTS_TABLE: "daily_24_hourly_forecasts.json",
        BIGQUERY_OPENWEATHERMAP_TABLE: "openweathermap_hourly_data.json",
        BIGQUERY_SATELLITE_COPERNICUS_RAW_EVENTS_TABLE: "satelite_airquality_data_copernicus_temp.json",
        BIGQUERY_GX_RESULTS_TABLE: "airqo_data_quality_checks.json",
        BIGQUERY_GX_MEASUREMENTS_BASELINE: "measurements_baseline.json",
        BIGQUERY_GX_DEVICE_COMPUTED_METADATA: "device_computed_metadata.json",
        BIGQUERY_GX_SITE_COMPUTED_METADATA: "site_computed_metadata.json",
        "all": None,
    }
    DataSource = {
        DataType.RAW: {
            DeviceCategory.GENERAL: {
                Frequency.RAW: BIGQUERY_RAW_EVENTS_TABLE,
            },
            DeviceCategory.SATELLITE: {
                Frequency.RAW: BIGQUERY_SATELLITE_COPERNICUS_RAW_EVENTS_TABLE,
            },
            DeviceCategory.MOBILE: {
                Frequency.RAW: BIGQUERY_AIRQO_MOBILE_EVENTS_RAW_TABLE,
                Frequency.NONE: BIGQUERY_UNCLEAN_RAW_MOBILE_EVENTS_TABLE,
            },
            DeviceCategory.BAM: {Frequency.RAW: BIGQUERY_RAW_BAM_DATA_TABLE},
            DeviceCategory.WEATHER: {Frequency.RAW: BIGQUERY_RAW_WEATHER_TABLE},
        },
        DataType.AVERAGED: {
            DeviceCategory.GENERAL: {
                Frequency.RAW: BIGQUERY_HOURLY_UNCALIBRATED_EVENTS_TABLE,
                Frequency.HOURLY: BIGQUERY_HOURLY_EVENTS_TABLE,
                Frequency.DAILY: BIGQUERY_DAILY_EVENTS_TABLE,
            },
            DeviceCategory.MOBILE: {
                Frequency.HOURLY: BIGQUERY_AIRQO_MOBILE_EVENTS_AVERAGED_TABLE,
            },
            DeviceCategory.BAM: {Frequency.HOURLY: BIGQUERY_HOURLY_BAM_EVENTS_TABLE},
            DeviceCategory.WEATHER: {Frequency.HOURLY: BIGQUERY_HOURLY_WEATHER_TABLE},
        },
        DataType.CONSOLIDATED: {
            DeviceCategory.GENERAL: {
                Frequency.HOURLY: BIGQUERY_ANALYTICS_TABLE,
            }
        },
        # TODO Expand usage
        DataType.EXTRAS: {
            DeviceNetwork.URBANBETTER: {
                MetaDataType.SENSORPOSITIONS: SENSOR_POSITIONS_TABLE
            },
            DeviceNetwork.AIRQO: {
                MetaDataType.DEVICES: BIGQUERY_GX_DEVICE_COMPUTED_METADATA,
                MetaDataType.SITES: BIGQUERY_GX_SITE_COMPUTED_METADATA,
                MetaDataType.DATAQUALITYCHECKS: BIGQUERY_GX_MEASUREMENTS_BASELINE,
            },
        },
    }
    extra_time_grouping = {"weekly", "monthly", "yearly"}

    COMMON_POLLUTANT_MAPPING = {
        "bam": {
            "raw": {
                "pm2_5": ["realtime_conc", "hourly_conc", "short_time_conc"],
            },
            "averaged": {"pm2_5": ["pm2_5"]},
        },
        "lowcost": {
            "raw": {
                "pm2_5": ["s1_pm2_5", "s2_pm2_5"],
                # "pm10": ["s1_pm10", "s2_pm10"],
            },
            "averaged": {
                "pm2_5": ["pm2_5_calibrated_value"],
            },
        },
        "mobile": {
            "raw": {
                "pm2_5": ["s1_pm2_5", "s2_pm2_5"],
                # "pm10": ["s1_pm10", "s2_pm10"],
            }
        },
    }

    MetaDataStore = {
        MetaDataType.DEVICES: BIGQUERY_DEVICES_TABLE,
        MetaDataType.SITES: BIGQUERY_SITES_TABLE,
        MetaDataType.AIRQLOUDS: BIGQUERY_AIRQLOUDS_TABLE,
        MetaDataType.GRIDS: BIGQUERY_GRIDS_TABLE,
        MetaDataType.COHORTS: BIGQUERY_COHORTS_TABLE,
        MetaDataType.SENSORPOSITIONS: SENSOR_POSITIONS_TABLE,
        MetaDataType.DATAQUALITYCHECKS: {
            MetaDataType.DEVICES: BIGQUERY_GX_DEVICE_COMPUTED_METADATA,
            MetaDataType.SITES: BIGQUERY_GX_SITE_COMPUTED_METADATA,
        },
    }

    AIRFLOW_XCOM_BUCKET = os.getenv("AIRFLOW_XCOM_BUCKET")
    FIREBASE_STORAGE_BUCKET_NAME = os.getenv("FIREBASE_STORAGE_BUCKET_NAME")

    # -------------------------------------------------------
    # Satelite constants
    # -------------------------------------------------------
    # TODO: May need to remove when no. of locations grow
    satellite_cities = [
        # NOTE: Syntax is lon, lat for GEE, not the usual lat, lon
        {"city": "kampala", "coords": [32.6313083, 0.336219]},
        {"city": "nairobi", "coords": [36.886487, -1.243396]},
        {"city": "lagos", "coords": [3.39936, 6.53257]},
        {"city": "accra", "coords": [-0.205874, 5.614818]},
        {"city": "bujumbura", "coords": [29.3599, 3.3614]},
        {"city": "yaounde", "coords": [11.5202, 3.8617]},
        {"city": "kisumu", "coords": [34.7680, 0.0917]},
    ]
    satellite_collections = {
        "COPERNICUS/S5P/OFFL/L3_SO2": [
            "SO2_column_number_density",
            "SO2_column_number_density_amf",
            "SO2_slant_column_number_density",
            "absorbing_aerosol_index",
            "cloud_fraction",
            "sensor_azimuth_angle",
            "sensor_zenith_angle",
            "solar_azimuth_angle",
            "solar_zenith_angle",
            "SO2_column_number_density_15km",
        ],
        "COPERNICUS/S5P/OFFL/L3_CO": [
            "CO_column_number_density",
            "H2O_column_number_density",
            "cloud_height",
            "sensor_altitude",
            "sensor_azimuth_angle",
            "sensor_zenith_angle",
            "solar_azimuth_angle",
            "solar_zenith_angle",
        ],
        "COPERNICUS/S5P/OFFL/L3_NO2": [
            "NO2_column_number_density",
            "tropospheric_NO2_column_number_density",
            "stratospheric_NO2_column_number_density",
            "NO2_slant_column_number_density",
            "tropopause_pressure",
            "absorbing_aerosol_index",
            "cloud_fraction",
            "sensor_altitude",
            "sensor_azimuth_angle",
            "sensor_zenith_angle",
            "solar_azimuth_angle",
            "solar_zenith_angle",
        ],
        "COPERNICUS/S5P/OFFL/L3_HCHO": [
            "tropospheric_HCHO_column_number_density",
            "tropospheric_HCHO_column_number_density_amf",
            "HCHO_slant_column_number_density",
            "cloud_fraction",
            "solar_zenith_angle",
            "solar_azimuth_angle",
            "sensor_zenith_angle",
            "sensor_azimuth_angle",
        ],
        "COPERNICUS/S5P/OFFL/L3_O3": [
            "O3_column_number_density",
            "O3_effective_temperature",
            "cloud_fraction",
            "sensor_azimuth_angle",
            "sensor_zenith_angle",
            "solar_azimuth_angle",
            "solar_zenith_angle",
        ],
        "COPERNICUS/S5P/OFFL/L3_AER_AI": [
            "absorbing_aerosol_index",
            "sensor_altitude",
            "sensor_azimuth_angle",
            "sensor_zenith_angle",
            "solar_azimuth_angle",
            "solar_zenith_angle",
        ],
        "COPERNICUS/S5P/OFFL/L3_CH4": [
            "CH4_column_volume_mixing_ratio_dry_air",
            "aerosol_height",
            "aerosol_optical_depth",
            "sensor_zenith_angle",
            "sensor_azimuth_angle",
            "solar_azimuth_angle",
            "solar_zenith_angle",
        ],
        "COPERNICUS/S5P/OFFL/L3_CLOUD": [
            "cloud_fraction",
            "cloud_top_pressure",
            "cloud_top_height",
            "cloud_base_pressure",
            "cloud_base_height",
            "cloud_optical_depth",
            "surface_albedo",
            "sensor_azimuth_angle",
            "sensor_zenith_angle",
            "solar_azimuth_angle",
            "solar_zenith_angle",
        ],
    }
    # -------------------------------------------------------
    # Attachment constants
    # -------------------------------------------------------
    IMAGE_DIR = os.path.join(os.path.dirname(__file__), "images")
    ATTACHMENTS = {
        "EMAIL_ATTACHMENTS": [
            {
                "filename": "favoriteIcon.png",
                "path": os.path.join(IMAGE_DIR, "favoriteIcon.png"),
                "cid": "FavoriteIcon",
                "contentDisposition": "inline",
            },
            {
                "filename": "airqoLogoAlternate.png",
                "path": os.path.join(IMAGE_DIR, "airqoLogoAlternate.png"),
                "cid": "AirQoEmailLogoAlternate",
                "contentDisposition": "inline",
            },
            {
                "filename": "faceBookLogo.png",
                "path": os.path.join(IMAGE_DIR, "facebookLogo.png"),
                "cid": "FacebookLogo",
                "contentDisposition": "inline",
            },
            {
                "filename": "youtubeLogo.png",
                "path": os.path.join(IMAGE_DIR, "youtubeLogo.png"),
                "cid": "YoutubeLogo",
                "contentDisposition": "inline",
            },
            {
                "filename": "twitterLogo.png",
                "path": os.path.join(IMAGE_DIR, "Twitter.png"),
                "cid": "Twitter",
                "contentDisposition": "inline",
            },
            {
                "filename": "linkedInLogo.png",
                "path": os.path.join(IMAGE_DIR, "linkedInLogo.png"),
                "cid": "LinkedInLogo",
                "contentDisposition": "inline",
            },
        ],
        "EMOJI_ATTACHMENTS": [
            {
                "filename": "goodEmoji.png",
                "path": os.path.join(IMAGE_DIR, "goodEmoji.png"),
                "cid": "goodEmoji",
            },
            {
                "filename": "moderateEmoji.png",
                "path": os.path.join(IMAGE_DIR, "moderateEmoji.png"),
                "cid": "moderateEmoji",
            },
            {
                "filename": "uhfsgEmoji.png",
                "path": os.path.join(IMAGE_DIR, "uhfsgEmoji.png"),
                "cid": "uhfsgEmoji",
            },
            {
                "filename": "unhealthyEmoji.png",
                "path": os.path.join(IMAGE_DIR, "unhealthyEmoji.png"),
                "cid": "unhealthyEmoji",
            },
            {
                "filename": "veryUnhealthyEmoji.png",
                "path": os.path.join(IMAGE_DIR, "veryUnhealthyEmoji.png"),
                "cid": "veryUnhealthyEmoji",
            },
            {
                "filename": "hazardousEmoji.png",
                "path": os.path.join(IMAGE_DIR, "hazardousEmoji.png"),
                "cid": "hazardousEmoji",
            },
        ],
    }
    # ---------------------------------------------------
    # Data unit tests
    # ---------------------------------------------------
    BUCKET_NAME_AIRQO = os.getenv("BUCKET_NAME")
    FILE_PATH_AIRQO = os.getenv("FILE_PATH_AIRQO")

    # Forecast job
    HOURLY_FORECAST_TRAINING_JOB_SCOPE = os.getenv("HOURLY_FORECAST_TRAINING_JOB_SCOPE")
    DAILY_FORECAST_TRAINING_JOB_SCOPE = os.getenv("DAILY_FORECAST_TRAINING_JOB_SCOPE")
    HOURLY_FORECAST_PREDICTION_JOB_SCOPE = os.getenv(
        "HOURLY_FORECAST_PREDICTION_JOB_SCOPE"
    )
    DAILY_FORECAST_PREDICTION_JOB_SCOPE = os.getenv(
        "DAILY_FORECAST_PREDICTION_JOB_SCOPE"
    )
    HOURLY_FORECAST_HORIZON = os.getenv("HOURLY_FORECAST_HORIZON")
    DAILY_FORECAST_HORIZON = os.getenv("DAILY_FORECAST_HORIZON")
    SATELLITE_TRAINING_SCOPE = os.getenv("SATELLITE_TRAINING_SCOPE")
    MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI")
    FORECAST_MODELS_BUCKET = os.getenv("FORECAST_MODELS_BUCKET")
    MONGO_URI = os.getenv("MONGO_URI")
    MONGO_DATABASE_NAME = os.getenv("MONGO_DATABASE_NAME", "airqo_db")
    ENVIRONMENT = os.getenv("ENVIRONMENT")
    CALIBRATEBY = os.getenv("CALIBRATEBY", "country")

    # Twitter bot
    TWITTER_BOT_API_KEY = os.getenv("TWITTER_BOT_API_KEY")
    TWITTER_BOT_API_KEY_SECRET = os.getenv("TWITTER_BOT_API_KEY_SECRET")
    TWITTER_BOT_BEARER_TOKEN = os.getenv("TWITTER_BOT_BEARER_TOKEN")
    TWITTER_BOT_ACCESS_TOKEN = os.getenv("TWITTER_BOT_ACCESS_TOKEN")
    TWITTER_BOT_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_BOT_ACCESS_TOKEN_SECRET")

    # Email
    MAIL_USER = os.getenv("MAIL_USER")
    MAIL_PASS = os.getenv("MAIL_PASS")

    def unsubscribe_url(self, email, user_id):
        print(os.getenv("UNSUBSCRIBE_URL"))
        return f"{os.getenv('UNSUBSCRIBE_URL')}?email={email}&user_id={user_id}"


configuration = Config()

# MONGO_DB
client = pm.MongoClient(configuration.MONGO_URI)
db = client[configuration.MONGO_DATABASE_NAME]

# Twitter
twitter_client = tweepy.Client(
    bearer_token=configuration.TWITTER_BOT_BEARER_TOKEN,
    access_token=configuration.TWITTER_BOT_ACCESS_TOKEN,
    access_token_secret=configuration.TWITTER_BOT_ACCESS_TOKEN_SECRET,
    consumer_key=configuration.TWITTER_BOT_API_KEY,
    consumer_secret=configuration.TWITTER_BOT_API_KEY_SECRET,
)
twitter_auth = tweepy.OAuthHandler(
    access_token=configuration.TWITTER_BOT_ACCESS_TOKEN,
    access_token_secret=configuration.TWITTER_BOT_ACCESS_TOKEN_SECRET,
    consumer_key=configuration.TWITTER_BOT_API_KEY,
    consumer_secret=configuration.TWITTER_BOT_API_KEY_SECRET,
)
