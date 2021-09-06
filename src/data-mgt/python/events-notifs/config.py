import os
from pathlib import Path

import urllib3
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


class Config:
    TENANT = os.getenv("TENANT")
    HOURS = os.getenv("HOURS")


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
