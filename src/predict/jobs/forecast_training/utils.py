import gcsfs
import joblib
import pandas as pd
from datetime import datetime
from google.cloud import storage
from google.oauth2 import service_account

from config import configuration


def upload_trained_model_to_gcs(trained_model, project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)

    # backup previous model 
    try:
        fs.rename(f'{bucket_name}/{source_blob_name}', f'{bucket_name}/{datetime.now()}-{source_blob_name}')
        print("Bucket: previous model is backed up")
    except:
        print("Bucket: No file to updated")

    # store new model
    with fs.open(bucket_name + '/' + source_blob_name, 'wb') as handle:
        job = joblib.dump(trained_model, handle)


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
    tenants = str(configuration.TENANTS).split(',')
    query = f"""
    SELECT DISTINCT timestamp, site_id, device_number,pm2_5_calibrated_value FROM `{configuration.GOOGLE_CLOUD_PROJECT_ID}.consolidated_data.hourly_device_measurements` where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL {configuration.NUMBER_OF_MONTHS} MONTH) and tenant IN UNNEST({tenants}) ORDER BY timestamp 
    """
    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    df.rename(columns={'timestamp': 'created_at', 'pm2_5_calibrated_value': 'pm2_5'}, inplace=True)
    return df
