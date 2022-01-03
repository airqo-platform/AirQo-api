import json
import traceback
from datetime import datetime, timedelta

import pandas as pd
import simplejson
from airflow import DAG
from airflow.operators.python import PythonOperator

from airqoApi import AirQoApi
from config import configuration
from date import date_to_str_hours, date_to_str_days, date_to_str, predict_str_to_date, str_to_date
from kafka_client import KafkaBrokerClient
from utils import clean_up_task

default_args = {
    "owner": "airflow",
    "start_date": datetime(2020, 1, 1),
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "email": "devs@airqo.net",
    "retries": 1,
    "retry_delay": timedelta(minutes=5)
}


def predict_time_to_string(time):
    date_time = predict_str_to_date(time)
    return date_to_str(date_time)


def measurement_time_to_string(time):
    date_time = str_to_date(time)
    return date_to_str(date_time)


def get_insights_forecast(tenant, output_file):
    airqo_api = AirQoApi()
    columns = ['time', 'pm2_5', 'siteId', 'frequency']
    devices = airqo_api.get_devices(tenant=tenant, active=True)

    forecast_measurements = pd.DataFrame(data=[], columns=columns)

    for device in devices:
        device_dict = dict(device)
        device_number = device_dict.get("device_number", None)
        site_id = device_dict.get("site", None)["_id"]

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

                forecast_measurements = forecast_measurements.append(forecast_cleaned_df, ignore_index=True)

    forecast_measurements['time'] = forecast_measurements['time'].apply(lambda x: predict_time_to_string(x))
    forecast_measurements = forecast_measurements[forecast_measurements['pm2_5'].notna()]

    forecast_measurements.to_csv(path_or_buf=output_file, index=False)


def get_insights_averaged_data(tenant, output_file):
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
                                              end_time=end_time, device=device['name'], meta_data="site")

                if not events:
                    print(f"No {frequency} measurements for {device['name']} : "
                          f"startTime {start_time} : endTime : {end_time}")
                    continue

                averaged_measurements.extend(events)

            except:
                traceback.print_exc()

    measurements_df = pd.json_normalize(averaged_measurements)

    measurements_df['average_pm2_5.calibratedValue'].fillna(measurements_df['average_pm2_5.value'], inplace=True)
    measurements_df['average_pm10.calibratedValue'].fillna(measurements_df['average_pm10.value'], inplace=True)
    measurements_df['siteDetails.search_name'].fillna(measurements_df['siteDetails.name'], inplace=True)

    measurements_df['location'] = measurements_df.apply(
        lambda row: row['siteDetails.district'] + " " + row['siteDetails.country'], axis=1)

    measurements_df['time'] = measurements_df['time'].apply(lambda x: measurement_time_to_string(x))

    measurements_df = measurements_df[['time', 'frequency', 'siteDetails._id',
                                       'average_pm2_5.calibratedValue', 'average_pm10.calibratedValue',
                                       'siteDetails.search_name', 'location']]

    measurements_df.columns = ['time', 'frequency', 'siteId', 'pm2_5', 'pm10',
                               'name', 'location']

    measurements_df = measurements_df[measurements_df['pm2_5'].notna()]

    measurements_df.to_csv(path_or_buf=output_file, index=False)


def create_insights_data(forecast_data_file, averaged_data_file, output_file):
    forecast_data = pd.read_csv(forecast_data_file)
    averaged_data = pd.read_csv(averaged_data_file)

    insights_data = forecast_data.append(averaged_data, ignore_index=True)

    # output_file = str(output_file).replace('json', 'csv')
    # insights_data.to_csv(path_or_buf=output_file, index=False)

    with open(output_file, 'w', encoding='utf-8') as f:
        simplejson.dump(insights_data.to_dict(orient="records"), f, ensure_ascii=False, indent=4, ignore_nan=True)
    return


def save_insights_data(insights_data_file):
    file = open(insights_data_file)
    data = json.load(file)

    kafka = KafkaBrokerClient()
    kafka.send_data(data=data, topic=configuration.WEATHER_MEASUREMENTS_TOPIC)


with DAG(
        'App-Insights',
        default_args=default_args,
        description='App Insights DAG',
        schedule_interval=timedelta(days=1),
        start_date=datetime(2021, 1, 1),
        catchup=False,
        tags=['insights', 'app'],
) as dag:
    fetch_forecast_data = PythonOperator(
        task_id="fetch_forecast_data",
        python_callable=get_insights_forecast,
        op_args=['airqo', 'forecast_data.csv']
    )

    fetch_averaged_data = PythonOperator(
        task_id="fetch_averaged_data",
        python_callable=get_insights_averaged_data,
        op_args=['airqo', 'averaged_data.csv']
    )

    create_insights = PythonOperator(
        task_id="create_insights",
        python_callable=create_insights_data,
        op_args=['forecast_data.csv', 'averaged_data.csv', 'insights_data.json']
    )

    save_insights = PythonOperator(
        task_id="save_insights",
        python_callable=save_insights_data,
        op_args=['insights_data.json']
    )

    clean_up = PythonOperator(
        task_id='clean_up',
        python_callable=clean_up_task,
        op_args=[['averaged_data.csv', 'forecast_data.csv', 'insights_data.json']]
    )

    fetch_forecast_data >> fetch_averaged_data >> create_insights >> save_insights >> clean_up
