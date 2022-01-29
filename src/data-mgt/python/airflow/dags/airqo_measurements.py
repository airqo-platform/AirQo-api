import json
import pickle
import traceback
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import requests
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from config import configuration
from date import date_to_str, date_to_str_days, date_to_str_hours, str_to_date
from utils import get_device, get_valid_value, get_weather_data_from_tahmo, resample_weather_data, \
    resample_data, remove_invalid_dates, fill_nan, download_file_from_gcs, get_frequency, \
    slack_dag_failure_notification, un_fill_nan, save_measurements_to_bigquery, get_column_value


def extract_airqo_hourly_data_from_api(start_time: str, end_time: str) -> list:
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant='airqo')
    devices_list = list(devices)
    hourly_events = []

    if len(devices_list) == 0:
        print("devices empty")
        return []

    for device in devices_list:

        try:
            if 'name' not in device.keys():
                print(f'name missing in device keys : {device}')
                continue

            device_name = device['name']
            events = airqo_api.get_events(tenant='airqo', start_time=start_time, frequency="hourly",
                                          end_time=end_time, device=device_name)

            if not events:
                print(f"No measurements for {device_name} : startTime {start_time} : endTime : {end_time}")
                continue

            hourly_events.extend(events)
        except Exception as ex:
            traceback.print_exc()
            print(ex)

    device_measurements = pd.json_normalize(hourly_events)
    columns = device_measurements.columns
    column_mappings = {
        'internalTemperature.value': 'internalTemperature',
        'internalHumidity.value': 'internalHumidity',
        'externalTemperature.value': 'temperature',
        'externalHumidity.value': 'humidity',
        'externalPressure.value': 'pressure',
        'speed.value': 'windSpeed',
        'altitude.value': 'altitude',
        'battery.value': 'battery',
        'satellites.value': 'satellites',
        'hdop.value': 'hdop',
        'pm10.value': 'pm10',
        's2_pm10.value': 's2_pm10',
        's2_pm2_5.value': 's2_pm2_5',
        'average_pm2_5.calibratedValue': 'calibrated_pm2_5',
    }

    for col in columns:
        device_measurements[column_mappings[col]] = device_measurements[col]
        device_measurements = device_measurements.drop(columns[col])

    return hourly_events


def extract_airqo_devices_deployment_history() -> list:
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant='airqo')
    devices_history = []
    for device in devices:

        try:
            maintenance_logs = airqo_api.get_maintenance_logs(tenant='airqo', device=device['name'],
                                                              activity_type='deployment')

            if not maintenance_logs or len(maintenance_logs) <= 1:
                continue

            log_df = pd.DataFrame(maintenance_logs)
            log_df = log_df.dropna(subset=['date'])

            log_df['site_id'] = log_df['site_id'].fillna(method='bfill').fillna(method='ffill')
            log_df = log_df.dropna(subset=['site_id'])

            log_df['start_time'] = pd.to_datetime(log_df['date'])
            log_df = log_df.sort_values(by="start_time")
            log_df['end_time'] = log_df['start_time'].shift(-1)
            log_df['end_time'] = log_df['end_time'].fillna(datetime.utcnow())

            log_df['start_time'] = log_df['start_time'].apply(lambda x: date_to_str(x))
            log_df['end_time'] = log_df['end_time'].apply(lambda x: date_to_str(x))

            if len(set(log_df['site_id'].tolist())) == 1:
                continue

            for _, raw in log_df.iterrows():
                device_history = {
                    'device': raw['device'],
                    'device_id': device['_id'],
                    'start_time': raw['start_time'],
                    'end_time': raw['end_time'],
                    'site_id': raw['site_id'],
                }

                devices_history.append(device_history)

        except Exception as ex:
            print(ex)
            traceback.print_exc()

    return devices_history


