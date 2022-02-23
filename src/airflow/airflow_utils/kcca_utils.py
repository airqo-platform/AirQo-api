from datetime import timedelta

import numpy as np
import pandas as pd
import requests

from airflow_utils.airqo_api import AirQoApi
from airflow_utils.bigquery_api import BigQueryApi
from airflow_utils.config import configuration
from airflow_utils.date import (
    date_to_str,
    str_to_date,
    frequency_time,
)
from airflow_utils.commons import (
    get_valid_column_value,
    to_double,
    get_site_and_device_id,
    get_column_value,
)


def query_kcca_measurements(frequency: str, start_time: str, end_time: str):
    api_url = f"{configuration.CLARITY_API_BASE_URL}measurements?startTime={start_time}&endTime={end_time}"

    if frequency == "hourly":
        api_url = f"{api_url}&outputFrequency=hour"
    elif frequency == "daily":
        api_url = f"{api_url}&outputFrequency=day"
    else:
        api_url = f"{api_url}&outputFrequency=minute"

    headers = {"x-api-key": configuration.CLARITY_API_KEY, "Accept-Encoding": "gzip"}
    results = requests.get(api_url, headers=headers)
    if results.status_code != 200:
        print(f"{results.content}")
        return []
    return results.json()


def extract_kcca_measurements(start_time: str, end_time: str, freq: str) -> list:
    if freq.lower() == "hourly":
        interval = "6H"
    elif freq.lower() == "daily":
        interval = "48H"
    else:
        interval = "1H"

    dates = pd.date_range(start_time, end_time, freq=interval)
    measurements = []
    last_date_time = dates.values[len(dates.values) - 1]

    for date in dates:

        start = date_to_str(date)
        end_date_time = date + timedelta(hours=dates.freq.n)

        if np.datetime64(end_date_time) > last_date_time:
            end = end_time
        else:
            end = date_to_str(end_date_time)

        print(start_time + " : " + end_time)

        range_measurements = query_kcca_measurements(freq, start, end)
        measurements.extend(range_measurements)

    measurements_df = pd.json_normalize(measurements)
    return measurements_df.to_dict(orient="records")


def transform_kcca_measurements_for_api(unclean_data) -> list:
    data = pd.DataFrame(unclean_data)
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="kcca")
    device_gps = data.groupby("deviceCode")
    cleaned_measurements = []
    for _, group in device_gps:
        device_name = group.iloc[0]["deviceCode"]

        site_id, device_id = get_site_and_device_id(devices, device_name=device_name)

        if not site_id and not device_id:
            continue

        transformed_data = []
        columns = group.columns

        for index, row in group.iterrows():

            location = str(row["location.coordinates"])
            location = location.replace("[", "").replace("]", "")
            location_coordinates = location.split(",")

            frequency = str(row.get("outputFrequency", "raw"))

            if frequency.lower() == "hour":
                frequency = "hourly"
            elif frequency.lower() == "day":
                frequency = "daily"
            else:
                frequency = "raw"

            row_data = dict(
                {
                    "frequency": frequency,
                    "time": frequency_time(
                        dateStr=row.get("time"), frequency=frequency
                    ),
                    "tenant": "kcca",
                    "site_id": site_id,
                    "device_id": device_id,
                    "device": row["deviceCode"],
                    "location": dict(
                        {
                            "longitude": dict(
                                {"value": to_double(location_coordinates[0])}
                            ),
                            "latitude": dict(
                                {"value": to_double(location_coordinates[1])}
                            ),
                        }
                    ),
                    "pm2_5": {
                        "value": get_valid_column_value(
                            column_name="characteristics.pm2_5ConcMass.raw",
                            series=row,
                            columns_names=columns,
                            data_name="pm2_5",
                        ),
                        "calibratedValue": get_valid_column_value(
                            column_name="characteristics.pm2_5ConcMass.value",
                            series=row,
                            columns_names=columns,
                            data_name="pm2_5",
                        ),
                    },
                    "pm1": {
                        "value": get_valid_column_value(
                            column_name="characteristics.pm1ConcMass.raw",
                            series=row,
                            columns_names=columns,
                            data_name=None,
                        ),
                        "calibratedValue": get_valid_column_value(
                            column_name="characteristics.pm1ConcMass.value",
                            series=row,
                            columns_names=columns,
                            data_name=None,
                        ),
                    },
                    "pm10": {
                        "value": get_valid_column_value(
                            column_name="characteristics.pm10ConcMass.raw",
                            series=row,
                            columns_names=columns,
                            data_name="pm10",
                        ),
                        "calibratedValue": get_valid_column_value(
                            column_name="characteristics.pm10ConcMass.value",
                            series=row,
                            columns_names=columns,
                            data_name="pm10",
                        ),
                    },
                    "externalTemperature": {
                        "value": get_valid_column_value(
                            column_name="characteristics.temperature.value",
                            series=row,
                            columns_names=columns,
                            data_name="externalTemperature",
                        ),
                    },
                    "externalHumidity": {
                        "value": get_valid_column_value(
                            column_name="characteristics.relHumid.value",
                            series=row,
                            columns_names=columns,
                            data_name="externalHumidity",
                        ),
                    },
                    "no2": {
                        "value": get_valid_column_value(
                            column_name="characteristics.no2Conc.raw",
                            series=row,
                            columns_names=columns,
                            data_name=None,
                        ),
                        "calibratedValue": get_valid_column_value(
                            column_name="characteristics.no2Conc.value",
                            series=row,
                            columns_names=columns,
                            data_name=None,
                        ),
                    },
                    "speed": {
                        "value": get_valid_column_value(
                            column_name="characteristics.windSpeed.value",
                            series=row,
                            columns_names=columns,
                            data_name=None,
                        ),
                    },
                }
            )

            transformed_data.append(row_data)

        if transformed_data:
            cleaned_measurements.extend(transformed_data)

    return cleaned_measurements


