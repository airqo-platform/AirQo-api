#from helpers import helpers
from pymongo import MongoClient
#from app import mongo, MONGO_URI
from datetime import datetime, timedelta
import os
import sys
from dotenv import load_dotenv
load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')


def connect_mongo(tenant):
    client = MongoClient(MONGO_URI)
    if tenant == 'airqo':
        db_selected = 'airqo_netmanager'
    else:
        db_selected = 'airqo_netmanager_' + tenant
    db = client[db_selected]
    return db
