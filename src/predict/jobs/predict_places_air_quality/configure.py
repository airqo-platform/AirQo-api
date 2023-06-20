import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class Config:
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES")
    BIGQUERY_AIRQLOUDS_SITES = os.getenv("BIGQUERY_AIRQLOUDS_SITES")
    BIGQUERY_HOURLY_DATA = os.getenv("BIGQUERY_HOURLY_DATA")
    BIGQUERY_PLACES_PREDICTIONS = os.getenv("BIGQUERY_PLACES_PREDICTIONS")

    MONGO_URI = os.getenv("MONGO_URI")
    MONGO_DB = os.getenv("MONGO_DB")
    MONGO_SHAPE_FILES_COLLECTION = os.getenv("MONGO_SHAPE_FILES_COLLECTION")

    AIRQO_API_TOKEN = os.getenv("AIRQO_API_TOKEN")
    DEVICE_REGISTRY_URL = os.getenv(
        "DEVICE_REGISTRY_URL", "https://api.airqo.net/api/v1/devices"
    )

    POSTGRES_TABLE = os.getenv("POSTGRES_TABLE")
    POSTGRES_CONNECTION_URL = os.getenv("POSTGRES_CONNECTION_URL")
