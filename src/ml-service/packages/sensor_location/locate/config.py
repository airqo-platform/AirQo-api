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


class ProductionConfig(Config):
    DEBUG = False


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True


class TestingConfig(Config):
    TESTING = True


if __name__ == '__main__':
    print('package root', "Locate App")


