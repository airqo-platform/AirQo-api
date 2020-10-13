
from pymongo import MongoClient
import app
from datetime import datetime, timedelta
import os
import sys
from dotenv import load_dotenv
load_dotenv()

if os.getenv('FLASK_ENV') == 'production':
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_PROD')
elif os.getenv('FLASK_ENV') == 'testing':
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_STAGE')
else:
    MONGO_URI = os.getenv('MONGO_DEV_URI')
    DB_NAME = os.getenv('DB_NAME_DEV')


def connect_mongo(tenant):
    client = MongoClient(MONGO_URI)
    db_selected = DB_NAME + '_' + tenant.lower()
    db = client[db_selected]
    return db