def average_airqo_api_measurements(data: list, frequency: str) -> list:
    if len(data) == 0:
        print("events list is empty")
        return []

    devices_events_df = pd.DataFrame(data)
    devices_groups = devices_events_df.groupby("device")
    averaged_measurements = []

    for _, device_group in devices_groups:

        try:
            device_measurements = pd.json_normalize(device_group.to_dict(orient='records'))

            measurement_metadata = device_measurements[['site_id', 'device_id', 'device', 'device_number']].copy()

            measurement_readings = device_measurements

            del measurement_readings['site_id']
            del measurement_readings['device_id']
            del measurement_readings['frequency']
            del measurement_readings['device']
            del measurement_readings['device_number']

            averages = resample_data(measurement_readings, frequency)

            for _, row in averages.iterrows():
                combined_dataset = {**row.to_dict(), **measurement_metadata.iloc[0].to_dict()}
                averaged_measurements.append(combined_dataset)
        except Exception as ex:
            print(ex)
            traceback.print_exc()

    return averaged_measurements


def extract_airqo_data_from_thingspeak(start_time: str, end_time: str, all_devices: bool) -> list:
    thingspeak_base_url = configuration.THINGSPEAK_CHANNEL_URL

    airqo_api = AirQoApi()
    airqo_devices = airqo_api.get_devices(tenant='airqo', all_devices=all_devices)
    read_keys = airqo_api.get_read_keys(devices=airqo_devices)

    channels_data = []

    frequency = get_frequency(start_time=start_time, end_time=end_time)

    def get_field_8_value(x: str, position: int):

        try:
            values = x.split(',')
            return values[position]
        except Exception as exc:
            print(exc)
            return None

    dates = pd.date_range(start_time, end_time, freq=frequency)
    last_date_time = dates.values[len(dates.values) - 1]
    for device in airqo_devices:
        try:

            channel_id = str(device['device_number'])

            for date in dates:

                start = date_to_str(date)
                end_date_time = date + timedelta(hours=dates.freq.n)

                if np.datetime64(end_date_time) > last_date_time:
                    end = end_time
                else:
                    end = date_to_str(end_date_time)

                read_key = read_keys[str(channel_id)]

                channel_url = f'{thingspeak_base_url}{channel_id}/feeds.json?start={start}&end={end}&api_key={read_key}'
                print(f'{channel_url}')

                data = json.loads(requests.get(channel_url, timeout=100.0).content.decode('utf-8'))
                if (data != -1) and ('feeds' in data):
                    dataframe = pd.DataFrame(data['feeds'])

                    if dataframe.empty:
                        print(f'{channel_id} does not have data between {start} and {end}')
                        continue

                    channel_df = pd.DataFrame(data=[], columns=['time', 's1_pm2_5', 's2_pm2_5', 's1_pm10', 'device_id',
                                                                'site_id', 's2_pm10', 'latitude', 'longitude',
                                                                'altitude', 'wind_speed', 'satellites', 'hdop',
                                                                'internalTemperature', 'internalHumidity', 'battery',
                                                                'temperature', 'humidity', 'pressure',
                                                                'externalAltitude'])

                    channel_df['s1_pm2_5'] = dataframe['field1'].apply(lambda x: get_valid_value(x, 'pm2_5'))
                    channel_df['s1_pm10'] = dataframe['field2'].apply(lambda x: get_valid_value(x, 'pm10'))
                    channel_df['s2_pm2_5'] = dataframe['field3'].apply(lambda x: get_valid_value(x, 'pm2_5'))
                    channel_df['s2_pm10'] = dataframe['field4'].apply(lambda x: get_valid_value(x, 'pm10'))
                    channel_df['latitude'] = dataframe['field5'].apply(lambda x: get_valid_value(x, 'latitude'))
                    channel_df['longitude'] = dataframe['field6'].apply(lambda x: get_valid_value(x, 'longitude'))
                    channel_df['battery'] = dataframe['field7'].apply(lambda x: get_valid_value(x, 'battery'))

                    if 'field8' in dataframe.columns:
                        try:
                            channel_df['latitude'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 0), 'latitude'))
                            channel_df['longitude'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 1), 'longitude'))
                            channel_df['altitude'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 2), 'altitude'))
                            channel_df['wind_speed'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 3), 'wind_speed'))
                            channel_df['satellites'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 4), 'satellites'))
                            channel_df['hdop'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 5), 'hdop'))
                            channel_df['internalTemperature'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 6), 'externalTemperature'))
                            channel_df['internalHumidity'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 7), 'externalHumidity'))
                            channel_df['temperature'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 8), 'externalTemperature'))
                            channel_df['humidity'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 9), 'externalHumidity'))
                            channel_df['pressure'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 10), 'pressure'))
                            channel_df['externalAltitude'] = dataframe['field8'].apply(
                                lambda x: get_valid_value(get_field_8_value(x, 11), 'altitude'))

                        except Exception as ex:
                            traceback.print_exc()
                            print(ex)

                    channel_df['time'] = dataframe['created_at']
                    channel_df['device_id'] = device['_id']
                    channel_df['site_id'] = device['site']['_id']
                    channel_df['device_number'] = device['device_number']
                    channel_df['device'] = device['name']
                    channel_df['frequency'] = 'raw'

                    channels_data.extend(channel_df.to_dict(orient='records'))

        except Exception as ex:
            print(ex)
            traceback.print_exc()

    channel_data_df = pd.DataFrame(channels_data)
    clean_channel_data_df = remove_invalid_dates(dataframe=channel_data_df, start_time=start_time, end_time=end_time)
    return clean_channel_data_df.to_dict(orient='records')


