import traceback
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from airflow_utils.airqo_api import AirQoApi
from airflow_utils.config import configuration
from airflow_utils.message_broker import KafkaBrokerClient
from airflow_utils.date import (
    date_to_str_hours,
    date_to_str_days,
    date_to_str,
    predict_str_to_date,
    str_to_date,
)
from airflow_utils.commons import (
    get_airqo_api_frequency,
    resample_data,
)


def format_measurements_to_insights(data: list):
    measurements_df = pd.json_normalize(data)
    if "pm2_5.calibratedValue" not in measurements_df.columns:
        measurements_df["pm2_5.calibratedValue"] = ["pm2_5.value"]
    else:
        measurements_df["pm2_5.calibratedValue"].fillna(
            measurements_df["pm2_5.value"], inplace=True
        )

    if "pm10.calibratedValue" not in measurements_df.columns:
        measurements_df["pm10.calibratedValue"] = measurements_df["pm10.value"]
    else:
        measurements_df["pm10.calibratedValue"].fillna(
            measurements_df["pm10.value"], inplace=True
        )

    measurements_df = measurements_df[
        [
            "time",
            "frequency",
            "site_id",
            "pm2_5.calibratedValue",
            "pm10.calibratedValue",
        ]
    ]

    measurements_df.columns = ["time", "frequency", "siteId", "pm2_5", "pm10"]
    measurements_df = measurements_df.dropna()

    measurements_df["frequency"] = measurements_df["frequency"].apply(
        lambda x: str(x).upper()
    )

    hourly_measurements_df = measurements_df.loc[
        measurements_df["frequency"] == "HOURLY"
    ]
    hourly_measurements_df["time"] = hourly_measurements_df["time"].apply(
        lambda x: measurement_time_to_string(x, daily=False)
    )

    daily_measurements_df = measurements_df.loc[measurements_df["frequency"] == "DAILY"]
    daily_measurements_df["time"] = daily_measurements_df["time"].apply(
        lambda x: measurement_time_to_string(x, daily=True)
    )

    data = pd.concat([hourly_measurements_df, daily_measurements_df], ignore_index=True)
    data["empty"] = False
    data["forecast"] = False

    return data.to_dict(orient="records")


def save_insights_data(
    insights_data: list = None,
    action: str = "insert",
    start_time=datetime(year=2020, month=1, day=1),
    end_time=datetime(year=2020, month=1, day=1),
):
    if insights_data is None:
        insights_data = []

    print("saving insights .... ")

    data = {
        "data": insights_data,
        "action": action,
        "startTime": date_to_str(start_time),
        "endTime": date_to_str(end_time),
    }

    kafka = KafkaBrokerClient()
    kafka.send_data(info=data, topic=configuration.INSIGHTS_MEASUREMENTS_TOPIC)


def predict_time_to_string(time: str):
    date_time = predict_str_to_date(time)
    return date_to_str(date_time)


def measurement_time_to_string(time: str, daily=False):
    date_time = str_to_date(time)
    if daily:
        return date_to_str_days(date_time)
    else:
        return date_to_str_hours(date_time)


def get_forecast_data(tenant: str) -> list:
    airqo_api = AirQoApi()
    columns = ["time", "pm2_5", "pm10", "siteId", "frequency", "forecast", "empty"]
    devices = airqo_api.get_devices(tenant=tenant, all_devices=False)

    forecast_measurements = pd.DataFrame(data=[], columns=columns)
    time = int(datetime.utcnow().timestamp())

    for device in devices:
        device_dict = dict(device)
        device_number = device_dict.get("device_number", None)
        site = device_dict.get("site", None)
        if not site:
            print(f"device {device_number} isn't attached to  a site.")
            continue
        site_id = site["_id"]

        if device_number:

            forecast = airqo_api.get_forecast(channel_id=device_number, timestamp=time)
            if forecast:
                forecast_df = pd.DataFrame(forecast)

                forecast_cleaned_df = pd.DataFrame(columns=columns)
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
        lambda x: predict_time_to_string(x)
    )
    forecast_measurements = forecast_measurements[
        forecast_measurements["pm2_5"].notna()
    ]

    return forecast_measurements.to_dict(orient="records")


def get_airqo_data(freq: str, start_time: str = None, end_time: str = None) -> list:
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="airqo", all_devices=False)
    measurements = []

    start = (
        str_to_date(start_time) if start_time else datetime.utcnow() - timedelta(days=7)
    )
    end = str_to_date(end_time) if end_time else datetime.utcnow()

    start_time = (
        date_to_str_days(start) if freq == "daily" else date_to_str_hours(start)
    )
    end_time = date_to_str_days(end) if freq == "daily" else date_to_str_hours(end)

    frequency = get_airqo_api_frequency(freq=freq)
    dates = pd.date_range(start_time, end_time, freq=frequency)
    last_date_time = dates.values[len(dates.values) - 1]

    for device in devices:

        for date in dates:

            start = date_to_str(date)
            end_date_time = date + timedelta(hours=dates.freq.n)

            if np.datetime64(end_date_time) > last_date_time:
                end = end_time
            else:
                end = date_to_str(end_date_time)

            try:
                events = airqo_api.get_events(
                    tenant="airqo",
                    start_time=start,
                    frequency=freq,
                    end_time=end,
                    device=device["name"],
                )
                measurements.extend(events)

            except Exception as ex:
                print(ex)
                traceback.print_exc()

    insights = format_measurements_to_insights(data=measurements)
    return insights


def create_insights_data(data: list) -> list:
    print("creating insights .... ")

    insights_data = pd.DataFrame(data)

    insights_data["frequency"] = insights_data["frequency"].apply(
        lambda x: str(x).upper()
    )
    insights_data["forecast"] = insights_data["forecast"].fillna(False)
    insights_data["empty"] = False
    insights_data = insights_data.dropna()

    return insights_data.to_dict(orient="records")


def time_values(**kwargs):
    try:
        dag_run = kwargs.get("dag_run")
        start_time = dag_run.conf["startTime"]
        end_time = dag_run.conf["endTime"]
    except KeyError:
        start_time = None
        end_time = None

    return start_time, end_time


def average_hourly_insights(data: list) -> list:
    insights_df = pd.DataFrame(data)
    site_groups = insights_df.groupby("siteId")
    averaged_insights = []

    for _, site_group in site_groups:

        try:
            site_measurements = site_group
            site_measurements["frequency"] = "DAILY"
            measurement_data = site_measurements[["pm2_5", "pm10", "time"]].copy()

            del site_measurements["pm2_5"]
            del site_measurements["pm10"]
            del site_measurements["time"]

            averages = resample_data(measurement_data, "daily")

            for _, row in averages.iterrows():
                combined_dataset = dict(
                    {
                        **row.to_dict(),
                        **site_measurements.iloc[0].to_dict(),
                    }
                )
                averaged_insights.append(combined_dataset)

        except Exception as ex:
            print(ex)
            traceback.print_exc()

    return pd.DataFrame(averaged_insights).to_dict(orient="records")
