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
    NUMBER_OF_HOURS = os.getenv('NUMBER_OF_HOURS')


class ProductionConfig(Config):
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_PROD')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_STAGE')


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")
    BUCKET_NAME = os.getenv('AIRQO_FAULT_DETECTION_BUCKET_STAGE')


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
