from datetime import timedelta

import numpy as np
import pandas as pd

from .bigquery_api import BigQueryApi
from .commons import Utils, get_frequency
from .constants import Tenant
from .date import date_to_str
from .purple_air_api import PurpleAirApi


class PurpleDataUtils:
    @staticmethod
    def query_data(
        start_date_time: str, end_date_time: str, device_number: int
    ) -> pd.DataFrame:
        purple_air_api = PurpleAirApi()

        response = purple_air_api.get_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            sensor=device_number,
        )

        return pd.DataFrame(
            columns=response.get("fields", []),
            data=response.get("data", []),
        )

    @staticmethod
    def extract_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:

        frequency = get_frequency(start_time=start_date_time, end_time=end_date_time)
        dates = pd.date_range(start_date_time, end_date_time, freq=frequency)
        last_date_time = dates.values[len(dates.values) - 1]
        data = pd.DataFrame()
        bigquery_api = BigQueryApi()
        devices = bigquery_api.query_devices(tenant=Tenant.NASA)

        for _, device in devices.iterrows():
            device_number = device["device_number"]

            for date in dates:

                start = date_to_str(date)
                end_date = date + timedelta(hours=dates.freq.n)

                if np.datetime64(end_date) > last_date_time:
                    timestring = pd.to_datetime(str(last_date_time))
                    end = date_to_str(timestring)
                else:
                    end = date_to_str(end_date)

                if start == end:
                    end = date_to_str(date, str_format="%Y-%m-%dT%H:59:59Z")

                query_data = PurpleDataUtils.query_data(
                    start_date_time=start,
                    end_date_time=end,
                    device_number=device_number,
                )

                if not query_data.empty:
                    query_data["device_number"] = device_number
                    query_data["latitude"] = device["latitude"]
                    query_data["longitude"] = device["longitude"]
                    data = data.append(query_data, ignore_index=True)

        return data

    @staticmethod
    def process_data(data: pd.DataFrame) -> pd.DataFrame:

        data.rename(
            columns={
                "time_stamp": "timestamp",
                "humidity_a": "s1_humidity",
                "humidity_b": "s2_humidity",
                "temperature_a": "s1_temperature",
                "temperature_b": "s2_temperature",
                "pressure_a": "s1_pressure",
                "pressure_b": "s2_pressure",
                "pm1.0_atm": "pm1",
                "pm1.0_atm_a": "s1_pm1",
                "pm1.0_atm_b": "s2_pm1",
                "pm2.5_atm": "pm2_5",
                "pm2.5_atm_a": "s1_pm2_5",
                "pm2.5_atm_b": "s2_pm2_5",
                "pm10.0_atm": "pm10",
                "pm10.0_atm_a": "s1_pm10",
                "pm10.0_atm_b": "s2_pm10",
            },
            inplace=True,
        )
        data["tenant"] = Tenant.NASA
        return data

    @staticmethod
    def process_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(
            table=big_query_api.temp_raw_measurements_table
        )
        return Utils.populate_missing_columns(data=data, cols=cols)
