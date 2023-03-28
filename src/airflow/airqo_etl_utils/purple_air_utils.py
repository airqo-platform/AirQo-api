import pandas as pd

from .bigquery_api import BigQueryApi
from .constants import Tenant, DataSource
from .purple_air_api import PurpleAirApi
from .utils import Utils


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
        data = pd.DataFrame()
        bigquery_api = BigQueryApi()
        devices = bigquery_api.query_devices(tenant=Tenant.NASA)

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.TAHMO,
        )

        for _, device in devices.iterrows():
            device_number = device["device_number"]

            for start, end in dates:
                query_data = PurpleDataUtils.query_data(
                    start_date_time=start,
                    end_date_time=end,
                    device_number=device_number,
                )

                if not query_data.empty:
                    query_data["device_number"] = device_number
                    query_data["latitude"] = device["latitude"]
                    query_data["longitude"] = device["longitude"]
                    query_data["device_id"] = device["device_id"]
                    data = data.append(query_data, ignore_index=True)

        return data

    @staticmethod
    def process_data(data: pd.DataFrame) -> pd.DataFrame:
        data.rename(
            columns={
                "time_stamp": "timestamp",
                "humidity": "device_humidity",
                "temperature": "device_temperature",
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
                "voc_a": "s1_voc",
                "voc_b": "s2_voc",
            },
            inplace=True,
        )
        data["tenant"] = str(Tenant.NASA)
        return data

    @staticmethod
    def process_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        return Utils.populate_missing_columns(data=data, cols=cols)
