import os

import urllib3
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

urllib3.disable_warnings()


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    MEASUREMENTS_TOPIC = os.getenv('MEASUREMENTS_TOPIC')
    AIRQLOUDS_TOPIC = os.getenv('AIRQLOUDS_TOPIC')
    BOOTSTRAP_SERVERS = os.getenv('BOOTSTRAP_SERVERS')
    GP_MODEL_DB = os.getenv('GP_MODEL_DB')
    GP_MODEL_DB_URI = os.getenv('GP_MODEL_DB_URI')

    BIGQUERY_MEASUREMENTS_PREDICTIONS = os.getenv('BIGQUERY_MEASUREMENTS_PREDICTIONS')
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES")
    BIGQUERY_AIRQLOUDS_SITES = os.getenv("BIGQUERY_AIRQLOUDS_SITES")
    BIGQUERY_HOURLY_DATA = os.getenv("BIGQUERY_HOURLY_DATA")

class ProductionConfig(Config):
    MONGO_URI_NETMANAGER = os.getenv('MONGO_GCE_URI_NETMANAGER')
    DB_NAME_NETMANAGER = os.getenv("DB_NAME_PROD_NETMANAGER")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_PROD_DEVICE_REGISTRY")
    VIEW_AIRQLOUD_URI = os.getenv('VIEW_AIRQLOUD_URI_PROD')
    LIST_DEVICES_URI = os.getenv('LIST_DEVICES_URI_PROD')
    EVENTS_URI = os.getenv('EVENTS_URI_PROD')
    API_TOKEN = os.getenv('PROD_TOKEN')


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI_NETMANAGER = os.getenv('MONGO_DEV_URI_NETMANAGER')
    DB_NAME_NETMANAGER = os.getenv("DB_NAME_DEV_NETMANAGER")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_DEV_URI_DEVICE_REGISTRY')
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_DEV_DEVICE_REGISTRY")
    VIEW_AIRQLOUD_URI = os.getenv('VIEW_AIRQLOUD_URI_DEV')
    LIST_DEVICES_URI = os.getenv('LIST_DEVICES_URI_DEV')
    EVENTS_URI = os.getenv('EVENTS_URI_DEV')
    API_TOKEN = os.getenv('DEV_TOKEN')


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    DB_NAME_NETMANAGER = os.getenv("DB_NAME_STAGE_NETMANAGER")
    MONGO_URI_NETMANAGER = os.getenv('MONGO_GCE_URI_NETMANAGER')
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_STAGE_DEVICE_REGISTRY")
    VIEW_AIRQLOUD_URI = os.getenv('VIEW_AIRQLOUD_URI_STAGE')
    LIST_DEVICES_URI = os.getenv('LIST_DEVICES_URI_STAGE')
    EVENTS_URI = os.getenv('EVENTS_URI_STAGE')
    API_TOKEN = os.getenv('STAGE_TOKEN')


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or 'staging')

configuration = app_config.get(environment, TestingConfig)


def connect_mongo(tenant, db_host=configuration.MONGO_URI_NETMANAGER):
    client = MongoClient(db_host)
    if db_host == configuration.MONGO_URI_NETMANAGER:
        db = client[configuration.DB_NAME_NETMANAGER]
    else:
        db = client[f'{configuration.DB_NAME_DEVICE_REGISTRY}_{tenant.lower()}']
    return db
