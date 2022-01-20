import math
import os
import traceback
from datetime import timedelta, datetime
from functools import reduce

import numpy as np
import pandas as pd
from airflow.hooks.base import BaseHook
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator
from google.cloud import bigquery, storage

from airqoApi import AirQoApi
from config import configuration
from date import str_to_date, date_to_str, date_to_str_days, date_to_str_hours
from kafka_client import KafkaBrokerClient
from tahmo import TahmoApi


def save_insights_data(insights_data=None, action="insert", start_time=datetime(year=2020, month=1, day=1),
                       end_time=datetime(year=2020, month=1, day=1)):
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


def measurement_time_to_string(time: str, daily=False):
    date_time = str_to_date(time)
    if daily:
        return date_to_str_days(date_time)
    else:
        return date_to_str_hours(date_time)


def format_measurements_to_insights(data: list):
    measurements_df = pd.json_normalize(data)
    if 'average_pm2_5.calibratedValue' not in measurements_df.columns:
        measurements_df['average_pm2_5.calibratedValue'] = ['average_pm2_5.value']
    else:
        measurements_df['average_pm2_5.calibratedValue'].fillna(measurements_df['average_pm2_5.value'], inplace=True)

    if 'average_pm10.calibratedValue' not in measurements_df.columns:
        measurements_df['average_pm10.calibratedValue'] = measurements_df['average_pm10.value']
    else:
        measurements_df['average_pm10.calibratedValue'].fillna(measurements_df['average_pm10.value'], inplace=True)

    measurements_df = measurements_df[['time', 'frequency', 'site_id', 'average_pm2_5.calibratedValue',
                                       'average_pm10.calibratedValue']]

    measurements_df.columns = ['time', 'frequency', 'siteId', 'pm2_5', 'pm10']
    measurements_df = measurements_df.dropna()

    measurements_df['frequency'] = measurements_df['frequency'].apply(lambda x: str(x).upper())

    hourly_measurements_df = measurements_df.loc[measurements_df["frequency"] == "HOURLY"]
    hourly_measurements_df['time'] = hourly_measurements_df['time'].apply(
        lambda x: measurement_time_to_string(x, daily=False))

    daily_measurements_df = measurements_df.loc[measurements_df["frequency"] == "DAILY"]
    daily_measurements_df['time'] = daily_measurements_df['time'].apply(
        lambda x: measurement_time_to_string(x, daily=True))

    data = pd.concat([hourly_measurements_df, daily_measurements_df])
    data.reset_index(inplace=True)

    return data.to_dict(orient="records")


def get_last_datetime(year, month):
    next_month = int(month) + 1
    next_year = int(year) + 1 if next_month > 12 else year
    next_month = 1 if next_month > 12 else next_month

    date_time = datetime(int(next_year), int(next_month), 1) - timedelta(days=1)

    return datetime.strftime(date_time, '%Y-%m-%dT00:00:00Z')


def get_first_datetime(year, month):
    month_value = 1 if int(month) > 12 else month
    date_time = datetime(int(year), int(month_value), 1)

    return datetime.strftime(date_time, '%Y-%m-%dT00:00:00Z')


def get_month(value):
    if value == 1:
        return "Jan"
    elif value == 2:
        return "Feb"
    elif value == 3:
        return "Mar"
    elif value == 4:
        return "Apr"
    elif value == 5:
        return "May"
    elif value == 6:
        return "Jun"
    elif value == 7:
        return "July"
    elif value == 8:
        return "Aug"
    elif value == 9:
        return "Sept"
    elif value == 10:
        return "Oct"
    elif value == 11:
        return "Nov"
    elif value == 12:
        return "Dec"
    else:
        Exception("Invalid month value")


def to_float(string):
    try:
        value = float(string)
        if math.isnan(value):
            return None
        return value
    except Exception:
        return None


def to_double(x):
    try:
        value = float(x)
        if math.isnan(value) or np.isnan(value):
            return None
        return value
    except Exception:
        return None


def fill_nan(data: list) -> list:
    data_df = pd.DataFrame(data)
    data_df = data_df.fillna('none')
    return data_df.to_dict(orient='records')


