import logging
import pathlib
import os
import sys
from dotenv import load_dotenv


class Config:
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY").strip()
    DB_NAME = os.getenv("DB_NAME_PROD").strip()
    MONGO_URI = os.getenv('MONGO_GCE_URI').strip()


class ProductionConfig(Config):
    DEVELOPMENT = False


class DevelopmentConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)

    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI").strip()
    DB_NAME = os.getenv("DB_NAME_DEV").strip()


class TestingConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)

    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI').strip()
    DB_NAME = os.getenv("DB_NAME_STAGE").strip()


app_config = {"development": DevelopmentConfig,
              "testing": TestingConfig,
              "production": ProductionConfig,
              "staging": TestingConfig}