def average_airqo_data(data: list, frequency='hourly') -> list:
    data_df = pd.DataFrame(data)

    device_groups = data_df.groupby("device_id")
    sampled_data = []

    for _, device_group in device_groups:
        site_id = device_group.iloc[0]["site_id"]
        device_id = device_group.iloc[0]["device_id"]
        device_number = device_group.iloc[0]["device_number"]
        device = device_group.iloc[0]["device"]

        del device_group['site_id']
        del device_group['device_id']

        averages = resample_data(device_group, frequency)

        averages["frequency"] = frequency.lower()
        averages["device_id"] = device_id
        averages["site_id"] = site_id
        averages["device_number"] = device_number
        averages["device"] = device

        sampled_data.extend(averages.to_dict(orient="records"))

    print(f'after sampling airqo data => {len(sampled_data)}')
    return sampled_data


# TODO: remove invalid weather values
def extract_airqo_weather_data_from_tahmo(start_time: str, end_time: str, frequency='hourly') -> list:
    raw_weather_data = get_weather_data_from_tahmo(start_time=start_time, end_time=end_time)
    sampled_weather_data = resample_weather_data(data=raw_weather_data, frequency=frequency)

    return sampled_weather_data


def restructure_airqo_data_for_api(data: list) -> list:
    restructured_data = []

    data_df = pd.DataFrame(data)
    data_df['raw_pm2_5'] = data_df[['s1_pm2_5', 's2_pm2_5']].mean(axis=1)
    data_df['raw_pm10'] = data_df[['s1_pm10', 's2_pm10']].mean(axis=1)

    data_df['pm2_5'] = data_df['calibrated_pm2_5'] if 'calibrated_pm2_5' in data_df.columns else None
    data_df['pm10'] = data_df['calibrated_pm10'] if 'calibrated_pm10' in data_df.columns else None

    data_df['pm2_5'] = data_df['pm2_5'].fillna(data_df['raw_pm2_5'])
    data_df['pm10'] = data_df['pm10'].fillna(data_df['raw_pm10'])

    columns = list(data_df.columns)

    for _, data_row in data_df.iterrows():
        device_data = dict({
            "device": data_row["device"],
            "device_id": data_row["device_id"],
            "site_id": data_row["site_id"],
            "device_number": data_row["device_number"],
            "tenant": "airqo",
            "location": {
                "latitude": {"value": get_column_value(column="latitude", series=data_row, columns=columns)},
                "longitude": {"value": get_column_value(column="longitude", series=data_row, columns=columns)}
            },
            "frequency": data_row['frequency'],
            "time": data_row["time"],
            "average_pm2_5": {
                "value": data_row["raw_pm2_5"],
                "calibratedValue": data_row["pm2_5"]
            },
            "average_pm10": {
                "value": data_row["raw_pm10"],
                "calibratedValue": data_row["pm10"]
            },
            "pm2_5": {"value": get_column_value(column="s1_pm2_5", series=data_row, columns=columns)},
            "pm10": {"value": get_column_value(column="s1_pm10", series=data_row, columns=columns)},
            # "pm2_5": {
            #     "value": get_column_value("pm2_5", data_row, columns, "pm2_5"),
            #     "rawValue": get_column_value("raw_pm2_5", data_row, columns, "pm2_5"),
            #     "calibratedValue": get_column_value("calibrated_pm2_5", data_row, columns, "pm2_5")
            # },
            # "pm10": {
            #     "value": get_column_value("pm10", data_row, columns, "pm10"),
            #     "rawValue": get_column_value("raw_pm10", data_row, columns, "pm10"),
            #     "calibratedValue": get_column_value("calibrated_pm10", data_row, columns, "pm10")
            # },
            "s1_pm2_5": {"value": get_column_value(column="s1_pm2_5", series=data_row, columns=columns)},
            "s1_pm10": {"value": get_column_value(column="s1_pm10", series=data_row, columns=columns)},
            "s2_pm2_5": {"value": get_column_value(column="s2_pm2_5", series=data_row, columns=columns)},
            "s2_pm10": {"value": get_column_value(column="s2_pm10", series=data_row, columns=columns)},
            "battery": {"value": get_column_value(column="voltage", series=data_row, columns=columns)},
            "altitude": {"value": get_column_value(column="altitude", series=data_row, columns=columns)},
            "speed": {"value": get_column_value(column="wind_speed", series=data_row, columns=columns)},
            "satellites": {"value": get_column_value(column="no_sats", series=data_row, columns=columns)},
            "hdop": {"value": get_column_value(column="hdope", series=data_row, columns=columns)},
            "externalTemperature": {"value": get_column_value(column="temperature", series=data_row, columns=columns)},
            "externalHumidity": {"value": get_column_value(column="humidity", series=data_row, columns=columns)},
        })

        restructured_data.append(device_data)

    return restructured_data


