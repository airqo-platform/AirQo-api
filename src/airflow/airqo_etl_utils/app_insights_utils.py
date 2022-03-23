import traceback
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.message_broker import KafkaBrokerClient
from airqo_etl_utils.date import (
    date_to_str_hours,
    date_to_str_days,
    date_to_str,
    predict_str_to_date,
    str_to_date,
)
from airqo_etl_utils.commons import (
    get_airqo_api_frequency,
    resample_data,
    get_frequency,
    get_column_value,
)

insights_columns = ["time", "pm2_5", "pm10", "siteId", "frequency", "forecast", "empty"]


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


def format_airqo_data_to_insights(data: list):
    restructured_data = []

    data_df = pd.DataFrame(data)
    columns = list(data_df.columns)

    for _, data_row in data_df.iterrows():
        device_data = dict(
            {
                "time": data_row["time"],
                "siteId": data_row["site_id"],
                "frequency": data_row["frequency"],
                "pm2_5": get_column_value(
                    column="pm2_5", columns=columns, series=data_row
                ),
                "pm10": get_column_value(
                    column="pm10", columns=columns, series=data_row
                ),
                "empty": False,
                "forecast": False,
            }
        )

        restructured_data.append(device_data)

    return create_insights_data(data=restructured_data)


def save_insights_data(insights_data: list = None, action: str = "insert"):
    if insights_data is None:
        insights_data = []

    print("saving insights .... ")

    data = {
        "data": insights_data,
        "action": action,
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
    devices = airqo_api.get_devices(tenant=tenant, all_devices=False)

    forecast_measurements = pd.DataFrame(data=[], columns=insights_columns)
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


def average_insights_data(data: list, frequency="daily") -> list:
    data_df = pd.DataFrame(data)

    if data_df.empty:
        return pd.DataFrame(data=[], columns=insights_columns).to_dict(orient="records")

    site_groups = data_df.groupby("siteId")
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

    return sampled_data


def query_insights_data(freq: str, start_date_time: str, end_date_time: str) -> list:
    airqo_api = AirQoApi()
    insights = []

    frequency = get_frequency(start_time=start_date_time, end_time=end_date_time)
    dates = pd.date_range(start_date_time, end_date_time, freq=frequency)
    last_date_time = dates.values[len(dates.values) - 1]

    for date in dates:

        start = date_to_str(date)
        query_end_date_time = date + timedelta(hours=dates.freq.n)

        if np.datetime64(query_end_date_time) > last_date_time:
            end = end_date_time
        else:
            end = date_to_str(query_end_date_time)

        try:
            api_results = airqo_api.get_app_insights(
                start_time=start,
                frequency=freq,
                end_time=end,
            )
            insights.extend(api_results)

        except Exception as ex:
            print(ex)
            traceback.print_exc()

    return insights


def create_insights_data_from_bigquery(
    start_date_time: str, end_date_time: str
) -> list:
    from airqo_etl_utils.bigquery_api import BigQueryApi

    bigquery_api = BigQueryApi()

    hourly_data = bigquery_api.get_hourly_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=["pm2_5", "pm10", "site_id", "timestamp"],
        table=bigquery_api.hourly_measurements_table,
    )
    hourly_data["forecast"] = False
    hourly_data["empty"] = False
    hourly_data["frequency"] = "hourly"
    hourly_data.rename(columns={"site_id": "siteId"}, inplace=True)
    return hourly_data.to_dict(orient="records")


def create_insights_data(data: list) -> list:
    print("creating insights .... ")

    insights_data = pd.DataFrame(data)

    insights_data["frequency"] = insights_data["frequency"].apply(
        lambda x: str(x).upper()
    )
    insights_data["forecast"] = insights_data["forecast"].fillna(False)
    insights_data["empty"] = False

    if sorted(list(insights_data.columns)) != sorted(insights_columns):
        print(f"Required columns {insights_columns}")
        print(f"Dataframe columns {list(insights_data.columns)}")
        raise Exception("Invalid columns")

    insights_data = insights_data.dropna()

    return insights_data.to_dict(orient="records")
