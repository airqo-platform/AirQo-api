import os
from datetime import datetime
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT_ID')
    TRAIN_DATE_HOUR_START = pd.to_datetime(os.getenv('TRAIN_START_DATE'))
    TRAIN_DATE_HOUR_END = pd.to_datetime(
        os.environ.get('TRAIN_END_DATE', datetime.strftime(datetime.now(), '%Y-%m-%d %H:00:00'))
    )
    TENANT = os.getenv('TENANT', 'airqo')
    MONTHS_OF_DATA = os.getenv('MONTHS_OF_DATA', 2)

class ProductionConfig(Config):
    DB_NAME = os.getenv('DB_NAME_PROD')
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    MLFLOW_TRACKING_USERNAME = os.getenv('MLFLOW_TRACKING_USERNAME')
    MLFLOW_TRACKING_PASSWORD = os.getenv('MLFLOW_TRACKING_PASSWORD')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET')
    #DEVICE_SITE_DETAILS_URL = "https://platform.airqo.net/api/v1/devices?tenant=airqo&active=yes"
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_PROD')

class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_STAGE')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    MLFLOW_TRACKING_USERNAME = os.getenv('MLFLOW_TRACKING_USERNAME')
    MLFLOW_TRACKING_PASSWORD = os.getenv('MLFLOW_TRACKING_PASSWORD')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET')
    #DEVICE_SITE_DETAILS_URL = "https://staging-platform.airqo.net/api/v1/devices?tenant=airqo&active=yes"
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')

class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv('MONGO_DEV_URI')
    DB_NAME = os.getenv('DB_NAME_DEV')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI_DEV')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_DEV')
    #DEVICE_SITE_DETAILS_URL = "http://localhost:3000/api/v1/devices?tenant=airqo&active=yes"
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_DEV')


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
    db = client[f'{configuration.DB_NAME}_{configuration.TENANT.lower()}']
    return db