import pandas as pd
from google.oauth2 import service_account
from config import configuration


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
    query = f"""
  SELECT DISTINCT timestamp, device_number, s1_pm2_5 FROM `{configuration.GOOGLE_CLOUD_PROJECT_ID}.raw_data.device_measurements` where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH) and tenant = 'airqo'
    ORDER
    BY
    timestamp
    """
    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    df.rename(columns={'s1_pm2_5': 'pm2_5'}, inplace=True)
    return df
