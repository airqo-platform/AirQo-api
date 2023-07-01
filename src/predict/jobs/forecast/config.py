import os
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')
    NUMBER_OF_HOURS = os.getenv('NUMBER_OF_HOURS')
    NUMBER_OF_MONTHS = os.getenv('NUMBER_OF_MONTHS')
    TENANTS = os.getenv('TENANTS')
    FORECAST_DAILY_HORIZON = os.getenv('FORECAST_DAILY_HORIZON')
    FORECAST_HOURLY_HORIZON = os.getenv('FORECAST_HOURLY_HORIZON')
    METADATA_PATH = 'meta.csv'
    BOUNDARY_LAYER_PATH = 'boundary_layer.csv'

    test_start_datetime = datetime.now().strftime('%Y-%m-%d %H')
    daily_test_start_datetime = datetime.now().strftime('%Y-%m-%d')

    TEST_DATE_HOUR_START = pd.to_datetime(test_start_datetime)
    TEST_DATE_DAILY_START = pd.to_datetime(daily_test_start_datetime, utc=True)

    ### Prediction will end at this date-hour
    TEST_DATE_HOUR_END = TEST_DATE_HOUR_START + pd.Timedelta(hours=23)
    N_HRS_BACK = 24
    SEQ_LEN = 24
    ROLLING_SEQ_LEN = 24 * 90
    MAX_LAGS = N_HRS_BACK + max(ROLLING_SEQ_LEN, SEQ_LEN) + 48  # Extra 48 or 2 days for safety
    TEST_LAG_LAST_DATE_HOUR = TEST_DATE_HOUR_START - pd.Timedelta(hours=MAX_LAGS)
    TARGET_COL = 'pm2_5'


class ProductionConfig(Config):
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_PROD_DEVICE_REGISTRY")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_PROD')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_PROD')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_STAGE_DEVICE_REGISTRY")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_STAGE')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_STAGE_DEVICE_REGISTRY")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_DEV')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or 'staging')

configuration = app_config.get(environment, TestingConfig)


def connect_mongo():
    client = MongoClient(configuration.MONGO_URI)
    db = client[configuration.DB_NAME]
    return db
