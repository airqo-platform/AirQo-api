from pymongo import MongoClient
from config.constants import configuration


def connect_mongo(tenant):
    client = MongoClient(configuration.MONGO_URI)
    db = client[f'{configuration.DB_NAME}_{tenant.lower()}']
    return db
