import os
from pathlib import Path

import pymongo as pm
import urllib3
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

urllib3.disable_warnings()


class Config:
    # Kcca
    CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
    CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")

    # Thingspeak
    THINGSPEAK_API_KEY = os.getenv("THINGSPEAK_API_KEY")
    THINGSPEAK_CHANNEL_URL = os.getenv("THINGSPEAK_CHANNEL_URL")

    # Aggregated data
    BIGQUERY_HOURLY_EVENTS_TABLE = os.getenv("BIGQUERY_HOURLY_EVENTS_TABLE")
    BIGQUERY_HOURLY_EVENTS_TABLE_PROD = os.getenv("BIGQUERY_PROD_HOURLY_EVENTS_TABLE")
    BIGQUERY_DAILY_EVENTS_TABLE = os.getenv("BIGQUERY_DAILY_EVENTS_TABLE")
    BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE = os.getenv(
        "BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE"
    )
    BIGQUERY_DAILY_FORECAST_EVENTS_TABLE = os.getenv(
        "BIGQUERY_DAILY_FORECAST_EVENTS_TABLE"
    )
    BIGQUERY_HOURLY_WEATHER_TABLE = os.getenv("BIGQUERY_HOURLY_WEATHER_TABLE")
    BIGQUERY_ANALYTICS_TABLE = os.getenv("BIGQUERY_ANALYTICS_TABLE")

    # Bam data
    BIGQUERY_RAW_BAM_DATA_TABLE = os.getenv("BIGQUERY_RAW_BAM_DATA_TABLE")
    BIGQUERY_BAM_EVENTS_TABLE = os.getenv("BIGQUERY_BAM_EVENTS_TABLE")

    # Raw data
    BIGQUERY_AIRQO_MOBILE_EVENTS_TABLE = os.getenv("BIGQUERY_AIRQO_MOBILE_EVENTS_TABLE")
    BIGQUERY_RAW_EVENTS_TABLE = os.getenv("BIGQUERY_RAW_EVENTS_TABLE")
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
    BIGQUERY_DEVICES_DATA_TABLE = os.getenv("BIGQUERY_DEVICES_DATA_TABLE")
    BIGQUERY_SITES_TABLE = os.getenv("BIGQUERY_SITES_TABLE")
    BIGQUERY_SITES_META_DATA_TABLE = os.getenv("BIGQUERY_SITES_META_DATA_TABLE")
    BIGQUERY_AIRQLOUDS_TABLE = os.getenv("BIGQUERY_AIRQLOUDS_TABLE")
    BIGQUERY_AIRQLOUDS_SITES_TABLE = os.getenv("BIGQUERY_AIRQLOUDS_SITES_TABLE")

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

    # Kafka
    BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS", "localhost:9092").split(",")
    TOPIC_PARTITIONS = os.getenv("TOPIC_PARTITIONS", "1,2,3,4").split(",")
    SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL")

    # Kafka Topics
    WEATHER_MEASUREMENTS_TOPIC = os.getenv("WEATHER_MEASUREMENTS_TOPIC")
    INSIGHTS_MEASUREMENTS_TOPIC = os.getenv("INSIGHTS_MEASUREMENTS_TOPIC")
    HOURLY_MEASUREMENTS_TOPIC = os.getenv("HOURLY_MEASUREMENTS_TOPIC")
    BAM_MEASUREMENTS_TOPIC = os.getenv("BAM_MEASUREMENTS_TOPIC")

    # Airnow
    AIRNOW_BASE_URL = os.getenv("AIRNOW_BASE_URL")
    AIRNOW_API_KEY = os.getenv("AIRNOW_API_KEY")
    AIRNOW_COUNTRIES_METADATA_JSON_FILE = os.getenv(
        "AIRNOW_COUNTRIES_METADATA_JSON_FILE"
    )

    # US Embassy
    US_EMBASSY_API_KEY = os.getenv("US_EMBASSY_API_KEY")

    # FIREBASE
    FIREBASE_AIR_QUALITY_READINGS_COLLECTION = os.getenv(
        "FIREBASE_AIR_QUALITY_READINGS_COLLECTION"
    )
    APP_USERS_DATABASE = os.getenv("APP_USERS_DATABASE")
    APP_NOTIFICATION_TEMPLATES_DATABASE = os.getenv(
        "APP_NOTIFICATION_TEMPLATES_DATABASE"
    )

    # Plume labs
    PLUME_LABS_BASE_URL = os.getenv("PLUME_LABS_BASE_URL")
    PLUME_LABS_ORGANISATIONS_CRED = os.getenv("PLUME_LABS_ORGANISATIONS_CRED")

    # Air Beam
    AIR_BEAM_USERNAMES = os.getenv("AIR_BEAM_USERNAMES")
    AIR_BEAM_BASE_URL = os.getenv("AIR_BEAM_BASE_URL")

    # Purple Air
    PURPLE_AIR_BASE_URL = os.getenv("PURPLE_AIR_BASE_URL")
    PURPLE_AIR_API_KEY = os.getenv("PURPLE_AIR_API_KEY")

    AIRQO_BAM_CONFIG = {
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
    }

    AIRQO_BAM_MAPPING = {
        "hourly_conc": "pm2_5",
    }

    AIRQO_LOW_COST_CONFIG = {
        0: "latitude",
        1: "longitude",
        2: "altitude",
        3: "wind_speed",
        4: "satellites",
        5: "hdop",
        6: "device_temperature",
        7: "device_humidity",
        8: "temperature",
        9: "humidity",
        10: "vapor_pressure",
    }

    # Data unit tests
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
    MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI")
    FORECAST_MODELS_BUCKET = os.getenv("FORECAST_MODELS_BUCKET")
    MONGO_URI = os.getenv("MONGO_URI")
    MONGO_DATABASE_NAME = os.getenv("MONGO_DATABASE_NAME", 'airqo_DB')
    ENVIRONMENT = os.getenv("ENVIRONMENT")


configuration = Config()

client = pm.MongoClient(configuration.MONGO_URI)
db = client[configuration.MONGO_DATABASE_NAME]
