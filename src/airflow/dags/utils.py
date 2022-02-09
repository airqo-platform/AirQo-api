import math
import traceback
from datetime import timedelta, datetime
from functools import reduce

import numpy as np
import pandas
import pandas as pd
from airflow.hooks.base import BaseHook
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator
from google.cloud import bigquery
from google.cloud import storage

from airqoApi import AirQoApi
from config import configuration
from message_broker import KafkaBrokerClient
from date import str_to_date, date_to_str, date_to_str_days, date_to_str_hours
from tahmo import TahmoApi


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


def measurement_time_to_string(time: str, daily=False):
    date_time = str_to_date(time)
    if daily:
        return date_to_str_days(date_time)
    else:
        return date_to_str_hours(date_time)


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
    data_df = data_df.fillna("none")
    return data_df.to_dict(orient="records")


def un_fill_nan(data: list) -> list:
    data_df = pd.DataFrame(data)
    data_df = data_df.replace(to_replace="none", value=None)
    return data_df.to_dict(orient="records")


def get_valid_value(raw_value, name=None):
    value = to_double(raw_value)

    if name is None or value is None or value is np.nan:
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
    elif (name == "externalTemperature" or name == "temperature") and (
        value <= 0 or value > 45
    ):
        return None
    elif (name == "externalHumidity" or name == "humidity") and (
        value <= 0 or value > 100
    ):
        return None
    elif name == "pressure":
        return None
    else:
        pass

    return value


def get_site_ids_from_station(station: str, sites: list):
    station_sites = list(
        filter(
            lambda x: str(x["nearest_tahmo_station"]["code"]).lower()
            == station.lower(),
            sites,
        )
    )

    if not station_sites:
        return []
    site_ids = []
    for site in station_sites:
        site_ids.append(site["_id"])

    return site_ids


def get_device_ids_from_station(station: str, sites: list):
    station_sites = list(
        filter(
            lambda x: str(x["nearest_tahmo_station"]["code"]).lower()
            == station.lower(),
            sites,
        )
    )

    if not station_sites:
        return []
    device_ids = []

    for site in station_sites:
        try:
            for device in site["devices"]:
                device_ids.append(device["_id"])
        except KeyError:
            continue

    return device_ids


def resample_data(data: pd.DataFrame, frequency: str) -> pd.DataFrame:
    data = data.dropna(subset=["time"])
    data["time"] = pd.to_datetime(data["time"])
    data = data.sort_index(axis=0)

    resample_value = "24H" if frequency.lower() == "daily" else "1H"
    averages = pd.DataFrame(data.resample(resample_value, on="time").mean())

    averages["time"] = averages.index
    averages["time"] = averages["time"].apply(lambda x: date_to_str(x))
    averages = averages.reset_index(drop=True)

    return averages


