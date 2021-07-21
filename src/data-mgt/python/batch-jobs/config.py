import os
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:

    CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
    CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")
    FREQUENCY = os.getenv("FREQUENCY")
    START_TIME = os.getenv("START_TIME")
    END_TIME = os.getenv("END_TIME")
    TIME_INTERVAL = os.getenv("TIME_INTERVAL")
    INSERTION_INTERVAL = os.getenv("INSERTION_INTERVAL")
    BOOT_STRAP_SERVERS = os.getenv("BOOT_STRAP_SERVERS")
    OUTPUT_TOPIC = os.getenv("OUTPUT_TOPIC")
    AIRQO_API_KEY = os.getenv("AIRQO_API_KEY")
    TENANT = os.getenv("TENANT")
    PERIODIC = os.getenv("PERIODIC")
    PERIODIC_INTERVAL = os.getenv("PERIODIC_INTERVAL")

    def __init__(self):

        if self.PERIODIC.strip().lower() == "true":
            self.START_TIME = datetime.strftime(datetime.utcnow() - timedelta(hours=int(self.PERIODIC_INTERVAL)),
                                                '%Y-%m-%dT%H:%M:%SZ')
            self.END_TIME = datetime.strftime(datetime.utcnow(), '%Y-%m-%dT%H:%M:%SZ')


class ProductionConfig(Config):
    AIRQO_BASE_URL = "https://platform.airqo.net/api/v1/"


class DevelopmentConfig(Config):
    AIRQO_BASE_URL = "http://localhost:3000/api/v1/"


class StagingConfig(Config):
    AIRQO_BASE_URL = "https://staging-platform.airqo.net/api/v1/"


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
