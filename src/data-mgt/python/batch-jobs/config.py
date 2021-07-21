import os
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

    def __init__(self):
        pass


class ProductionConfig(Config):
    AIRQO_BASE_URL = "https://platform.airqo.net/api/v1/"


class DevelopmentConfig(Config):
    AIRQO_BASE_URL = "http://localhost:3000/api/v1/"


class StagingConfig(Config):
    AIRQO_BASE_URL = "https://staging-platform.airqo.net/api/v1/"


app_config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "staging": StagingConfig
}

environment = os.getenv("ENV")
print("ENVIRONMENT", environment or 'development')

configuration = app_config.get(environment, DevelopmentConfig)
print("TENANT", configuration.TENANT)
print("START TIME", configuration.START_TIME)
print("END TIME", configuration.END_TIME)
