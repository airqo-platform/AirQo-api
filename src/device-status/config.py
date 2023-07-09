import os
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

BASE_DIR = Path(__file__).resolve().parent.parent

ONE_HOUR = 3600
TWO_WEEKS = 14 * 24 * ONE_HOUR


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    MAX_ONLINE_ACCEPTABLE_DURATION = int(
        os.getenv("MAX_ONLINE_ACCEPTABLE_DURATION", ONE_HOUR)
    )
    DUE_FOR_MAINTENANCE_DURATION = os.getenv("DUE_FOR_MAINTENANCE_DURATION", TWO_WEEKS)
    SECRET_KEY = os.getenv("SECRET_KEY")
    BASE_API_URL = os.getenv("BASE_API_URL")
    RECENT_FEEDS_URL = f"{BASE_API_URL}/feeds/transform/recent"

    # Mongo Connections
    REGISTRY_MONGO_URI = os.getenv("REGISTRY_MONGO_GCE_URI")
    MONITORING_MONGO_URI = os.getenv("MONITORING_MONGO_GCE_URI")
    DB_NAME_DEVICE_REGISTRY = os.getenv("DB_NAME_DEVICE_REGISTRY")
    DB_NAME_DEVICE_MONITORING = os.getenv("DB_NAME_DEVICE_MONITORING")


class ProductionConfig(Config):
    DEVELOPMENT = False
    BASE_API_URL = os.getenv("BASE_API_URL")
    RECENT_FEEDS_URL = f"{BASE_API_URL}/feeds/transform/recent"


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
