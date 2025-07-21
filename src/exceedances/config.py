import os
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')


class ProductionConfig(Config):
    pass


class DevelopmentConfig(Config):
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")


class TestingConfig(Config):
    MONGO_URI = os.getenv('MONGO_GCE_URI')
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


def connect_mongo(tenant):
    client = MongoClient(configuration.MONGO_URI)
    db = client[f'{configuration.DB_NAME}_{tenant.lower()}']
    return db
