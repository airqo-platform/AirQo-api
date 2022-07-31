import traceback
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .commons import (
    resample_data,
    get_frequency,
    get_air_quality,
)
from .config import configuration
from .constants import Frequency
from .date import (
    date_to_str,
    predict_str_to_date,
)
from .message_broker import KafkaBrokerClient

insights_columns = ["time", "pm2_5", "pm10", "siteId", "frequency", "forecast", "empty"]


class AirQoAppUtils:
    @staticmethod
    def extract_hourly_airqo_data(start_date_time, end_date_time) -> pd.DataFrame:
        cols = [
            "pm2_5",
            "pm10",
            "timestamp",
            "site_id",
        ]
        bigquery_api = BigQueryApi()
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=cols,
            table=bigquery_api.hourly_measurements_table,
            where_fields={"tenant": "airqo"},
        )

        if measurements.empty:
            return pd.DataFrame([], columns=cols)

        measurements.rename(
            columns={"timestamp": "time", "site_id": "siteId"}, inplace=True
        )
        measurements["time"] = measurements["time"].apply(pd.to_datetime)
        measurements["frequency"] = str(Frequency.HOURLY)
        measurements[["forecast", "empty"]] = False

        return measurements

    @staticmethod
    def format_data_to_insights(
        data: pd.DataFrame, frequency: Frequency
    ) -> pd.DataFrame:

        insights = data[["site_id", "timestamp", "pm2_5", "pm10"]]
        insights.rename(
            columns={"timestamp": "time", "site_id": "siteId"}, inplace=True
        )
        insights["frequency"] = frequency
        insights[["empty", "forecast"]] = False

        return AirQoAppUtils.create_insights(insights)

    @staticmethod
    def create_insights(data: pd.DataFrame) -> pd.DataFrame:

        data = data.copy()

        if data.empty:
            return pd.DataFrame(columns=insights_columns)

        data["frequency"] = data["frequency"].apply(lambda x: str(x).upper())
        data["forecast"] = data["forecast"].fillna(False)
        data["empty"] = False
        data["pm2_5"] = data["pm2_5"].apply(
            lambda x: AirQoAppUtils.round_off_value(x, "pm2_5")
        )
        data["pm10"] = data["pm10"].apply(
            lambda x: AirQoAppUtils.round_off_value(x, "pm10")
        )
        if sorted(list(data.columns)) != sorted(insights_columns):
            print(f"Required columns {insights_columns}")
            print(f"Dataframe columns {list(data.columns)}")
            raise Exception("Invalid columns")

        data = data.dropna()

        return data

    @staticmethod
    def save_insights(insights_data: pd.DataFrame = None, partition: int = 0):
        insights_data = (
            [] if insights_data.empty else insights_data.to_dict(orient="records")
        )

        print(f"saving {len(insights_data)} insights .... ")

        data = {
            "data": insights_data,
            "action": "",
        }

        kafka = KafkaBrokerClient()
        kafka.send_data(
            info=data,
            topic=configuration.INSIGHTS_MEASUREMENTS_TOPIC,
            partition=partition,
        )

    @staticmethod
    def extract_forecast_data() -> pd.DataFrame:
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant="airqo")

        forecast_measurements = pd.DataFrame(data=[], columns=insights_columns)
        time = int((datetime.utcnow() + timedelta(hours=1)).timestamp())

        for device in devices:
            device_dict = dict(device)
            device_number = device_dict.get("device_number", None)
            site = device_dict.get("site", None)
            if not site:
                print(f"device {device_number} isn't attached to  a site.")
                continue
            site_id = site["_id"]

            if device_number:

                forecast = airqo_api.get_forecast(
                    channel_id=device_number, timestamp=time
                )
                if forecast:
                    forecast_df = pd.DataFrame(forecast)

                    forecast_cleaned_df = pd.DataFrame(columns=insights_columns)
                    forecast_cleaned_df["time"] = forecast_df["prediction_time"]
                    forecast_cleaned_df["pm2_5"] = forecast_df["prediction_value"]
                    forecast_cleaned_df["pm10"] = forecast_df["prediction_value"]
                    forecast_cleaned_df["siteId"] = site_id
                    forecast_cleaned_df["frequency"] = "hourly"
                    forecast_cleaned_df["forecast"] = True
                    forecast_cleaned_df["empty"] = False

                    forecast_measurements = forecast_measurements.append(
                        forecast_cleaned_df, ignore_index=True
                    )

        forecast_measurements["time"] = forecast_measurements["time"].apply(
            lambda x: AirQoAppUtils.predict_time_to_string(x)
        )
        forecast_measurements = forecast_measurements[
            forecast_measurements["pm2_5"].notna()
        ]

        return forecast_measurements

    @staticmethod
    def predict_time_to_string(time: str):
        date_time = predict_str_to_date(time)
        return date_to_str(date_time)

    @staticmethod
    def extract_insights(
        freq: str,
        start_date_time: str,
        end_date_time: str,
        forecast=False,
        all_data=False,
    ) -> pd.DataFrame:
        airqo_api = AirQoApi()
        insights = []

        frequency = get_frequency(start_time=start_date_time, end_time=end_date_time)
        dates = pd.date_range(start_date_time, end_date_time, freq=frequency)
        last_date_time = dates.values[len(dates.values) - 1]

        for date in dates:

            start = date_to_str(date)
            end_date_time = date + timedelta(hours=dates.freq.n)

            if np.datetime64(end_date_time) > last_date_time:
                timestring = pd.to_datetime(str(last_date_time))
                end = date_to_str(timestring)
            else:
                end = date_to_str(end_date_time)

            if start == end:
                end = date_to_str(start, str_format="%Y-%m-%dT%H:59:59Z")

            try:
                api_results = airqo_api.get_app_insights(
                    start_time=start,
                    frequency=freq,
                    end_time=end,
                    forecast=forecast,
                    all_data=all_data,
                )
                insights.extend(api_results)

            except Exception as ex:
                print(ex)
                traceback.print_exc()

        return pd.DataFrame(insights)

    @staticmethod
    def transform_old_forecast(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        forecast_data = AirQoAppUtils.extract_insights(
            freq="hourly",
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            forecast=True,
        )

        forecast_data_df = pd.DataFrame(data=forecast_data, columns=insights_columns)
        forecast_data_df["forecast"] = False
        forecast_data_df["empty"] = False
        return forecast_data_df

    @staticmethod
    def average_insights(data: pd.DataFrame, frequency="daily") -> pd.DataFrame:
        if data.empty:
            return pd.DataFrame(data=[], columns=insights_columns)

        site_groups = data.groupby("siteId")
        sampled_data = []

        for _, site_group in site_groups:
            site_id = site_group.iloc[0]["siteId"]
            insights = site_group[["time", "pm2_5", "pm10"]]

            averages = resample_data(insights, frequency)

            averages["frequency"] = frequency.upper()
            averages["siteId"] = site_id
            averages["forecast"] = False
            averages["empty"] = False

            sampled_data.extend(averages.to_dict(orient="records"))

        return pd.DataFrame(sampled_data)

    @staticmethod
    def round_off_value(value, pollutant, decimals: int = 2):
        new_value = round(value, decimals)

        if get_air_quality(value, pollutant) != get_air_quality(new_value, pollutant):
            try:
                new_value = f"{value}".split(".")
                decimal_values = new_value[1][:decimals]
                return float(f"{new_value[0]}.{decimal_values}")
            except Exception as ex:
                print(ex)
            return value

        return new_value
