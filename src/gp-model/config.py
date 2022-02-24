import os
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
    SECRET_KEY = os.getenv("SECRET_KEY")
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')


class ProductionConfig(Config):
    MONGO_URI_NETMANAGER = os.getenv('MONGO_GCE_URI_NETMANAGER')
    DB_NAME_NETMANAGER = os.getenv("DB_NAME_PROD_NETMANAGER")
    MONGO_URI_DEVICE_REGISTRY = os.getenv('MONGO_GCE_URI_DEVICE_REGISTRY')
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_PROD_DEVICE_REGISTRY")
    VIEW_AIRQLOUD_URI = os.getenv('VIEW_AIRQLOUD_URI_PROD')
    LIST_DEVICES_URI = os.getenv('LIST_DEVICES_URI_PROD')
    EVENTS_URI = os.getenv('EVENTS_URI_PROD')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    MLFLOW_TRACKING_USERNAME = os.getenv('MLFLOW_TRACKING_USERNAME')
    MLFLOW_TRACKING_PASSWORD = os.getenv('MLFLOW_TRACKING_PASSWORD')
    AIRQO_GPMODEL_BUCKET = os.getenv('AIRQO_GPMODEL_BUCKET_PROD')

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
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    MLFLOW_TRACKING_USERNAME = os.getenv('MLFLOW_TRACKING_USERNAME')
    MLFLOW_TRACKING_PASSWORD = os.getenv('MLFLOW_TRACKING_PASSWORD')
    AIRQO_GPMODEL_BUCKET = os.getenv('AIRQO_GPMODEL_BUCKET_STAGE')


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
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI_DEV')


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