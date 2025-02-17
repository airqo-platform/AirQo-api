import os
from configure import load_tflite_model_from_gcs, Config
from pymongo import MongoClient  

from pymongo.errors import ConnectionFailure

def connect_mongo():
    client = MongoClient(Config.MONGO_URI)
    return client[Config.DB_NAME]
db = connect_mongo()
collection = db["combined_data"]

print("Mongo URI:", Config.MONGO_URI)
print("Database Name:", Config.DB_NAME)


try:
    db = connect_mongo()
    db.command("ping")  # Checks connection
    print("Connected to MongoDB")
except ConnectionFailure as e:
    print("Failed to connect:", e)

print(db.list_collection_names())  # Should show 'combined_data'

