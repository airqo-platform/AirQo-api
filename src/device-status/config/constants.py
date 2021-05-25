import os
from dotenv import load_dotenv
from pathlib import Path

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

BASE_DIR = Path(__file__).resolve().parent.parent
print("BASE_DIR", BASE_DIR)


class Config:
    dotenv_path = os.path.join(BASE_DIR, '.env')
    print("dotenv", dotenv_path)
    load_dotenv(dotenv_path)
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    BASE_API_URL = "https://staging-platform.airqo.net/api/v1/data"
    RECENT_FEEDS_URL = f"{BASE_API_URL}/feeds/transform/recent"


class ProductionConfig(Config):
    DEVELOPMENT = False
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_PROD")
    BASE_API_URL = "https://platform.airqo.net/api/v1/data"
    RECENT_FEEDS_URL = f"{BASE_API_URL}/feeds/transform/recent"


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_DEV_URI")
    DB_NAME = os.getenv("DB_NAME_DEV")


class TestingConfig(Config):
    TESTING = True
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv("DB_NAME_STAGE")


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}

environment = os.getenv("FLASK_ENV")
configuration = app_config.get(environment, ProductionConfig)
