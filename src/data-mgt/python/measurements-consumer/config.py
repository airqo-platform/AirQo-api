import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class Config:
    BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS").split(",")
    PURPLE_AIR_DATA_GROUP_ID = os.getenv("PURPLE_AIR_DATA_GROUP_ID")
    PURPLE_AIR_RAW_MEASUREMENTS_DATA_TOPIC = os.getenv(
        "PURPLE_AIR_RAW_MEASUREMENTS_DATA_TOPIC"
    )


configuration = Config()