def map_site_ids_to_historical_measurements(data: list, deployment_logs: list) -> list:
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant='airqo')

    mapped_data = []

    devices_logs_df = pd.DataFrame(deployment_logs)
    devices_logs_df['start_time'] = devices_logs_df['start_time'].apply(lambda x: str_to_date(x))
    devices_logs_df['end_time'] = devices_logs_df['end_time'].apply(lambda x: str_to_date(x))

    data = un_fill_nan(data)
    data_df = pd.DataFrame(data)

    for _, data_row in data_df.iterrows():
        device = get_device(devices, device_id=data_row["device_id"])

        if not device:
            continue

        site_id = device.get("site").get("_id")
        time = str_to_date(data_row["time"])
        device_logs = devices_logs_df[devices_logs_df['device_id'] == device.get("_id")]

        if not device_logs.empty:
            for _, log in device_logs.iterrows():
                if log['start_time'] <= time <= log['end_time']:
                    site_id = log['site_id']

        data_row["site_id"] = site_id

        mapped_data.append(data_row.to_dict())

    return mapped_data


def restructure_airqo_data_for_bigquery(data: list) -> list:
    restructured_data = []

    data_df = pd.DataFrame(data)
    data_df['raw_pm2_5'] = data_df[['s1_pm2_5', 's2_pm2_5']].mean(axis=1)
    data_df['raw_pm10'] = data_df[['s1_pm10', 's2_pm10']].mean(axis=1)

    if 'calibrated_pm2_5' in data_df.columns:
        data_df['pm2_5'] = data_df['calibrated_pm2_5']
    else:
        data_df['calibrated_pm2_5'] = None
        data_df['pm2_5'] = None

    if 'calibrated_pm10' in data_df.columns:
        data_df['pm10'] = data_df['calibrated_pm10']
    else:
        data_df['calibrated_pm10'] = None
        data_df['pm10'] = None

    data_df['pm2_5'] = data_df['pm2_5'].fillna(data_df['raw_pm2_5'])
    data_df['pm10'] = data_df['pm10'].fillna(data_df['raw_pm10'])
    columns = list(data_df.columns)

    for _, data_row in data_df.iterrows():
        device_data = dict({

            "time": str_to_date(data_row["time"]),
            "tenant": "airqo",
            "site_id": data_row["site_id"],
            "device_number": data_row["device_number"],
            "device": data_row["device"],
            "latitude": get_column_value(column="latitude", columns=columns, series=data_row),
            "longitude": get_column_value(column="longitude", columns=columns, series=data_row),

            "pm2_5": get_column_value(column="pm2_5", columns=columns, series=data_row),
            "pm10": get_column_value(column="pm10", columns=columns, series=data_row),

            "s1_pm2_5": get_column_value(column="s1_pm2_5", columns=columns, series=data_row),
            "s1_pm10": get_column_value(column="s1_pm10", columns=columns, series=data_row),
            "s2_pm2_5": get_column_value(column="s2_pm2_5", columns=columns, series=data_row),
            "s2_pm10": get_column_value(column="s2_pm10", columns=columns, series=data_row),

            "pm2_5_calibrated_value": get_column_value(column="calibrated_pm2_5", columns=columns, series=data_row),
            "pm10_calibrated_value": get_column_value(column="calibrated_pm10", columns=columns, series=data_row),

            "altitude": get_column_value(column="altitude", columns=columns, series=data_row),
            "wind_speed": get_column_value(column="wind_speed", columns=columns, series=data_row),

            "external_temperature": get_column_value(column="temperature", columns=columns, series=data_row),
            "external_humidity": get_column_value(column="humidity", columns=columns, series=data_row),
        })

        restructured_data.append(device_data)

    return restructured_data


