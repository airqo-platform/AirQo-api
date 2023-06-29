import gcsfs
import joblib
import pandas as pd
from datetime import datetime
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


def fetch_bigquery_data(job_type):
    """gets data from the bigquery table"""

    months = configuration.MONTHS_OF_DATA_HOURLY_JOB if job_type == 'hourly_forecast' else configuration.MONTHS_OF_DATA_DAILY_JOB

    credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
    tenants = str(configuration.TENANTS).split(',')
    query = f"""
    SELECT DISTINCT timestamp , device_number,pm2_5_calibrated_value FROM `{configuration.GOOGLE_CLOUD_PROJECT_ID}.averaged_data.hourly_device_measurements` where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL {months} MONTH) and tenant IN UNNEST({tenants}) ORDER BY device_number, timestamp 
    """
    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    df.rename(columns={'timestamp': 'created_at', 'pm2_5_calibrated_value': 'pm2_5'}, inplace=True)
    return df
