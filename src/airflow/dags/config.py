import os
from pathlib import Path

import urllib3
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class Config:
    ENVIRONMENT = os.getenv("ENVIRONMENT", "DEVELOPMENT")

    CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
    CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")

    THINGSPEAK_API_KEY = os.getenv("THINGSPEAK_API_KEY")
    THINGSPEAK_CHANNEL_URL = os.getenv("THINGSPEAK_CHANNEL_URL")

    BIGQUERY_HOURLY_EVENTS_TABLE = os.getenv("BIGQUERY_HOURLY_EVENTS_TABLE")

    POST_EVENTS_BODY_SIZE = os.getenv("POST_EVENTS_BODY_SIZE", 10)
    POST_WEATHER_BODY_SIZE = os.getenv("POST_EVENTS_BODY_SIZE", 10)
    CALIBRATE_REQUEST_BODY_SIZE = os.getenv("CALIBRATE_REQUEST_BODY_SIZE", 10)

    TAHMO_BASE_URL = os.getenv("TAHMO_API_BASE_URL")
    TAHMO_API_MAX_PERIOD = os.getenv("TAHMO_API_MAX_PERIOD")
    TAHMO_API_KEY = os.getenv("TAHMO_API_CREDENTIALS_USERNAME")
    TAHMO_API_SECRET = os.getenv("TAHMO_API_CREDENTIALS_PASSWORD")

    BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS").split(",")
    TOPIC_PARTITIONS = os.getenv("TOPIC_PARTITIONS", "1,2,3,4").split(",")
    SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL")

    WEATHER_MEASUREMENTS_TOPIC = os.getenv("WEATHER_MEASUREMENTS_TOPIC")
    INSIGHTS_MEASUREMENTS_TOPIC = os.getenv("INSIGHTS_MEASUREMENTS_TOPIC")
    HOURLY_MEASUREMENTS_TOPIC = os.getenv("HOURLY_MEASUREMENTS_TOPIC")


class ProductionConfig(Config):
    AIRQO_BASE_URL = os.getenv("PROD_AIRQO_BASE_URL")
    AIRQO_BASE_URL_V2 = os.getenv("PROD_AIRQO_BASE_URL_V2")
    AIRQO_API_KEY = os.getenv("PROD_AIRQO_API_KEY")


class StagingConfig(Config):
    AIRQO_BASE_URL = os.getenv("STAGE_AIRQO_BASE_URL")
    AIRQO_BASE_URL_V2 = os.getenv("STAGE_AIRQO_BASE_URL_V2")
    AIRQO_API_KEY = os.getenv("STAGE_AIRQO_API_KEY")


class DevelopmentConfig(Config):
    AIRQO_BASE_URL = "https://localhost:3000/api/v1/"
    AIRQO_API_KEY = ""


app_config = {
    "development": DevelopmentConfig(),
    "production": ProductionConfig(),
    "staging": StagingConfig(),
}

environment = os.getenv("ENVIRONMENT")
print("ENVIRONMENT", environment or "development", sep=" : ")

configuration = app_config.get(environment, DevelopmentConfig())