def resample_weather_data(data: list, frequency: str):
    weather_raw_data = pd.DataFrame(data)
    if weather_raw_data.empty:
        return weather_raw_data.to_dict(orient="records")

    airqo_api = AirQoApi()
    sites = airqo_api.get_sites(tenant="airqo")
    valid_sites = list(
        filter(lambda x: "nearest_tahmo_station" in dict(x).keys(), sites)
    )

    # to include site id
    # devices = get_devices_or_sites(configuration.AIRQO_BASE_URL, tenant='airqo', sites=False)

    temperature = weather_raw_data.loc[
        weather_raw_data["variable"] == "te", ["value", "variable", "station", "time"]
    ]
    humidity = weather_raw_data.loc[
        weather_raw_data["variable"] == "rh", ["value", "variable", "station", "time"]
    ]
    wind_speed = weather_raw_data.loc[
        weather_raw_data["variable"] == "ws", ["value", "variable", "station", "time"]
    ]

    humidity["value"] = pd.to_numeric(humidity["value"], errors="coerce")
    humidity["value"] = humidity["value"].apply(lambda x: x * 100)

    data = pd.concat([temperature, humidity, wind_speed])
    data.reset_index(inplace=True)
    devices_weather_data = []

    data["value"] = pd.to_numeric(data["value"], errors="coerce", downcast="float")
    data = data.fillna(0)

    data_station_gps = data.groupby("station")

    for _, station_group in data_station_gps:

        device_weather_data = []
        station = station_group.iloc[0]["station"]

        try:

            # resampling station values
            temperature = resample_data(
                station_group.loc[station_group["variable"] == "te", ["value", "time"]],
                frequency,
            )
            temperature.columns = ["temperature", "time"]
            humidity = resample_data(
                station_group.loc[station_group["variable"] == "rh", ["value", "time"]],
                frequency,
            )
            humidity.columns = ["humidity", "time"]
            wind_speed = resample_data(
                station_group.loc[station_group["variable"] == "ws", ["value", "time"]],
                frequency,
            )
            wind_speed.columns = ["wind_speed", "time"]

            data_frames = [temperature, humidity, wind_speed]

            station_df = reduce(
                lambda left, right: pd.merge(left, right, on=["time"], how="outer"),
                data_frames,
            )
            station_df["frequency"] = frequency

            # mapping device to station
            station_devices = get_device_ids_from_station(station, valid_sites)

            if len(station_devices) == 0:
                continue

            for device_id in station_devices:
                device_station_df = station_df.copy(deep=True)
                device_station_df["device_id"] = device_id
                device_weather_data.extend(device_station_df.to_dict(orient="records"))

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
    slack_webhook_token = BaseHook.get_connection("slack").password

    msg = """
          :green_circle: Task Successful. 
          *Task*: {task}  
          *Dag*: {dag} 
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        task=context.get("task_instance").task_id,
        dag=context.get("task_instance").dag_id,
        ti=context.get("task_instance"),
        exec_date=context.get("execution_date"),
        log_url=context.get("task_instance").log_url,
    )

    success_alert = SlackWebhookOperator(
        task_id="slack_success_notification",
        http_conn_id="slack",
        webhook_token=slack_webhook_token,
        message=msg,
        username="airflow",
    )

    return success_alert.execute(context=context)


def slack_dag_failure_notification(context):
    slack_webhook_token = BaseHook.get_connection("slack").password
    icon_color = (
        ":red_circle"
        if configuration.ENVIRONMENT.lower() == "production"
        else ":yellow_circle"
    )

    msg = """
          {icon_color}: Task Failed. 
          *Task*: {task}  
          *Dag*: {dag}
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        icon_color=icon_color,
        task=context.get("task_instance").task_id,
        dag=context.get("task_instance").dag_id,
        ti=context.get("task_instance"),
        exec_date=context.get("execution_date"),
        log_url=context.get("task_instance").log_url,
    )

    failed_alert = SlackWebhookOperator(
        task_id="slack_failed_notification",
        http_conn_id="slack",
        webhook_token=slack_webhook_token,
        message=msg,
        username="airflow",
    )

    return failed_alert.execute(context=context)


def download_file_from_gcs(bucket_name: str, source_file: str, destination_file: str):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(source_file)
    blob.download_to_filename(destination_file)
    print(
        f"file: {destination_file} downloaded from bucket: {bucket_name} successfully"
    )
    return destination_file


def get_frequency(start_time: str, end_time: str) -> str:
    diff_days = round(
        (str_to_date(end_time) - str_to_date(start_time)).total_seconds() / 86400
    )

    if diff_days >= 5:
        frequency = "96H"
    elif diff_days <= 1:
        diff_hours = round(
            (str_to_date(end_time) - str_to_date(start_time)).seconds / 3600
        )
        frequency = "1H" if diff_hours <= 0 else f"{diff_hours}H"
    else:
        frequency = f"{round(diff_days * 24)}H"

    return frequency


def get_airqo_api_frequency(freq: str) -> str:
    if freq == "hourly":
        return "168H"
    elif freq == "daily":
        return "720H"
    else:
        return "5H"


