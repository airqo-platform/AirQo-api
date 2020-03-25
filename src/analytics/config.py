import logging
from logging.handlers import TimedRotatingFileHandler
import pathlib
import os
import sys

class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = 'sample-code-local-environment'
    #SERVER_PORT = 5000

    CLARITY_API_BASE_URL= "https://clarity-data-api.clarity.io/v1/"
    CLARITY_API_KEY= "qJ2INQDcuMhnTdnIi6ofYX5X4vl2YYG4k2VmwUOy"


class ProductionConfig(Config):
    DEBUG = False
    #SERVER_PORT = os.environ.get('PORT', 5000)
    MONGO_URI = MONGO_URI = "mongodb+srv://sserurich:dKZcVkS5PCSpmobo@cluster0-99jha.gcp.mongodb.net/airqo_analytics" #change to production db


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = "mongodb://localhost:27017/airqo_analytics"


class TestingConfig(Config):
    TESTING = True
    MONGO_URI = "mongodb+srv://sserurich:dKZcVkS5PCSpmobo@cluster0-99jha.gcp.mongodb.net/airqo_analytics"
    

app_config = {"development": DevelopmentConfig, "testing": TestingConfig, "production": ProductionConfig}


if __name__ == '__main__':
    print('package root', "Analytics App")


