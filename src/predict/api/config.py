import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class Config:
    CSRF_ENABLED = True
    SECRET_KEY = os.getenv("SECRET_KEY")
    CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    BIGQUERY_MEASUREMENTS_PREDICTIONS = os.getenv("BIGQUERY_MEASUREMENTS_PREDICTIONS")
    BIGQUERY_PLACES_PREDICTIONS = os.getenv("BIGQUERY_PLACES_PREDICTIONS")
    AIRQO_BASE_URL = os.getenv("AIRQO_BASE_URL", "https://api.airqo.net")
    AIRQO_API_AUTH_TOKEN = os.getenv("AIRQO_API_AUTH_TOKEN", "test_token")
    DB_NAME = os.getenv("DB_NAME", "test_airqo_db")
    MONGO_URI = os.getenv("MONGO_GCE_URI", "mongodb://localhost:27017/test_airqo_db")
    REDIS_SERVER = os.getenv("REDIS_SERVER", "localhost")
    POSTGRES_CONNECTION_URL = os.getenv("POSTGRES_CONNECTION_URL", "postgresql://localhost:5432/test_airqo_db")
    CACHE_TIMEOUT = os.getenv("CACHE_TIMEOUT", 3600)
    PARISH_PREDICTIONS_QUERY_LIMIT = os.getenv("PARISH_PREDICTIONS_QUERY_LIMIT", 100)


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True


class TestingConfig(Config):
    DEBUG = True
    TESTING = True


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig,
}

environment = os.getenv("FLASK_ENV", "development")
print("ENVIRONMENT", environment or "staging")

configuration = app_config.get(environment, "development")


def connect_mongo():
    client = MongoClient(configuration.MONGO_URI)
    db = client[configuration.DB_NAME]
    return db
