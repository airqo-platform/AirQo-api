import os
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv('SECRET_KEY')
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

class ProductionConfig(Config):
    MLFLOW_TRACKING_URL = os.getenv('MLFLOW_TRACKING_URL')
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')

class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MLFLOW_TRACKING_URL = os.getenv('MLFLOW_TRACKING_URL')
    DB_NAME = os.getenv("DB_NAME_STAGE")
    MONGO_URI = os.getenv('MONGO_GCE_URI')

class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MLFLOW_TRACKING_URL = os.getenv('MLFLOW_TRACKING_URL_DEV')


app_config = {"development": DevelopmentConfig,
              "testing": TestingConfig,
              "production": ProductionConfig,
              "staging": TestingConfig}

environment = os.getenv("FLASK_ENV")
print("ENVIRONMENT", environment or 'staging')

configuration = app_config.get(environment, TestingConfig)

def connect_mongo():
    client = MongoClient(configuration.MONGO_URI)
    db = client[configuration.DB_NAME]
    return db