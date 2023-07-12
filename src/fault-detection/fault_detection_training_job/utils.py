import pandas as pd
import gcsfs
import os
import joblib
from google.oauth2 import service_account
from config import configuration
from datetime import datetime
from pymongo import MongoClient


def upload_trained_model_to_gcs(trained_model, scaler, project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)

    try:
        fs.rename(f'{bucket_name}/{source_blob_name}', f'{bucket_name}/{datetime.now()}-{source_blob_name}')
        print("Bucket: Previous model is backed up")
        fs.rename(f'{bucket_name}/scaler.pkl', f'{bucket_name}/{datetime.now()}-scaler.pkl')
        print("Bucket: Previous scaler is backed up")
    except:
        print("Bucket: No file to update")

    temp_file = 'temp_model.keras'
    trained_model.save(temp_file)

    with fs.open(bucket_name + '/' + source_blob_name, 'wb') as model_handle:
        model_handle.write(open(temp_file, 'rb').read())
    os.remove(temp_file)

    with fs.open(bucket_name + '/scaler.pkl', 'wb') as scaler_handle:
        joblib.dump(scaler, scaler_handle)

    print("Trained model and scaler are uploaded to GCS bucket")


def date_to_str(date, format='%Y-%m-%dT%H:%M:%S.%fZ'):
    """Converts datetime to a string"""
    return datetime.strftime(date, format)


def connect_mongo():
    client = MongoClient(configuration.MONGO_URI)
    db = client[configuration.DB_NAME]
    return db
