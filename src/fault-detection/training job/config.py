import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    GOOGLE_CLOUD_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT_ID')
    MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
    MLFLOW_TRACKING_USERNAME = os.getenv('MLFLOW_TRACKING_USERNAME')
    MLFLOW_TRACKING_PASSWORD = os.getenv('MLFLOW_TRACKING_PASSWORD')


class ProductionConfig(Config):
    AIRQO_FAULT_DETECTION_BUCKET = os.getenv('AIRQO_FAULT_DETECTION_BUCKET_PROD')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_PROD')


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    AIRQO_FAULT_DETECTION_BUCKET = os.getenv('AIRQO_FAULT_DETECTION_BUCKET_STAGE')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    AIRQO_FAULT_DETECTION_BUCKET = os.getenv('AIRQO_FAULT_DETECTION_BUCKET_STAGE')
    AIRQO_API_BASE_URL = os.getenv('AIRQO_API_BASE_URL_STAGE')


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig
}

environment = os.getenv("ENVIRONMENT")
print("ENVIRONMENT", environment or 'staging')

configuration = app_config.get(environment, TestingConfig)