def get_valid_value(raw_value, name=None):
    value = to_double(raw_value)

    if not name or not value:
        return value

    if (name == "pm2_5" or name == "pm10") and (value < 1 or value > 1000):
        return None
    elif name == "latitude" and (value < -90 or value > 90):
        return None
    elif name == "longitude" and (value < -180 or value > 180):
        return None
    elif name == "battery" and (value < 2.7 or value > 5):
        return None
    elif (name == "altitude" or name == "hdop") and value < 0:
        return None
    elif name == "satellites" and (value < 0 or value > 50):
        return None
    elif name == "externalTemperature" and (value < 0 or value > 45):
        return None
    elif name == "externalHumidity" and (value < 0 or value > 100):
        return None
    elif name == "pressure":
        return None
    else:
        pass

    return value


def get_site_ids_from_station(station: str, sites: list):
    station_sites = list(filter(lambda x: str(x["nearest_tahmo_station"]["code"]).lower() == station.lower(), sites))

    if not station_sites:
        return []
    site_ids = []
    for site in station_sites:
        site_ids.append(site["_id"])

    return site_ids


def get_device_site_id(device_id: str, devices: list):
    device = list(filter(lambda x: str(x["_id"]).lower() == device_id.lower(), devices))

    if not device:
        return None

    try:
        return device[0]['site']['_id']
    except KeyError:
        return None


def get_device_ids_from_station(station: str, sites: list):
    station_sites = list(filter(lambda x: str(x["nearest_tahmo_station"]["code"]).lower() == station.lower(), sites))

    if not station_sites:
        return []
    device_ids = []

    for site in station_sites:
        try:
            for device in site['devices']:
                device_ids.append(device["_id"])
        except KeyError:
            continue

    return device_ids


def resample_data(data: pd.DataFrame, frequency: str) -> pd.DataFrame:
    data = data.dropna(subset=['time'])
    data['time'] = pd.to_datetime(data['time'])
    data.set_index('time')
    data.sort_index(axis=0)

    resample_value = '24H' if frequency.lower() == 'daily' else '1H'
    averages = pd.DataFrame(data.resample(resample_value, on='time').mean())

    averages["time"] = averages.index
    averages["time"] = averages["time"].apply(lambda x: date_to_str(x))
    averages = averages.reset_index(drop=True)

    return averages


def resample_weather_data(data, frequency: str):
    weather_raw_data = pd.DataFrame(data)
    airqo_api = AirQoApi()
    sites = airqo_api.get_sites(tenant='airqo')
    valid_sites = list(filter(lambda x: "nearest_tahmo_station" in dict(x).keys(), sites))

    # to include site id
    # devices = get_devices_or_sites(configuration.AIRQO_BASE_URL, tenant='airqo', sites=False)

    temperature = weather_raw_data.loc[weather_raw_data["variable"] == "te", ["value", "variable", "station", "time"]]
    humidity = weather_raw_data.loc[weather_raw_data["variable"] == "rh", ["value", "variable", "station", "time"]]
    wind_speed = weather_raw_data.loc[weather_raw_data["variable"] == "ws", ["value", "variable", "station", "time"]]

    humidity["value"] = pd.to_numeric(humidity["value"], errors='coerce')
    humidity['value'] = humidity['value'].apply(lambda x: x * 100)

    data = pd.concat([temperature, humidity, wind_speed])
    data.reset_index(inplace=True)
    devices_weather_data = []

    data["value"] = pd.to_numeric(data["value"], errors='coerce', downcast="float")
    data = data.fillna(0)

    data_station_gps = data.groupby('station')

    for _, station_group in data_station_gps:

        device_weather_data = []
        station = station_group.iloc[0]["station"]

        try:

            # resampling station values
            temperature = resample_data(station_group.loc[station_group["variable"] == "te", ["value", "time"]],
                                        frequency)
            temperature.columns = ['temperature', 'time']
            humidity = resample_data(station_group.loc[station_group["variable"] == "rh", ["value", "time"]],
                                     frequency)
            humidity.columns = ['humidity', 'time']
            wind_speed = resample_data(station_group.loc[station_group["variable"] == "ws", ["value", "time"]],
                                       frequency)
            wind_speed.columns = ['wind_speed', 'time']

            data_frames = [temperature, humidity, wind_speed]

            station_df = reduce(lambda left, right: pd.merge(left, right, on=['time'],
                                                             how='outer'), data_frames).fillna('None')
            station_df['frequency'] = frequency

            # mapping device to station
            station_devices = get_device_ids_from_station(station, valid_sites)

            if len(station_devices) == 0:
                continue

            for device_id in station_devices:
                device_station_df = station_df.copy(deep=True)
                device_station_df['device_id'] = device_id
                device_station_df = device_station_df.fillna('None')
                device_weather_data.extend(device_station_df.to_dict(orient='records'))

        except Exception as ex:
            print(ex)
            traceback.print_exc()
            continue

        # to include site id
        # device_station_data_df = pd.DataFrame(device_weather_data)
        # device_station_data_df['site_id'] = device_station_data_df['device_id'].apply(
        #     lambda x: get_device_site_id(x, devices))
        # devices_weather_data.extend(device_station_data_df.to_dict(orient='records'))

        devices_weather_data.extend(device_weather_data)

    # pd.DataFrame(devices_weather_data).to_csv(path_or_buf='devices_weather.csv', index=False)

    return devices_weather_data


