import os

from dotenv import load_dotenv
from pymongo import MongoClient

from config import constants

load_dotenv()


app_configuration = constants.app_config.get(os.getenv("FLASK_ENV"))


def connect_mongo(tenant):
    client = MongoClient(app_configuration.MONGO_URI)
    db = client[f"{app_configuration.DB_NAME}_{tenant.lower()}"]
    return db
