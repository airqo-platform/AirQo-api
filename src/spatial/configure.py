#configure.py
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

class Config:
    AIRQO_API_TOKEN = os.getenv("AIRQO_API_TOKEN")
    GRID_URL = os.getenv("GRID_URL_ID")
    BIGQUERY_HOURLY_CONSOLIDATED = os.getenv("BIGQUERY_HOURLY_CONSOLIDATED") 
    CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_CLOUD_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    GOOGLE_APPLICATION_CREDENTIALS_EMAIL = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_EMAIL")
    


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

environment = os.getenv("FLASK_ENV", "staging")
print("ENVIRONMENT", environment or "staging")

configuration = app_config.get(environment, "staging")