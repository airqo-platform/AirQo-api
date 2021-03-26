from pymongo import MongoClient
from datetime import datetime, timedelta
import os
import sys
from config import constants
from dotenv import load_dotenv
from http import HTTPStatus
load_dotenv()


app_configuration = constants.app_config.get(os.getenv("FLASK_ENV"))


def connect_mongo(tenant):
    try:
        client = MongoClient(app_configuration.MONGO_URI)
    except pymongo.errors.ConnectionFailure as e:
        return {'message': 'unable to connect to database', 'sucess': False}, HTTPStatus.BAD_REQUEST
    db = client[f'{app_configuration.DB_NAME}_{tenant.lower()}']
    return db
