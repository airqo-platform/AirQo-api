import os
from datetime import datetime, timedelta
from pathlib import Path

import urllib3
from dotenv import load_dotenv

from date import date_to_str

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:

    CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
    CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")
    FREQUENCY = os.getenv("FREQUENCY", "raw")
    START_TIME = os.getenv("START_TIME")
    END_TIME = os.getenv("END_TIME")
    BATCH_FETCH_TIME_INTERVAL = os.getenv("BATCH_FETCH_TIME_INTERVAL")
    BATCH_OUTPUT_SIZE = os.getenv("BATCH_OUTPUT_SIZE")
    BOOT_STRAP_SERVERS = os.getenv("BOOT_STRAP_SERVERS")
    TENANT = os.getenv("TENANT")
    PERIODIC = os.getenv("PERIODIC")
    PERIODIC_FETCH_TIME_INTERVAL = os.getenv("PERIODIC_FETCH_TIME_INTERVAL")

    def __init__(self):

        if self.PERIODIC.strip().lower() == "true":
            self.END_TIME = date_to_str(datetime.utcnow())
            self.START_TIME = date_to_str(datetime.utcnow() - timedelta(hours=int(self.PERIODIC_FETCH_TIME_INTERVAL)))

        if self.TENANT.strip().lower() == "airqo":
            self.OUTPUT_TOPIC = os.getenv("AIRQO_OUTPUT_TOPIC")
        elif self.TENANT.strip().lower() == "kcca":
            self.OUTPUT_TOPIC = os.getenv("KCCA_OUTPUT_TOPIC")
        else:
            self.OUTPUT_TOPIC = os.getenv("OUTPUT_TOPIC")


class ProductionConfig(Config):
    AIRQO_BASE_URL = os.getenv("PROD_AIRQO_BASE_URL")
    AIRQO_API_KEY = os.getenv("PROD_AIRQO_API_KEY")


class StagingConfig(Config):
    AIRQO_BASE_URL = os.getenv("STAGE_AIRQO_BASE_URL")
    AIRQO_API_KEY = os.getenv("STAGE_AIRQO_API_KEY")


class DevelopmentConfig(Config):
    AIRQO_BASE_URL = "https://localhost:3000/api/v1/"
    AIRQO_API_KEY = ""


app_config = {
    "development": DevelopmentConfig(),
    "production": ProductionConfig(),
    "staging": StagingConfig()
}

environment = os.getenv("ENVIRONMENT")
print("ENVIRONMENT", environment or 'development', sep=" : ")

configuration = app_config.get(environment, DevelopmentConfig())
print("TENANT", configuration.TENANT, sep=" : ")
print("START TIME", configuration.START_TIME, sep=" : ")
print("END TIME", configuration.END_TIME, sep=" : ")
print("PERIODIC", configuration.PERIODIC, sep=" : ")
