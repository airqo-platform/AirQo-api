from datetime import datetime, timezone

import numpy as np
import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .config import configuration
from .constants import (
    DeviceCategory,
    Tenant,
    Frequency,
    DataSource,
    DataType,
    CityModel,
)
from .data_validator import DataValidationUtils
from .date import date_to_str
from .ml_utils import GCSUtils
from .data_sources import DataSourcesApis
from .utils import Utils
from .weather_data_utils import WeatherDataUtils
from typing import List, Dict, Any, Optional, Union
from .airqo_gx_expectations import AirQoGxExpectations

import logging

logger = logging.getLogger(__name__)


class AirQoDataUtils:
    Device_Field_Mapping = {
        DeviceCategory.LOW_COST: {
            "field1": "s1_pm2_5",
            "field2": "s1_pm10",
            "field3": "s2_pm2_5",
            "field4": "s2_pm10",
            "field7": "battery",
            "created_at": "timestamp",
        },
        DeviceCategory.LOW_COST_GAS: {
            "field1": "pm2_5",
            "field2": "tvoc",
            "field3": "hcho",
            "field4": "co2",
            "field5": "intaketemperature",
            "field6": "intakehumidity",
            "field7": "battery",
            "created_at": "timestamp",
        },
    }

    @staticmethod
    def extract_uncalibrated_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        hourly_uncalibrated_data = bigquery_api.query_data(
            table=bigquery_api.hourly_measurements_table,
            null_cols=["pm2_5_calibrated_value"],
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=str(Tenant.AIRQO),
        )

        return DataValidationUtils.remove_outliers(hourly_uncalibrated_data)

    @staticmethod
    def extract_data_from_bigquery(
        start_date_time, end_date_time, frequency: Frequency
    ) -> pd.DataFrame:
        bigquery_api = BigQueryApi()
        if frequency == Frequency.RAW:
            table = bigquery_api.raw_measurements_table
        elif frequency == Frequency.HOURLY:
            table = bigquery_api.hourly_measurements_table
        else:
            table = ""
        raw_data = bigquery_api.query_data(
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=str(Tenant.AIRQO),
        )

        return DataValidationUtils.remove_outliers(raw_data)

    @staticmethod
    def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
        cols = data.columns.to_list()
        cols.remove("timestamp")
        cols.remove("device_number")
        data.dropna(subset=cols, how="all", inplace=True)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["duplicated"] = data.duplicated(
            keep=False, subset=["device_number", "timestamp"]
        )

        if True not in data["duplicated"].values:
            return data

        duplicated_data = data.loc[data["duplicated"]]
        not_duplicated_data = data.loc[~data["duplicated"]]

        for _, by_device_number in duplicated_data.groupby(by="device_number"):
            for _, by_timestamp in by_device_number.groupby(by="timestamp"):
                by_timestamp = by_timestamp.copy()
                by_timestamp.fillna(inplace=True, method="ffill")
                by_timestamp.fillna(inplace=True, method="bfill")
                by_timestamp.drop_duplicates(
                    subset=["device_number", "timestamp"], inplace=True, keep="first"
                )
                not_duplicated_data = pd.concat(
                    [not_duplicated_data, by_timestamp], ignore_index=True
                )

        return not_duplicated_data

    @staticmethod
    def extract_aggregated_raw_data(
        start_date_time: str,
        end_date_time: str,
        network: str = None,
        dynamic_query: bool = False,
    ) -> pd.DataFrame:
        """
        Retrieves raw pm2.5 sensor data from bigquery and computes averages for the numeric columns grouped by device_number, device_id and site_id
        """
        bigquery_api = BigQueryApi()

        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=bigquery_api.raw_measurements_table,
            network=network,
            dynamic_query=dynamic_query,
        )

        if measurements.empty:
            return pd.DataFrame([])

        return measurements

    @staticmethod
    def flatten_field_8(device_category: DeviceCategory, field_8: str = None):
        """
        Maps thingspeak field8 data to airqo custom mapping. Mappings are defined in the config file.

        Args:
            device_category(DeviceCategory): Type/category of device
            field_8(str): Comma separated string

        returns:
            Pandas Series object of mapped fields to their appropriate values.
        """
        values: List[str] = field_8.split(",") if field_8 else ""
        series = pd.Series(dtype=float)

        match device_category:
            case DeviceCategory.BAM:
                mappings = configuration.AIRQO_BAM_CONFIG
            case DeviceCategory.LOW_COST_GAS:
                mappings = configuration.AIRQO_LOW_COST_GAS_CONFIG
            case DeviceCategory.LOW_COST:
                mappings = configuration.AIRQO_LOW_COST_CONFIG
            case _:
                logger.exception("A valid device category must be provided")

        for key, value in mappings.items():
            try:
                series[value] = values[key]
            except Exception as ex:
                logger.exception(f"An error occurred: {ex}")
                series[value] = None

        return series

    @staticmethod
    def map_and_extract_data(
        data_mapping: Dict[str, Union[str, Dict[str, List[str]]]],
        data: Union[List[Any], Dict[str, Any]],
    ) -> pd.DataFrame:
        """
        Map and extract specified fields from input data based on a provided mapping and extraction fields.

        Args:
            data_mapping (Dict[str, str]): A dictionary mapping source keys to target keys.
                Example: {"pm25": "pm2_5", "pm10": "pm10", "tp": "temperature"}
            data (Dict[str, Any]|): Input data containing raw key-value pairs to map and extract.
                Example:
                {
                    "pm25": {"conc": 21, "aqius": 73, "aqicn": 30},
                    "pm10": {"conc": 37, "aqius": 34, "aqicn": 37},
                    "pr": 100836,
                    "hm": 28,
                    "tp": 39.7,
                    "ts": "2024-11-24T13:14:40.000Z"
                }

        Returns:
            pd.Series: A pandas Series containing the mapped and extracted data.
        """

        def process_single_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
            """
            Process a single dictionary entry and map its data based on the mapping.

            Args:
                entry (Dict[str, Any]): A single data entry.

            Returns:
                Dict[str, Any]: A dictionary with the mapped data.
            """
            row_data = {}

            # Process 'field8' mapping
            if "field8" in entry and isinstance(entry["field8"], str):
                field8_mapping = data_mapping.get("field8")
                try:
                    field8_values: List[str] = entry.pop("field8").split(",")
                    for index, target_key in field8_mapping.items():
                        if target_key not in row_data:
                            row_data[target_key] = (
                                field8_values[index]
                                if index < len(field8_values)
                                else None
                            )
                except (ValueError, TypeError, AttributeError) as e:
                    logger.warning(f"Error processing field8: {e}")

            # Process the remaining fields
            if isinstance(entry, dict):
                for key, value_data in entry.items():
                    target_key = data_mapping.get(key, None)
                    target_value = None
                    if isinstance(target_key, dict):
                        target_value = target_key.get("value")
                        target_key = target_key.get("key")

                    if target_key and target_key not in row_data:
                        if isinstance(value_data, dict):
                            extracted_value = AirQoDataUtils._extract_nested_value(
                                value_data, target_value
                            )
                        else:
                            extracted_value = value_data
                        row_data[target_key] = extracted_value
            return row_data

        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            raise ValueError(
                f"Invalid data format. Expected a dictionary or a list of dictionaries got {type(data)}"
            )

        processed_rows = [process_single_entry(entry) for entry in data]

        return pd.DataFrame(processed_rows)

    def _extract_nested_value(data: Dict[str, Any], key: str) -> Any:
        """
        Helper function to extract a nested value from a dictionary.

        Args:
            data (Dict[str, Any]): The input dictionary containing nested data.
            key (str): The key to extract the value for.

        Returns:
            Any: The extracted value or None if not found.
        """
        return data.get(key)

    @staticmethod
    def flatten_meta_data(meta_data: list) -> list:
        data = []
        for item in meta_data:
            item = dict(item)
            device_numbers = item.get("device_numbers", [])
            if device_numbers:
                item.pop("device_numbers")
                for device_number in device_numbers:
                    data.append({**item, **{"device_number": device_number}})
        return data

    @staticmethod
    def extract_mobile_low_cost_sensors_data(
        meta_data: list, resolution: Frequency
    ) -> pd.DataFrame:
        data = pd.DataFrame()

        for value in meta_data:
            value = dict(value)
            measurements = AirQoDataUtils.extract_devices_data(
                start_date_time=value.get("start_date_time"),
                end_date_time=value.get("end_date_time"),
                device_numbers=[value.get("device_number")],
                resolution=resolution,
                device_category=DeviceCategory.LOW_COST,
            )
            if measurements.empty:
                continue
            measurements["latitude"] = value.get("latitude", None)
            measurements["longitude"] = value.get("longitude", None)
            data = data.append(measurements, ignore_index=True)

        return data

    @staticmethod
    def extract_aggregated_mobile_devices_weather_data(
        data: pd.DataFrame,
    ) -> pd.DataFrame:
        weather_data = pd.DataFrame()
        for _, station_data in data.groupby(
            by=["station_code", "start_date_time", "end_date_time"]
        ):
            raw_data = WeatherDataUtils.query_raw_data_from_tahmo(
                start_date_time=station_data.iloc[0]["start_date_time"],
                end_date_time=station_data.iloc[0]["end_date_time"],
                station_codes=[station_data.iloc[0]["station_code"]],
            )
            if raw_data.empty:
                continue

            raw_data = WeatherDataUtils.transform_raw_data(raw_data)
            aggregated_data = WeatherDataUtils.aggregate_data(raw_data)
            aggregated_data["timestamp"] = pd.to_datetime(aggregated_data["timestamp"])

            for _, row in station_data.iterrows():
                device_weather_data = aggregated_data.copy()
                device_weather_data["device_number"] = row["device_number"]
                device_weather_data["distance"] = row["distance"]
                weather_data = weather_data.append(
                    device_weather_data, ignore_index=True
                )

        devices_weather_data = pd.DataFrame()
        for _, device_weather_data in weather_data.groupby("device_number"):
            for _, time_group in device_weather_data.groupby("timestamp"):
                time_group.sort_values(ascending=True, by="distance", inplace=True)
                time_group.fillna(method="bfill", inplace=True)
                time_group.drop_duplicates(
                    keep="first", subset=["timestamp"], inplace=True
                )
                time_group["device_number"] = device_weather_data.iloc[0][
                    "device_number"
                ]
                del time_group["distance"]
                devices_weather_data = devices_weather_data.append(
                    time_group, ignore_index=True
                )

        return devices_weather_data

    @staticmethod
    def merge_aggregated_mobile_devices_data_and_weather_data(
        measurements: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:
        airqo_data_cols = measurements.columns.to_list()
        weather_data_cols = weather_data.columns.to_list()
        intersecting_cols = list(set(airqo_data_cols) & set(weather_data_cols))
        intersecting_cols.remove("timestamp")
        intersecting_cols.remove("device_number")

        for col in intersecting_cols:
            measurements.rename(
                columns={col: f"device_reading_{col}_col"}, inplace=True
            )

        measurements["timestamp"] = pd.to_datetime(measurements["timestamp"])
        measurements["device_number"] = measurements["device_number"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        weather_data["timestamp"] = pd.to_datetime(weather_data["timestamp"])
        weather_data["device_number"] = weather_data["device_number"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        data = pd.merge(
            measurements,
            weather_data,
            on=["device_number", "timestamp"],
            how="left",
        )

        for col in intersecting_cols:
            data[col].fillna(data[f"device_reading_{col}_col"], inplace=True)
            del data[f"device_reading_{col}_col"]

        return data

    @staticmethod
    def restructure_airqo_mobile_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["tenant"] = "airqo"
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(
            table=big_query_api.airqo_mobile_measurements_table
        )
        return Utils.populate_missing_columns(data=data, columns=cols)

    @staticmethod
    def extract_devices_data(
        start_date_time: str,
        end_date_time: str,
        device_category: DeviceCategory,
        resolution: Frequency = Frequency.RAW,
        device_numbers: list = None,
        remove_outliers: bool = True,
    ) -> pd.DataFrame:
        """
        Extracts sensor measurements from AirQo devices recorded between specified date and time ranges.

        Retrieves sensor data from Thingspeak API for devices belonging to the specified device category (BAM or low-cost sensors).
        Optionally filters data by specific device numbers and removes outliers if requested.

        Args:
            start_date_time (str): Start date and time (ISO 8601 format) for data extraction.
            end_date_time (str): End date and time (ISO 8601 format) for data extraction.
            device_category (DeviceCategory): Category of devices to extract data from (BAM or low-cost sensors).
            device_numbers (list, optional): List of device numbers whose data to extract. Defaults to None (all devices).
            remove_outliers (bool, optional): If True, removes outliers from the extracted data. Defaults to True.
        """
        devices_data = pd.DataFrame()
        airqo_api = AirQoApi()
        data_source_api = DataSourcesApis()

        devices = airqo_api.get_devices_by_network(device_category=device_category)
        if not devices:
            logger.exception(
                "Failed to fetch devices. Please check if devices are deployed"
            )
            return devices_data

        other_fields_cols: List[str] = []
        network: str = None
        devices = (
            [x for x in devices if x["device_number"] in device_numbers]
            if device_numbers
            else devices
        )

        config = configuration.device_config_mapping.get(str(device_category), None)
        if not config:
            logger.warning("Missing device category.")
            return devices_data

        field_8_cols = config["field_8_cols"]
        other_fields_cols = config["other_fields_cols"]
        data_columns = list(
            set(
                [
                    "device_number",
                    "device_id",
                    "site_id",
                    "latitude",
                    "longitude",
                    "timestamp",
                    *field_8_cols,
                    *other_fields_cols,
                ]
            )
        )

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.THINGSPEAK,
        )

        for device in devices:
            data = []
            device_number = device.get("device_number", None)
            read_key = device.get("readKey", None)
            network = device.get("network", None)

            if device_number and read_key is None:
                logger.exception(f"{device_number} does not have a read key")
                continue
            api_data = []
            if device_number and network == "airqo":
                for start, end in dates:
                    data_, meta_data, data_available = data_source_api.thingspeak(
                        device_number=device_number,
                        start_date_time=start,
                        end_date_time=end,
                        read_key=read_key,
                    )
                    if data_available:
                        api_data.extend(data_)
                if len(api_data) > 0:
                    mapping = config["mapping"][network]
                    data = AirQoDataUtils.map_and_extract_data(mapping, api_data)
            elif network == "iqair":
                mapping = config["mapping"][network]
                try:
                    data = AirQoDataUtils.map_and_extract_data(
                        mapping, data_source_api.iqair(device, resolution=resolution)
                    )
                except Exception as e:
                    logger.exception(f"An error occured: {e} - device {device['name']}")
                    continue
            if isinstance(data, pd.DataFrame) and data.empty:
                logger.warning(f"No data received from {device['name']}")
                continue

            if isinstance(data, pd.DataFrame) and not data.empty:
                data = DataValidationUtils.fill_missing_columns(
                    data=data, cols=data_columns
                )
                data["device_number"] = device_number
                data["device_id"] = device["name"]
                data["site_id"] = device["site_id"]
                data["network"] = network

                # TODO Clean up long,lat assignment.
                if device_category in AirQoDataUtils.Device_Field_Mapping:
                    data["latitude"] = device.get("latitude", None)
                    data["longitude"] = device.get("longitude", None)
                else:
                    data["latitude"] = meta_data.get("latitude", None)
                    data["longitude"] = meta_data.get("longitude", None)
                devices_data = pd.concat([devices_data, data], ignore_index=True)

        if remove_outliers:
            if "vapor_pressure" in devices_data.columns.to_list():
                is_airqo_network = devices_data["network"] == "airqo"
                devices_data.loc[is_airqo_network, "vapor_pressure"] = devices_data.loc[
                    is_airqo_network, "vapor_pressure"
                ].apply(DataValidationUtils.convert_pressure_values)
            devices_data = DataValidationUtils.remove_outliers(devices_data)

        return devices_data

    @staticmethod
    def aggregate_low_cost_sensors_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Resamples and averages out the numeric type fields on an hourly basis.

        Args:
            data(pandas.DataFrame): A pandas DataFrame object containing cleaned/converted (numeric) data.

        Returns:
            A pandas DataFrame object containing hourly averages of data.
        """

        data["timestamp"] = pd.to_datetime(data["timestamp"])

        group_metadata = (
            data[["device_id", "site_id", "device_number", "network"]]
            .drop_duplicates("device_id")
            .set_index("device_id")
        )
        numeric_columns = data.select_dtypes(include=["number"]).columns
        numeric_columns = numeric_columns.difference(["device_number"])
        data_for_aggregation = data[["timestamp", "device_id"] + list(numeric_columns)]

        aggregated = (
            data_for_aggregation.groupby("device_id")
            .apply(lambda group: group.resample("1H", on="timestamp").mean())
            .reset_index()
        )

        aggregated = aggregated.merge(group_metadata, on="device_id", how="left")

        return aggregated

    @staticmethod
    def clean_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        data = DataValidationUtils.remove_outliers(data)
        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )

        data["tenant"] = str(Tenant.AIRQO)
        data.rename(columns=configuration.AIRQO_BAM_MAPPING, inplace=True)

        big_query_api = BigQueryApi()
        required_cols = big_query_api.get_columns(
            table=big_query_api.bam_measurements_table
        )

        data = Utils.populate_missing_columns(data=data, columns=required_cols)
        data = data[required_cols]

        return data

    @staticmethod
    def clean_low_cost_sensor_data(
        data: pd.DataFrame,
        device_category: DeviceCategory,
        remove_outliers: bool = True,
    ) -> pd.DataFrame:
        """
        Removes outlier values, drops duplicates and converts timestamp to the pandas datetime type.

        Args:
            data(pandas.DataFrame): The data to clean.
            device_category(DeviceCategory): Device category as defined by the enums in DeviceCategory.
            remove_outliers(bool): A bool that defaults to true that is used to determine whether outliers should be dropped or not.

        Returns:
            A pandas.DataFrame object that contains the cleaned data.
        """
        if remove_outliers:
            data = DataValidationUtils.remove_outliers(data)
            # Perform data check here: TODO Find a more structured and robust way to implement raw data quality checks.
            match device_category:
                case DeviceCategory.LOW_COST_GAS:
                    AirQoGxExpectations.from_pandas().gaseous_low_cost_sensor_raw_data_check(
                        data
                    )
                case DeviceCategory.LOW_COST:
                    AirQoGxExpectations.from_pandas().pm2_5_low_cost_sensor_raw_data(
                        data
                    )
        else:
            data["timestamp"] = pd.to_datetime(data["timestamp"])
        data.dropna(subset=["timestamp"], inplace=True)

        data.drop_duplicates(
            subset=["timestamp", "device_id"], keep="first", inplace=True
        )
        # TODO Find an appropriate place to put this
        if device_category == DeviceCategory.LOW_COST:
            is_airqo_network = data["network"] == "airqo"

            pm2_5_mean = data.loc[is_airqo_network, ["s1_pm2_5", "s2_pm2_5"]].mean(
                axis=1
            )
            pm10_mean = data.loc[is_airqo_network, ["s1_pm10", "s2_pm10"]].mean(axis=1)

            data.loc[is_airqo_network, "pm2_5_raw_value"] = pm2_5_mean
            data.loc[is_airqo_network, "pm2_5"] = pm2_5_mean
            data.loc[is_airqo_network, "pm10_raw_value"] = pm10_mean
            data.loc[is_airqo_network, "pm10"] = pm10_mean
        return data

    @staticmethod
    def format_data_for_bigquery(
        data: pd.DataFrame, data_type: DataType
    ) -> pd.DataFrame:
        # Currently only used for BAM device measurements
        data.loc[:, "timestamp"] = pd.to_datetime(data["timestamp"])

        big_query_api = BigQueryApi()
        if data_type == DataType.UNCLEAN_BAM_DATA:
            cols = big_query_api.get_columns(
                table=big_query_api.raw_bam_measurements_table
            )
        elif data_type == DataType.CLEAN_BAM_DATA:
            cols = big_query_api.get_columns(table=big_query_api.bam_measurements_table)
        elif data_type == DataType.UNCLEAN_LOW_COST_DATA:
            cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        elif data_type == DataType.CLEAN_LOW_COST_DATA:
            cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        elif data_type == DataType.AGGREGATED_LOW_COST_DATA:
            cols = big_query_api.get_columns(
                table=big_query_api.hourly_measurements_table
            )
        else:
            raise Exception("invalid data type")
        return Utils.populate_missing_columns(data=data, columns=cols)

    @staticmethod
    def process_raw_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        """
        Makes neccessary conversions, adds missing columns and sets them to `None`
        """
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        return Utils.populate_missing_columns(data=data, columns=cols)

    @staticmethod
    def process_aggregated_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        """
        Makes neccessary conversions, adds missing columns and sets them to `None`
        """
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.hourly_measurements_table)
        return Utils.populate_missing_columns(data=data, columns=cols)

    @staticmethod
    def process_latest_data(
        data: pd.DataFrame, device_category: DeviceCategory
    ) -> pd.DataFrame:
        cols = data.columns.to_list()
        if device_category == DeviceCategory.BAM:
            if "pm2_5" not in cols:
                data.loc[:, "pm2_5"] = None

            if "pm10" not in cols:
                data.loc[:, "pm10"] = None

            if "no2" not in cols:
                data.loc[:, "no2"] = None

            data["s1_pm2_5"] = data["pm2_5"]
            data["pm2_5_raw_value"] = data["pm2_5"]
            data["pm2_5_calibrated_value"] = data["pm2_5"]

            data["s1_pm10"] = data["pm10"]
            data["pm10_raw_value"] = data["pm10"]
            data["pm10_calibrated_value"] = data["pm10"]

            data["no2_raw_value"] = data["no2"]
            data["no2_calibrated_value"] = data["no2"]

        else:
            data["pm2_5"] = data["pm2_5_calibrated_value"]
            data["pm10"] = data["pm10_calibrated_value"]

            data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
            data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

            data["pm2_5"] = data["pm2_5"].fillna(data["pm2_5_raw_value"])
            data["pm10"] = data["pm10"].fillna(data["pm10_raw_value"])

        data.loc[:, "device_category"] = str(device_category)

        return data

    @staticmethod
    def process_data_for_api(data: pd.DataFrame, frequency: Frequency) -> list:
        """
        Formats device measurements into a format required by the events endpoint.

        Args:
            data: device measurements
            frequency: frequency of the measurements.

        Return:
            A list of measurements
        """
        restructured_data = []

        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        # Create a device lookup dictionary for faster access
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices()

        device_lookup = {
            device["device_number"]: device
            for device in devices
            if device.get("device_number")
        }

        for _, row in data.iterrows():
            try:
                device_number = row["device_number"]

                # Get device details from the lookup dictionary
                device_details = device_lookup.get(device_number)
                if not device_details:
                    logger.exception(
                        f"Device number {device_number} not found in device list."
                    )
                    continue

                row_data = {
                    "device": device_details["device_id"],
                    "device_id": device_details["_id"],
                    "site_id": row["site_id"],
                    "device_number": device_number,
                    "tenant": str(Tenant.AIRQO),
                    "location": {
                        "latitude": {"value": row["latitude"]},
                        "longitude": {"value": row["longitude"]},
                    },
                    "frequency": str(frequency),
                    "time": row["timestamp"],
                    "average_pm2_5": {
                        "value": row["pm2_5"],
                        "calibratedValue": row["pm2_5_calibrated_value"],
                    },
                    "average_pm10": {
                        "value": row["pm10"],
                        "calibratedValue": row["pm10_calibrated_value"],
                    },
                    "pm2_5": {
                        "value": row["pm2_5"],
                        "calibratedValue": row["pm2_5_calibrated_value"],
                    },
                    "pm10": {
                        "value": row["pm10"],
                        "calibratedValue": row["pm10_calibrated_value"],
                    },
                    "s1_pm2_5": {"value": row["s1_pm2_5"]},
                    "s1_pm10": {"value": row["s1_pm10"]},
                    "s2_pm2_5": {"value": row["s2_pm2_5"]},
                    "s2_pm10": {"value": row["s2_pm10"]},
                    "battery": {"value": row["battery"]},
                    "altitude": {"value": row["altitude"]},
                    "speed": {"value": row["wind_speed"]},
                    "satellites": {"value": row["satellites"]},
                    "hdop": {"value": row["hdop"]},
                    "externalTemperature": {"value": row["temperature"]},
                    "externalHumidity": {"value": row["humidity"]},
                }

                if row_data["site_id"] is None or row_data["site_id"] is np.nan:
                    row_data.pop("site_id")

                restructured_data.append(row_data)

            except Exception as ex:
                logger.exception(f"An error occurred: {ex}")

        return restructured_data

    @staticmethod
    def merge_aggregated_weather_data(
        airqo_data: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Merges airqo pm2.5 sensor data with weather data from the weather stations selected from the sites data.

        args:
            airqo_data(pandas.DataFrame):
            weather_data(pandas.DataFrame):
        """
        if weather_data.empty:
            return airqo_data

        airqo_data["timestamp"] = pd.to_datetime(airqo_data["timestamp"])
        weather_data["timestamp"] = pd.to_datetime(weather_data["timestamp"])

        airqo_api = AirQoApi()
        sites: List[Dict[str, Any]] = []

        for site in airqo_api.get_sites(tenant=Tenant.AIRQO):
            sites.extend(
                [
                    {
                        "site_id": site.get("_id"),
                        "station_code": station.get("code", None),
                        "distance": station.get("distance", None),
                    }
                    for station in site.get("weather_stations", [])
                ]
            )
        sites_df = pd.DataFrame(sites)
        sites_weather_data = pd.DataFrame()
        weather_data_cols = weather_data.columns.to_list()

        for _, by_site in sites_df.groupby("site_id"):
            site_weather_data = weather_data[
                weather_data["station_code"].isin(by_site["station_code"].to_list())
            ]
            if site_weather_data.empty:
                continue

            site_weather_data = pd.merge(site_weather_data, by_site, on="station_code")

            for _, by_timestamp in site_weather_data.groupby("timestamp"):
                by_timestamp.sort_values(ascending=True, by="distance", inplace=True)
                by_timestamp.fillna(method="bfill", inplace=True)
                by_timestamp.drop_duplicates(
                    keep="first", subset=["timestamp"], inplace=True
                )
                by_timestamp = by_timestamp[weather_data_cols]

                by_timestamp.loc[:, "site_id"] = by_site.iloc[0]["site_id"]
                sites_weather_data = pd.concat(
                    [sites_weather_data, by_timestamp], ignore_index=True
                )

        airqo_data_cols = airqo_data.columns.to_list()
        weather_data_cols = sites_weather_data.columns.to_list()
        intersecting_cols = list(set(airqo_data_cols) & set(weather_data_cols))
        intersecting_cols.remove("timestamp")
        intersecting_cols.remove("site_id")

        for col in intersecting_cols:
            airqo_data.rename(columns={col: f"device_reading_{col}_col"}, inplace=True)

        measurements = pd.merge(
            left=airqo_data,
            right=sites_weather_data,
            how="left",
            on=["site_id", "timestamp"],
        )

        for col in intersecting_cols:
            measurements[col].fillna(
                measurements[f"device_reading_{col}_col"], inplace=True
            )
            del measurements[f"device_reading_{col}_col"]

        numeric_columns = measurements.select_dtypes(include=["number"]).columns
        numeric_columns = numeric_columns.difference(["device_number"])
        numeric_counts = measurements[numeric_columns].notna().sum(axis=1)
        measurements = measurements[numeric_counts >= 1]
        return measurements

    @staticmethod
    def extract_devices_deployment_logs() -> pd.DataFrame:
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(network=str(Tenant.AIRQO))
        devices_history = pd.DataFrame()
        for device in devices:
            try:
                maintenance_logs = airqo_api.get_maintenance_logs(
                    tenant="airqo",
                    device=device.get("name", None),
                    activity_type="deployment",
                )

                if not maintenance_logs or len(maintenance_logs) <= 1:
                    continue

                log_df = pd.DataFrame(maintenance_logs)
                log_df = log_df.dropna(subset=["date"])

                log_df["site_id"] = (
                    log_df["site_id"].fillna(method="bfill").fillna(method="ffill")
                )
                log_df = log_df.dropna(subset=["site_id"])

                log_df["start_date_time"] = pd.to_datetime(log_df["date"])
                log_df = log_df.sort_values(by="start_date_time")
                log_df["end_date_time"] = log_df["start_date_time"].shift(-1)
                log_df["end_date_time"] = log_df["end_date_time"].fillna(
                    datetime.now(timezone.utc)
                )

                log_df["start_date_time"] = log_df["start_date_time"].apply(
                    lambda x: date_to_str(x)
                )
                log_df["end_date_time"] = log_df["end_date_time"].apply(
                    lambda x: date_to_str(x)
                )

                if len(set(log_df["site_id"].tolist())) == 1:
                    continue

                log_df["device_number"] = device.get("device_number", None)

                devices_history = devices_history.append(
                    log_df[
                        [
                            "start_date_time",
                            "end_date_time",
                            "site_id",
                            "device_number",
                        ]
                    ],
                    ignore_index=True,
                )

            except Exception as ex:
                logger.exception(f"An error occurred {ex}")

        return devices_history.dropna()

    @staticmethod
    def map_site_ids_to_historical_data(
        data: pd.DataFrame, deployment_logs: pd.DataFrame
    ) -> pd.DataFrame:
        if deployment_logs.empty or data.empty:
            return data

        data = data.copy()
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        deployment_logs["start_date_time"] = pd.to_datetime(
            deployment_logs["start_date_time"]
        )
        deployment_logs["end_date_time"] = pd.to_datetime(
            deployment_logs["end_date_time"]
        )

        for _, device_log in deployment_logs.iterrows():
            device_data = data.loc[
                (data["timestamp"] >= device_log["start_date_time"])
                & (data["timestamp"] <= device_log["end_date_time"])
                & (data["device_number"] == device_log["device_number"])
            ]
            if device_data.empty:
                continue

            temp_device_data = device_data.copy()
            for col in temp_device_data.columns.to_list():
                temp_device_data.rename(columns={col: f"{col}_temp"}, inplace=True)

            non_device_data = pd.merge(
                left=data,
                right=temp_device_data,
                left_on=["device_number", "timestamp"],
                right_on=["device_number_temp", "timestamp_temp"],
                how="outer",
                indicator=True,
            )
            non_device_data = non_device_data.loc[
                non_device_data["_merge"] == "left_only"
            ].drop("_merge", axis=1)

            non_device_data = non_device_data[device_data.columns.to_list()]

            device_data["site_id"] = device_log["site_id"]
            data = non_device_data.append(device_data, ignore_index=True)

        return data

    @staticmethod
    def calibrate_data(data: pd.DataFrame) -> pd.DataFrame:
        bucket = configuration.FORECAST_MODELS_BUCKET
        project_id = configuration.GOOGLE_CLOUD_PROJECT_ID

        data["timestamp"] = pd.to_datetime(data["timestamp"])
        sites = AirQoApi().get_sites()
        sites_df = pd.DataFrame(sites, columns=["_id", "city"]).rename(
            columns={"_id": "site_id"}
        )
        data = pd.merge(data, sites_df, on="site_id", how="left")
        data.dropna(subset=["device_id", "timestamp"], inplace=True)

        columns_to_fill = [
            "s1_pm2_5",
            "s1_pm10",
            "s2_pm2_5",
            "s2_pm10",
            "temperature",
            "humidity",
        ]

        data[columns_to_fill] = data[columns_to_fill].fillna(0)
        # TODO: Need to opt for a different approach eg forward fill, can't do here as df only has data of last 1 hour. Perhaps use raw data only?
        # May have to rewrite entire pipeline flow

        # additional input columns for calibration
        data["avg_pm2_5"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1).round(2)
        data["avg_pm10"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1).round(2)
        data["error_pm2_5"] = np.abs(data["s1_pm2_5"] - data["s2_pm2_5"])
        data["error_pm10"] = np.abs(data["s1_pm10"] - data["s2_pm10"])
        data["pm2_5_pm10"] = data["avg_pm2_5"] - data["avg_pm10"]
        data["pm2_5_pm10_mod"] = data["avg_pm2_5"] / data["avg_pm10"]
        data["hour"] = data["timestamp"].dt.__getattribute__("hour")

        input_variables = [
            "avg_pm2_5",
            "avg_pm10",
            "temperature",
            "humidity",
            "hour",
            "error_pm2_5",
            "error_pm10",
            "pm2_5_pm10",
            "pm2_5_pm10_mod",
        ]
        data[input_variables] = data[input_variables].replace([np.inf, -np.inf], 0)
        data.dropna(subset=input_variables, inplace=True)

        grouped_df = data.groupby("city", dropna=False)

        rf_model = GCSUtils.get_trained_model_from_gcs(
            project_name=project_id,
            bucket_name=bucket,
            source_blob_name=Utils.get_calibration_model_path(
                CityModel.DEFAULT, "pm2_5"
            ),
        )
        lasso_model = GCSUtils.get_trained_model_from_gcs(
            project_name=project_id,
            bucket_name=bucket,
            source_blob_name=Utils.get_calibration_model_path(
                CityModel.DEFAULT, "pm10"
            ),
        )
        for city, group in grouped_df:
            if str(city).lower() in [c.value.lower() for c in CityModel]:
                try:
                    rf_model = GCSUtils.get_trained_model_from_gcs(
                        project_name=project_id,
                        bucket_name=bucket,
                        source_blob_name=Utils.get_calibration_model_path(
                            city, "pm2_5"
                        ),
                    )
                    lasso_model = GCSUtils.get_trained_model_from_gcs(
                        project_name=project_id,
                        bucket_name=bucket,
                        source_blob_name=Utils.get_calibration_model_path(city, "pm10"),
                    )
                except Exception as ex:
                    logger.exception(f"Error getting model: {ex}")
            group["pm2_5_calibrated_value"] = rf_model.predict(group[input_variables])
            group["pm10_calibrated_value"] = lasso_model.predict(group[input_variables])

            data.loc[group.index, "pm2_5_calibrated_value"] = group[
                "pm2_5_calibrated_value"
            ]
            data.loc[group.index, "pm10_calibrated_value"] = group[
                "pm10_calibrated_value"
            ]

        data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)
        if "pm2_5_calibrated_value" in data.columns:
            data["pm2_5"] = data["pm2_5_calibrated_value"]
        else:
            data["pm2_5_calibrated_value"] = None
            data["pm2_5"] = None
        if "pm10_calibrated_value" in data.columns:
            data["pm10"] = data["pm10_calibrated_value"]
        else:
            data["pm10_calibrated_value"] = None
            data["pm10"] = None
        data["pm2_5"] = data["pm2_5"].fillna(data["pm2_5_raw_value"])
        data["pm10"] = data["pm10"].fillna(data["pm10_raw_value"])

        return data.drop(
            columns=[
                "avg_pm2_5",
                "avg_pm10",
                "error_pm2_5",
                "error_pm10",
                "pm2_5_pm10",
                "pm2_5_pm10_mod",
                "hour",
                "city",
            ]
        )

    @staticmethod
    def get_devices(group_id: str) -> pd.DataFrame:
        """
        Fetches and returns a DataFrame of devices from the 'devices-topic' Kafka topic.

        Args:
            group_id (str): The consumer group ID used to track message consumption from the topic.

        Returns:
            pd.DataFrame: A DataFrame containing the list of devices, where each device is represented as a row.
                      If any errors occur during the process, an empty DataFrame is returned.
        """
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from confluent_kafka import KafkaException
        import json

        broker = MessageBrokerUtils()
        devices_list: list = []

        for message in broker.consume_from_topic(
            topic="devices-topic",
            group_id=group_id,
            auto_offset_reset="earliest",
            auto_commit=False,
        ):
            try:
                key = message.get("key", None)
                try:
                    value = json.loads(message.get("value", None))
                except json.JSONDecodeError as e:
                    logger.exception(f"Error decoding JSON: {e}")
                    continue

                if not key or not value.get("device_id"):
                    logger.warning(
                        f"Skipping message with key: {key}, missing 'device_id'."
                    )
                    continue

                devices_list.append(value)
            except KafkaException as e:
                logger.exception(f"Error while consuming message: {e}")
            continue

        try:
            devices = pd.DataFrame(devices_list)
            # Will be removed in the future. Just here for initial tests.
            devices.drop(
                devices.columns[devices.columns.str.contains("^Unnamed")],
                axis=1,
                inplace=True,
            )
        except Exception as e:
            logger.exception(f"Failed to convert consumed messages to DataFrame: {e}")
            # Return empty DataFrame on failure
            devices = pd.DataFrame()

        if "device_name" in devices.columns.tolist():
            devices.drop_duplicates(subset=["device_name"], keep="last")
        elif "device_id" in devices.columns.tolist():
            devices.drop_duplicates(subset=["device_id"], keep="last")

        return devices
