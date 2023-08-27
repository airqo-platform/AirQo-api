import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

print("Environment", os.getenv("FLASK_ENV"))

THIRTY_MINUTES = 1800  # seconds

TWO_HOURS = 7200  # seconds


class CollocationDefaults:
    DataCompletenessThreshold = os.getenv("DATA_COMPLETENESS_THRESHOLD", 80)

    IntraCorrelationThreshold = os.getenv("INTRA_CORRELATION_THRESHOLD", 0.98)
    IntraCorrelationR2Threshold = os.getenv("INTRA_CORRELATION_R2_THRESHOLD", 0.99)

    InterCorrelationThreshold = os.getenv("INTER_CORRELATION_THRESHOLD", 0.98)
    InterCorrelationR2Threshold = os.getenv("INTER_CORRELATION_R2_THRESHOLD", 0.99)

    DifferencesThreshold = os.getenv("DIFFERENCES_THRESHOLD", 5)

    InterCorrelationParameter = os.getenv("INTER_CORRELATION_PARAMETER", "pm2_5")
    IntraCorrelationParameter = os.getenv("INTRA_CORRELATION_PARAMETER", "pm2_5")
    DataCompletenessParameter = os.getenv("DATA_COMPLETENESS_PARAMETER", "timestamp")
    DifferencesParameter = os.getenv("DIFFERENCES_PARAMETER", "pm2_5")
    InterCorrelationAdditionalParameters = os.getenv(
        "INTER_CORRELATION_ADDITIONAL_PARAMETERS", ["pm10"]
    )

    ExpectedRecordsPerHour = os.getenv("EXPECTED_RECORDS_PER_HOUR", 30)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True

    CACHE_TYPE = "RedisCache"
    CACHE_DEFAULT_TIMEOUT = THIRTY_MINUTES
    CACHE_KEY_PREFIX = "device-monitoring"
    CACHE_REDIS_URL = os.getenv("REDIS_URL_PROD")
    REDIS_URL = os.getenv("REDIS_URL")

    SECRET_KEY = os.getenv("SECRET_KEY")

    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv("MONGO_GCE_URI")

    BIGQUERY_AIRQLOUDS_SITES = os.getenv("BIGQUERY_AIRQLOUDS_SITES")
    BIGQUERY_AIRQLOUDS = os.getenv("BIGQUERY_AIRQLOUDS")
    BIGQUERY_RAW_DATA = os.getenv("BIGQUERY_RAW_DATA")
    BIGQUERY_DEVICES = os.getenv("BIGQUERY_DEVICES")
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES")
    BIGQUERY_HOURLY_DATA = os.getenv("BIGQUERY_HOURLY_DATA")
    COLLOCATION_CELERY_MINUTES_INTERVAL = int(
        os.getenv("COLLOCATION_CELERY_MINUTES_INTERVAL", 10)
    )
    BIGQUERY_DEVICE_UPTIME_TABLE = os.getenv("BIGQUERY_DEVICE_UPTIME_TABLE")

    USERS_BASE_URL = os.getenv("USERS_BASE_URL")
    JWT_TOKEN = os.getenv("JWT_TOKEN")


class ProductionConfig(Config):
    DEVELOPMENT = False


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    CACHE_REDIS_URL = os.getenv("REDIS_URL_DEV")
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    CACHE_REDIS_URL = os.getenv("REDIS_URL_STAGE")
    MONGO_URI = os.getenv("MONGO_GCE_URI")
    DB_NAME = os.getenv("DB_NAME_STAGE")


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig,
}