def slack_success_notification(context):
    slack_webhook_token = BaseHook.get_connection('slack').password

    msg = """
          :green_circle: Task Successful. 
          *Task*: {task}  
          *Dag*: {dag} 
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        task=context.get('task_instance').task_id,
        dag=context.get('task_instance').dag_id,
        ti=context.get('task_instance'),
        exec_date=context.get('execution_date'),
        log_url=context.get('task_instance').log_url,
    )

    success_alert = SlackWebhookOperator(
        task_id='slack_success_notification',
        http_conn_id='slack',
        webhook_token=slack_webhook_token,
        message=msg,
        username='airflow')

    return success_alert.execute(context=context)


def slack_failure_notification(context):
    slack_webhook_token = BaseHook.get_connection('slack').password

    msg = """
          :red_circle: Task Failed. 
          *Task*: {task}  
          *Dag*: {dag}
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        task=context.get('task_instance').task_id,
        dag=context.get('task_instance').dag_id,
        ti=context.get('task_instance'),
        exec_date=context.get('execution_date'),
        log_url=context.get('task_instance').log_url,
    )

    failed_alert = SlackWebhookOperator(
        task_id='slack_failed_notification',
        http_conn_id='slack',
        webhook_token=slack_webhook_token,
        message=msg,
        username='airflow')

    return failed_alert.execute(context=context)


def download_file_from_gcs(bucket_name: str, source_file: str, destination_file: str):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(source_file)
    blob.download_to_filename(destination_file)
    print(f'file: {destination_file} downloaded from bucket: {bucket_name} successfully')
    return destination_file


def get_frequency(start_time: str, end_time: str) -> str:
    diff_days = round((str_to_date(end_time) - str_to_date(start_time)).total_seconds() / 86400)

    if diff_days >= 5:
        frequency = '96H'
    elif diff_days <= 1:
        diff_hours = round((str_to_date(end_time) - str_to_date(start_time)).seconds / 3600)
        frequency = '1H' if diff_hours <= 0 else f'{diff_hours}H'
    else:
        frequency = f'{round(diff_days * 24)}H'

    return frequency


def get_weather_data_from_tahmo(start_time=None, end_time=None, tenant='airqo'):
    airqo_api = AirQoApi()
    airqo_sites = airqo_api.get_sites(tenant=tenant)
    station_codes = []
    for site in airqo_sites:
        try:
            if 'nearest_tahmo_station' in dict(site).keys():
                station_codes.append(site['nearest_tahmo_station']['code'])
        except Exception as ex:
            print(ex)

    measurements = []
    columns = []
    tahmo_api = TahmoApi()

    frequency = get_frequency(start_time=start_time, end_time=end_time)
    dates = pd.date_range(start_time, end_time, freq=frequency)
    last_date_time = dates.values[len(dates.values) - 1]

    for date in dates:

        start = date_to_str(date)
        end_date_time = date + timedelta(hours=dates.freq.n)

        if np.datetime64(end_date_time) > last_date_time:
            end = end_time
        else:
            end = date_to_str(end_date_time)

        # start = date_to_str(date)
        # end = date_to_str(date + timedelta(hours=12))
        print(start + " : " + end)

        cols, range_measurements = tahmo_api.get_measurements(start, end, station_codes)
        measurements.extend(range_measurements)
        if len(columns) == 0:
            columns = cols

    if len(measurements) != 0 and len(columns) != 0:
        measurements_df = pd.DataFrame(data=measurements, columns=columns)
    else:
        measurements_df = pd.DataFrame([])
    measurements_df = measurements_df.fillna('None')

    # pd.DataFrame(measurements_df).to_csv(path_or_buf='raw_weather_data.csv', index=False)

    clean_measurements_df = remove_invalid_dates(dataframe=measurements_df, start_time=start_time, end_time=end_time)
    return clean_measurements_df.to_dict(orient='records')