def get_weather_data_from_tahmo(start_time=None, end_time=None, tenant="airqo"):
    airqo_api = AirQoApi()
    airqo_sites = airqo_api.get_sites(tenant=tenant)
    station_codes = []
    for site in airqo_sites:
        try:
            if "nearest_tahmo_station" in dict(site).keys():
                station_codes.append(site["nearest_tahmo_station"]["code"])
        except Exception as ex:
            print(ex)

    measurements = []
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

        print(start + " : " + end)

        range_measurements = tahmo_api.get_measurements(start, end, station_codes)
        measurements.extend(range_measurements)

    if len(measurements) != 0:
        measurements_df = pd.DataFrame(data=measurements)
    else:
        measurements_df = pd.DataFrame(
            [], columns=["value", "variable", "station", "time"]
        )
        return measurements_df.to_dict(orient="records")

    clean_measurements_df = remove_invalid_dates(
        dataframe=measurements_df, start_time=start_time, end_time=end_time
    )
    return clean_measurements_df.to_dict(orient="records")


def remove_invalid_dates(
    dataframe: pd.DataFrame, start_time: str, end_time: str
) -> pd.DataFrame:
    start = pd.to_datetime(start_time)
    end = pd.to_datetime(end_time)

    dataframe["time"] = pd.to_datetime(dataframe["time"])
    data_frame = dataframe.set_index(["time"])

    time_data_frame = data_frame.loc[
        (data_frame.index >= start) & (data_frame.index <= end)
    ]

    time_data_frame["time"] = time_data_frame.index
    time_data_frame["time"] = time_data_frame["time"].apply(lambda x: date_to_str(x))
    time_data_frame = time_data_frame.reset_index(drop=True)

    return time_data_frame


def get_column_value(column: str, columns: list, series: pd.Series):
    return series[column] if column in columns else None


def get_valid_column_value(column_name, series, columns_names, data_name):
    if column_name in columns_names:
        value = to_double(series[column_name])
        return get_valid_value(value, data_name)

    return None


def get_site_and_device_id(devices, channel_id=None, device_name=None):
    try:
        if channel_id is not None:
            result = list(
                filter(lambda device: (device["device_number"] == channel_id), devices)
            )
        elif device_name is not None:
            result = list(
                filter(lambda device: (device["name"] == device_name), devices)
            )
        else:
            return None, None

        if not result:
            print("Device not found")
            return None, None

        return result[0]["site"]["_id"], result[0]["_id"]
    except Exception as ex:
        print(ex)
        print(
            f"Site ID for device => {device_name}/ channel Id => {channel_id} not found "
        )
        return None, None


def get_time_values(**kwargs):
    try:
        dag_run = kwargs.get("dag_run")
        start_time = dag_run.conf["startTime"]
        end_time = dag_run.conf["endTime"]
    except KeyError:
        yesterday = datetime.utcnow() - timedelta(days=1)
        start_time = datetime.strftime(yesterday, "%Y-%m-%dT%00:00:00Z")
        end_time = datetime.strftime(yesterday, "%Y-%m-%dT%11:59:59Z")

    return start_time, end_time


def save_measurements_to_bigquery(measurements: list, table_id: str) -> None:
    client = bigquery.Client()

    dataframe = pandas.DataFrame(
        measurements,
        columns=[
            "time",
            "tenant",
            "site_id",
            "device_number",
            "device",
            "latitude",
            "longitude",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "pm2_5",
            "pm10",
            "pm2_5_calibrated_value",
            "pm10_calibrated_value",
            "external_temperature",
            "external_humidity",
            "wind_speed",
            "altitude",
        ],
    )

    dataframe["time"] = pd.to_datetime(dataframe["time"])
    dataframe[
        [
            "latitude",
            "longitude",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "pm2_5",
            "pm10",
            "pm2_5_calibrated_value",
            "pm10_calibrated_value",
            "external_temperature",
            "external_humidity",
            "wind_speed",
            "altitude",
        ]
    ] = dataframe[
        [
            "latitude",
            "longitude",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "pm2_5",
            "pm10",
            "pm2_5_calibrated_value",
            "pm10_calibrated_value",
            "external_temperature",
            "external_humidity",
            "wind_speed",
            "altitude",
        ]
    ].apply(
        pd.to_numeric, errors="coerce"
    )

    job_config = bigquery.LoadJobConfig(
        write_disposition="WRITE_APPEND",
    )

    job = client.load_table_from_dataframe(dataframe, table_id, job_config=job_config)
    job.result()

    table = client.get_table(table_id)
    print(
        "Loaded {} rows and {} columns to {}".format(
            table.num_rows, len(table.schema), table_id
        )
    )


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
