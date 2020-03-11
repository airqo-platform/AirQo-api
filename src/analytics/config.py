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


class ProductionConfig(Config):
    DEBUG = False
    #SERVER_PORT = os.environ.get('PORT', 5000)


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True


class TestingConfig(Config):
    TESTING = True


if __name__ == '__main__':
    print('package root', "Analytics App")


