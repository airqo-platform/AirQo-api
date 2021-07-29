import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

print('Environment', os.getenv("FLASK_ENV"))

THIRTY_MINUTES = 1800 # seconds

TWO_HOURS = 7200 # seconds


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True

    CACHE_TYPE = 'RedisCache'
    CACHE_DEFAULT_TIMEOUT = THIRTY_MINUTES
    CACHE_KEY_PREFIX = 'device-monitoring'
    CACHE_REDIS_URL = os.getenv('REDIS_URL_PROD')

    SECRET_KEY = os.getenv("SECRET_KEY")

    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv('MONGO_GCE_URI')


class ProductionConfig(Config):
    DEVELOPMENT = False


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    CACHE_REDIS_URL = os.getenv('REDIS_URL_DEV')
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    CACHE_REDIS_URL = os.getenv('REDIS_URL_STAGE')
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}
