import os
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    DB_NAME = os.getenv("DB_NAME_PROD")
    REGISTRY_MONGO_URI = os.getenv('REGISTRY_MONGO_GCE_URI')
    MONITORING_MONGO_URI = os.getenv('MONITORING_MONGO_GCE_URI')
    MONITOR_FREQUENCY_MINUTES = os.getenv('MONITOR_FREQUENCY_MINUTES', 60)
    BASE_API_URL = "https://staging-platform.airqo.net/api/v1"
    DAILY_EVENTS_URL = f"{BASE_API_URL}/devices/events"
    DEVICE_RECENT_EVENTS_URL = f"{BASE_API_URL}/data/feeds/transform/recent"


class ProductionConfig(Config):
    DEVELOPMENT = False
    BASE_API_URL = "https://platform.airqo.net/api/v1"
    DAILY_EVENTS_URL = f"{BASE_API_URL}/devices/events"
    DEVICE_RECENT_EVENTS_URL = f"{BASE_API_URL}/data/feeds/transform/recent"


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    REGISTRY_MONGO_URI = os.getenv("REGISTRY_MONGO_DEV_URI")
    MONITORING_MONGO_URI = os.getenv("MONITORING_MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")


class TestingConfig(Config):
    TESTING = True
    REGISTRY_MONGO_URI = os.getenv('REGISTRY_MONGO_GCE_URI')
    MONITORING_MONGO_URI = os.getenv('MONITORING_MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or 'staging')

configuration = app_config.get(environment, TestingConfig)

DB_HOSTS = {
    "device_registry": configuration.REGISTRY_MONGO_URI,
    "device_monitoring": configuration.MONITORING_MONGO_URI
}


def connect_mongo(tenant, db_host):
    try:
        mongo_uri = DB_HOSTS[db_host]
        client = MongoClient(mongo_uri)
        return client[f'{configuration.DB_NAME}_{tenant.lower()}']

    except KeyError:
        raise Exception(f'Unknown db host "{db_host}"')
