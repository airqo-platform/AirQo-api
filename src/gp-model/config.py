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
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    VIEW_AIRQLOUD_URI = os.getenv('VIEW_AIRQLOUD_URI_PROD')
    LIST_DEVICES_URI = os.getenv('LIST_DEVICES_URI_PROD')
    EVENTS_URI = os.getenv('EVENTS_URI_PROD')


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")
    VIEW_AIRQLOUD_URI = os.getenv('VIEW_AIRQLOUD_URI_DEV')
    LIST_DEVICES_URI = os.getenv('LIST_DEVICES_URI_DEV')
    EVENTS_URI = os.getenv('EVENTS_URI_DEV')


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")
    VIEW_AIRQLOUD_URI = os.getenv('VIEW_AIRQLOUD_URI_STAGE')
    LIST_DEVICES_URI = os.getenv('LIST_DEVICES_URI_STAGE')
    EVENTS_URI = os.getenv('EVENTS_URI_STAGE')


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or 'staging')

configuration = app_config.get(environment, TestingConfig)


def connect_mongo(tenant):
    client = MongoClient(configuration.MONGO_URI)
    db = client[f'{configuration.DB_NAME}_{tenant.lower()}']
    return db