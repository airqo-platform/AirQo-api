import os
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
import pandas as pd
BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT')

    TENANT = os.getenv('TENANT', 'airqo')
    MONTHS_OF_DATA = os.getenv('MONTHS_OF_DATA', 2)
    # prediction configs

    #load & preprocess test data:
    METADATA_PATH = 'meta.csv'
    BOUNDARY_LAYER_PATH = 'boundary_layer.csv'

    #set constants
    test_start_datetime = datetime.now().strftime('%Y-%m-%d %H')
    #test_end_datetime = date_to_str(datetime.now() + timedelta(hours=24))

    TEST_DATE_HOUR_START = pd.to_datetime(test_start_datetime)

    ### Prediction will end at this date-hour
    TEST_DATE_HOUR_END = TEST_DATE_HOUR_START + pd.Timedelta(hours=23)
    N_HRS_BACK = 24
    SEQ_LEN = 24
    ROLLING_SEQ_LEN = 24*90
    MAX_LAGS = N_HRS_BACK + max(ROLLING_SEQ_LEN, SEQ_LEN) + 48 # Extra 48 or 2 days for safety
    TEST_LAG_LAST_DATE_HOUR = TEST_DATE_HOUR_START - pd.Timedelta(hours = MAX_LAGS)
    TARGET_COL = 'pm2_5'
class ProductionConfig(Config):
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_PROD_DEVICE_REGISTRY")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_PROD')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_PROD')

class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_STAGE_DEVICE_REGISTRY")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_STAGE')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')

class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_STAGE_DEVICE_REGISTRY")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    AIRQO_PREDICT_BUCKET = os.getenv('AIRQO_PREDICT_BUCKET_DEV')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')


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

def connect_mongo_device_registry():
    client = MongoClient(configuration.MONGO_URI_DEVICE_REGISTRY)
    db = client[f'{configuration.DB_NAME_DEVICE_REGISTRY}_{configuration.TENANT.lower()}']
    return db

