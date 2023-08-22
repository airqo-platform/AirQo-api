import os

from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from decouple import config as env_var
from flasgger import LazyString

env_path = Path(".") / ".env"
load_dotenv(dotenv_path=env_path, verbose=True)

TWO_HOURS = 7200  # seconds

API_V2_BASE_URL = "/api/v2/analytics"

APP_ENV = env_var("FLASK_ENV", "production")


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = env_var("SECRET_KEY")

    CACHE_TYPE = "RedisCache"
    CACHE_DEFAULT_TIMEOUT = TWO_HOURS
    CACHE_KEY_PREFIX = f"Analytics-{APP_ENV}"
    CACHE_REDIS_HOST = env_var("REDIS_SERVER")
    CACHE_REDIS_PORT = env_var("REDIS_PORT")
    CACHE_REDIS_URL = f"redis://{env_var('REDIS_SERVER')}:{env_var('REDIS_PORT')}"

    BIGQUERY_DEVICES = env_var("BIGQUERY_DEVICES")
    BIGQUERY_SITES = env_var("BIGQUERY_SITES")
    BIGQUERY_AIRQLOUDS_SITES = env_var("BIGQUERY_AIRQLOUDS_SITES")
    BIGQUERY_AIRQLOUDS = env_var("BIGQUERY_AIRQLOUDS")
    DATA_EXPORT_DECIMAL_PLACES = os.getenv("DATA_EXPORT_DECIMAL_PLACES", 2)

    BIGQUERY_RAW_DATA = env_var("BIGQUERY_RAW_DATA")
    BIGQUERY_HOURLY_DATA = env_var("BIGQUERY_HOURLY_DATA")
    BIGQUERY_BAM_DATA = env_var("BIGQUERY_BAM_DATA")
    BIGQUERY_DAILY_DATA = env_var("BIGQUERY_DAILY_DATA")
    DATA_EXPORT_LIMIT = os.getenv("DATA_EXPORT_LIMIT", 2000)
    DATA_SUMMARY_DAYS_INTERVAL = os.getenv("DATA_SUMMARY_DAYS_INTERVAL", 2)

    DEVICES_SUMMARY_TABLE = env_var("DEVICES_SUMMARY_TABLE")

    DATA_EXPORT_BUCKET = env_var("DATA_EXPORT_BUCKET")
    DATA_EXPORT_DATASET = env_var("DATA_EXPORT_DATASET")
    DATA_EXPORT_GCP_PROJECT = env_var("DATA_EXPORT_GCP_PROJECT")
    DATA_EXPORT_COLLECTION = env_var("DATA_EXPORT_COLLECTION", "data_export")

    SWAGGER = {
        "swagger": "2.0",
        "info": {
            "title": "Analytics API",
            "description": "API docs for analytics AirQO microservice",
            "version": "0.0.1",
        },
        "schemes": ["http", "https"],
        "footer_text": LazyString(lambda: f"&copy; AirQo. {datetime.now().year}"),
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


class ProductionConfig(Config):
    DEBUG = False
    MONGO_URI = env_var("MONGO_GCE_URI")
    DB_NAME = env_var("MONGO_PROD")
    BIGQUERY_EVENTS = env_var("BIGQUERY_EVENTS_PROD")
    BIGQUERY_MOBILE_EVENTS = env_var("BIGQUERY_MOBILE_EVENTS_PROD")


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = env_var("MONGO_LOCAL_URI")
    DB_NAME = env_var("MONGO_DEV")
    BIGQUERY_EVENTS = env_var("BIGQUERY_EVENTS_STAGE")
    BIGQUERY_MOBILE_EVENTS = env_var("BIGQUERY_MOBILE_EVENTS_STAGE")


class TestingConfig(Config):
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

print(f"app running - {APP_ENV.upper()} mode")

CONFIGURATIONS = config[APP_ENV]
