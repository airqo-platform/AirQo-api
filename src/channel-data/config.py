import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    BQ_SCHEME = os.getenv("BQ_SCHEME_PROD")
    RAW_FEEDS_PMS = os.getenv("RAW_FEEDS_PMS_PROD")

class ProductionConfig(Config):
    pass


class DevelopmentConfig(Config):
    BQ_SCHEME = os.getenv("BQ_SCHEME_DEV")
    RAW_FEEDS_PMS = os.getenv("RAW_FEEDS_PMS_DEV")

class TestingConfig(Config):
    BQ_SCHEME = os.getenv("BQ_SCHEME_STAGE")
    RAW_FEEDS_PMS = os.getenv("RAW_FEEDS_PMS_STAGE")


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or 'staging')

configuration = app_config.get(environment, TestingConfig)

