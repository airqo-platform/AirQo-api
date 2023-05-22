from datetime import datetime, timedelta

import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import Tenant
from airqo_etl_utils.data_validator import DataValidationUtils
from airqo_etl_utils.date import predict_str_to_date, date_to_str


class ForecastDataUtils:
    @staticmethod
    def forecast_time_to_string(time: str):
        date_time = predict_str_to_date(time)
        return date_to_str(date_time)

    @staticmethod
    def query_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        raw_data = bigquery_api.query_data(
            table=bigquery_api.forecast_measurements_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.ALL,
        )

        return DataValidationUtils.remove_outliers(raw_data)

    @staticmethod
    def extract_data_from_api() -> pd.DataFrame:
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant=Tenant.AIRQO)
        forecast_data = pd.DataFrame()

        time = int((datetime.utcnow() + timedelta(hours=1)).timestamp())

        for device in devices:
            device_dict = dict(device)
            device_number = device_dict.get("device_number", None)
            device_id = device_dict.get("device_id", None)
            site_id = device_dict.get("site_id", None)
            tenant = device_dict.get("tenant", None)

            if device_number:
                forecast = airqo_api.get_forecast(
                    channel_id=device_number, timestamp=time
                )
                if forecast:
                    device_forecast_data = pd.DataFrame(forecast)

                    device_forecast_data.rename(
                        columns={
                            "prediction_time": "timestamp",
                            "prediction_value": "pm2_5",
                            "lower_ci": "lower_confidence_interval",
                            "upper_ci": "upper_confidence_interval",
                        },
                        inplace=True,
                    )

                    device_forecast_data["site_id"] = site_id
                    device_forecast_data["device_number"] = device_number
                    device_forecast_data["device_id"] = device_id
                    device_forecast_data["device_number"] = device_number
                    device_forecast_data["tenant"] = tenant

                    forecast_data = pd.concat(
                        [forecast_data, device_forecast_data], ignore_index=True
                    )

        forecast_data.dropna(subset=["pm2_5", "timestamp"], inplace=True)
        forecast_data["timestamp"] = forecast_data["timestamp"].apply(pd.to_datetime)

        return forecast_data

    @staticmethod
    def save_data(data: pd.DataFrame):
        bigquery_api = BigQueryApi()

        table = bigquery_api.forecast_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=table,
        )

        bigquery_api.load_data(
            table=table,
            dataframe=data,
        )

    @staticmethod
    def cleanup_and_reload(
        data: pd.DataFrame, start_date_time=None, end_date_time=None
    ):
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data = data.drop_duplicates(
            subset=["device_number", "device_id", "timestamp"], keep="first"
        )

        bigquery_api = BigQueryApi()
        table = bigquery_api.forecast_measurements_table
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
