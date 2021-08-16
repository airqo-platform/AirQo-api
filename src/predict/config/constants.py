import logging
import pathlib
import os
import sys
from dotenv import load_dotenv
from pathlib import Path
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
#print("BASE_DIR", BASE_DIR)


class Config:
    dotenv_path = os.path.join(BASE_DIR, '.env')
    #print("dotenv", dotenv_path)
    load_dotenv(dotenv_path)
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv('SECRET_KEY')
    DB_NAME = os.getenv('DB_NAME')
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    REDIS_SERVER = os.getenv('REDIS_SERVER_PROD')
    CACHE_TIME_24_HOUR_PREDICTION = os.getenv('CACHE_TIME_24_HOUR_PREDICTION')


class ProductionConfig(Config):
    DEVELOPMENT = False


class DevelopmentConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv('MONGO_DEV_URI')
    REDIS_SERVER = os.getenv('REDIS_SERVER_DEV')

class TestingConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_TEST')


app_config = {"development": DevelopmentConfig,
              "testing": TestingConfig,
              "production": ProductionConfig,
              "staging": TestingConfig}
