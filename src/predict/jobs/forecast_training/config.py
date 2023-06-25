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
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT_ID')
    TENANTS = os.getenv('TENANTS')
    MONTHS_OF_DATA = os.getenv('MONTHS_OF_DATA', 2)


class ProductionConfig(Config):
    DB_NAME = os.getenv('DB_NAME_PROD')
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    MLFLOW_TRACKING_USERNAME = os.getenv('MLFLOW_TRACKING_USERNAME')
    MLFLOW_TRACKING_PASSWORD = os.getenv('MLFLOW_TRACKING_PASSWORD')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_PROD')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_PROD')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT_ID')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    MONTHS_OF_DATA = os.getenv('MONTHS_OF_DATA', 12)


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_STAGE')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    MLFLOW_TRACKING_USERNAME = os.getenv('MLFLOW_TRACKING_USERNAME')
    MLFLOW_TRACKING_PASSWORD = os.getenv('MLFLOW_TRACKING_PASSWORD')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_STAGE')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT_ID')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    MONTHS_OF_DATA = os.getenv('MONTHS_OF_DATA', 12)


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_STAGE')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_DEV')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT_ID')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    MONTHS_OF_DATA = os.getenv('MONTHS_OF_DATA', 12)


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
