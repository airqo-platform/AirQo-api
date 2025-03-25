import numpy as np
import pandas as pd
import json
from pathlib import Path
from confluent_kafka import KafkaException
from typing import List, Dict, Any, Union, Tuple, Optional
import ast

from .config import configuration as Config
from .commons import download_file_from_gcs, drop_rows_with_bad_data
from .bigquery_api import BigQueryApi
from airqo_etl_utils.data_api import DataApi
from .data_sources import DataSourcesApis
from .airqo_gx_expectations import AirQoGxExpectations
from .constants import (
    DeviceCategory,
    DeviceNetwork,
    Frequency,
    DataSource,
    DataType,
    MetaDataType,
)
from .message_broker_utils import MessageBrokerUtils

from .utils import Utils
from .date import date_to_str, str_to_date
from .data_validator import DataValidationUtils

import logging

logger = logging.getLogger("airflow.task")


class DataUtils:
    @staticmethod
    def get_devices(
        device_category: Optional[DeviceCategory] = None,
        device_network: Optional[DeviceNetwork] = None,
    ) -> Tuple[pd.DataFrame, Dict]:
        """
        Retrieve devices data and associated keys for a given device network and category.

        This function attempts to load devices data from a cached CSV file located at a predetermined
        local path. If cached data is available, missing values in the "device_number" column are filled
        with -1. If the cache is empty, the function fetches devices data and corresponding keys via the
        API. If both the cache and the API fail to return any devices data, a RuntimeError is raised.

        Args:
            device_network (DeviceNetwork): The device network for which devices data is required.
            device_category (DeviceCategory): The category of devices to filter the retrieved data.

        Returns:
            Tuple[pd.DataFrame, Dict]: A tuple where:
                - The first element is a pandas DataFrame containing the devices data.
                - The second element is a dictionary mapping device numbers to their corresponding keys.

        Raises:
            RuntimeError: If devices data cannot be obtained from either the cache or the API.
        """
        local_file_path = "/tmp/devices.csv"
        devices: pd.DataFrame = pd.DataFrame()
        keys: Dict = {}
        # Load devices from cache
        try:
            devices = DataUtils.load_cached_data(
                local_file_path, MetaDataType.DEVICES.str
            )
            if not devices.empty:
                devices["device_number"] = (
                    devices["device_number"].fillna(-1).astype(int)
                )

                if device_category:
                    devices = devices.loc[
                        devices.device_category == device_category.str
                    ]

                if device_network:
                    devices = devices.loc[devices.network == device_network.str]

                keys = dict(
                    zip(
                        devices.loc[
                            devices.network == "airqo", "device_number"
                        ].to_numpy(),
                        devices.loc[devices.network == "airqo", "key"].to_numpy(),
                    )
                )

        except Exception as e:
            logger.exception(f"No devices currently cached: {e}")

        # If cache is empty, fetch from API
        if devices.empty:
            devices, keys = DataUtils.fetch_devices_from_api(
                device_network, device_category
            )
            if not keys:
                raise RuntimeError("Failed to retrieve device keys")

        if devices.empty:
            raise RuntimeError("Failed to retrieve cached/api devices data.")
        return devices, keys

    @staticmethod
    def get_sites(network: Optional[DeviceNetwork] = None) -> pd.DataFrame:
        """
        Retrieve sites data.

        This function attempts to load sites data from a cached CSV file located at a predetermined
        local path. If the cache is empty, the function tries to fetche sites data via the API.
        If both the cache and the API fail to return any sites data, a RuntimeError is raised.

        Returns:
            sites(pd.DataFrame):A pandas DataFrame containing the sites data.

        Raises:
            RuntimeError: If sites data cannot be obtained from either the cache or the API.
        """
        local_file_path = "/tmp/sites.csv"
        sites: pd.DataFrame = pd.DataFrame()

        # Load sites from cache
        try:
            sites = DataUtils.load_cached_data(local_file_path, MetaDataType.SITES.str)
        except Exception as e:
            logger.exception(f"Failed to load cached: {e}")

        # If cache is empty, fetch from API
        if sites.empty:
            data_api = DataApi()
            try:
                sites = pd.DataFrame(data_api.get_sites())
            except Exception as e:
                logger.exception(f"Failed to load sites data from api. {e}")

        if sites.empty:
            raise RuntimeError("Failed to retrieve cached/api sites data.")

        if network:
            sites = sites.loc[sites.network == network.str]
        return sites

    @staticmethod
    def extract_devices_data(
        start_date_time: str,
        end_date_time: str,
        device_category: DeviceCategory,
        device_network: Optional[DeviceNetwork] = None,
        resolution: Frequency = Frequency.RAW,
        device_names: Optional[list] = None,
    ) -> pd.DataFrame:
        """
        Extracts sensor measurements from network devices recorded between specified date and time ranges.

        Retrieves sensor data from Thingspeak API for devices belonging to the specified device category (BAM or low-cost sensors).
        Optionally filters data by specific device numbers and removes outliers if requested.

        Args:
            start_date_time (str): Start date and time (ISO 8601 format) for data extraction.
            end_date_time (str): End date and time (ISO 8601 format) for data extraction.
            device_category (DeviceCategory): Category of devices to extract data from (BAM or low-cost sensors).
            device_names(list, optional): List of device ids/names whose data to extract. Defaults to None (all devices).
        """
        devices_data = pd.DataFrame()

        devices, keys = DataUtils.get_devices(device_category, device_network)

        if not devices.empty and device_network:
            devices = devices.loc[devices.network == device_network.str]

        if device_names:
            devices = devices.loc[devices.name.isin(device_names)]

        config = Config.device_config_mapping.get(device_category.str, None)
        if not config:
            logger.warning("Missing device category configuration.")
            raise RuntimeError("Device category configurations not found.")

        dates = Utils.query_dates_array(
            data_source=DataSource.THINGSPEAK,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )
        data_store: List[pd.DataFrame] = []
        for _, device in devices.iterrows():
            data, meta_data = DataUtils._extract_device_api_data(
                device, dates, config, keys, resolution
            )
            if isinstance(data, pd.DataFrame) and not data.empty:
                data = DataUtils._process_and_append_device_data(
                    device, data, meta_data, config
                )
            else:
                continue

            if not data.empty:
                data_store.append(data)

        if data_store:
            devices_data = pd.concat(data_store, ignore_index=True)
        else:
            devices_data = pd.DataFrame()

        if "vapor_pressure" in devices_data.columns.to_list():
            is_airqo_network = devices_data["network"] == "airqo"
            devices_data.loc[is_airqo_network, "vapor_pressure"] = devices_data.loc[
                is_airqo_network, "vapor_pressure"
            ].apply(DataValidationUtils.convert_pressure_values)
        return devices_data

    @staticmethod
    def load_cached_data(local_file_path: str, file_name: str) -> pd.DataFrame:
        """Download and load the cached CSV from GCS if available."""
        try:
            file = Path(local_file_path)
            if not file.exists() or file.stat().st_size == 0:
                download_file_from_gcs(
                    bucket_name=Config.AIRFLOW_XCOM_BUCKET,
                    source_file=f"{file_name}.csv",
                    destination_file=local_file_path,
                )
            data = pd.read_csv(local_file_path)
            if not data.empty:
                return data
        except Exception as e:
            logger.exception(f"Failed to download cached {file_name}. {e}")
            return pd.DataFrame()

    @staticmethod
    def fetch_devices_from_api(
        device_network: Optional[DeviceNetwork] = None,
        device_category: Optional[DeviceCategory] = None,
    ) -> pd.DataFrame:
        """Fetch devices from the API if the cached file is empty."""
        data_api = DataApi()
        try:
            devices = pd.DataFrame(
                data_api.get_devices_by_network(
                    device_network=device_network,
                    device_category=device_category,
                )
            )
            devices["device_number"] = devices["device_number"].fillna(-1)
            devices_airqo = devices.loc[devices.network == "airqo"]
            keys = data_api.get_thingspeak_read_keys(devices_airqo)
            return devices, keys
        except Exception as e:
            logger.exception(
                f"Failed to fetch devices or read keys from device_registry. {e}"
            )
        return pd.DataFrame(), {}

    def _extract_device_api_data(
        device: pd.Series,
        dates: List[Tuple[str, str]],
        config: dict,
        keys: dict,
        resolution: Frequency,
    ) -> pd.DataFrame:
        """Extract and map API data for a single device."""
        device_number = device.get("device_number")
        key = device.get("key")
        network = device.get("network")
        api_data = []
        data_source_api = DataSourcesApis()

        if (
            device_number
            and not np.isnan(device_number)
            and network == DeviceNetwork.AIRQO.str
        ):
            for start, end in dates:
                data_, meta_data, data_available = data_source_api.thingspeak(
                    device_number=int(device_number),
                    start_date_time=start,
                    end_date_time=end,
                    read_key=key if key else keys.get(device_number),
                )
                if data_available:
                    api_data.extend(data_)
            if api_data:
                mapping = config["mapping"][network]
                return DataUtils.map_and_extract_data(mapping, api_data), meta_data
        elif network == DeviceNetwork.IQAIR.str:
            mapping = config["mapping"][network]
            try:
                iqair_data = data_source_api.iqair(device, resolution=resolution)
                if iqair_data:
                    data = DataUtils.map_and_extract_data(mapping, iqair_data)
                    return data, {}
            except Exception as e:
                logger.exception(
                    f"An error occurred: {e} - device {device.get('name')}"
                )
                return pd.DataFrame(), {}
        return pd.DataFrame(), {}

    def _process_and_append_device_data(
        device: pd.Series, data: pd.DataFrame, meta_data: dict, config: dict
    ) -> pd.DataFrame:
        """Process API data, fill missing columns, and append device details."""
        if data.empty:
            logger.warning(f"No data received from {device.get('name')}")
            return

        data_columns = list(
            set(
                [
                    "device_number",
                    "device_id",
                    "site_id",
                    "latitude",
                    "longitude",
                    "timestamp",
                    *config["field_8_cols"],
                    *config["other_fields_cols"],
                ]
            )
        )

        data = DataValidationUtils.fill_missing_columns(data=data, cols=data_columns)
        data["device_category"] = device.get("device_category")
        data["device_number"] = device.get("device_number")
        data["device_id"] = device.get("name")
        data["site_id"] = device.get("site_id")
        data["network"] = device.get("network")
        data["latitude"] = device.get("latitude") or meta_data.get("latitude")
        data["longitude"] = device.get("longitude") or meta_data.get("longitude")

        return data

    @staticmethod
    def extract_data_from_bigquery(
        datatype: DataType,
        start_date_time: str,
        end_date_time: str,
        frequency: Frequency,
        device_category: DeviceCategory,
        device_network: Optional[DeviceNetwork] = None,
        dynamic_query: Optional[bool] = False,
        remove_outliers: Optional[bool] = True,
        data_filter: Optional[Dict[str, Any]] = None,
        use_cache: Optional[bool] = False,
    ) -> pd.DataFrame:
        """
        Extracts data from BigQuery within a specified time range and frequency,
        with an optional filter for the device network. The data is cleaned to remove outliers.

        Args:
            datatype(DataType): The type of data to extract determined by the source data asset.
            start_date_time(str): The start of the time range for data extraction, in ISO 8601 format.
            end_date_time(str): The end of the time range for data extraction, in ISO 8601 format.
            frequency(Frequency): The frequency of the data to be extracted, e.g., RAW or HOURLY.
            device_network(DeviceNetwork, optional): The network to filter devices, default is None (no filter).
            dynamic_query(bool, optional): Determines the type of data returned. If True, returns averaged data grouped by `device_number`, `device_id`, and `site_id`. If False, returns raw data without aggregation. Defaults to False.
            remove_outliers(bool, optional): If True, removes outliers from the extracted data. Defaults to True.

        Returns:
            pd.DataFrame: A pandas DataFrame containing the cleaned data from BigQuery.

        Raises:
            ValueError: If the frequency is unsupported or no table is associated with it.
        """
        bigquery_api = BigQueryApi()
        table: str = None

        if not device_category:
            device_category = DeviceCategory.GENERAL
        try:
            source = Config.DataSource.get(datatype)
            table = source.get(device_category).get(frequency)
        except KeyError as e:
            logger.exception(
                f"Invalid combination: {datatype.str}, {device_category.str}, {frequency.str}"
            )
        except Exception as e:
            logger.exception(
                f"An unexpected error occurred during column retrieval: {e}"
            )

        if not table:
            raise ValueError("No table information provided.")

        raw_data = bigquery_api.query_data(
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=device_network,
            dynamic_query=dynamic_query,
            where_fields=data_filter,
            use_cache=use_cache,
        )

        if remove_outliers:
            raw_data = DataValidationUtils.remove_outliers(raw_data)

        return raw_data

    @staticmethod
    def remove_duplicates(
        data: pd.DataFrame,
        timestamp_col: str,
        id_col: str,
        group_col: str,
        exclude_cols: Optional[list] = None,
    ) -> pd.DataFrame:
        """
        Removes duplicate rows from a pandas DataFrame based on unique identifiers while
        ensuring missing values are filled and non-duplicated data is retained.

        Steps:
        1. Drops rows where all non-essential columns (excluding specified columns) are NaN.
        2. Identifies duplicate rows based on the provided ID and timestamp columns.
        3. Fills missing values for duplicates within each group using forward and backward filling.
        4. Retains only the first occurrence of duplicates.

        Args:
            data(pd.DataFrame): The input DataFrame.
            timestamp_col(str): The name of the column containing timestamps.
            id_col(str): The name of the column used for identifying duplicates (e.g., 'device_id' or 'station_code').
            group_col(str): The name of the column to group by for filling missing values (e.g., 'site_id' or 'station_code').
            exclude_cols(list, optional): A list of columns to exclude from forward and backward filling.

        Returns:
            pd.DataFrame: A cleaned DataFrame with duplicates handled and missing values filled.
        """
        data[timestamp_col] = pd.to_datetime(data[timestamp_col])

        exclude_cols = exclude_cols or []
        essential_cols = (
            [timestamp_col, id_col]
            if id_col == group_col
            else [timestamp_col, id_col, group_col]
        )
        non_essential_cols = [
            col for col in data.columns if col not in essential_cols + exclude_cols
        ]

        data.dropna(subset=non_essential_cols, how="all", inplace=True)

        # If grouping column is specified, drop rows where it is NaN
        if group_col in data.columns:
            data.dropna(subset=[group_col], inplace=True)

        data["duplicated"] = data.duplicated(keep=False, subset=[id_col, timestamp_col])

        # If no duplicates exist, clean up and return the data
        if not data["duplicated"].any():
            data.drop(columns=["duplicated"], inplace=True)
            return data

        duplicates = data[data["duplicated"]].copy()
        non_duplicates = data[~data["duplicated"]].copy()

        columns_to_fill = [
            col
            for col in duplicates.columns
            if col not in essential_cols + exclude_cols
        ]

        filled_duplicates = []
        for _, group in duplicates.groupby(group_col):
            group = group.sort_values(by=[timestamp_col, id_col])
            group[columns_to_fill] = (
                group[columns_to_fill].fillna(method="ffill").fillna(method="bfill")
            )
            group = group.drop_duplicates(subset=[id_col, timestamp_col], keep="first")
            filled_duplicates.append(group)

        duplicates = pd.concat(filled_duplicates, ignore_index=True)
        cleaned_data = pd.concat([non_duplicates, duplicates], ignore_index=True)

        cleaned_data.drop(columns=["duplicated"], inplace=True)

        return cleaned_data

    @staticmethod
    def transform_weather_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms raw weather data into a structured DataFrame with standardized parameters.

        This function processes the input DataFrame containing weather observations, converting values to numeric types and timestamps to datetime objects. It maps weather variables
        to standardized parameter names and constructs a new DataFrame with aggregated data by station and timestamp.

        Args:
            data(pd.DataFrame): The input DataFrame containing raw weather data with columns such as 'station', 'time', 'variable', and 'value'.

        Returns:
            pd.DataFrame: A DataFrame containing transformed weather data with standardized parameters, missing columns populated, and outliers removed.
        """
        if data.empty:
            return data

        data["value"] = pd.to_numeric(data["value"], errors="coerce", downcast="float")
        data["time"] = pd.to_datetime(data["time"], errors="coerce")
        # TODO Clean this up.
        parameter_mappings = {
            "te": "temperature",
            "rh": "humidity",
            "ws": "wind_speed",
            "ap": "atmospheric_pressure",
            "ra": "radiation",
            "vp": "vapor_pressure",
            "wg": "wind_gusts",
            "pr": "precipitation",
            "wd": "wind_direction",
        }
        weather_data = []
        station_groups = data.groupby("station")
        for _, station_group in station_groups:
            station = station_group.iloc[0]["station"]
            time_groups = station_group.groupby("time")

            for _, time_group in time_groups:
                timestamp = time_group.iloc[0]["time"]
                timestamp_data = {"timestamp": timestamp, "station_code": station}

                for _, row in time_group.iterrows():
                    if row["variable"] in parameter_mappings.keys():
                        parameter = parameter_mappings[row["variable"]]
                        value = row["value"]
                        if parameter == "humidity":
                            value = value * 100

                        timestamp_data[parameter] = value

                weather_data.append(timestamp_data)

        weather_data = pd.DataFrame(weather_data)

        cols = [value for value in parameter_mappings.values()]

        weather_data = DataValidationUtils.fill_missing_columns(
            data=weather_data, cols=cols
        )

        return DataValidationUtils.remove_outliers(weather_data)

    @staticmethod
    def aggregate_weather_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregates weather data by station code, calculating hourly averages and sums.

        Steps:
        1. This function processes the input DataFrame by grouping the data by station code.
        2. It then calculates the hourly average for numeric columns (excluding precipitation) and the hourly sum for precipitation, combining these results into a single aggregated DataFrame.

        Args:
            data(pd.DataFrame): The input DataFrame containing weather data with columns such as 'timestamp', 'station_code', and 'precipitation'.

        Returns:
            pd.DataFrame: A DataFrame containing aggregated weather data with hourly averages for numeric columns and hourly sums for precipitation, indexed by station code.
        """
        if data.empty:
            return data

        data = data.dropna(subset=["timestamp"])
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        aggregated_data = pd.DataFrame()

        station_groups = data.groupby("station_code")

        for _, station_group in station_groups:
            station_group.index = station_group["timestamp"]
            station_group = station_group.sort_index(axis=0)

            averaging_data = station_group.copy()
            averaging_data.drop(columns=["precipitation"], inplace=True)
            numeric_cols = averaging_data.select_dtypes(include=[np.number]).columns
            averages = averaging_data.resample("H")[numeric_cols].mean()
            averages.reset_index(drop=True, inplace=True)

            summing_data = station_group.copy()[["precipitation"]]
            sums = pd.DataFrame(summing_data.resample("H").sum())
            sums["timestamp"] = sums.index
            sums.reset_index(drop=True, inplace=True)

            merged_data = pd.concat([averages, sums], axis=1)
            merged_data["station_code"] = station_group.iloc[0]["station_code"]

            aggregated_data = pd.concat(
                [aggregated_data, merged_data], ignore_index=True, axis=0
            )

        return aggregated_data

    @staticmethod
    def process_data_for_api(data: pd.DataFrame, frequency: Frequency) -> list:
        """
        Formats device measurements into a format required by the events endpoint.

        Args:
            data(pd.DataFrame): device measurements
            frequency(Frequency): frequency of the measurements.

        Return:
            A list of measurements
        """
        restructured_data = []

        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        devices, _ = DataUtils.get_devices()
        devices.rename(columns={"name": "device_id"}, inplace=True)
        devices = devices[["_id", "device_id", "network"]]
        devices = devices.set_index("device_id")

        for _, row in data.iterrows():
            try:
                device_number = row["device_number"]
                device_id = row["device_id"]
                device_details = None

                if device_id in devices.index:
                    device_details = devices.loc[device_id]
                else:
                    logger.exception(
                        f"Device number {device_id} not found in device list"
                    )
                    continue

                if row["site_id"] is None or pd.isna(row["site_id"]):
                    logger.exception(f"Invalid site id in data.")
                    continue

                row_data = {
                    "device": device_id,
                    "device_id": device_details["_id"],
                    "site_id": row["site_id"],
                    "device_number": device_number,
                    "network": device_details["network"],
                    "location": {
                        key: {"value": row[key]} for key in ["latitude", "longitude"]
                    },
                    "frequency": frequency.str,
                    "time": row["timestamp"],
                    **{
                        f"average_{key}": {
                            "value": row[key],
                            "calibratedValue": row[f"{key}_calibrated_value"],
                        }
                        for key in ["pm2_5", "pm10"]
                    },
                    **{
                        key: {
                            "value": row[key],
                            "calibratedValue": row[f"{key}_calibrated_value"],
                        }
                        for key in ["pm2_5", "pm10"]
                    },
                    **{
                        key: {"value": row.get(key, None)}
                        for key in [
                            "s1_pm2_5",
                            "s1_pm10",
                            "s2_pm2_5",
                            "s2_pm10",
                            "battery",
                            "altitude",
                            "wind_speed",
                            "satellites",
                            "hdop",
                            "temperature",
                            "humidity",
                        ]
                    },
                }
                restructured_data.append(row_data)
            except Exception as e:
                logger.exception(f"An error occurred: {e}")

        return restructured_data

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
                            extracted_value = DataUtils._extract_nested_value(
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

    # ----------------------------------------------------------------------------------
    # Lowcost
    # ----------------------------------------------------------------------------------
    @staticmethod
    def aggregate_low_cost_sensors_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Resamples and averages out the numeric type fields on an hourly basis.

        Args:
            data(pandas.DataFrame): A pandas DataFrame object containing cleaned/converted (numeric) data.

        Returns:
            A pandas DataFrame object containing hourly averages of data.
        """

        data["timestamp"] = pd.to_datetime(data["timestamp"], errors="coerce")
        group_metadata = (
            data[
                ["device_id", "site_id", "device_number", "network", "device_category"]
            ]
            .drop_duplicates("device_id")
            .set_index("device_id")
        )
        numeric_columns = data.select_dtypes(include=["number"]).columns
        numeric_columns = numeric_columns.difference(["device_number"])
        data_for_aggregation = data[["timestamp", "device_id"] + list(numeric_columns)]
        try:
            aggregated = (
                data_for_aggregation.groupby("device_id")
                .apply(lambda group: group.resample("1H", on="timestamp").mean())
                .reset_index()
            )
            aggregated = aggregated.merge(group_metadata, on="device_id", how="left")
        except Exception as e:
            logger.exception(f"An error occured: No data passed - {e}")
            aggregated = pd.DataFrame(columns=data.columns)

        return drop_rows_with_bad_data("number", aggregated, exclude=["device_number"])

    @staticmethod
    def clean_low_cost_sensor_data(
        data: pd.DataFrame,
        device_category: DeviceCategory,
        remove_outliers: Optional[bool] = True,
    ) -> pd.DataFrame:
        """
        Cleans low-cost sensor data by performing outlier removal, raw data quality checks,
        timestamp conversion, duplicate removal, and network-specific calculations.

        The cleaning process includes:
        1. Optional removal of outliers.
        2. Device-specific raw data quality checks.
        3. Conversion of the 'timestamp' column to pandas datetime format.
        4. Removal of duplicate rows based on 'timestamp' and 'device_id'.
        5. Computation of mean values for PM2.5 and PM10 raw data, specifically for the AirQo network.

        Args:
            data (pd.DataFrame): The input data to be cleaned.
            device_category (DeviceCategory): The category of the device, as defined in the DeviceCategory enum.
            remove_outliers (bool, optional): Determines whether outliers should be removed. Defaults to True.

        Returns:
            pd.DataFrame: The cleaned DataFrame.

        Raises:
            KeyError: If there are issues with the 'timestamp' column during processing.
        """
        if remove_outliers:
            data = DataValidationUtils.remove_outliers(data)

        # Perform data check here: TODO Find a more structured and robust way to implement raw data quality checks.
        match device_category:
            case DeviceCategory.GAS:
                AirQoGxExpectations.from_pandas().gaseous_low_cost_sensor_raw_data_check(
                    data
                )
            case DeviceCategory.LOWCOST:
                AirQoGxExpectations.from_pandas().pm2_5_low_cost_sensor_raw_data(data)
        try:
            dropna_subset = ["pm2_5", "pm10"]
            if DeviceNetwork.AIRQO.str in data.network.unique():
                dropna_subset.extend(["s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10"])

            data.dropna(
                subset=dropna_subset,
                how="all",
                inplace=True,
            )
            data.dropna(subset=["timestamp"], inplace=True)
            data["timestamp"] = pd.to_datetime(data["timestamp"])
        except Exception as e:
            logger.exception(
                f"There is an issue with the timestamp column. Shape of data: {data.shape}"
            )
            raise KeyError(
                f"An error has occurred with the 'timestamp' column: {e}"
            ) from e

        data.drop_duplicates(
            subset=["timestamp", "device_id"], keep="first", inplace=True
        )
        return data

    # ----------------------------------------------------------------------------------
    # BAM data
    # ----------------------------------------------------------------------------------
    @staticmethod
    def clean_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Cleans and transforms BAM data for BigQuery insertion.

        This function processes the input DataFrame by removing outliers, dropping duplicate entries based on timestamp and device number, and renaming columns according to a
        specified mapping. It also adds a network identifier and ensures that all required columns for the BigQuery BAM hourly measurements table are present.

        Args:
            data(pd.DataFrame): The input DataFrame containing BAM data with columns such as 'timestamp' and 'device_number'.

        Returns:
            pd.DataFrame: A cleaned DataFrame containing only the required columns, with outliers removed, duplicates dropped, and column names mapped according to the defined configuration.
        """
        # TODO Merge bam data cleanup functionality
        data = DataValidationUtils.remove_outliers(data)
        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )

        data["network"] = DeviceNetwork.AIRQO.str
        data.rename(columns=Config.AIRQO_BAM_MAPPING, inplace=True)

        big_query_api = BigQueryApi()
        required_cols = big_query_api.get_columns(
            table=big_query_api.bam_hourly_measurements_table
        )

        data = DataValidationUtils.fill_missing_columns(data=data, cols=required_cols)
        data = data[required_cols]

        return data

    @staticmethod
    def extract_bam_data_airnow(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        """
        Extracts BAM (Beta Attenuation Monitor) data from AirNow API for the given date range.

        This function fetches device information for the BAM network, queries data for each device over the specified date range,
        and compiles it into a pandas DataFrame.

        Args:
            start_date_time(str): Start of the date range in ISO 8601 format (e.g., "2024-11-01T00:00").
            end_date_time(str): End of the date range in ISO 8601 format (e.g., "2024-11-07T23:59").

        Returns:
            pd.DataFrame: A DataFrame containing BAM data for all devices within the specified date range,
                        including a `network` column indicating the device network.

        Raises:
            ValueError: If no devices are found for the BAM network or if no data is returned for the specified date range.
        """
        bam_data = pd.DataFrame()
        data_api = DataApi()

        dates: List[str] = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.AIRNOW,
        )

        if not dates:
            raise ValueError("Invalid or empty date range provided.")

        dates = [
            (
                str_to_date(sdate).strftime("%Y-%m-%dT%H:%M"),
                str_to_date(edate).strftime("%Y-%m-%dT%H:%M"),
            )
            for sdate, edate in dates
        ]
        device_data: List[pd.DataFrame] = []
        for start, end in dates:
            query_data = data_api.get_airnow_data(
                start_date_time=start, end_date_time=end
            )
            if query_data:
                device_data.extend(query_data)

        if device_data:
            bam_data = pd.DataFrame(device_data)
            bam_data["network"] = DeviceNetwork.METONE.str

        if bam_data.empty:
            logger.info("No BAM data found for the specified date range.")

        return bam_data

    @staticmethod
    def process_bam_data_airnow(data: pd.DataFrame) -> pd.DataFrame:
        """
        Processes raw BAM device data by matching it to corresponding device details and constructing
        a structured DataFrame of air quality measurements.

        Steps:
        1. Maps each device code to its corresponding device details using a device mapping.
        2. Iterates over the input DataFrame, validates the device details, and retrieves pollutant values.
        3. Constructs a list of air quality measurements with relevant device information and pollutant data.
        4. Removes outliers from the processed data.

        Args:
            data(pd.DataFrame): A DataFrame containing raw BAM device data, with columns such as 'FullAQSCode', 'Parameter', 'Value', 'Latitude', 'Longitude', and 'UTC'.

        Returns:
            pd.DataFrame: A cleaned and structured DataFrame containing processed air quality data. The resulting DataFrame includes columns such as 'timestamp', 'network', 'site_id', 'device_id', and pollutant values ('pm2_5', 'pm10', 'no2', etc.).
        """
        air_now_data = []

        devices, _ = DataUtils.get_devices(
            device_category=DeviceCategory.BAM, device_network=DeviceNetwork.METONE
        )
        device_mapping = {
            device_code: device
            for device in devices.to_dict(orient="records")
            for device_code in ast.literal_eval(device.get("device_codes", []))
        }
        for _, row in data.iterrows():
            pollutant_value = {"pm2_5": None, "pm10": None, "no2": None}
            try:
                # Temp external device id  # Lookup device details based on FullAQSCode
                device_id_ = str(row["FullAQSCode"])
                device_details = device_mapping.get(device_id_)

                if not device_details:
                    logger.exception(f"Device with ID {device_id_} not found")
                    continue

                parameter_col_name = (
                    Config.device_config_mapping.get(DeviceCategory.BAM.str, {})
                    .get("mapping", {})
                    .get(DeviceNetwork.METONE.str, {})
                    .get(row["Parameter"].lower(), None)
                )
                if parameter_col_name and parameter_col_name in pollutant_value:
                    pollutant_value[parameter_col_name] = row["Value"]

                if row["network"] != device_details.get("network"):
                    logger.exception(f"Network mismatch for device ID {device_id_}")
                    continue

                air_now_data.append(
                    {
                        "timestamp": row["UTC"],
                        "network": row["network"],
                        "site_id": device_details.get("site_id"),
                        "device_id": device_details.get("name"),
                        "mongo_id": device_details.get("_id"),
                        "device_number": device_details.get("device_number"),
                        "frequency": Frequency.HOURLY.str,
                        "latitude": row["Latitude"],
                        "longitude": row["Longitude"],
                        "device_category": DeviceCategory.BAM.str,
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
            except Exception as e:
                logger.exception(f"Error processing row: {e}")

        air_now_data = pd.DataFrame(air_now_data)
        air_now_data = DataValidationUtils.remove_outliers(air_now_data)

        return air_now_data

    # ----------------------------------------------------------------------------------
    # Storage
    # ----------------------------------------------------------------------------------
    def format_data_for_bigquery(
        data: pd.DataFrame,
        datatype: DataType,
        device_category: DeviceCategory,
        frequency: Frequency,
        device_network: Optional[DeviceNetwork] = None,
        extra_type: Optional[Any] = None,
    ) -> Tuple[pd.DataFrame, str]:
        """
        Formats a pandas DataFrame for BigQuery by ensuring all required columns are present
        and the timestamp column is correctly parsed to datetime.

        Args:
            data (pd.DataFrame): The input DataFrame to be formatted.
            data_type (DataType): The type of data (e.g., raw, averaged or processed).
            device_category (DeviceCategory): The category of the device (e.g., BAM, low-cost).
            frequency (Frequency): The data frequency (e.g., raw, hourly, daily).
            device_network(DeviceNetwork):
            extra_type(Any):

        Returns:
            pd.DataFrame: A DataFrame formatted for BigQuery with required columns populated.
            str: Name of the table.

        Raises:
            KeyError: If the combination of data_type, device_category, and frequency is invalid.
            Exception: For unexpected errors during column retrieval or data processing.
        """
        bigquery = BigQueryApi()
        data["timestamp"] = pd.to_datetime(data["timestamp"], errors="coerce")
        data.dropna(subset=["timestamp"], inplace=True)

        try:
            datasource = Config.DataSource
            if datatype == DataType.EXTRAS:
                table = datasource.get(datatype).get(device_network).get(extra_type)
            else:
                table = datasource.get(datatype).get(device_category).get(frequency)
            cols = bigquery.get_columns(table=table)
        except KeyError:
            logger.exception(
                f"Invalid combination: {datatype.str}, {device_category.str}, {frequency.str}"
            )
        except Exception as e:
            logger.exception(
                f"An unexpected error occurred during column retrieval: {e}"
            )
        data = DataValidationUtils.fill_missing_columns(data=data, cols=cols)
        dataframe = DataValidationUtils.remove_outliers(data)
        return dataframe[cols], table

    @staticmethod
    def transform_for_bigquery_weather(data: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms the input DataFrame to match the schema of the BigQuery hourly weather table.

        This function retrieves the required columns from the BigQuery hourly weather table and populates any missing columns in the input DataFrame.

        Args:
            data(pd.DataFrame): The input DataFrame containing weather data that needs to be transformed.

        Returns:
            pd.DataFrame: A transformed DataFrame that includes all required columns for the BigQuery hourly weather table, with missing columns populated.
        """
        bigquery = BigQueryApi()
        cols = bigquery.get_columns(table=bigquery.hourly_weather_table)
        return DataValidationUtils.fill_missing_columns(data=data, cols=cols)

    @staticmethod
    def get_devices_kafka(group_id: str) -> pd.DataFrame:
        """
        Fetches and returns a DataFrame of devices from the 'devices-topic' Kafka topic.

        Args:
            group_id (str): The consumer group ID used to track message consumption from the topic.

        Returns:
            pd.DataFrame: A DataFrame containing the list of devices, where each device is represented as a row.
                      If any errors occur during the process, an empty DataFrame is returned.
        """
        broker = MessageBrokerUtils()
        devices_list: List = []

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
        except Exception as e:
            logger.exception(f"Failed to convert consumed messages to DataFrame: {e}")
            # Return empty DataFrame on failure
            devices = pd.DataFrame()

        if "device_name" in devices.columns.tolist():
            devices.drop_duplicates(subset=["device_name"], keep="last")
        elif "device_id" in devices.columns.tolist():
            devices.drop_duplicates(subset=["device_id"], keep="last")

        return devices

    @staticmethod
    def process_data_for_message_broker(
        data: pd.DataFrame,
        frequency: Frequency = Frequency.HOURLY,
    ) -> pd.DataFrame:
        """
        Processes the input DataFrame for message broker consumption based on the specified network, frequency.

        Args:
            data (pd.DataFrame): The input data to be processed.
            frequency (Frequency): The data frequency (e.g., hourly), defaults to Frequency.HOURLY.

        Returns:
            pd.DataFrame: The processed DataFrame ready for message broker consumption.
        """

        data["frequency"] = frequency.str
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        devices, _ = DataUtils.get_devices()

        data.rename(columns={"device_id": "device_name"}, inplace=True)
        devices.rename(columns={"name": "device_name"}, inplace=True)
        try:
            devices = devices[
                [
                    "device_name",
                    "site_id",
                    "device_latitude",
                    "device_longitude",
                    "network",
                ]
            ]

            data = pd.merge(
                left=data,
                right=devices,
                on=["device_name", "site_id", "network"],
                how="left",
            )
        except KeyError as e:
            logger.exception(
                f"KeyError: The key(s) '{e.args}' are not available in the returned devices data."
            )
            return None
        except Exception as e:
            logger.exception(f"An error occured: {e}")
            return None
        return data

    # Clarity
    def _flatten_location_coordinates_clarity(coordinates: str) -> pd.Series:
        """
        Extracts latitude and longitude from a string representation of coordinates.

        Args:
            coordinates(str): A string containing a list or tuple with two numeric values representing latitude and longitude (e.g., "[37.7749, -122.4194]").

        Returns:
            pd.Series: A Pandas Series containing two values:
                    - latitude (float) at index 0
                    - longitude (float) at index 1
                    If parsing fails or the format is invalid, returns Series([None, None]).
        """
        try:
            coords = ast.literal_eval(coordinates)

            if isinstance(coords, (list, tuple)) and len(coords) == 2:
                return pd.Series(coords)
        except (ValueError, SyntaxError):
            logger.exception("Error occurred while cleaning up coordinates")

        return pd.Series([None, None])

    def _transform_clarity_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms Clarity API data by renaming columns, extracting location details,
        mapping devices, and ensuring required columns are present.

        Args:
            data(pd.DataFrame): The input data frame containing raw Clarity API data.

        Returns:
            pd.DataFrame: The transformed data frame with cleaned and formatted data.

        Processing Steps:
        1. Renames columns for consistency.
        2. Extracts latitude and longitude from the `location.coordinates` field.
        3. Adds site and device details from the `device_id` field.
        4. Retrieves required columns from BigQuery and fills missing ones.
        5. Removes outliers before returning the final dataset.
        """
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
            DataUtils._flatten_location_coordinates_clarity
        )

        devices, _ = DataUtils.get_devices()
        data[["site_id", "device_number"]] = data["device_id"].apply(
            lambda device_id: DataUtils._add_site_and_device_details(
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

    def _add_site_and_device_details(devices: pd.DataFrame, device_id) -> pd.Series:
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
