import traceback

import pandas as pd

from .airnow_api import AirNowApi
from .airqo_api import AirQoApi
from .constants import Tenant, DataSource, DeviceCategory, Frequency
from .data_validator import DataValidationUtils
from .date import str_to_date, date_to_str
from .utils import Utils

import json

import logging

logger = logging.getLogger(__name__)


class AirnowDataUtils:
    @staticmethod
    def parameter_column_name(parameter: str) -> str:
        parameter = parameter.lower()
        if parameter == "pm2.5":
            return "pm2_5"
        elif parameter == "pm10":
            return "pm10"
        elif parameter == "no2":
            return "no2"
        else:
            raise Exception(f"Unknown parameter {parameter}")

    @staticmethod
    def query_bam_data(
        api_key: str, start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        airnow_api = AirNowApi()
        start_date_time = date_to_str(
            str_to_date(start_date_time), str_format="%Y-%m-%dT%H:%M"
        )
        end_date_time = date_to_str(
            str_to_date(end_date_time), str_format="%Y-%m-%dT%H:%M"
        )

        data = airnow_api.get_data(
            api_key=api_key,
            start_date_time=start_date_time,
            boundary_box="-16.9530804676,-33.957634112,54.8058474018,37.2697926495",
            end_date_time=end_date_time,
        )

        return pd.DataFrame(data)

    @staticmethod
    def extract_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
        tenants = AirQoApi().get_tenants(DataSource.AIRNOW)
        bam_data = pd.DataFrame()
        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.AIRNOW,
        )

        for tenant in tenants:
            network_api_key = tenant["api_key"]
            network_data = pd.DataFrame()

            for start, end in dates:
                query_data = AirnowDataUtils.query_bam_data(
                    api_key=network_api_key, start_date_time=start, end_date_time=end
                )
                network_data = pd.concat([network_data, query_data], ignore_index=True)

            network_data["tenant"] = tenant["network"]

            bam_data = pd.concat([bam_data, network_data], ignore_index=True)

        return bam_data

    @staticmethod
    def process_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Processes BAM data by matching it to device details and constructing a list of air quality measurements.

        Args:
            data (pd.DataFrame): A DataFrame containing raw BAM device data.

        Returns:
            pd.DataFrame: A DataFrame containing processed air quality data, with relevant device information and pollutant values.
        """
        air_now_data = []

        devices = AirQoApi().get_devices(
            tenant=Tenant.ALL, device_category=DeviceCategory.BAM
        )

        # Precompute device mapping for faster lookup
        device_mapping = {}
        for device in devices:
            for device_code in device["device_codes"]:
                device_mapping[device_code] = device

        for _, row in data.iterrows():
            try:
                device_id = str(row["FullAQSCode"])

                # Lookup device details based on FullAQSCode
                device_details = device_mapping.get(device_id)
                if not device_details:
                    logger.exception(f"Device with ID {device_id} not found")
                    continue

                # Initialize pollutant values (note: pm10 and no2 are not always present)
                pollutant_value = {"pm2_5": None, "pm10": None, "no2": None}

                # Get the corresponding pollutant value for the current parameter
                parameter_col_name = AirnowDataUtils.parameter_column_name(
                    row["Parameter"]
                )
                if parameter_col_name in pollutant_value:
                    pollutant_value[parameter_col_name] = row["Value"]

                if row["tenant"] != device_details.get("tenant"):
                    logger.exception(f"Tenant mismatch for device ID {device_id}")
                    continue

                air_now_data.append(
                    {
                        "timestamp": row["UTC"],
                        "tenant": row["tenant"],
                        "site_id": device_details.get("site_id"),
                        "device_id": device_details.get("device_id"),
                        "mongo_id": device_details.get("mongo_id"),
                        "device_number": device_details.get("device_number"),
                        "frequency": str(Frequency.HOURLY),
                        "latitude": row["Latitude"],
                        "longitude": row["Longitude"],
                        "device_category": str(DeviceCategory.BAM),
                        "pm2_5": pollutant_value["pm2_5"],
                        "pm2_5_calibrated_value": pollutant_value["pm2_5"],
                        "pm2_5_raw_value": pollutant_value["pm2_5"],
                        "pm10": pollutant_value["pm10"],
                        "pm10_calibrated_value": pollutant_value["pm10"],
                        "pm10_raw_value": pollutant_value["pm10"],
                        "no2": pollutant_value["no2"],
                        "no2_calibrated_value": pollutant_value["no2"],
                        "no2_raw_value": pollutant_value["no2"],
                    }
                )
            except Exception as ex:
                logger.exception(f"Error processing row: {ex}")

        return pd.DataFrame(air_now_data)
