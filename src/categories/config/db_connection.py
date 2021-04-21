
from flask_pymongo import PyMongo
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
import sys
from config import constants
from dotenv import load_dotenv
load_dotenv()


app_configuration = constants.app_config.get(os.getenv("FLASK_ENV"))


def connect_mongo(tenant):
    print("MONGO URI", app_configuration.MONGO_URI)
    print("DB_NAME", app_configuration.DB_NAME)

    client = MongoClient(app_configuration.MONGO_URI)
    db = client[f'{app_configuration.DB_NAME}_{tenant.lower()}']
    return db
