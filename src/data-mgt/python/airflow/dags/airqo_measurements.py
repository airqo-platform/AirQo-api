import json
import traceback
from datetime import datetime, timedelta

import pandas as pd
import requests
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from config import configuration
from date import date_to_str, date_to_str_days, date_to_str_hours
from utils import get_column_value, get_valid_devices, build_channel_id_filter, get_airqo_device_data, get_device, \
    get_valid_value, get_weather_data_from_tahmo, resample_weather_data, resample_data, remove_invalid_dates, \
    save_measurements_via_api, fill_nan


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


def extract_airqo_data_from_thingspeak(start_time: str, end_time: str) -> list:
    thingspeak_base_url = configuration.THINGSPEAK_CHANNEL_URL

    airqo_api = AirQoApi()
    airqo_devices = airqo_api.get_devices(tenant='airqo')
    read_keys = airqo_api.get_read_keys(devices=airqo_devices)

    channels_data = []
    dates = pd.date_range(start_time, end_time, freq='1H')

    def get_field_8_value(x: str, position: int):

        try:
            values = x.split(',')
            return values[position]
        except Exception as exc:
            print(exc)
            return None

    for device in airqo_devices:
        try:

            channel_id = str(device['device_number'])
            for date in dates:

                start = date_to_str(date)
                end = date_to_str(date + timedelta(hours=1))
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

        del device_group['site_id']
        del device_group['device_id']

        averages = resample_data(device_group, frequency)

        averages["frequency"] = frequency.lower()
        averages["device_id"] = device_id
        averages["site_id"] = site_id

        sampled_data.extend(averages.to_dict(orient="records"))

    print(f'after sampling airqo data => {len(sampled_data)}')
    return sampled_data


def extract_airqo_weather_data_from_tahmo(start_time: str, end_time: str, frequency='hourly') -> list:
    raw_weather_data = get_weather_data_from_tahmo(start_time=start_time, end_time=end_time)
    sampled_weather_data = resample_weather_data(data=raw_weather_data, frequency=frequency)

    return sampled_weather_data


def extract_airqo_data_from_bigquery(start_time: str, end_time: str) -> list:
    valid_devices = get_valid_devices('airqo')

    channel_ids = build_channel_id_filter(valid_devices)

    dates = pd.date_range(start_time, end_time, freq='12H')
    measurements = []

    for date in dates:
        start_time = date_to_str(date)
        end_time = date_to_str(date + timedelta(hours=int(2)))

        print(start_time + " : " + end_time)

        range_measurements = get_airqo_device_data(start_time, end_time, channel_ids)
        measurements.extend(range_measurements)

    return measurements


