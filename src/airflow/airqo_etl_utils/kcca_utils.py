import traceback

import numpy as np
import pandas as pd
import requests

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .config import configuration
from .constants import Tenant, DataSource, Frequency, DeviceCategory
from .data_validator import DataValidationUtils
from .date import date_to_str
from .utils import Utils


class KccaUtils:
    @staticmethod
    def query_data_from_api(start_time: str, end_time: str):
        api_url = f"{configuration.CLARITY_API_BASE_URL}measurements?startTime={start_time}&endTime={end_time}&outputFrequency=hour"

        headers = {
            "x-api-key": configuration.CLARITY_API_KEY,
            "Accept-Encoding": "gzip",
        }
        try:
            results = requests.get(api_url, headers=headers)
            if results.status_code != 200:
                print(f"{results.content}")
                return []
            return results.json()
        except Exception as ex:
            traceback.print_exc()
            print(ex)
            return []

    @staticmethod
    def extract_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
        measurements = []
        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.CLARITY,
        )

        for start, end in dates:
            range_measurements = KccaUtils.query_data_from_api(start, end)
            measurements.extend(range_measurements)

        return pd.json_normalize(measurements)

    @staticmethod
    def add_site_and_device_details(devices, device_id):
        try:
            result = dict(
                list(
                    filter(lambda device: (device["device_id"] == device_id), devices)
                )[0]
            )

            return pd.Series(
                {
                    "site_id": result.get("site_id", None),
                    "device_number": result.get("device_number", None),
                }
            )
        except Exception as ex:
            print(ex)
            return pd.Series({"site_id": None, "device_number": None})

    @staticmethod
    def flatten_location_coordinates(coordinates: str):
        try:
            coordinates = coordinates.replace("[", "")
            coordinates = coordinates.replace("]", "")
            coordinates = coordinates.replace(" ", "")
            coordinates = coordinates.split(",")

            return pd.Series({"latitude": coordinates[1], "longitude": coordinates[0]})
        except Exception as ex:
            print(ex)
            return pd.Series({"latitude": None, "longitude": None})

    @staticmethod
    def transform_data(data: pd.DataFrame) -> pd.DataFrame:
        data.rename(
            columns={
                "time": "timestamp",
                "deviceCode": "device_id",
                "characteristics.pm2_5ConcMass.value": "pm2_5",
                "characteristics.pm2_5ConcMass.raw": "pm2_5_raw_value",
                "characteristics.pm2_5ConcMass.calibratedValue": "pm2_5_calibrated_value",
                "characteristics.pm10ConcMass.value": "pm10",
                "characteristics.pm10ConcMass.raw": "pm10_raw_value",
                "characteristics.pm10ConcMass.calibratedValue": "pm10_calibrated_value",
                "characteristics.pm1ConcMass.value": "pm1",
                "characteristics.pm1ConcMass.raw": "pm1_raw_value",
                "characteristics.pm1ConcMass.calibratedValue": "pm1_calibrated_value",
                "characteristics.no2Conc.value": "no2",
                "characteristics.no2Conc.raw": "no2_raw_value",
                "characteristics.no2Conc.calibratedValue": "no2_calibrated_value",
                "characteristics.windSpeed.value": "wind_speed",
                "characteristics.temperature.value": "temperature",
                "characteristics.relHumid.value": "humidity",
                "characteristics.altitude.value": "altitude",
            },
            inplace=True,
        )

        data[["latitude", "longitude"]] = data["location.coordinates"].apply(
            KccaUtils.flatten_location_coordinates
        )

        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant=Tenant.KCCA)
        data[["site_id", "device_number"]] = data["device_id"].apply(
            lambda device_id: KccaUtils.add_site_and_device_details(
                devices=devices, device_id=device_id
            )
        )

        big_query_api = BigQueryApi()
        required_cols = big_query_api.get_columns(
            table=big_query_api.hourly_measurements_table
        )

        data = DataValidationUtils.fill_missing_columns(data=data, cols=required_cols)
        data = data[required_cols]

        return DataValidationUtils.remove_outliers(data)

    @staticmethod
    def process_latest_data(data: pd.DataFrame) -> pd.DataFrame:
        data.loc[:, "tenant"] = str(Tenant.KCCA)
        data.loc[:, "device_category"] = str(DeviceCategory.LOW_COST)
        return data

    @staticmethod
    def transform_data_for_api(data: pd.DataFrame) -> list:
        measurements = []
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["timestamp"] = data["timestamp"].apply(date_to_str)
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant=Tenant.KCCA)

        for _, row in data.iterrows():
            device_id = row["device_id"]
            device_details = list(
                filter(
                    lambda device: (device["device_id"] == device_id),
                    devices,
                )
            )[0]

            row_data = {
                "frequency": str(Frequency.HOURLY),
                "time": row.get("timestamp", None),
                "network": str(Tenant.KCCA),
                "tenant": str(Tenant.AIRQO),
                "site_id": row.get("site_id", None),
                "device_id": device_details.get("_id", None),
                "device": device_details.get("name", None),
                "location": dict(
                    {
                        "longitude": dict({"value": row.get("longitude", None)}),
                        "latitude": dict({"value": row.get("latitude", None)}),
                    }
                ),
                "pm2_5": {
                    "value": row.get("pm2_5", None),
                    "calibratedValue": row.get("pm2_5_calibrated_value", None),
                },
                "pm1": {
                    "value": row.get("pm1", None),
                    "calibratedValue": row.get("pm1_calibrated_value", None),
                },
                "pm10": {
                    "value": row.get("pm10", None),
                    "calibratedValue": row.get("pm10_calibrated_value", None),
                },
                "no2": {
                    "value": row.get("no2", None),
                    "calibratedValue": row.get("no2_calibrated_value", None),
                },
                "externalTemperature": {
                    "value": row.get("temperature", None),
                },
                "externalHumidity": {
                    "value": row.get("humidity", None),
                },
                "speed": {
                    "value": row.get("wind_speed", None),
                },
            }

            if row_data["site_id"] is None or data["site_id"] is np.nan:
                data.pop("site_id")

            measurements.append(row_data)

        return measurements
