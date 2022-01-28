import random
import traceback
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from date import date_to_str_hours, date_to_str_days, date_to_str, predict_str_to_date, str_to_date, \
    first_day_of_week, last_day_of_week, first_day_of_month, last_day_of_month
from utils import save_insights_data, format_measurements_to_insights, slack_failure_notification, get_frequency, \
    get_airqo_api_frequency


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
    columns = ['time', 'pm2_5', 'pm10', 'siteId', 'frequency', 'forecast', 'empty']
    devices = airqo_api.get_devices(tenant=tenant, all_devices=False)

    forecast_measurements = pd.DataFrame(data=[], columns=columns)
    time = int(datetime.utcnow().timestamp())

    for device in devices:
        device_dict = dict(device)
        device_number = device_dict.get("device_number", None)
        site = device_dict.get("site", None)
        if not site:
            print(f'device {device_number} isn\'t attached to  a site.')
            continue
        site_id = site["_id"]

        if device_number:

            forecast = airqo_api.get_forecast(channel_id=device_number, timestamp=time)
            if forecast:
                forecast_df = pd.DataFrame(forecast)

                forecast_cleaned_df = pd.DataFrame(columns=columns)
                forecast_cleaned_df['time'] = forecast_df['prediction_time']
                forecast_cleaned_df['pm2_5'] = forecast_df['prediction_value']
                forecast_cleaned_df['pm10'] = forecast_df['prediction_value']
                forecast_cleaned_df['siteId'] = site_id
                forecast_cleaned_df['frequency'] = 'hourly'
                forecast_cleaned_df['forecast'] = True
                forecast_cleaned_df['empty'] = False

                forecast_measurements = forecast_measurements.append(forecast_cleaned_df, ignore_index=True)

    forecast_measurements['time'] = forecast_measurements['time'].apply(lambda x: predict_time_to_string(x))
    forecast_measurements = forecast_measurements[forecast_measurements['pm2_5'].notna()]

    return forecast_measurements.to_dict(orient="records")


def get_airqo_data(freq: str, start_time: str = None, end_time: str = None) -> list:
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant='airqo', all_devices=False)
    measurements = []

    start = str_to_date(start_time) if start_time else datetime.utcnow() - timedelta(days=7)
    end = str_to_date(end_time) if end_time else datetime.utcnow()

    start_time = date_to_str_days(start) if freq == 'daily' else date_to_str_hours(start)
    end_time = date_to_str_days(end) if freq == 'daily' else date_to_str_hours(end)

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
                events = airqo_api.get_events(tenant='airqo', start_time=start,
                                              frequency=freq, end_time=end, device=device['name'])
                measurements.extend(events)

            except Exception as ex:
                print(ex)
                traceback.print_exc()

    insights = format_measurements_to_insights(data=measurements)
    return insights


def create_insights_data(data: list) -> list:
    print("creating insights .... ")

    insights_data = pd.DataFrame(data)

    insights_data['frequency'] = insights_data['frequency'].apply(lambda x: str(x).upper())
    insights_data['forecast'] = insights_data['forecast'].fillna(False)
    insights_data['empty'] = False
    insights_data = insights_data.dropna()

    return insights_data.to_dict(orient="records")


def time_values(**kwargs):
    try:
        dag_run = kwargs.get('dag_run')
        start_time = dag_run.conf['startTime']
        end_time = dag_run.conf['endTime']
    except KeyError:
        start_time = None
        end_time = None

    return start_time, end_time


@dag('App-Forecast-Insights', schedule_interval="@hourly", on_failure_callback=slack_failure_notification,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'forecast'])
def app_forecast_insights_etl():
    @task(multiple_outputs=True)
    def extract_forecast_data():
        forecast_data = get_forecast_data('airqo')
        insights_data = create_insights_data(data=forecast_data)

        return dict({"data": insights_data})

    @task()
    def load(data: dict):
        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    insights = extract_forecast_data()
    load(insights)


@dag('App-Daily-Insights', schedule_interval="30 * * * *", on_failure_callback=slack_failure_notification,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'daily'])
def app_daily_insights_etl():

    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):
        start_time, end_time = time_values(**kwargs)
        measurements_data = get_airqo_data(freq='daily', start_time=start_time, end_time=end_time)
        insights_data = create_insights_data(data=measurements_data)

        return dict({"data": insights_data})

    @task()
    def load(data: dict):
        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    insights = extract_airqo_data()
    load(insights)


@dag('App-Hourly-Insights', schedule_interval="30 * * * *", on_failure_callback=slack_failure_notification,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'hourly'])
def app_hourly_insights_etl():

    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):
        start_time, end_time = time_values(**kwargs)
        measurements_data = get_airqo_data(freq='hourly', start_time=start_time, end_time=end_time)
        insights_data = create_insights_data(data=measurements_data)

        return dict({"data": insights_data})

    @task()
    def load(data: dict):
        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    insights = extract_airqo_data()
    load(insights)


@dag('App-Insights-cleanup', schedule_interval="@weekly", on_failure_callback=slack_failure_notification,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'empty'])
def insights_cleanup_etl():
    @task()
    def load_place_holders():
        start_time = date_to_str_days(first_day_of_week(first_day_of_month(date_time=datetime.now())))
        end_time = date_to_str_days(last_day_of_week(last_day_of_month(date_time=datetime.now())))

        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(tenant="airqo")
        empty_insights = []

        dates = pd.date_range(start_time, end_time, freq='1H')
        for date in dates:
            date_time = date_to_str_hours(date)
            for site in sites:
                try:
                    hourly_insight = {
                        "time": date_time,
                        "pm2_5": random.uniform(50.0, 150.0),
                        "pm10": random.uniform(50.0, 150.0),
                        "empty": True,
                        "frequency": "HOURLY",
                        "forecast": False,
                        "siteId": site["_id"],
                    }
                    empty_insights.append(hourly_insight)
                except Exception as ex:
                    print(ex)

        dates = pd.date_range(start_time, end_time, freq='24H')
        for date in dates:
            date_time = date_to_str_days(date)
            for site in sites:
                try:
                    daily_insight = {
                        "time": date_time,
                        "pm2_5": random.uniform(50.0, 150.0),
                        "pm10": random.uniform(50.0, 150.0),
                        "empty": True,
                        "frequency": "DAILY",
                        "forecast": False,
                        "siteId": site["_id"],
                    }
                    empty_insights.append(daily_insight)
                except Exception as ex:
                    print(ex)
        save_insights_data(insights_data=empty_insights, action="insert")

    @task()
    def delete_old_insights():
        start_time = first_day_of_week(first_day_of_month(date_time=datetime.now())) - timedelta(days=7)
        end_time = last_day_of_week(last_day_of_month(date_time=datetime.now())) + timedelta(days=7)

        save_insights_data(insights_data=[], action="delete", start_time=start_time, end_time=end_time)

    load_place_holders()
    # delete_old_insights()


app_forecast_insights_etl_dag = app_forecast_insights_etl()
app_hourly_insights_etl_dag = app_hourly_insights_etl()
app_daily_insights_etl_dag = app_daily_insights_etl()
insights_cleanup_etl_dag = insights_cleanup_etl()