def restructure_airqo_data(data: list) -> list:
    restructured_data = []
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant='airqo')

    data_df = pd.DataFrame(data)

    # data_df['raw_pm2_5'] = data_df[['s1_pm2_5', 's2_pm2_5']].mean(axis=1)
    # data_df['raw_pm10'] = data_df[['s1_pm10', 's2_pm10']].mean(axis=1)
    #
    # data_df['pm2_5_value'] = data_df['calibrated_pm2_5'] if 'calibrated_pm2_5' in data_df.columns else None
    # data_df['pm10_value'] = data_df['calibrated_pm10'] if 'calibrated_pm10' in data_df.columns else None
    #
    # data_df['pm2_5_value'].fillna(data_df['raw_pm2_5'])
    # data_df['pm10_value'].fillna(data_df['raw_pm10'])

    data_df['average_pm2_5'] = data_df[['s1_pm2_5', 's2_pm2_5']].mean(axis=1)
    data_df['average_pm10'] = data_df[['s1_pm10', 's2_pm10']].mean(axis=1)

    data_df = data_df.replace(to_replace='None', value=None)
    columns = data_df.columns

    for _, data_row in data_df.iterrows():
        device = get_device(devices, device_id=data_row["device_id"])

        if not device:
            continue

        device_data = dict({
            "device": device.get("name", ""),
            "device_id": device.get("_id", ""),
            "site_id": device.get("site").get("_id"),
            "device_number": device.get("device_number", ""),
            "tenant": "airqo",
            "location": {
                "latitude": {"value": get_column_value("latitude", data_row, columns, "latitude")},
                "longitude": {"value": get_column_value("longitude", data_row, columns, "longitude")}
            },
            "frequency": data_row['frequency'],
            "time": data_row["time"],
            "average_pm2_5": {
                "value": get_column_value("average_pm2_5", data_row, columns, "pm2_5"),
                "calibratedValue": get_column_value("calibrated_pm2_5", data_row, columns, "pm2_5")
            },
            "average_pm10": {
                "value": get_column_value("average_pm10", data_row, columns, "pm10"),
                "calibratedValue": get_column_value("calibrated_pm10", data_row, columns, "pm10")
            },
            "pm2_5": {
                "value": get_column_value("s1_pm2_5", data_row, columns, "pm2_5"),
            },
            "pm10": {
                "value": get_column_value("s1_pm10", data_row, columns, "pm10"),
            },
            # "pm2_5": {
            #     "value": get_column_value("pm2_5_value", data_row, columns, "pm2_5"),
            #     "rawValue": get_column_value("raw_pm2_5", data_row, columns, "pm2_5"),
            #     "calibratedValue": get_column_value("calibrated_pm2_5", data_row, columns, "pm2_5")
            # },
            # "pm10": {
            #     "value": get_column_value("pm10_value", data_row, columns, "pm10"),
            #     "rawValue": get_column_value("raw_pm10", data_row, columns, "pm10"),
            #     "calibratedValue": get_column_value("calibrated_pm10", data_row, columns, "pm10")
            # },
            # "s1_pm2_5": {"value": get_column_value("s1_pm2_5", data_row, columns, "pm2_5")},
            # "s1_pm10": {"value": get_column_value("s1_pm10", data_row, columns, "pm10")},
            "s2_pm2_5": {"value": get_column_value("s2_pm2_5", data_row, columns, "s2_pm2_5")},
            "s2_pm10": {"value": get_column_value("s2_pm10", data_row, columns, "s2_pm10")},
            "battery": {"value": get_column_value("voltage", data_row, columns, "battery")},
            "altitude": {"value": get_column_value("altitude", data_row, columns, "altitude")},
            "speed": {"value": get_column_value("wind_speed", data_row, columns, "speed")},
            "satellites": {"value": get_column_value("no_sats", data_row, columns, "satellites")},
            "hdop": {"value": get_column_value("hdope", data_row, columns, "hdop")},
            "externalTemperature": {"value": get_column_value("temperature", data_row, columns,
                                                              "externalTemperature")},
            "externalHumidity": {"value": get_column_value("humidity", data_row, columns, "externalHumidity")},
        })

        restructured_data.append(device_data)

    return restructured_data


def merge_airqo_and_weather_data(airqo_data: list, weather_data: list) -> list:
    airqo_data_df = pd.DataFrame(airqo_data)
    weather_data_df = pd.DataFrame(weather_data)

    airqo_data_df['frequency'] = airqo_data_df['frequency'].apply(lambda x: str(x).lower())
    weather_data_df['frequency'] = weather_data_df['frequency'].apply(lambda x: str(x).lower())

    if ('site_id' in weather_data_df.columns) and ('site_id' in airqo_data_df.columns):
        weather_data_df.drop(columns=['site_id'])

    merged_data_df = pd.merge(airqo_data_df, weather_data_df, on=['device_id', 'time', 'frequency'], how='left')

    def merge_values(row, variable):
        return row[f'{variable}_y'] if row[f'{variable}_y'] else row[f'{variable}_x']

    merged_data_df['temperature'] = merged_data_df.apply(lambda row: merge_values(row, 'temperature'), axis=1)
    merged_data_df['humidity'] = merged_data_df.apply(lambda row: merge_values(row, 'humidity'), axis=1)
    merged_data_df['wind_speed'] = merged_data_df.apply(lambda row: merge_values(row, 'wind_speed'), axis=1)

    merged_data_df = merged_data_df.drop(columns=['temperature_x', 'temperature_y', 'humidity_x',
                                                  'humidity_y', 'wind_speed_x', 'wind_speed_y'], axis=1)

    print(f'received samples: airqo => {len(airqo_data)} , tahmo => {len(weather_data)}, '
          f'merge => {len(merged_data_df.to_dict(orient="records"))}')

    return merged_data_df.to_dict(orient='records')


