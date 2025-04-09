import os

from datetime import datetime
from pathlib import Path
from decouple import config as env_var
from flasgger import LazyString
from constants import DataType, DeviceCategory, Frequency

TWO_HOURS = 7200  # seconds

API_V2_BASE_URL = "/api/v2/analytics"

APP_ENV = env_var("FLASK_ENV", "production")


class BaseConfig:
    """Base configuration shared across all environments."""

    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = env_var("SECRET_KEY")

    # Cache
    CACHE_TYPE = "RedisCache"
    CACHE_DEFAULT_TIMEOUT = TWO_HOURS
    CACHE_KEY_PREFIX = f"Analytics-{APP_ENV}"
    CACHE_REDIS_HOST = env_var("REDIS_SERVER")
    CACHE_REDIS_PORT = env_var("REDIS_PORT")
    CACHE_REDIS_URL = f"redis://{CACHE_REDIS_HOST}:{CACHE_REDIS_PORT}"

    # External APIs
    AIRQO_API_BASE_URL = env_var("AIRQO_API_BASE_URL")
    AIRQO_API_TOKEN = env_var("AIRQO_API_TOKEN")
    GRID_URL = env_var("GRID_URL_ID")

    # Export
    DATA_EXPORT_DECIMAL_PLACES = env_var("DATA_EXPORT_DECIMAL_PLACES", 2)
    DATA_EXPORT_LIMIT = env_var("DATA_EXPORT_LIMIT", 2000)
    DATA_SUMMARY_DAYS_INTERVAL = env_var("DATA_SUMMARY_DAYS_INTERVAL", 2)
    DATA_EXPORT_BUCKET = env_var("DATA_EXPORT_BUCKET")
    DATA_EXPORT_DATASET = env_var("DATA_EXPORT_DATASET")
    DATA_EXPORT_GCP_PROJECT = env_var("DATA_EXPORT_GCP_PROJECT")
    DATA_EXPORT_COLLECTION = env_var("DATA_EXPORT_COLLECTION", "data_export")

    # Data tables
    BIGQUERY_RAW_DATA = env_var("BIGQUERY_RAW_DATA")
    BIGQUERY_HOURLY_DATA = env_var("BIGQUERY_HOURLY_DATA")
    BIGQUERY_DAILY_DATA = env_var("BIGQUERY_DAILY_DATA")
    BIGQUERY_RAW_BAM_DATA_TABLE = env_var("BIGQUERY_RAW_BAM_DATA_TABLE")
    BIGQUERY_BAM_DATA = env_var("BIGQUERY_BAM_DATA")
    BIGQUERY_HOURLY_CONSOLIDATED = env_var("BIGQUERY_HOURLY_CONSOLIDATED")

    # Meta-Data
    BIGQUERY_DEVICES_DEVICES = env_var("BIGQUERY_DEVICES_DEVICES")
    BIGQUERY_SITES_SITES = env_var("BIGQUERY_SITES_SITES")
    BIGQUERY_AIRQLOUDS_SITES = env_var("BIGQUERY_AIRQLOUDS_SITES")
    BIGQUERY_AIRQLOUDS = env_var("BIGQUERY_AIRQLOUDS")
    BIGQUERY_GRIDS_SITES = env_var("BIGQUERY_GRIDS_SITES")
    BIGQUERY_GRIDS = env_var("BIGQUERY_GRIDS")
    BIGQUERY_COHORTS_DEVICES = env_var("BIGQUERY_COHORTS_DEVICES")
    BIGQUERY_COHORTS = env_var("BIGQUERY_COHORTS")
    DEVICES_SUMMARY_TABLE = env_var("DEVICES_SUMMARY_TABLE")

    # Data sources
    @classmethod
    def data_sources(cls):
        return {
            DataType.RAW: {
                DeviceCategory.LOWCOST: {
                    Frequency.RAW: cls.BIGQUERY_RAW_DATA,
                    Frequency.HOURLY: cls.BIGQUERY_HOURLY_DATA,  # For the use case of hourly raw data
                },
                DeviceCategory.BAM: {Frequency.RAW: cls.BIGQUERY_RAW_BAM_DATA_TABLE},
            },
            # Added as a repetition - Accomodates the frontend request parameters as is. Can be cleanup better.
            DataType.CALIBRATED: {
                DeviceCategory.LOWCOST: {
                    Frequency.HOURLY: cls.BIGQUERY_HOURLY_DATA,
                    Frequency.DAILY: cls.BIGQUERY_DAILY_DATA,
                },
            },
            DataType.AVERAGED: {
                DeviceCategory.GENERAL: {
                    Frequency.HOURLY: cls.BIGQUERY_HOURLY_DATA,
                    Frequency.DAILY: cls.BIGQUERY_DAILY_DATA,
                },
                DeviceCategory.BAM: {Frequency.HOURLY: cls.BIGQUERY_BAM_DATA},
            },
            DataType.CONSOLIDATED: {
                DeviceCategory.GENERAL: {
                    Frequency.HOURLY: cls.BIGQUERY_HOURLY_CONSOLIDATED,
                },
            },
        }

    # Schema files mapping
    SCHEMA_FILE_MAPPING = {
        BIGQUERY_HOURLY_DATA: "measurements.json",
        BIGQUERY_DAILY_DATA: "measurements.json",
        BIGQUERY_RAW_DATA: "raw_measurements.json",
        BIGQUERY_HOURLY_CONSOLIDATED: "data_warehouse.json",
        BIGQUERY_BAM_DATA: "bam_measurements.json",
        BIGQUERY_RAW_BAM_DATA_TABLE: "bam_raw_measurements.json",
        "all": None,
    }

    SWAGGER = {
        "swagger": "2.0",
        "info": {
            "title": "Analytics API",
            "description": "API docs for analytics AIRQO microservice",
            "version": "0.0.1",
        },
        "schemes": ["http", "https"],
        "footer_text": LazyString(lambda: f"&copy; AIRQO. {datetime.now().year}"),
        "head_text": "<style>.top_text{color: red;}</style>",
        "doc_expansion": "list",
        "ui_params": {
            "apisSorter": "alpha",
            "operationsSorter": "alpha",
        },
        "ui_params_text": """{
            "operationsSorter" : (a, b) => a.get("path").localeCompare(b.get("path"))
        }""",
        "url_prefix": f"{API_V2_BASE_URL}",
    }