def merge_airqo_and_weather_data(airqo_data: list, weather_data: list) -> list:
    # TODO: notify in case of missing data
    airqo_data_df = pd.DataFrame(airqo_data)
    weather_data_df = pd.DataFrame(weather_data)

    if weather_data_df.empty:
        return airqo_data_df.to_dict(orient="records")

    airqo_data_df['frequency'] = airqo_data_df['frequency'].apply(lambda x: str(x).lower())
    weather_data_df['frequency'] = weather_data_df['frequency'].apply(lambda x: str(x).lower())

    if ('site_id' in weather_data_df.columns) and ('site_id' in airqo_data_df.columns):
        weather_data_df.drop(columns=['site_id'])

    merged_data_df = pd.merge(airqo_data_df, weather_data_df, on=['device_id', 'time', 'frequency'], how='left')

    def merge_values(dataframe: pd.DataFrame, variable: str) -> pd.DataFrame:
        dataframe[variable] = dataframe[f'{variable}_x'].apply(lambda x: get_valid_value(x, variable))
        dataframe[variable] = dataframe[variable].fillna(dataframe[f'{variable}_y'])
        dataframe = dataframe.drop(columns=[f'{variable}_x', f'{variable}_y'], axis=1)
        return dataframe

    if 'temperature_y' in merged_data_df.columns and 'temperature_x' in merged_data_df.columns:
        merged_data_df = merge_values(merged_data_df, 'temperature')

    if 'humidity_y' in merged_data_df.columns and 'humidity_x' in merged_data_df.columns:
        merged_data_df = merge_values(merged_data_df, 'humidity')

    if 'wind_speed_y' in merged_data_df.columns and 'wind_speed_x' in merged_data_df.columns:
        merged_data_df = merge_values(merged_data_df, 'wind_speed')

    return merged_data_df.to_dict(orient='records')


def calibrate_using_pickle_file(measurements: list) -> list:
    pm_2_5_model_file = download_file_from_gcs(bucket_name="airqo_prediction_bucket",
                                               source_file="PM2.5_calibrate_model.pkl",
                                               destination_file="pm2_5_model.pkl")

    pm_10_model_file = download_file_from_gcs(bucket_name="airqo_prediction_bucket",
                                              source_file="PM10_calibrate_model.pkl",
                                              destination_file="pm10_model.pkl")

    with open(pm_2_5_model_file, "rb") as f:
        rf_regressor = pickle.load(f)

    with open(pm_10_model_file, "rb") as f:
        lasso_regressor = pickle.load(f)

    calibrated_measurements = []
    data_df = pd.DataFrame(measurements)

    for _, row in data_df:
        try:
            calibrated_row = row
            hour = pd.to_datetime(row["time"]).hour
            s1_pm2_5 = row["s1_pm2_5"]
            s2_pm2_5 = row["s2_pm2_5"]
            s1_pm10 = row["s1_pm10"]
            s2_pm10 = row["s2_pm10"]
            temperature = row["temperature"]
            humidity = row["humidity"]

            input_variables = pd.DataFrame([[s1_pm2_5, s2_pm2_5, s1_pm10, s2_pm10, temperature, humidity, hour]],
                                           columns=['s1_pm2_5', 's2_pm2_5', 's1_pm10', 's2_pm10', 'temperature',
                                                    'humidity', 'hour'],
                                           dtype='float',
                                           index=['input'])

            input_variables["avg_pm2_5"] = input_variables[['s1_pm2_5', 's2_pm2_5']].mean(axis=1).round(2)
            input_variables["avg_pm10"] = input_variables[['s1_pm10', 's2_pm10']].mean(axis=1).round(2)
            input_variables["error_pm10"] = np.abs(input_variables["s1_pm10"] - input_variables["s2_pm10"])
            input_variables["error_pm2_5"] = np.abs(input_variables["s1_pm2_5"] - input_variables["s2_pm2_5"])
            input_variables["pm2_5_pm10"] = input_variables["avg_pm2_5"] - input_variables["avg_pm10"]
            input_variables["pm2_5_pm10_mod"] = input_variables["pm2_5_pm10"] / input_variables["avg_pm10"]
            input_variables = input_variables.drop(['s1_pm2_5', 's2_pm2_5', 's1_pm10', 's2_pm10'], axis=1)

            # reorganise columns
            input_variables = input_variables[['avg_pm2_5', 'avg_pm10', 'temperature', 'humidity', 'hour',
                                               'error_pm2_5', 'error_pm10', 'pm2_5_pm10', 'pm2_5_pm10_mod']]

            calibrated_pm2_5 = rf_regressor.predict(input_variables)[0]
            calibrated_pm10 = lasso_regressor.predict(input_variables)[0]

            calibrated_row['calibrated_pm2_5'] = calibrated_pm2_5
            calibrated_row['calibrated_pm10'] = calibrated_pm10

            calibrated_measurements.append(calibrated_row.to_dict(orient='records'))

        except Exception as ex:
            traceback.print_exc()
            print(ex)
            continue

    return calibrated_measurements


