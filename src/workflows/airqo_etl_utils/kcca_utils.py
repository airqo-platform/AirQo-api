import numpy as np
import pandas as pd
import requests

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .config import configuration
from .constants import DataSource, Frequency, DeviceCategory, DeviceNetwork
from .data_validator import DataValidationUtils
from .date import date_to_str
from .utils import Utils
from .datautils import DataUtils

import logging

logger = logging.getLogger(__name__)


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
            logger.exception(ex)
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
    def add_site_and_device_details(devices: pd.DataFrame, device_id) -> pd.Series:
        """
        Retrieves site and device details for a given device ID from the provided DataFrame.

        This function filters the `devices` DataFrame to find a row matching the specified `device_id`.
        If a matching device is found, it returns a pandas Series containing the `site_id` and
        `device_number` associated with that device. If no matching device is found or an error occurs,
        it returns a Series with None values.

        Args:
            devices (pd.DataFrame): A DataFrame containing device information, including 'device_id'.
            device_id: The ID of the device to search for in the DataFrame.

        Returns:
            pd.Series: A Series containing 'site_id' and 'device_number' for the specified device ID,
                    or None values if the device is not found or an error occurs.
        """
        try:
            filtered_devices = devices.loc[devices.name == device_id]
            if not filtered_devices.empty:
                result = filtered_devices.iloc[0]
                return pd.Series(
                    {
                        "site_id": result.get("site_id", None),
                        "device_number": result.get("device_number", None),
                    }
                )
        except Exception as e:
            logger.exception(f"An erro has occurred: {e}")

        logger.info("No matching device_id found.")
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

        devices, _ = DataUtils.get_devices()
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
        data.loc[:, "network"] = str(DeviceNetwork.KCCA)
        data.loc[:, "device_category"] = str(DeviceCategory.LOWCOST)
        return data

    @staticmethod
    def transform_data_for_api(data: pd.DataFrame) -> list:
        return DataUtils.process_data_for_api(data)