def calibrate_hourly_airqo_measurements(measurements: list) -> list:
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

    hourly_measurements_groups = data_for_calibration.groupby("time")
    airqo_api = AirQoApi()
    calibrated_measurements = []

    for _, time_group in hourly_measurements_groups:

        try:
            data = time_group
            date_time = data.iloc[0]["time"]

            calibrate_body = data.to_dict(orient="records")

            calibrated_values = airqo_api.get_calibrated_values(time=date_time, calibrate_body=calibrate_body)

            for value in calibrated_values:
                try:

                    data.loc[data['device_id'] == value["device_id"], 'calibrated_pm2_5'] = value["calibrated_PM2.5"]
                    data.loc[data['device_id'] == value["device_id"], 'calibrated_pm10'] = value["calibrated_PM10"]
                except Exception as ex:
                    traceback.print_exc()
                    print(ex)
                    continue

            calibrated_measurements.extend(data.to_dict(orient='records'))

        except Exception as ex:
            traceback.print_exc()
            print(ex)
            continue

    calibrated_measurements.extend(uncalibrated_data.to_dict(orient='records'))

    return calibrated_measurements


@dag('AirQo-Hourly-Measurements', schedule_interval="@hourly",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['airqo', 'hourly'])
def airqo_hourly_measurements_etl():
    def time_values(**kwargs):
        try:
            dag_run = kwargs.get('dag_run')
            start_time = dag_run.conf['startTime']
            end_time = dag_run.conf['endTime']
        except KeyError:
            hour_of_day = datetime.utcnow() - timedelta(hours=1)
            start_time = date_to_str_hours(hour_of_day)
            end_time = datetime.strftime(hour_of_day, '%Y-%m-%dT%H:59:59Z')

        return start_time, end_time

    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):

        start_time, end_time = time_values(**kwargs)
        raw_airqo_data = extract_airqo_data_from_thingspeak(start_time=start_time, end_time=end_time)
        average_data = average_airqo_data(data=raw_airqo_data, frequency='hourly')

        return dict({"data": average_data})

    @task(multiple_outputs=True)
    def extract_weather_data(**kwargs):

        start_time, end_time = time_values(**kwargs)
        airqo_weather_data = extract_airqo_weather_data_from_tahmo(start_time=start_time, end_time=end_time,
                                                                   frequency='hourly')
        return dict({"data": fill_nan(data=airqo_weather_data)})

    @task(multiple_outputs=True)
    def merge_data(raw_data: dict, weather_data: dict):
        hourly_airqo_data = raw_data.get("data")
        hourly_weather_data = weather_data.get("data")

        merged_measurements = merge_airqo_and_weather_data(airqo_data=hourly_airqo_data,
                                                           weather_data=hourly_weather_data)

        return dict({"data": fill_nan(data=merged_measurements)})

    @task(multiple_outputs=True)
    def calibrate(inputs: dict):
        data = inputs.get("data")

        airqo_calibrated_data = calibrate_hourly_airqo_measurements(measurements=data)

        return dict({"data": fill_nan(data=airqo_calibrated_data)})

    @task()
    def load(inputs: dict):
        data = inputs.get("data")

        airqo_restructured_data = restructure_airqo_data(data)

        save_measurements_via_api(measurements=airqo_restructured_data, tenant="airqo")

    extracted_airqo_data = extract_airqo_data()
    extracted_weather_data = extract_weather_data()
    merged_data = merge_data(raw_data=extracted_airqo_data, weather_data=extracted_weather_data)
    calibrated_data = calibrate(merged_data)
    load(calibrated_data)


@dag('AirQo-Daily-Measurements', schedule_interval="@daily",
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

        return dict({"data": data})

    @task(multiple_outputs=True)
    def average_data(inputs: dict):
        data = inputs.get("data")
        averaged_data = average_airqo_api_measurements(data=data, frequency='daily')

        return dict({"data": averaged_data})

    @task()
    def load(inputs: dict):
        data = inputs.get("data")

        airqo_restructured_data = restructure_airqo_data(data)

        save_measurements_via_api(measurements=airqo_restructured_data, tenant="airqo")

    hourly_airqo_data = extract_airqo_data()
    averaged_airqo_data = average_data(hourly_airqo_data)
    load(averaged_airqo_data)


airqo_hourly_measurements_etl_dag = airqo_hourly_measurements_etl()
# airqo_daily_measurements_etl_dag = airqo_daily_measurements_etl()