def calibrate_using_api(measurements: list) -> list:
    data_df = pd.DataFrame(measurements)

    data_df_groups = data_df.groupby("time")
    airqo_api = AirQoApi()
    calibrated_measurements = []

    for _, time_group in data_df_groups:

        try:
            data = time_group
            date_time = data.iloc[0]["time"]

            calibrate_body = data.to_dict(orient="records")

            calibrated_values = airqo_api.get_calibrated_values(time=date_time, calibrate_body=calibrate_body)

            for value in calibrated_values:
                try:
                    data.loc[(data['device_id'] == value["device_id"]) & (data['time'] == date_time),
                             'calibrated_pm2_5'] = value["calibrated_PM2.5"]
                    data.loc[(data['device_id'] == value["device_id"]) & (data['time'] == date_time),
                             'calibrated_pm10'] = value["calibrated_PM10"]
                except Exception as ex:
                    traceback.print_exc()
                    print(ex)
                    continue

            calibrated_measurements.extend(data.to_dict(orient='records'))

        except Exception as ex:
            traceback.print_exc()
            print(ex)
            continue

    return calibrated_measurements


def calibrate_hourly_airqo_measurements(measurements: list, method: str = 'api') -> list:
    data_df = pd.DataFrame(measurements)

    data_df["s1_pm2_5"] = data_df["s1_pm2_5"].apply(lambda x: get_valid_value(x, 'pm2_5'))
    data_df["s2_pm2_5"] = data_df["s2_pm2_5"].apply(lambda x: get_valid_value(x, 'pm2_5'))
    data_df["s1_pm10"] = data_df["s1_pm10"].apply(lambda x: get_valid_value(x, 'pm10'))
    data_df["s2_pm10"] = data_df["s2_pm10"].apply(lambda x: get_valid_value(x, 'pm10'))
    data_df["temperature"] = data_df["temperature"].apply(lambda x: get_valid_value(x, 'temperature'))
    data_df["humidity"] = data_df["humidity"].apply(lambda x: get_valid_value(x, 'humidity'))

    uncalibrated_data = data_df.loc[(data_df["s1_pm2_5"].isnull()) | (data_df["s1_pm10"].isnull()) |
                                    (data_df["s2_pm2_5"].isnull()) | (data_df["s2_pm10"].isnull()) |
                                    (data_df["temperature"].isnull()) | (data_df["humidity"].isnull())]

    data_for_calibration = data_df.dropna(subset=["s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10",
                                                  "temperature", "humidity"])
    calibrated_measurements = []

    if method.lower() == 'pickle':
        calibrated_data = calibrate_using_pickle_file(data_for_calibration)
    else:
        calibrated_data = calibrate_using_api(data_for_calibration)

    calibrated_measurements.extend(calibrated_data)
    calibrated_measurements.extend(uncalibrated_data.to_dict(orient='records'))

    return calibrated_measurements