def remove_invalid_dates(dataframe: pd.DataFrame, start_time: str, end_time: str) -> pd.DataFrame:
    start = pd.to_datetime(start_time)
    end = pd.to_datetime(end_time)

    dataframe['time'] = pd.to_datetime(dataframe['time'])
    data_frame = dataframe.set_index(['time'])

    time_data_frame = data_frame.loc[(data_frame.index >= start) & (data_frame.index <= end)]

    time_data_frame['time'] = time_data_frame.index
    time_data_frame["time"] = time_data_frame["time"].apply(lambda x: date_to_str(x))
    time_data_frame = time_data_frame.reset_index(drop=True)

    return time_data_frame


def get_column_value(column_name, series, columns_names, data_name):
    if column_name in columns_names:
        value = to_double(series[column_name])
        return get_valid_value(value, data_name)

    return None


def clean_up_task(list_of_files):
    for item in list_of_files:
        try:
            os.remove(item)
        except Exception as ex:
            print(ex)


def get_site_and_device_id(devices, channel_id=None, device_name=None):
    try:
        if channel_id is not None:
            result = list(filter(lambda device: (device["device_number"] == channel_id), devices))
        elif device_name is not None:
            result = list(filter(lambda device: (device["name"] == device_name), devices))
        else:
            return None, None

        if not result:
            print("Device not found")
            return None, None

        return result[0]["site"]["_id"], result[0]["_id"]
    except Exception as ex:
        print(ex)
        print("Site ID not found")
        return None, None


def get_airqo_device_data(start_time, end_time, channel_ids):
    client = bigquery.Client()

    query = """
             SELECT channel_id, created_at, pm2_5, pm10 , s2_pm2_5,
              s2_pm10, temperature , humidity, voltage, altitude, latitude, longitude, no_sats, hdope, wind
              FROM airqo-250220.thingspeak.clean_feeds_pms where ({0})
              AND created_at BETWEEN '{1}' AND '{2}' ORDER BY created_at
                """.format(channel_ids, str_to_date(start_time), str_to_date(end_time))

    dataframe = (
        client.query(query).result().to_dataframe()
    )

    return dataframe.to_dict(orient='records')


def get_device(devices=None, channel_id=None, device_id=None):
    if devices is None:
        devices = []

    if channel_id:
        result = list(filter(lambda x: x["device_number"] == channel_id, devices))
        if not result:
            return None
        return result[0]

    elif device_id:
        result = list(filter(lambda x: x["_id"] == device_id, devices))
        if not result:
            return None
        return result[0]

    return None


def filter_valid_devices(devices_data):
    valid_devices = []
    for device in devices_data:
        device_dict = dict(device)
        if "site" in device_dict.keys() and "device_number" in device_dict.keys():
            valid_devices.append(device_dict)

    return valid_devices


def filter_valid_kcca_devices(devices_data):
    valid_devices = []
    for device in devices_data:
        device_dict = dict(device)
        if "site" in device_dict.keys():
            valid_devices.append(device_dict)

    return valid_devices


def build_channel_id_filter(devices_data):
    channel_filter = "channel_id = 0"
    for device in devices_data:
        device_dict = dict(device)
        channel_filter = channel_filter + f" or channel_id = {device_dict.get('device_number')}"

    return channel_filter


def get_valid_devices(tenant):
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant=tenant)
    filtered_devices = filter_valid_devices(devices)
    return filtered_devices
