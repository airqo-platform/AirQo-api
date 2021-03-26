from pymongo import MongoClient
import os
import pymongo
import sys
from config import db_connection


def db_names():
    client = MongoClient(db_connection.app_configuration.MONGO_URI)
    return client.list_database_names()
