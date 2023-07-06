import os
from pathlib import Path

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
    TARGET_COL = 'pm2_5'


class ProductionConfig(Config):
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_PROD')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_PROD')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')
    BIGQUERY_DATASET = os.getenv('BIGQUERY_DATASET_PROD')


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_STAGE')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')
    BIGQUERY_DATASET = os.getenv('BIGQUERY_DATASET_STAGE')


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_DEV')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')
    BIGQUERY_DATASET = os.getenv('BIGQUERY_DATASET_STAGE')


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