@dag('AirQo-Historical-Hourly-Measurements', schedule_interval=None, on_failure_callback=slack_dag_failure_notification,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['airqo', 'hourly', 'historical'])
def historical_hourly_measurements_etl():
    def time_values(**kwargs):
        try:
            dag_run = kwargs.get('dag_run')
            start_time = dag_run.conf['startTime']
            end_time = dag_run.conf['endTime']
        except KeyError:
            yesterday = datetime.utcnow() - timedelta(days=1)
            start_time = datetime.strftime(yesterday, '%Y-%m-%dT%00:00:00Z')
            end_time = datetime.strftime(yesterday, '%Y-%m-%dT%11:59:59Z')

        return start_time, end_time

    @task(multiple_outputs=True)
    def extract_hourly_raw_data(**kwargs):

        start_time, end_time = time_values(**kwargs)
        raw_airqo_data = extract_airqo_data_from_thingspeak(start_time=start_time, end_time=end_time, all_devices=True)
        average_data = average_airqo_data(data=raw_airqo_data, frequency='hourly')

        return dict({"data": fill_nan(data=average_data)})

    @task(multiple_outputs=True)
    def extract_device_deployment_logs():
        logs = extract_airqo_devices_deployment_history()

        return dict({"data": logs})

    @task()
    def map_site_ids(airqo_data: dict, deployment_logs: dict):
        data = un_fill_nan(airqo_data.get("data"))
        logs = deployment_logs.get("data")

        restructured_data = map_site_ids_to_historical_measurements(data=data, deployment_logs=logs)

        return dict({"data": fill_nan(data=restructured_data)})

    @task(multiple_outputs=True)
    def extract_hourly_weather_data(**kwargs):

        start_time, end_time = time_values(**kwargs)
        airqo_weather_data = extract_airqo_weather_data_from_tahmo(start_time=start_time, end_time=end_time,
                                                                   frequency='hourly')
        return dict({"data": fill_nan(data=airqo_weather_data)})

    @task(multiple_outputs=True)
    def merge_data(averaged_airqo_data: dict, weather_data: dict):

        hourly_airqo_data = un_fill_nan(averaged_airqo_data.get("data"))
        hourly_weather_data = un_fill_nan(weather_data.get("data"))

        merged_measurements = merge_airqo_and_weather_data(airqo_data=hourly_airqo_data,
                                                           weather_data=hourly_weather_data)

        return dict({"data": fill_nan(data=merged_measurements)})

    @task(multiple_outputs=True)
    def calibrate(inputs: dict):
        data = un_fill_nan(inputs.get("data"))

        airqo_calibrated_data = calibrate_hourly_airqo_measurements(measurements=data)

        return dict({"data": fill_nan(data=airqo_calibrated_data)})

    @task()
    def load(airqo_data: dict, **kwargs):
        data = un_fill_nan(airqo_data.get("data"))

        try:
            dag_run = kwargs.get('dag_run')
            destination = dag_run.conf['destination']
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            airqo_restructured_data = restructure_airqo_data_for_bigquery(data=data)
            save_measurements_to_bigquery(measurements=airqo_restructured_data)

        else:
            airqo_restructured_data = restructure_airqo_data_for_api(data=data)
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=airqo_restructured_data, tenant='airqo')

    extracted_airqo_data = extract_hourly_raw_data()
    device_logs = extract_device_deployment_logs()
    data_with_site_ids = map_site_ids(airqo_data=extracted_airqo_data, deployment_logs=device_logs)

    extracted_weather_data = extract_hourly_weather_data()
    merged_data = merge_data(averaged_airqo_data=data_with_site_ids, weather_data=extracted_weather_data)
    calibrated_data = calibrate(merged_data)

    load(calibrated_data)


@dag('AirQo-Realtime-Measurements', schedule_interval="10 * * * *",
     on_failure_callback=slack_dag_failure_notification,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['airqo', 'hourly', 'realtime', 'raw'])
