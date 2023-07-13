import os
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    MONITOR_FREQUENCY_MINUTES = int(os.getenv("MONITOR_FREQUENCY_MINUTES", 60))
    BASE_API_URL = os.getenv("BASE_API_URL")
    DEVICE_RECENT_EVENTS_URL = f"{BASE_API_URL}/feeds/transform/recent"

    # Mongo Connections
    REGISTRY_MONGO_URI = os.getenv("REGISTRY_MONGO_GCE_URI")
    MONITORING_MONGO_URI = os.getenv("MONITORING_MONGO_GCE_URI")
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_DEVICE_REGISTRY")
    DB_NAME_DEVICE_MONITORING = os.getenv("DB_NAME_DEVICE_MONITORING")

    BIGQUERY_RAW_DATA = os.getenv("BIGQUERY_RAW_DATA")
    BIGQUERY_DEVICE_UPTIME_TABLE = os.getenv("BIGQUERY_DEVICE_UPTIME_TABLE")
    UPTIME_HOURLY_THRESHOLD = os.getenv("UPTIME_HOURLY_THRESHOLD")


class ProductionConfig(Config):
    DEVELOPMENT = False
    BASE_API_URL = os.getenv("BASE_API_URL")
    DEVICE_RECENT_EVENTS_URL = f"{BASE_API_URL}/feeds/transform/recent"


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    REGISTRY_MONGO_URI = os.getenv("REGISTRY_MONGO_DEV_URI")
    MONITORING_MONGO_URI = os.getenv("MONITORING_MONGO_DEV_URI")


class TestingConfig(Config):
    TESTING = True
    REGISTRY_MONGO_URI = os.getenv("REGISTRY_MONGO_GCE_URI")
    MONITORING_MONGO_URI = os.getenv("MONITORING_MONGO_GCE_URI")


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig,
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or "staging")

configuration = app_config.get(environment, TestingConfig)

DB_HOSTS = {
    "device_registry": {
        "mongo_uri": configuration.REGISTRY_MONGO_URI,
        "database": configuration.DB_NAME_DEVICE_REGISTRY,
    },
    "device_monitoring": {
        "mongo_uri": configuration.MONITORING_MONGO_URI,
        "database": configuration.DB_NAME_DEVICE_MONITORING,
    },
}


def connect_mongo(tenant, db_host):
    try:
        mongo_uri = DB_HOSTS[db_host]["mongo_uri"]
        client = MongoClient(mongo_uri)
        return client[f"{DB_HOSTS[db_host]['database']}_{tenant.lower()}"]

    except KeyError:
        raise Exception(f'Unknown db host "{db_host}"')
