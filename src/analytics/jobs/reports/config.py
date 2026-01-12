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
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES_SITES")


class ProductionConfig(Config):
    MAIL_SENDER_EMAILADDRESS = os.getenv("MAIL_SENDER_EMAILADDRESS")
    MAIL_SENDER_PASSWORD = os.getenv("MAIL_SENDER_PASSWORD")
    MAIL_RECEIVER_EMAILADDRESS = os.getenv("MAIL_RECEIVER_EMAILADDRESS")
    MAIL_SUBJECT = os.getenv("MAIL_SUBJECT")
    AIRQO_QUARTERLY_REPORT_BUCKET = os.getenv("AIRQO_REPORTS_BUCKET")
    BIGQUERY_EVENTS = os.getenv("BIGQUERY_EVENTS")
    BIGQUERY_SITES_METADATA = os.getenv("BIGQUERY_SITES_METADATA")


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    MAIL_SENDER_EMAILADDRESS = os.getenv("MAIL_SENDER_EMAILADDRESS")
    MAIL_SENDER_PASSWORD = os.getenv("MAIL_SENDER_PASSWORD")
    MAIL_RECEIVER_EMAILADDRESS = os.getenv("MAIL_RECEIVER_EMAILADDRESS")
    MAIL_SUBJECT = os.getenv("MAIL_SUBJECT")
    AIRQO_QUARTERLY_REPORT_BUCKET = os.getenv("AIRQO_REPORTS_BUCKET")
    BIGQUERY_EVENTS = os.getenv("BIGQUERY_EVENTS")
    BIGQUERY_SITES_METADATA = os.getenv("BIGQUERY_SITES_METADATA")
    EXPECTED_DAYS = os.getenv("EXPECTED_DAYS")


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MAIL_SENDER_EMAILADDRESS = os.getenv("MAIL_SENDER_EMAILADDRESS")
    MAIL_SENDER_PASSWORD = os.getenv("MAIL_SENDER_PASSWORD")
    MAIL_RECEIVER_EMAILADDRESS = os.getenv("MAIL_RECEIVER_EMAILADDRESS")
    MAIL_SUBJECT = os.getenv("MAIL_SUBJECT")
    AIRQO_QUARTERLY_REPORT_BUCKET = os.getenv("AIRQO_REPORTS_BUCKET")
    BIGQUERY_EVENTS = os.getenv("BIGQUERY_EVENTS")
    BIGQUERY_SITES_METADATA = os.getenv("BIGQUERY_SITES_METADATA")
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
