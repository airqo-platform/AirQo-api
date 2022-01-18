import random
import traceback
from datetime import datetime
from datetime import timedelta

import pandas as pd
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from date import date_to_str_hours, date_to_str_days, date_to_str, predict_str_to_date, str_to_date, \
    first_day_of_week, last_day_of_week, first_day_of_month, last_day_of_month
from utils import save_insights_data, format_measurements_to_insights


def predict_time_to_string(time):
    date_time = predict_str_to_date(time)
    return date_to_str(date_time)


def measurement_time_to_string(time: str, daily=False):
    date_time = str_to_date(time)
    if daily:
        return date_to_str_days(date_time)
    else:
        return date_to_str_hours(date_time)


def extract_insights_forecast(tenant):
    airqo_api = AirQoApi()
    columns = ['time', 'pm2_5', 'siteId', 'frequency', 'forecast']
    devices = airqo_api.get_devices(tenant=tenant, active=True)

    forecast_measurements = pd.DataFrame(data=[], columns=columns)

    for device in devices:
        device_dict = dict(device)
        device_number = device_dict.get("device_number", None)
        site = device_dict.get("site", None)
        if not site:
            print(f'device {device_number} isn\'t attached to  a site.')
            continue
        site_id = site["_id"]

        if device_number:
            time = int(datetime.utcnow().timestamp())

            forecast = airqo_api.get_forecast(channel_id=device_number, timestamp=time)
            if forecast:
                forecast_df = pd.DataFrame(forecast)

                forecast_cleaned_df = pd.DataFrame(columns=columns)
                forecast_cleaned_df['time'] = forecast_df['prediction_time']
                forecast_cleaned_df['pm2_5'] = forecast_df['prediction_value']
                forecast_cleaned_df['siteId'] = site_id
                forecast_cleaned_df['frequency'] = 'hourly'
                forecast_cleaned_df['forecast'] = True

                forecast_measurements = forecast_measurements.append(forecast_cleaned_df, ignore_index=True)

        # if forecast_measurements.size > 72:
        #     break

    forecast_measurements['time'] = forecast_measurements['time'].apply(lambda x: predict_time_to_string(x))
    forecast_measurements = forecast_measurements[forecast_measurements['pm2_5'].notna()]

    return forecast_measurements.to_dict(orient="records")


def extract_airqo_data(tenant):
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant=tenant, active=True)
    averaged_measurements = []

    time = datetime.utcnow()
    hourly_start_time = date_to_str_hours(time - timedelta(hours=4))
    hourly_end_time = date_to_str_hours(time)
    daily_start_time = date_to_str_days(time - timedelta(days=2))
    daily_end_time = date_to_str_days(time)

    print(f'hourly start time : {hourly_start_time}')
    print(f'hourly end time : {hourly_end_time}')
    print(f'hourly start time : {daily_start_time}')
    print(f'hourly end time : {daily_end_time}')

    for device in devices:

        for frequency in ["daily", "hourly"]:

            try:
                if 'name' not in device.keys():
                    print(f'name missing in device keys : {device}')
                    continue

                start_time = hourly_start_time if frequency == "hourly" else daily_start_time
                end_time = hourly_end_time if frequency == "hourly" else daily_end_time
                events = airqo_api.get_events(tenant='airqo', start_time=start_time, frequency=frequency,
                                              end_time=end_time, device=device['name'])

                if not events:
                    print(f"No {frequency} measurements for {device['name']} : "
                          f"startTime {start_time} : endTime : {end_time}")
                    continue

                averaged_measurements.extend(events)

            except Exception as ex:
                print(ex)
                traceback.print_exc()
        #
        # if len(averaged_measurements) > 20:
        #     break

    insights = format_measurements_to_insights(data=averaged_measurements)
    return insights


def create_insights_data(forecast_data_file, averaged_data_file):
    print("creating insights .... ")

    forecast_data = pd.DataFrame(forecast_data_file)
    averaged_data = pd.DataFrame(averaged_data_file)

    insights_data = forecast_data.append(averaged_data, ignore_index=True)
    insights_data['forecast'].fillna(False, inplace=True)

    insights_data.dropna(inplace=True)
    insights_data['frequency'] = insights_data['frequency'].apply(lambda x: str(x).upper())

    return insights_data.to_dict(orient="records")


@dag('App-Insights', schedule_interval="*/30 * * * *",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights'])
def app_insights_etl():
    @task(multiple_outputs=True)
    def extract_measurements_data():
        measurements_data = extract_airqo_data('airqo')

        return dict({"data": measurements_data})

    @task(multiple_outputs=True)
    def extract_forecast():
        forecast_data = extract_insights_forecast('airqo')

        return dict({"data": forecast_data})

    @task(multiple_outputs=True)
    def merge_data(measurements_data: dict, forecast_data: dict):
        insights_data = create_insights_data(forecast_data, measurements_data)

        return dict({"data": insights_data})

    @task()
    def load(data: dict):
        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    measurements = extract_measurements_data()
    forecast = extract_forecast()
    insights = merge_data(measurements_data=measurements, forecast_data=forecast)
    load(insights)


@dag('Delete-Insights', schedule_interval="@weekly",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'delete'])
def app_delete_insights_etl():
    @task()
    def delete():
        start_time = first_day_of_week(first_day_of_month(date_time=datetime.now())) - timedelta(days=7)
        end_time = last_day_of_week(last_day_of_month(date_time=datetime.now())) + timedelta(days=7)

        save_insights_data(insights_data=[], action="delete", start_time=start_time, end_time=end_time)

    delete()


@dag('App-Placeholder-Insights', schedule_interval="@weekly",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'empty'])
def app_placeholder_insights_etl():
    @task()
    def load():
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

    load()


app_insights_etl_dag = app_insights_etl()
app_delete_insights_dag = app_delete_insights_etl()
app_placeholder_insights_dag = app_placeholder_insights_etl()
