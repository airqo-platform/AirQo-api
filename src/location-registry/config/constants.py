import logging
from logging.handlers import TimedRotatingFileHandler
import pathlib
from pathlib import Path
import os
import sys
from dotenv import load_dotenv
import ee

BASE_DIR = Path(__file__).resolve().parent.parent
print("BASE_DIR", BASE_DIR)


class Config:
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    API_KEY = os.getenv("API_KEY")
    OVERPASS_URL = os.getenv("OVERPASS_URL")
    SERVICE_ACCOUNT = os.getenv("SERVICE_ACCOUNT")
    CREDENTIALS = ee.ServiceAccountCredentials(
        SERVICE_ACCOUNT, 'private_key.json')


class ProductionConfig(Config):
    DEVELOPMENT = False


class DevelopmentConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)

    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")
    API_KEY = os.getenv("API_KEY")
    OVERPASS_URL = os.getenv("OVERPASS_URL")
    SERVICE_ACCOUNT = os.getenv("SERVICE_ACCOUNT")
    CREDENTIALS = ee.ServiceAccountCredentials(
        SERVICE_ACCOUNT, 'private_key.json')


class TestingConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)

    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")
    API_KEY = os.getenv("API_KEY")
    OVERPASS_URL = os.getenv("OVERPASS_URL")
    SERVICE_ACCOUNT = os.getenv("SERVICE_ACCOUNT")
    CREDENTIALS = ee.ServiceAccountCredentials(
        SERVICE_ACCOUNT, 'private_key.json')


app_config = {"development": DevelopmentConfig,
              "testing": TestingConfig,
              "production": ProductionConfig,
              "staging": TestingConfig}