def transform_kcca_data_for_message_broker(data: list, frequency: str) -> list:
    restructured_data = []

    data_df = pd.DataFrame(data)
    columns = list(data_df.columns)

    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="kcca")

    for _, data_row in data_df.iterrows():
        device_name = data_row["deviceCode"]
        site_id, device_id = get_site_and_device_id(devices, device_name=device_name)
        if not site_id and not device_id:
            continue

        location = str(data_row["location.coordinates"])
        location = location.replace("[", "").replace("]", "")
        location_coordinates = location.split(",")

        device_data = dict(
            {
                "time": frequency_time(dateStr=data_row["time"], frequency=frequency),
                "tenant": "kcca",
                "site_id": site_id,
                "device_id": device_id,
                "device_number": 0,
                "device": device_name,
                "latitude": location_coordinates[1],
                "longitude": location_coordinates[0],
                "pm2_5": get_column_value(
                    column="characteristics.pm2_5ConcMass.value",
                    columns=columns,
                    series=data_row,
                ),
                "pm10": get_column_value(
                    column="characteristics.pm10ConcMass.value",
                    columns=columns,
                    series=data_row,
                ),
                "s1_pm2_5": get_column_value(
                    column="characteristics.pm2_5ConcMass.raw",
                    columns=columns,
                    series=data_row,
                ),
                "s1_pm10": get_column_value(
                    column="characteristics.pm10ConcMass.raw",
                    columns=columns,
                    series=data_row,
                ),
                "s2_pm2_5": None,
                "s2_pm10": None,
                "pm2_5_calibrated_value": get_column_value(
                    column="characteristics.pm2_5ConcMass.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "pm10_calibrated_value": get_column_value(
                    column="characteristics.pm10ConcMass.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "altitude": get_column_value(
                    column="characteristics.altitude.value",
                    columns=columns,
                    series=data_row,
                ),
                "wind_speed": get_column_value(
                    column="characteristics.windSpeed.value",
                    columns=columns,
                    series=data_row,
                ),
                "external_temperature": get_column_value(
                    column="characteristics.temperature.value",
                    columns=columns,
                    series=data_row,
                ),
                "external_humidity": get_column_value(
                    column="characteristics.relHumid.value",
                    columns=columns,
                    series=data_row,
                ),
            }
        )

        restructured_data.append(device_data)

    return restructured_data


def transform_kcca_hourly_data_for_bigquery(data: list) -> list:
    restructured_data = []

    data_df = pd.DataFrame(data)
    columns = list(data_df.columns)

    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="kcca")

    for _, data_row in data_df.iterrows():
        device_name = data_row["deviceCode"]
        site_id, _ = get_site_and_device_id(devices, device_name=device_name)
        if not site_id:
            continue

        location = str(data_row["location.coordinates"])
        location = location.replace("[", "").replace("]", "")
        location_coordinates = location.split(",")

        device_data = dict(
            {
                "time": str_to_date(data_row["time"]),
                "tenant": "kcca",
                "site_id": site_id,
                "device_number": 0,
                "device": device_name,
                "latitude": location_coordinates[1],
                "longitude": location_coordinates[0],
                "pm2_5": get_column_value(
                    column="characteristics.pm2_5ConcMass.value",
                    columns=columns,
                    series=data_row,
                ),
                "pm2_5_raw_value": get_column_value(
                    column="characteristics.pm2_5ConcMass.raw",
                    columns=columns,
                    series=data_row,
                ),
                "pm2_5_calibrated_value": get_column_value(
                    column="characteristics.pm2_5ConcMass.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "pm10": get_column_value(
                    column="characteristics.pm10ConcMass.value",
                    columns=columns,
                    series=data_row,
                ),
                "pm10_raw_value": get_column_value(
                    column="characteristics.pm10ConcMass.raw",
                    columns=columns,
                    series=data_row,
                ),
                "pm10_calibrated_value": get_column_value(
                    column="characteristics.pm10ConcMass.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "no2": get_column_value(
                    column="characteristics.no2Conc.value",
                    columns=columns,
                    series=data_row,
                ),
                "no2_raw_value": get_column_value(
                    column="characteristics.no2Conc.raw",
                    columns=columns,
                    series=data_row,
                ),
                "no2_calibrated_value": get_column_value(
                    column="characteristics.no2Conc.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "pm1": get_column_value(
                    column="characteristics.pm1ConcMass.value",
                    columns=columns,
                    series=data_row,
                ),
                "pm1_raw_value": get_column_value(
                    column="characteristics.pm1ConcMass.raw",
                    columns=columns,
                    series=data_row,
                ),
                "pm1_calibrated_value": get_column_value(
                    column="characteristics.pm1ConcMass.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "altitude": get_column_value(
                    column="characteristics.altitude.value",
                    columns=columns,
                    series=data_row,
                ),
                "wind_speed": get_column_value(
                    column="characteristics.windSpeed.value",
                    columns=columns,
                    series=data_row,
                ),
                "external_temperature": get_column_value(
                    column="characteristics.temperature.value",
                    columns=columns,
                    series=data_row,
                ),
                "external_humidity": get_column_value(
                    column="characteristics.relHumid.value",
                    columns=columns,
                    series=data_row,
                ),
            }
        )

        restructured_data.append(device_data)

    return pd.DataFrame(
        columns=BigQueryApi().hourly_measurements_columns, data=restructured_data
    ).to_dict(orient="records")
