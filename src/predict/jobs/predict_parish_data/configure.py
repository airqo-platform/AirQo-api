import os

import urllib3
from dotenv import load_dotenv
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

urllib3.disable_warnings()


class Config:
    BIGQUERY_SITES = os.getenv("BIGQUERY_SITES")
    BIGQUERY_AIRQLOUDS_SITES = os.getenv("BIGQUERY_AIRQLOUDS_SITES")
    BIGQUERY_HOURLY_DATA = os.getenv("BIGQUERY_HOURLY_DATA")

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    MONGO_DB = os.getenv("MONGO_DB", "local")
    MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "uganda_shapefile")