class ProductionConfig(BaseConfig):
    """Production environment settings."""

    MONGO_URI = env_var("MONGO_GCE_URI")
    DB_NAME = env_var("MONGO_PROD")
    BIGQUERY_EVENTS = env_var("BIGQUERY_EVENTS_PROD")
    BIGQUERY_MOBILE_EVENTS = env_var("BIGQUERY_MOBILE_EVENTS_PROD")


class DevelopmentConfig(BaseConfig):
    """Development environment settings."""

    DEBUG = True
    DEVELOPMENT = True
    MONGO_URI = env_var("MONGO_LOCAL_URI")
    DB_NAME = env_var("MONGO_DEV")
    BIGQUERY_EVENTS = env_var("BIGQUERY_EVENTS_STAGE")
    BIGQUERY_MOBILE_EVENTS = env_var("BIGQUERY_MOBILE_EVENTS_STAGE")


class TestingConfig(BaseConfig):
    """Testing / Staging environment settings."""

    TESTING = True
    DEBUG = True
    MONGO_URI = env_var("MONGO_GCE_URI")
    DB_NAME = env_var("MONGO_STAGE")
    BIGQUERY_EVENTS = env_var("BIGQUERY_EVENTS_STAGE")
    BIGQUERY_MOBILE_EVENTS = env_var("BIGQUERY_MOBILE_EVENTS_STAGE")


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "staging": TestingConfig,
    "production": ProductionConfig,
}

print(f"App running in {APP_ENV.upper()} mode")

CONFIGURATIONS = config[APP_ENV]
