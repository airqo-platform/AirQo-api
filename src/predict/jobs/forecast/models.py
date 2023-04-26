import concurrent.futures
from datetime import datetime, timedelta
import requests

import aiohttp
import dateutil.parser
import pandas as pd
from google.oauth2 import service_account
import pandas as pd
import requests

from config import configuration


class Events:
    def __init__(self):
        super().__init__()

    events_url = f"{configuration.AIRQO_API_BASE_URL}devices/events"

    @staticmethod
    def fetch_data_from_events_api():
        """gets data from the events api in batches"""
        start_date = datetime.now() - timedelta(days=30)
        end_date = datetime.now()
        batch_size = timedelta(hours=5)
        data = []
        batches = []
        while start_date < end_date:
            batch_start = start_date.strftime('%Y-%m-%d')
            batch_end = (start_date + batch_size).strftime('%Y-%m-%d')
            batches.append((batch_start, batch_end))
            start_date += batch_size

        def fetch_batch(batch):
            start, end = batch
            params = {
                'tenant': configuration.TENANT,
                'startTime': start,
                'endTime': end
            }
            response = requests.get(Events.events_url, params=params)
            if response.status_code != 200:
                raise Exception(f'Error fetching data from events api: {response.text}')
            else:
                return response.json()

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(fetch_batch, batch) for batch in batches]
            for future in concurrent.futures.as_completed(futures):
                data.append(future.result())
        return data

    @staticmethod
    def get_forecast_data():
        """transforms the events json data to a pandas dataframe"""
        data = Events.fetch_data_from_events_api()
        final_df = pd.DataFrame()
        for batch in data:
            df = pd.DataFrame(batch['measurements'], columns=['time', 'site_id', 'pm2_5', 'deviceDetails'])
            df['deviceDetails'] = df['deviceDetails'].apply(lambda x: list(x.values())[-2][0])
            df['pm2_5'] = df['pm2_5'].apply(lambda x: list(x.values())[1])
            df.rename(columns={'time': 'created_at', 'deviceDetails': 'device_number'}, inplace=True)
            final_df = pd.concat([final_df, df], ignore_index=True)
        return final_df

    # TODO: Remove this and use Events API only
    @staticmethod
    def fetch_bigquery_data():
        """gets data from the bigquery table"""

        credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
        query = f"""
        SELECT DISTINCT timestamp, site_id, device_number,pm2_5_calibrated_value FROM `{configuration.GOOGLE_CLOUD_PROJECT_ID}.averaged_data.hourly_device_measurements` where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH) and tenant = 'airqo' ORDER BY timestamp 
        """
        df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
        df.rename(columns={'timestamp': 'created_at', 'pm2_5_calibrated_value': 'pm2_5'}, inplace=True)
        return df

    @staticmethod
    def fetch_health_tips():
        "fetch health tips from the api"
        response = requests.get(Events.events_tips_url, headers={"authorization": configuration.AIRQO_API_KEY})
        if response.status_code == 200:
            result = response.json()
            return result["tips"]
