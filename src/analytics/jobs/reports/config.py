import os
from datetime import datetime
import pandas as pd

# from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_CLOUD_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")

    TENANT = os.getenv("TENANT", "airqo")
    MONTHS_OF_DATA = os.getenv("MONTHS_OF_DATA", 3)
    EXPECTED_DAYS = os.getenv("EXPECTED_DAYS")


class ProductionConfig(Config):
    DB_NAME = os.getenv("DB_NAME_PROD")
    MONGO_URI = os.getenv("MONGO_GCE_URI")
    MAIL_SENDER_EMAILADDRESS = os.getenv("MAIL_SENDER_EMAILADDRESS")
    MAIL_SENDER_PASSWORD = os.getenv("MAIL_SENDER_PASSWORD")
    MAIL_RECEIVER_EMAILADDRESS = os.getenv("MAIL_RECEIVER_EMAILADDRESS")
    MAIL_SUBJECT = os.getenv("MAIL_SUBJECT")
    AIRQO_QUARTERLY_REPORT_BUCKET = os.getenv("AIRQO_PREDICT_BUCKET_PROD")
    AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL_PROD")
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES_PROD")
    BIGQUERY_EVENTS = os.getenv("BIGQUERY_EVENTS_PROD")


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MONGO_URI = os.getenv("MONGO_GCE_URI")
    DB_NAME = os.getenv("DB_NAME_STAGE")
    MAIL_SENDER_EMAILADDRESS = os.getenv("MAIL_SENDER_EMAILADDRESS")
    MAIL_SENDER_PASSWORD = os.getenv("MAIL_SENDER_PASSWORD")
    MAIL_RECEIVER_EMAILADDRESS = os.getenv("MAIL_RECEIVER_EMAILADDRESS")
    MAIL_SUBJECT = os.getenv("MAIL_SUBJECT")
    AIRQO_QUARTERLY_REPORT_BUCKET = os.getenv("AIRQO_PREDICT_BUCKET_STAGE")
    AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL_STAGE")
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES_STAGE")
    BIGQUERY_EVENTS = os.getenv("BIGQUERY_EVENTS_STAGE")
    EXPECTED_DAYS = os.getenv("EXPECTED_DAYS")


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = os.getenv("MONGO_GCE_URI")
    DB_NAME = os.getenv("DB_NAME_STAGE")
    MAIL_SENDER_EMAILADDRESS = os.getenv("MAIL_SENDER_EMAILADDRESS")
    MAIL_SENDER_PASSWORD = os.getenv("MAIL_SENDER_PASSWORD")
    MAIL_RECEIVER_EMAILADDRESS = os.getenv("MAIL_RECEIVER_EMAILADDRESS")
    MAIL_SUBJECT = os.getenv("MAIL_SUBJECT")
    AIRQO_QUARTERLY_REPORT_BUCKET = os.getenv("AIRQO_PREDICT_BUCKET_DEV")
    AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL_STAGE")
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES_STAGE")
    BIGQUERY_EVENTS = os.getenv("BIGQUERY_EVENTS_STAGE")
    EXPECTED_DAYS = os.getenv("EXPECTED_DAYS")


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig,
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or "staging")

configuration = app_config.get(environment, TestingConfig)
