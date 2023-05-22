import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import Tenant
from airqo_etl_utils.data_validator import DataValidationUtils


class DailyDataUtils:
    @staticmethod
    def average_data(data: pd.DataFrame) -> pd.DataFrame:
        averaged_data = pd.DataFrame()
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)

        for _, by_tenant in data.groupby("tenant"):
            tenant = by_tenant.iloc[0]["tenant"]
            del by_tenant["tenant"]
            for _, by_device in by_tenant.groupby("device_id"):
                site_id = by_device.iloc[0]["site_id"]
                device_id = by_device.iloc[0]["device_id"]
                device_number = by_device.iloc[0]["device_number"]

                del by_device["site_id"]
                del by_device["device_id"]
                del by_device["device_number"]

                device_averages = by_device.resample("1D", on="timestamp").mean()
                device_averages["timestamp"] = device_averages.index
                device_averages["device_id"] = device_id
                device_averages["site_id"] = site_id
                device_averages["device_number"] = device_number
                device_averages["tenant"] = tenant

                averaged_data = pd.concat(
                    [averaged_data, device_averages], ignore_index=True
                )

        return averaged_data

    @staticmethod
    def query_hourly_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        raw_data = bigquery_api.query_data(
            table=bigquery_api.hourly_measurements_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.ALL,
        )

        return DataValidationUtils.remove_outliers(raw_data)

    @staticmethod
    def query_daily_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        raw_data = bigquery_api.query_data(
            table=bigquery_api.daily_measurements_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.ALL,
        )

        return DataValidationUtils.remove_outliers(raw_data)

    @staticmethod
    def cleanup_and_reload(
        data: pd.DataFrame, start_date_time=None, end_date_time=None
    ):
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data = data.drop_duplicates(
            subset=["device_number", "device_id", "timestamp"], keep="first"
        )

        bigquery_api = BigQueryApi()
        table = bigquery_api.daily_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=table,
        )

        bigquery_api.reload_data(
            tenant=Tenant.ALL,
            table=table,
            dataframe=data,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @staticmethod
    def save_data(data: pd.DataFrame):
        bigquery_api = BigQueryApi()

        table = bigquery_api.daily_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=table,
        )

        bigquery_api.load_data(
            table=table,
            dataframe=data,
        )
