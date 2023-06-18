import os
from pathlib import Path

from dotenv import load_dotenv

env_path = Path(".") / ".env"
load_dotenv(dotenv_path=env_path, verbose=True)


class Config:
    AIRQLOUDS_TOPIC = os.getenv("AIRQLOUDS_TOPIC")
    SITES_TOPIC = os.getenv("SITES_TOPIC")
    DEVICES_TOPIC = os.getenv("DEVICES_TOPIC")
    BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")

    AIRQLOUDS_TABLE = os.getenv("AIRQLOUDS_TABLE")
    SITES_TABLE = os.getenv("SITES_TABLE")
    DEVICES_TABLE = os.getenv("DEVICES_TABLE")
    AIRQLOUDS_SITES_TABLE = os.getenv("AIRQLOUDS_SITES_TABLE")
