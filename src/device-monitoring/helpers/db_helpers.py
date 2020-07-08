#from helpers import helpers
from pymongo import MongoClient
#from app import mongo, MONGO_URI
from datetime import datetime, timedelta
import os
import sys

MONGO_URI = os.getenv('MONGO_URI')


def connect_mongo():
    client = MongoClient(MONGO_URI)
    db = client['airqo_netmanager']
    return db
