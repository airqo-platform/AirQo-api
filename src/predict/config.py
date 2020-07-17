import logging
import pathlib
import os
import sys
from dotenv import load_dotenv


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")


class ProductionConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), 'production.env')
    load_dotenv(dotenv_path)
    DEBUG = False
    MONGO_URI = os.getenv("MONGO_URI")


class DevelopmentConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path)

    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_URI")


class TestingConfig(Config):
    dotenv_path = os.path.join(os.path.dirname(__file__), 'testing.env')
    load_dotenv(dotenv_path)

    TESTING = True
    MONGO_URI = os.getenv("MONGO_URI")


app_config = {"development": DevelopmentConfig,
              "testing": TestingConfig, "production": ProductionConfig}


if __name__ == '__main__':
    print('package root', "Prediction App")
