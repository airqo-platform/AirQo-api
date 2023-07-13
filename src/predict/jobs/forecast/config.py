import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    CSRF_ENABLED = True
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')
    AIRQO_API_AUTH_TOKEN = os.getenv('AIRQO_API_AUTH_TOKEN')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET')
    DB_NAME = os.getenv("DB_NAME")
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    NUMBER_OF_DAYS = os.getenv('NUMBER_OF_DAYS')
    NUMBER_OF_HOURS = os.getenv('NUMBER_OF_HOURS')
    FORECAST_DAILY_HORIZON = os.getenv('FORECAST_DAILY_HORIZON')
    FORECAST_HOURLY_HORIZON = os.getenv('FORECAST_HOURLY_HORIZON')
    BIGQUERY_DATASET = os.getenv('BIGQUERY_DATASET')
    BIGQUERY_HOURLY_TABLE = os.getenv('BIGQUERY_HOURLY_TABLE')
    TARGET_COL = 'pm2_5'


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    DEBUG = True
    TESTING = True

class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True


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
