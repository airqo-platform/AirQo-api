
from pymongo import MongoClient
import app
from datetime import datetime, timedelta
import os
import sys
from dotenv import load_dotenv
load_dotenv()

if os.getenv('FLASK_ENV') == 'development':
    MONGO_URI = os.getenv('MONGO_DEV_URI')
    DB_NAME = os.getenv('DB_NAME_DEV')
elif os.getenv('FLASK_ENV') == 'testing':
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_STAGE')
else:
    MONGO_URI = os.getenv('MONGO_GCE_URI')
    DB_NAME = os.getenv('DB_NAME_PROD')


def connect_mongo(tenant):
    client = MongoClient(MONGO_URI)
    if tenant == 'airqo':
        db_selected = DB_NAME
    else:
        db_selected = DB_NAME + '_' + tenant
    db = client[db_selected]
    return db
