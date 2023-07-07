import datetime

import pandas as pd
import requests
from google.oauth2 import service_account

from config import configuration
from forecast.utils import date_to_str

credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)


class Events:
    def __init__(self):
        super().__init__()

    events_tips_url = f"{configuration.AIRQO_API_BASE_URL}devices/tips/"

    @staticmethod
    def fetch_monthly_bigquery_data():
        """gets data from the bigquery table"""

        start_date = datetime.datetime.utcnow() - datetime.timedelta(days=configuration.NUMBER_OF_MONTHS)
        start_date = date_to_str(start_date, format='%Y-%m-%dT00:00:00Z')

        query = f"""
                SELECT DISTINCT timestamp , site_id, device_number, pm2_5_calibrated_value 
                FROM `{configuration.BIGQUERY_HOURLY_DATA_TABLE}` 
                WHERE DATE(timestamp) >= '{start_date}' 
                ORDER BY device_number, timestamp 
        """

        df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
        df.rename(columns={'timestamp': 'created_at', 'pm2_5_calibrated_value': 'pm2_5'}, inplace=True)
        return df

    @staticmethod
    def fetch_hourly_bigquery_data():
        """gets data from the bigquery table"""

        start_date = datetime.datetime.utcnow() - datetime.timedelta(hours=int(configuration.NUMBER_OF_HOURS))
        start_date = date_to_str(start_date, format='%Y-%m-%dT00:00:00Z')

        query = f"""
                SELECT DISTINCT timestamp , site_id, device_number,pm2_5_calibrated_value 
                FROM `{configuration.GOOGLE_CLOUD_PROJECT_ID}.averaged_data.hourly_device_measurements` 
                WHERE DATE(timestamp) >= '{start_date}' 
                ORDER BY device_number, timestamp 
        """

        df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
        df.rename(columns={'timestamp': 'created_at', 'pm2_5_calibrated_value': 'pm2_5'}, inplace=True)
        return df

    @staticmethod
    def fetch_health_tips():
        """fetch health tips from the api"""
        response = requests.get(Events.events_tips_url, params={"token": configuration.AIRQO_API_AUTH_TOKEN})
        if response.status_code == 200:
            result = response.json()
        return result["tips"]

    @staticmethod
    def save_hourly_forecasts_to_bigquery(df):
        """saves the dataframe to the bigquery table"""
        df.to_gbq(
            destination_table=f"{configuration.GOOGLE_CLOUD_PROJECT_ID}.{configuration.BIGQUERY_DATASET}.daily_24_hour_forecasts",
            project_id=configuration.GOOGLE_CLOUD_PROJECT_ID,
            if_exists='append',
            credentials=credentials)

        print("Data saved to bigquery")

    @staticmethod
    def save_daily_forecasts_to_bigquery(df):
        """saves the dataframe to the bigquery table"""
        df.to_gbq(
            destination_table=f"{configuration.GOOGLE_CLOUD_PROJECT_ID}.{configuration.BIGQUERY_DATASET}.daily_1_week_forecasts",
            project_id=configuration.GOOGLE_CLOUD_PROJECT_ID,
            if_exists='append',
            credentials=credentials)

        print("Data saved to bigquery")