def realtime_measurements_etl():
    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, '%Y-%m-%dT%H:59:59Z')

    @task(multiple_outputs=True)
    def extract_raw_data():
        raw_airqo_data = extract_airqo_data_from_thingspeak(start_time=start_time, end_time=end_time, all_devices=False)
        return dict({"data": fill_nan(data=raw_airqo_data)})

    @task(multiple_outputs=True)
    def average_data_by_hour(raw_data: dict):
        raw_airqo_data = un_fill_nan(raw_data.get("data"))
        average_data = average_airqo_data(data=raw_airqo_data, frequency='hourly')

        return dict({"data": fill_nan(data=average_data)})

    @task(multiple_outputs=True)
    def extract_hourly_weather_data():
        airqo_weather_data = extract_airqo_weather_data_from_tahmo(start_time=start_time, end_time=end_time,
                                                                   frequency='hourly')
        return dict({"data": fill_nan(data=airqo_weather_data)})

    @task(multiple_outputs=True)
    def merge_data(averaged_hourly_data: dict, weather_data: dict):
        hourly_airqo_data = un_fill_nan(averaged_hourly_data.get("data"))
        hourly_weather_data = un_fill_nan(weather_data.get("data"))

        merged_measurements = merge_airqo_and_weather_data(airqo_data=hourly_airqo_data,
                                                           weather_data=hourly_weather_data)

        return dict({"data": fill_nan(data=merged_measurements)})

    @task(multiple_outputs=True)
    def calibrate(inputs: dict):
        data = un_fill_nan(inputs.get("data"))

        airqo_calibrated_data = calibrate_hourly_airqo_measurements(measurements=data)

        return dict({"data": fill_nan(data=airqo_calibrated_data)})

    @task()
    def save_hourly_data(airqo_data: dict):
        data = un_fill_nan(airqo_data.get("data"))

        airqo_restructured_data = restructure_airqo_data_for_api(data=data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant='airqo')

    @task()
    def save_raw_data(airqo_data: dict):
        data = un_fill_nan(airqo_data.get("data"))

        airqo_restructured_data = restructure_airqo_data_for_api(data=data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant='airqo')

    extracted_airqo_data = extract_raw_data()
    averaged_airqo_data = average_data_by_hour(extracted_airqo_data)
    extracted_weather_data = extract_hourly_weather_data()
    merged_data = merge_data(averaged_hourly_data=averaged_airqo_data, weather_data=extracted_weather_data)
    calibrated_data = calibrate(merged_data)
    save_hourly_data(calibrated_data)
    save_raw_data(extracted_airqo_data)


@dag('AirQo-Daily-Measurements', schedule_interval="0 1 * * *", on_failure_callback=slack_dag_failure_notification,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['airqo', 'daily'])
def airqo_daily_measurements_etl():
    def time_values(**kwargs):
        try:
            dag_run = kwargs.get('dag_run')
            start_time = dag_run.conf['startTime']
            end_time = dag_run.conf['endTime']
        except KeyError:
            hour_of_day = datetime.utcnow() - timedelta(hours=24)
            start_time = date_to_str_days(hour_of_day)
            end_time = datetime.strftime(hour_of_day, '%Y-%m-%dT%23:59:59Z')

        return start_time, end_time

    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):

        start_time, end_time = time_values(**kwargs)
        data = extract_airqo_hourly_data_from_api(start_time=start_time, end_time=end_time)

        return dict({"data": fill_nan(data=data)})

    @task(multiple_outputs=True)
    def average_data(inputs: dict):
        data = un_fill_nan(inputs.get("data"))
        averaged_data = average_airqo_api_measurements(data=data, frequency='daily')

        return dict({"data": fill_nan(data=averaged_data)})

    @task(multiple_outputs=True)
    def extract_devices_logs():
        logs = extract_airqo_devices_deployment_history()

        return dict({"data": logs})

    @task()
    def load(airqo_data: dict, device_logs: dict):
        data = un_fill_nan(airqo_data.get("data"))
        logs = device_logs.get("data")

        airqo_restructured_data = restructure_airqo_data_for_api(data=data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant='airqo')

    hourly_airqo_data = extract_airqo_data()
    averaged_airqo_data = average_data(hourly_airqo_data)
    devices_logs = extract_devices_logs()
    load(airqo_data=averaged_airqo_data, device_logs=devices_logs)


historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
hourly_realtime_measurements_etl_dag = realtime_measurements_etl()
# airqo_daily_measurements_etl_dag = airqo_daily_measurements_etl()
