import asyncio
import math
from datetime import datetime, timedelta

import aiohttp
import dateutil.parser
import pandas as pd
from google.oauth2 import service_account

from config import configuration


class Events:
    def __init__(self):
        super().__init__()

    events_measurements_url = f"{configuration.AIRQO_API_BASE_URL}devices/events/all"

    # events_tips_url = f"{configuration.AIRQO_API_BASE_URL}devices/tips/"

    @staticmethod
    def fetch_data_from_events_api():
        async def fetch_page(session, url, params, headers):
            try:
                async with session.get(url, params=params, headers=headers) as response:
                    return await response.json()
            except aiohttp.ClientError as e:
                print("Error fetching page: ", e)
                return None

        async def fetch_all_pages(url, params, headers):
            async with aiohttp.ClientSession() as session:
                response = await fetch_page(session, url, params, headers)
                measurements = response["measurements"]
                total_pages = response["meta"]["pages"]
                tasks = []
                for page in range(2, total_pages + 1):
                    params["page"] = page
                    tasks.append(fetch_page(session, url, params, headers))
                results = await asyncio.gather(*tasks)
                for result in results:
                    measurements.extend(result["measurements"])
                return measurements

        start_date = datetime.now() - timedelta(days=30)
        end_date = datetime.now()
        params = {
            "tenant": configuration.TENANT,
        }
        headers = {"authorization": configuration.AIRQO_API_KEY}
        interval = timedelta(days=5)
        all_measurements = []
        while start_date < end_date:
            params["startTime"] = start_date.strftime("%Y-%m-%d")
            params["endTime"] = (start_date + interval).strftime("%Y-%m-%d")
            measurements = asyncio.run(fetch_all_pages(Events.events_measurements_url, params, headers))
            all_measurements += measurements
            start_date += interval

        return all_measurements

    @staticmethod
    def get_forecast_data():
        """transforms the events json data to a pandas dataframe and returns it"""
        data = Events.fetch_data_from_events_api()
        if data is None:
            return Events.fetch_bigquery_data()
        else:
            df_data = [
                {"created_at": dateutil.parser.parse(d["time"]),
                 "site_id": d["site_id"],
                 "pm2_5": d["pm2_5"]["calibratedValue"],
                 "device_number": d["deviceDetails"]["device_codes"][0]} for
                d in data if "site_id" in d and d["site_id"] and "deviceDetails" in d and "device_codes" in d[
                    "deviceDetails"] and len(
                    d["deviceDetails"]["device_codes"]) > 0 and "pm2_5" in d and "calibratedValue" in d["pm2_5"] and
                             d["pm2_5"]["calibratedValue"] is not None and not math.isnan(
                    d["pm2_5"]["calibratedValue"])]
            df = pd.DataFrame(df_data)
            return df

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
