import numpy as np
import pandas as pd
import json
from pathlib import Path
import os
from datetime import datetime, timedelta, timezone
from confluent_kafka import KafkaException
from typing import List, Dict, Any, Union, Tuple, Optional
import ast
from concurrent.futures import ThreadPoolExecutor, as_completed

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
    ColumnDataType,
)
from .message_broker_utils import MessageBrokerUtils

from .utils import Utils
from .date import date_to_str, str_to_date
from .data_validator import DataValidationUtils

import logging

logger = logging.getLogger("airflow.task")

max_workers = Config.MAX_WORKERS


class DataUtils:
    @staticmethod
    def get_devices(
        device_category: Optional[DeviceCategory] = None,
        device_network: Optional[DeviceNetwork] = None,
        preferred_source: Optional[str] = "cache",
    ) -> pd.DataFrame:
        """
        Retrieve devices data and associated keys for a given device network and category.

        This function attempts to load devices data from a cached CSV file located at a predetermined
        local path. If cached data is available, missing values in the "device_number" column are filled
        with -1. If the cache is empty, the function fetches devices data and corresponding keys via the
        API. If both the cache and the API fail to return any devices data, a RuntimeError is raised.

        Args:
            device_network (DeviceNetwork): The device network for which devices data is required.
            device_category (DeviceCategory): The category of devices to filter the retrieved data.
            preferred_source (str, optional): Preferred source for fetching devices data. Defaults to "cache". Other option is "api".

        Returns:
            Tuple[pd.DataFrame, Dict]: A tuple where:
                - The first element is a pandas DataFrame containing the devices data.
                - The second element is a dictionary mapping device numbers to their corresponding keys.

        Raises:
            RuntimeError: If devices data cannot be obtained from either the cache or the API.
        """
        # TODO: Add bigquery as a source of devices as a 3rd option and also centralize any device cleaning logic
        # There might be some repeated devices data cleaning/column renaming/normalization logic in other places
        local_file_path = "/tmp/devices.csv"
        devices: pd.DataFrame = pd.DataFrame()

        if preferred_source == "cache":
            devices = DataUtils._load_devices_from_cache(local_file_path)

        if preferred_source == "cache" and not devices.empty:
            devices = DataUtils._process_cached_devices(
                devices, device_category, device_network
            )
        else:
            devices = DataUtils.fetch_devices_from_api()

        if devices.empty:
            raise RuntimeError(
                "Failed to retrieve devices data from both cache and API."
            )

        if Config.ENVIRONMENT == "production":
            devices = devices[devices.deployed == True]

        if device_category:
            devices = devices.loc[devices.device_category == device_category.str]

        if device_network:
            devices = devices.loc[devices.network == device_network.str]

        return devices

    def _load_devices_from_cache(file_path: str) -> pd.DataFrame:
        """Loads devices data from the local cache."""
        devices: pd.DataFrame = pd.DataFrame()
        try:
            devices = DataUtils.load_cached_data(file_path, MetaDataType.DEVICES.str)
        except FileNotFoundError:
            logger.info(f"Cache file not found at: {file_path}")
        except pd.errors.EmptyDataError:
            logger.info(f"Cache file at {file_path} is empty.")
        except Exception as e:
            logger.exception(f"Error loading devices from cache: {e}")
        return devices

    def _process_cached_devices(
        devices: pd.DataFrame,
        device_category: Optional[DeviceCategory],
        device_network: Optional[DeviceNetwork],
    ) -> pd.DataFrame:
        """Processes the DataFrame loaded from the cache."""

        devices["device_number"] = devices["device_number"].fillna(-1).astype(int)

        if device_category:
            devices = devices.loc[devices.device_category == device_category.str]

        if device_network:
            devices = devices.loc[devices.network == device_network.str]

        return devices

    def _extract_keys(devices: pd.DataFrame, network: DeviceNetwork) -> Dict:
        """Extracts and match device numbers and keys from file."""
        keys = dict(
            zip(
                devices.loc[devices.network == network.str, "device_number"].to_numpy(),
                devices.loc[devices.network == network.str, "key"].to_numpy(),
            )
        )
        return keys

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
            sites = DataUtils.fetch_sites_from_api()

        if network:
            sites = sites.loc[sites.network == network.str]

        if sites.empty:
            raise RuntimeError("Failed to retrieve cached/api sites data.")

        return sites

    @staticmethod
    def fetch_sites_from_api():
        """
        Fetch all site metadata from the external API.

        This function:
            - Calls the `DataApi.get_sites()` endpoint to retrieve site information.
            - Converts the API response into a pandas DataFrame.
            - Logs an exception and returns an empty DataFrame if the API call fails.

        Returns:
            pd.DataFrame
                A DataFrame containing site metadata fetched from the API.
                Returns an empty DataFrame if the API request fails or no data is available.

        Raises:
            Logs exceptions internally and does not propagate errors.
        """
        data_api = DataApi()
        try:
            sites_data = data_api.get_sites()
            return pd.DataFrame(sites_data)
        except Exception as e:
            logger.exception(f"Failed to load sites data from api. {e}")
        return pd.DataFrame()

    @staticmethod
    def extract_devices_data(
        start_date_time: str,
        end_date_time: str,
        device_category: DeviceCategory,
        device_network: Optional[DeviceNetwork] = None,
        resolution: Frequency = Frequency.RAW,
        device_ids: Optional[List[str]] = None,
    ) -> pd.DataFrame:
        """
        Extracts sensor measurements from network devices recorded between specified date and time ranges.

        Retrieves sensor data from Thingspeak API for devices belonging to the specified device category (BAM or low-cost sensors).
        Optionally filters data by specific device numbers and removes outliers if requested.

        Args:
            start_date_time (str): Start date and time (ISO 8601 format) for data extraction.
            end_date_time (str): End date and time (ISO 8601 format) for data extraction.
            device_category (DeviceCategory): Category of devices to extract data from (BAM or low-cost sensors).
            device_ids(list, optional): List of device ids/names whose data to extract. Defaults to None (all devices).
        """
        # Temporary fix for mobile devices - TODO: Fix after requirements review
        is_mobile_category = device_category == DeviceCategory.MOBILE

        devices_data = pd.DataFrame()
        if is_mobile_category:
            device_category = DeviceCategory.LOWCOST

        devices = DataUtils.get_devices(device_category, device_network)

        # Temporary fix for mobile devices - # TODO: Fix after requirements review
        if is_mobile_category:
            # Device registry metadata has multiple devices tagged as mobile and yet aren't
            devices = devices[
                (devices["mobility"] == True) & (devices["mount_type"] == "vehicle")
            ]

        if not devices.empty and device_network:
            devices = devices.loc[devices.network == device_network.str]

        if device_ids:
            devices = devices.loc[devices.device_id.isin(device_ids)]

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

        with ThreadPoolExecutor(
            max_workers=max_workers
        ) as executor:  # Adjust worker count to your CPU
            futures = [
                executor.submit(
                    DataUtils.__per_device_data, device, dates, config, resolution
                )
                for _, device in devices.iterrows()
            ]

            for future in as_completed(futures):
                result = future.result()
                if result is not None:
                    data_store.append(result)
        if data_store:
            devices_data = pd.concat(data_store, ignore_index=True)
            # Data could be dropped due to bad datetime entries
            # devices_data = devices_data[
            #     devices_data["timestamp"].between(start_date_time, end_date_time)
            # ]
        return devices_data

    def __per_device_data(
        device: Dict[str, Any],
        dates: List[str],
        config: Dict[str, Any],
        resolution: Frequency,
    ):
        """
        Fetches, processes, and returns device-specific data for a given date range.

        This method performs the following steps:
        1. Extracts raw data and metadata for the given device using the provided configuration and date range.
        2. If data is returned and valid, it is processed and enriched.
        3. Returns the processed DataFrame or None if no valid data was available.

        Args:
            device(Dict[str, Any]): Device information (must include identifiers used in extraction).
            dates(List[str]): List of date strings to extract data for.
            config(Dict[str, Any]): Configuration parameters for data extraction and processing.
            resolution(Frequency): Data resolution or granularity (e.g., hourly, daily).

        Returns:
            Optional[pd.DataFrame]: Processed device data as a DataFrame, or None if no data was returned.
        """
        data, meta_data = DataUtils._extract_device_api_data(
            device, dates, config, resolution
        )
        if isinstance(data, pd.DataFrame) and not data.empty:
            data = DataUtils._process_and_append_device_data(
                device, data, meta_data, config
            )
            if not data.empty:
                return data
        else:
            logger.info(
                f"No data returned from {device.device_id} for the given date range"
            )

    @staticmethod
    def compute_device_site_metadata_per_device(
        table: str,
        unique_id: str,
        entity: Dict[str, Any],
        column: Dict[str, Any],
        frequency: Optional[Frequency] = Frequency.WEEKLY,
    ) -> pd.DataFrame:
        """
        Computes metadata for devices or sites based on the specified parameters.

        This method retrieves and processes metadata for a given device or site, using the provided table, unique identifier, and column.
        It calculates the metadata within a 30-day window starting from the most recent maintenance or offset date.

        Args:
            table(str): The BigQuery table to query for metadata.
            unique_id(str): The unique identifier for the entity (e.g., "device_id" or "site_id").
            entity(Dict[str, Any]): A dictionary containing entity details, including:
                - "device_maintenance" (str): The last maintenance date.
                - "next_offset_date" (str): The previous offset date.
                - The unique identifier (e.g., "device_id" or "site_id").
            column(str): The column to compute metadata for (e.g., pollutant type).
            frequency(Optional[Frequency], default=Frequency.WEEKLY): The frequency for metadata computation. Defaults to weekly.

        Returns:
            pd.DataFrame: A DataFrame containing the computed metadata. If the end date is in the future, an empty DataFrame is returned.

        Note: Supported frequencies are: weekly, monthly, yearly. For other frequencies, this method may return empty or incorrect data.
        """
        device_maintenance = entity.get("device_maintenance", None)
        if device_maintenance is None or pd.isna(device_maintenance):
            logger.info("Device maintenance date is missing or invalid.")
            return pd.DataFrame()

        device_previous_offset = entity.get("next_offset_date")
        start_date = max(
            device_maintenance,
            device_maintenance
            if device_previous_offset is None or np.isnan(device_previous_offset)
            else device_previous_offset,
        )
        entity_id = entity.get(unique_id)
        extra_id = entity.get("site_id") if unique_id == "device_id" else None
        end_date = str_to_date(start_date) + timedelta(days=frequency.value)
        if end_date > datetime.today():
            logger.info(f"End date {end_date} cannot be in the future.")
            return pd.DataFrame()

        end_date = date_to_str(end_date)
        big_query_api = BigQueryApi()

        data = big_query_api.fetch_max_min_values(
            table=table,
            start_date_time=start_date,
            end_date_time=end_date,
            unique_id=unique_id,
            filter=entity_id,
            pollutant=column,
        )
        if not data.empty:
            data["next_offset_date"] = end_date
            data[unique_id] = entity_id
            if extra_id:
                data["site_id"] = extra_id
            data["created"] = datetime.now(timezone.utc)
            data["recent_maintenance_date"] = date_to_str(
                str_to_date(device_maintenance)
            )
            data.dropna(
                inplace=True,
                how="any",
                subset=["pollutant", "minimum", "maximum", "average", "site_id"],
            )
        return data

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
    def fetch_devices_from_api() -> pd.DataFrame:
        """Fetch devices from the external device registry API.

        This method:
            - Retrieves a list of devices from the API using the provided `device_network` and `device_category`.
            - Converts the response into a pandas DataFrame.
            - Ensures that any missing `device_number` values are filled with `-1`.
            - Fetches associated read keys for the filtered devices.
            - Returns both the complete devices DataFrame and a dictionary of read keys.

        If the API request or processing fails, it logs the exception and returns an empty DataFrame and an empty dictionary.

        Returns:
            pd.DataFrame: pandas DataFrame containing device metadata. Always includes a `device_number` column with missing values filled as `-1`.

        Raises:
            Logs exceptions internally and returns empty outputs rather than propagating errors.
        """
        data_api: DataApi = DataApi()
        devices: pd.DataFrame = pd.DataFrame()
        try:
            devices = data_api.get_devices()
            devices = pd.DataFrame(devices)
            if not devices.empty:
                DataUtils.device_metadata_normalizer(devices)
                devices["device_number"] = (
                    devices["device_number"].fillna(-1).astype(int)
                )
                # It is assumed only airqo devices have keys
                airqo_devices = devices.loc[devices.network == DeviceNetwork.AIRQO.str]
                keys = data_api.get_thingspeak_read_keys(airqo_devices)
                devices["key"] = devices["device_number"].map(keys)
        except Exception as e:
            logger.exception(
                f"Failed to fetch devices or read keys from device_registry. {e}"
            )

        return devices

    @staticmethod
    def device_metadata_normalizer(devices: pd.DataFrame) -> None:
        """
        Normalize and clean device metadata DataFrame.

        This function performs the following operations on the input devices DataFrame:
        - Renames columns to standardize naming conventions.
        - Converts specific columns to appropriate data types (e.g., boolean, integer).
        - Parses string representations of lists into actual list objects.
        - Fills missing values in the `device_number` column with `-1` and ensures it is of integer type.
        - Removes duplicate entries based on the `device_id` column, keeping the first occurrence.

        Args:
            devices(pd.DataFrame): A pandas DataFrame containing raw device metadata.
        Returns:
            pd.DataFrame: A cleaned and normalized DataFrame with standardized column names and types.
        """
        devices.rename(
            columns={
                "status": "deployed",
                "mountType": "mount_type",
                "powerType": "power_type",
                "createdAt": "created_at",
                "name": "device_id",
                "_id": "id",
                "authRequired": "auth_required",
                "isActive": "active",
            },
            inplace=True,
            errors="ignore",
        )
        devices["deployed"] = devices["deployed"].replace(
            {"deployed": True, "not deployed": False, "recalled": False}
        )

    def _extract_device_api_data(
        device: pd.Series,
        dates: List[Tuple[str, str]],
        config: dict,
        resolution: Frequency,
    ) -> pd.DataFrame:
        """
        Extract and normalize API data for a single device based on its network type.

        This function:
        - Determines the device's network and retrieves time-series data accordingly.
        - For `DeviceNetwork.AIRQO`, it iterates through a list of date ranges, fetches raw data using the appropriate read key, and aggregates all available API responses.
        - For `DeviceNetwork.IQAIR`, it fetches data using the IQAir API endpoint for the given resolution.
        - Maps the raw API response into a standardized DataFrame format using network-specific mappings.

        Args:
            device(pd.Series): A pandas Series containing device metadata (e.g., `device_number`, `network`, `key`).
            dates(List[Tuple[str, str]]): A list of (start_date, end_date) tuples specifying the time ranges for data extraction.
            config(dict): Configuration dictionary containing:
                        - `mapping`: a mapping of network names to their data field mapping rules.
            resolution(Frequency): Data resolution (e.g., hourly, daily) used when querying certain networks (like `DeviceNetwork.IQAIR`).

        Returns:
            Tuple[pd.DataFrame, dict]
                - **data**: A pandas DataFrame containing mapped and normalized API data.
                Returns an empty DataFrame if no data is found.
                - **meta_data**: A dictionary containing metadata returned by the API (may be empty for some networks).

        Workflow:
            1. If the device belongs to `DeviceNetwork.AIRQO`:
                - Iterate through each date range, fetch API data, and aggregate results.
                - If data is available, apply the mapping rules from `config["mapping"][network]`.
            2. If the device belongs to `DeviceNetwork.IQAIR`:
                - Fetch data via `data_source_api.iqair()`, then apply mapping rules.
            3. If neither condition is met or an error occurs:
                - Return `(empty DataFrame, empty dict)`.

        Raises:
            Logs exceptions internally (does not raise).
            - If an API request fails, logs an exception with the device name and returns empty results.

        Notes:
            - Requires a valid `device_number` (non-null, non-NaN) for `DeviceNetwork.AIRQO`.
            - Uses either `device["key"]` or a fallback key from the `keys` dictionary.
            - Mapping logic depends on the `config["mapping"]` structure.
        """
        device_number = device.get("device_number")
        key = device.get("key")
        network = device.get("network")
        api_data = []
        data_source_api = DataSourcesApis()

        if (
            device_number
            and not np.isnan(device_number)
            and device_number != -1
            and network == DeviceNetwork.AIRQO.str
        ):
            key = Utils.decrypt_key(bytes(key, "utf-8")) if key else None
            for start, end in dates:
                data_, meta_data, data_available = data_source_api.thingspeak(
                    device_number=int(device_number),
                    start_date_time=start,
                    end_date_time=end,
                    read_key=key,
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
        """
        Process incoming API data, ensure required columns exist, and enrich it with device metadata.

        This function:
        - Ensures all required columns are present in the DataFrame by filling missing ones.
        - Appends device details (category, ID, site, network).
        - Replaces latitude/longitude values of `0.0` or NaN with fallback values from the device metadata or global `meta_data`.

        Args
            device(pd.Series): A pandas Series containing device-specific metadata (e.g., device_id, site_id, latitude).
            data(pd.DataFrame): The raw API data for the device. Can be empty.
            meta_data(dict): Global metadata dictionary providing fallback latitude/longitude if the device data is incomplete.
            config(dict): Configuration dictionary with expected columns:
                        - `field_8_cols` : list of extra required field names.
                        - `other_fields_cols` : list of additional required field names.

        Returns
            pd.DataFrame
                A DataFrame with:
                - Required columns ensured.
                - Device metadata appended.
                - Latitude/longitude corrected (0.0 or NaN replaced by fallback values).
                Returns `None` if the input DataFrame is empty.

        Notes
            - Latitude/longitude will NOT be overwritten if valid (non-zero, non-null) values exist.
            - If no valid fallback latitude/longitude is found in `device` or `meta_data`, the 0.0 values remain unchanged.
        """
        is_mobile = device.get("mobility", False)
        if data.empty:
            logger.warning(f"No data received from {device.get('device_id')}")
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

        if is_mobile:
            lat_fallback = device.get("latitude")
            lon_fallback = device.get("longitude")
        else:
            lat_fallback = meta_data.get("latitude") or device.get("latitude")
            lon_fallback = meta_data.get("longitude") or device.get("longitude")

        data = DataValidationUtils.fill_missing_columns(data=data, cols=data_columns)
        data["device_category"] = device.get("device_category")
        data["device_number"] = device.get("device_number")
        data["device_id"] = device.get("device_id")
        data["site_id"] = device.get("site_id")
        data["network"] = device.get("network")
        # Does not update for mobile devices unless sent data is equal to 0
        data["latitude"] = (
            data["latitude"].replace(0.0, lat_fallback).fillna(lat_fallback)
        )
        data["longitude"] = (
            data["longitude"].replace(0.0, lon_fallback).fillna(lon_fallback)
        )

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
            data_filter(Dict, optional): A column filter with it's values i.e {"device_id":["aq_001", "aq_002"]}
            use_cach(bool, optional): Use biqquery cache

        Returns:
            pd.DataFrame: A pandas DataFrame containing the cleaned data from BigQuery.

        Raises:
            ValueError: If the frequency is unsupported or no table is associated with it.
        """
        bigquery_api = BigQueryApi()
        table: str = None

        if not device_category:
            device_category = DeviceCategory.GENERAL

        table, _ = DataUtils._get_table(
            datatype, device_category, frequency, device_network
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

        if not isinstance(raw_data, pd.DataFrame):
            raise ValueError(
                "No data returned from BigQuery query, but data was expected. Check your logs for more information"
            )

        if remove_outliers:
            raw_data = DataValidationUtils.remove_outliers_fix_types(raw_data)

        return raw_data

    @staticmethod
    def extract_most_recent_metadata_record(
        metadata_type: MetaDataType,
        unique_id: str,
        offset_column: str,
        filter: Dict[str, Any] = None,
    ) -> pd.DataFrame:
        """
        Extracts the most recent record for a specific metadata type and unique ID.

        Args:
            metadata_type (MetaDataType): The type of metadata to extract.
            unique_id (str): The unique ID of the record to extract.
            offset_column (str): The column to use for offsetting the results.

        Returns:
            pd.DataFrame: A DataFrame containing the most recent record.
        """
        big_query_api = BigQueryApi()
        try:
            # TODO : Refactor to avoid using hardcoded MetaDataType
            metadata_table, cols = DataUtils._get_metadata_table(
                MetaDataType.DATAQUALITYCHECKS, metadata_type
            )
        except Exception as e:
            logger.exception(f"Failed to get metadata table. {e}")
            return pd.DataFrame()

        data = big_query_api.fetch_most_recent_record(
            metadata_table,
            unique_id,
            offset_column=offset_column,
            columns=cols,
            filter=filter,
        )
        return data

    @staticmethod
    def extract_purpleair_data(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        """
        Extracts PurpleAir sensor data for all NASA network devices between specified datetime ranges.

        Args:
            start_date_time(str): The start datetime in ISO 8601 format.
            end_date_time(str): The end datetime in ISO 8601 format.

        Returns:
            pd.DataFrame: A DataFrame containing aggregated sensor readings along with metadata (device number, location, and ID).
        """
        all_data: List[Any] = []
        devices = DataUtils.get_devices(device_network=DeviceNetwork.NASA)

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.PURPLE_AIR,
        )

        for _, device in devices.iterrows():
            device_number = device["device_number"]
            device_id = device["device_id"]
            latitude = device["latitude"]
            longitude = device["longitude"]

            for start, end in dates:
                query_data = DataUtils.query_purpleair_data(
                    start_date_time=start,
                    end_date_time=end,
                    device_number=device_number,
                )

                if not query_data.empty:
                    query_data = query_data.assign(
                        device_number=device_number,
                        device_id=device_id,
                        latitude=latitude,
                        longitude=longitude,
                    )
                    all_data.append(query_data)
        return pd.concat(all_data, ignore_index=True) if all_data else pd.DataFrame()

    @staticmethod
    def query_purpleair_data(
        start_date_time: str, end_date_time: str, device_number: int
    ) -> pd.DataFrame:
        """
        Queries the PurpleAir API for a specific sensor and time range.

        Args:
            start_date_time (str): The start datetime in ISO 8601 format.
            end_date_time (str): The end datetime in ISO 8601 format.
            device_number (int): The PurpleAir sensor ID to query.

        Returns:
            pd.DataFrame: A DataFrame with the queried data. Returns an empty DataFrame if no data is found.
        """
        data_api = DataApi()
        response = data_api.extract_purpleair_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            sensor=device_number,
        )

        return pd.DataFrame(
            columns=response.get("fields", []),
            data=response.get("data", []),
        )

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

    # --------------------------------------------------------------------
    # Weather Data
    # --------------------------------------------------------------------
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

        return DataValidationUtils.remove_outliers_fix_types(weather_data)

    @staticmethod
    def extract_tahmo_data(
        start_time: str, end_time: str, station_codes: List[str]
    ) -> List[Dict]:
        """
        Extracts measurement data from the TAHMO API for a list of station codes over a specified time range.

        Args:
            start_time(str): Start timestamp in ISO 8601 format (e.g., "2024-01-01T00:00:00Z").
            end_time(str): End timestamp in ISO 8601 format.
            station_codes(list[str]): List of TAHMO station codes to query.

        Returns:
            list[dict]: A list of measurement records, each as a dictionary with keys such as "value", "variable", "station", and "time". If no data is available,returns an empty list.

        Notes:
            - Only data under the "controlled" measurement endpoint is fetched.
            - Any station errors are logged but do not halt execution for other stations.
        """
        data_api = DataApi()

        if not isinstance(station_codes, list):
            raise TypeError("station_codes must be a list of station codes.")

        stations = set(station_codes)
        measurements = data_api.get_tahmo_data(start_time, end_time, stations)

        return measurements.to_dict(orient="records")

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

    # ---------------------------------------------------------------------------
    # TODO Add section
    # ---------------------------------------------------------------------------

    @staticmethod
    def process_data_for_api(
        data: pd.DataFrame, frequency: Frequency
    ) -> List[Dict[str, Any]]:
        """
        Transform **CLEANED** device measurements into the payload format required by the API events endpoint.

        This function:
            - Ensures `timestamp` is converted to a string format expected by the API.
            - Retrieves device metadata from the device registry.
            - Merges measurement data with device metadata.
            - Restructures each row into a nested JSON-like dict for the events endpoint.

        Args:
            data(pd.DataFrame): Cleaned device measurements. Must contain:
                - "device_id", "device_number", "site_id", "timestamp", "latitude", "longitude", pollutant columns, etc.
            frequency(Frequency): The measurement frequency (e.g., hourly, daily).

        Returns:
            list[dict]: A list of measurement dicts ready to send to the API.
        """

        data["timestamp"] = pd.to_datetime(data["timestamp"], errors="coerce")
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        devices = DataUtils.get_devices()
        devices = devices[["id", "device_id", "network"]]
        devices = devices.set_index("device_id")

        restructured_data = DataUtils.__device_registry_api_data(
            data, devices, frequency
        )

        return restructured_data

    def __device_registry_api_data(
        data: pd.DataFrame, devices: pd.DataFrame, frequency: Frequency
    ) -> List[Dict[str, Any]]:
        """
        Merge measurement rows with device metadata and format into the API's expected structure.

        Each row:
            - Is matched to its corresponding device details from the registry.
            - Includes pollutant values and calibrated equivalents (if both exist).
            - Adds location, network, frequency, and additional sensor metadata.

        Args:
            data(pd.DataFrame): Measurement data with required fields.
            devices(pd.DataFrame): Device metadata indexed by `device_id`, containing at least `_id` and `network`.
            frequency(Frequency): Measurement frequency.

        Returns:
            list[dict]: Structured measurement dicts suitable for the API.
        """
        restructured_data = []
        for _, row in data.iterrows():
            try:
                device_number = row["device_number"]
                device_id = row["device_id"]
                device_details = None

                if device_id not in devices.index:
                    logger.exception(
                        f"Device number {device_id} not found in device list"
                    )
                    continue

                # only include pollutant if both keys exist - Use same structure to build raw data rows
                (
                    average_pollutants,
                    calibrated_pollutants,
                ) = DataUtils.__averaged_calibrated_data_structure(row)

                device_details = devices.loc[device_id]
                row_data = {
                    "device": device_id,
                    "device_id": device_details["id"],
                    "site_id": row.get("site_id", None),
                    "device_number": device_number,
                    "network": device_details["network"],
                    "location": {
                        key: {"value": row[key]} for key in ["latitude", "longitude"]
                    },
                    "frequency": frequency.str,
                    "time": row["timestamp"],
                    **average_pollutants,  # Can be empty
                    **calibrated_pollutants,  # Can be empty
                    # extra sensor metadata
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
                logger.exception(
                    f"An error occurred while processing data for the api: {e}"
                )
        return restructured_data

    def __averaged_calibrated_data_structure(
        row: Dict,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Build pollutant data structures for averaged and calibrated values.

        This function extracts pollutant measurements (`pm2_5`, `pm10`) and their calibrated values from a given `row` dictionary, but only includes entries if both the raw value and its calibrated counterpart (`<pollutant>_calibrated_value`) are present.

        Args:
            row(Dict): A dictionary containing pollutant values and possibly their calibrated values.
                Expected keys include:
                - "pm2_5", "pm10"
                - "pm2_5_calibrated_value", "pm10_calibrated_value"

        Returns:
            Tuple[Dict[str, Any], Dict[str, Any]]:
                - average_pollutants: A dict with keys like `"average_pm2_5"` and `"average_pm10"`, each containing:
                    {
                        "value": <raw_value>,
                        "calibratedValue": <calibrated_value>
                    }
                - calibrated_pollutants: A dict with keys `"pm2_5"` and `"pm10"` in the same structure.
        """
        pollutants = ["pm2_5", "pm10"]

        average_pollutants = {
            f"average_{key}": {
                "value": row[key],
                "calibratedValue": row[f"{key}_calibrated_value"],
            }
            for key in pollutants
            if key in row and f"{key}_calibrated_value" in row
        }

        calibrated_pollutants = {
            key: {
                "value": row[key],
                "calibratedValue": row[f"{key}_calibrated_value"],
            }
            for key in pollutants
            if key in row and f"{key}_calibrated_value" in row
        }

        return average_pollutants, calibrated_pollutants

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
        Aggregates low-cost sensor data by resampling numeric fields to hourly averages. This method processes the input DataFrame by grouping data by `device_id` and
        resampling numeric columns on an hourly basis. It ensures that required metadata columns are preserved and handles missing or invalid data gracefully.

        Args:
            data(pd.DataFrame): A pandas DataFrame containing cleaned low-cost sensor data. Must include `timestamp` and `device_id` columns.

        Returns:
            pd.DataFrame: A DataFrame containing hourly averages of numeric fields, with metadata columns preserved.
        """

        required_columns = {"timestamp", "device_id"}
        if not required_columns.issubset(data.columns):
            raise ValueError(
                f"Input data must contain the following columns: {required_columns}"
            )

        data["timestamp"] = pd.to_datetime(data["timestamp"], errors="coerce")

        try:
            # TODO: Make this more dynamic and device-type agnostic
            # Might drop some columns if not included in group metadata
            group_metadata = (
                data[
                    [
                        "device_id",
                        "site_id",
                        "device_number",
                        "network",
                        "device_category",
                        "last_updated",
                    ]
                ]
                .drop_duplicates("device_id")
                .set_index("device_id")
            )
        except KeyError as e:
            logger.exception(f"Missing required metadata columns: {e}")
            return pd.DataFrame(columns=data.columns)

        numeric_columns = data.select_dtypes(include=["number"]).columns.difference(
            ["device_number"]
        )
        data_for_aggregation = data[["timestamp", "device_id"] + list(numeric_columns)]

        try:
            aggregated = (
                data_for_aggregation.groupby("device_id")
                .apply(lambda group: group.resample("1H", on="timestamp").mean())
                .reset_index()
            )
            aggregated = aggregated.merge(group_metadata, on="device_id", how="left")
        except Exception as e:
            logger.exception(f"Aggregation error: {e}")
            aggregated = pd.DataFrame(columns=data.columns)

        return drop_rows_with_bad_data("number", aggregated, exclude=["device_number"])

    @staticmethod
    def clean_low_cost_sensor_data(
        data: pd.DataFrame,
        device_category: DeviceCategory,
        data_type: DataType,
        frequency: Frequency = None,
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
            data(pd.DataFrame): The input data to be cleaned.
            device_category(DeviceCategory): The category of the device, as defined in the DeviceCategory enum.
            frequency(Frequency): This is the frequency of the dag that executed this method.
            remove_outliers(bool, optional): Determines whether outliers should be removed. Defaults to True.

        Returns:
            pd.DataFrame: The cleaned DataFrame.

        Raises:
            KeyError: If there are issues with the 'timestamp' column during processing.

        Notes:
            #TODO Find a better way to extract frequency of dag that is executing the method. #
        """
        # It's assumed that if a row has no site_id, it could be from an undeployed device.
        if (
            device_category != DeviceCategory.MOBILE
        ):  # Temporary until location data requirements for mobile data are revised.
            data.dropna(subset=["site_id"], how="any", inplace=True)

        if remove_outliers:
            data = DataValidationUtils.remove_outliers_fix_types(data)

        # Perform data quality checks on separate thread.
        if frequency and frequency == Frequency.HOURLY:
            data_ = data[data["network"] == DeviceNetwork.AIRQO.str]
            # Pass copy as pandas does not guarantee returned data to be a view or copy
            DataUtils.execute_data_quality_checks(
                device_category, data_type, data_.copy(), frequency
            )

        try:
            networks = set(data.network.unique())
            dropna_subset = []

            if "airqo" in networks:
                if "vapor_pressure" in data.columns:
                    values = pd.to_numeric(data["vapor_pressure"], errors="coerce")
                    converted = values * 0.1
                    mask_valid = ~values.isna()
                    data.loc[:, "vapor_pressure"] = converted[mask_valid]

                # Airqo devices specific fields
                dropna_subset.extend(["s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10"])

            if networks - {"airqo"}:
                # Expected fields from non-airqo devices
                dropna_subset.extend(["pm2_5", "pm10"])

            data.dropna(
                subset=dropna_subset,
                how="all",
                inplace=True,
            )
            data.dropna(subset=["timestamp"], inplace=True)
            data["timestamp"] = pd.to_datetime(data["timestamp"])
            data["last_updated"] = date_to_str(datetime.now(timezone.utc))
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
    def clean_bam_data(
        data: pd.DataFrame, datatype: DataType, frequency: Frequency
    ) -> pd.DataFrame:
        """
        Cleans and transforms BAM data for BigQuery insertion.

        This function processes the input DataFrame by removing outliers, dropping duplicate entries based on timestamp and device number, and renaming columns according to a
        specified mapping. It also adds a network identifier and ensures that all required columns for the BigQuery BAM hourly measurements table are present.

        Args:
            data(pd.DataFrame): The input DataFrame containing BAM data with columns such as 'timestamp' and 'device_number'.

        Returns:
            pd.DataFrame: A cleaned DataFrame containing only the required columns, with outliers removed, duplicates dropped, and column names mapped according to the defined configuration.
        """
        remove_outliers = True
        data["network"] = DeviceNetwork.AIRQO.str

        if datatype == DataType.RAW:
            remove_outliers = False
        else:
            data.rename(columns=Config.AIRQO_BAM_MAPPING, inplace=True)

        data = DataValidationUtils.remove_outliers_fix_types(
            data, remove_outliers=remove_outliers
        )
        data.dropna(subset=["timestamp"], inplace=True)

        data["timestamp"] = pd.to_datetime(data["timestamp"], errors="coerce")

        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )
        _, required_cols = DataUtils._get_table(datatype, DeviceCategory.BAM, frequency)
        data = DataValidationUtils.fill_missing_columns(data=data, cols=required_cols)
        data = data[required_cols]

        return drop_rows_with_bad_data("number", data, exclude=["device_number"])

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

        devices = DataUtils.get_devices(
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
                        "device_id": device_details.get("device_id"),
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
        air_now_data = DataValidationUtils.remove_outliers_fix_types(air_now_data)

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
            device_network (DeviceNetwork): The network the device is connected to.
            metadata_type (Optional[str]): The type of metadata to include (if any).
            extra_type (Any): Any additional type information.

        Returns:
            pd.DataFrame: A DataFrame formatted for BigQuery with required columns populated.
            str: Name of the table.

        Raises:
            KeyError: If the combination of data_type, device_category, and frequency is invalid.
            Exception: For unexpected errors during column retrieval or data processing.
        """
        big_query_api = BigQueryApi()
        table, cols = DataUtils._get_table(
            datatype, device_category, frequency, device_network, extra_type
        )
        timestamp_columns = big_query_api.get_columns(
            table=table, column_type=[ColumnDataType.TIMESTAMP]
        )

        try:
            for col in timestamp_columns:
                data[col] = pd.to_datetime(data[col], errors="coerce")
        except Exception as e:
            logger.exception(f"Possible table and column mismatch: {e}")
            raise
        if "timestamp" in data.columns:
            data.dropna(subset=["timestamp"], inplace=True)

        data = DataValidationUtils.fill_missing_columns(data=data, cols=cols)
        data = DataValidationUtils.remove_outliers_fix_types(data)
        return data[cols], table

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

        devices = DataUtils.get_devices()

        try:
            data.rename(columns={"device_id": "device_name"}, inplace=True)
            devices.rename(
                columns={
                    "device_id": "device_name",
                    "latitude": "device_latitude",
                    "longitude": "device_longitude",
                },
                inplace=True,
            )
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

        devices = DataUtils.get_devices()
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

        return DataValidationUtils.remove_outliers_fix_types(data)

    def _add_site_and_device_details(devices: pd.DataFrame, device_id) -> pd.Series:
        """
        Retrieves site and device details for a given device ID from the provided DataFrame.

        This function filters the `devices` DataFrame to find a row matching the specified `device_id`.
        If a matching device is found, it returns a pandas Series containing the `site_id` and
        `device_number` associated with that device. If no matching device is found or an error occurs,
        it returns a Series with None values.

        Args:
            devices(pd.DataFrame): A DataFrame containing device information, including 'device_id'.
            device_id(str): The ID of the device to search for in the DataFrame.

        Returns:
            pd.Series: A Series containing 'site_id' and 'device_number' for the specified device ID,
                    or None values if the device is not found or an error occurs.
        """
        try:
            filtered_devices = devices.loc[devices.device_id == device_id]
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

    def _get_table(
        datatype: DataType,
        device_category: DeviceCategory,
        frequency: Optional[Frequency] = None,
        device_network: Optional[DeviceNetwork] = None,
        extra_type: Optional[Any] = None,
    ) -> Tuple[str, List[str]]:
        """
        Retrieves the appropriate BigQuery table name and its column names based on the given parameters.

        Args:
            datatype(DataType): The type of data to retrieve (e.g., EXTRAS, AIR_QUALITY).
            device_category(DeviceCategory): The category of the device.
            frequency(Frequency): The data collection frequency.
            device_network(DeviceNetwork, optional): The device network, required for EXTRAS data.
            extra_type(Any, optional): The specific extra type, required for EXTRAS data.

        Returns:
            Tuple[str, List[str]]: A tuple containing:
                - The table name (str) if found, otherwise None.
                - A list of column names if found, otherwise an empty list.

        Raises:
            KeyError: If the combination of parameters does not exist in the data source.
            Exception: Logs and handles unexpected errors during retrieval.
        """
        bigquery = BigQueryApi()
        frequency_: Frequency = frequency
        if frequency_ in Config.extra_time_grouping:
            frequency_ = Frequency.HOURLY
        try:
            datasource = Config.DataSource
            if datatype == DataType.EXTRAS:
                table = datasource.get(datatype).get(device_network).get(extra_type)
            else:
                table = datasource.get(datatype).get(device_category).get(frequency_)
            cols = bigquery.get_columns(table=table)
            return table, cols
        except KeyError:
            logger.exception(
                f"Invalid combination: {datatype.str}, {device_category.str}, {frequency.str}, {extra_type}"
            )
        except Exception as e:
            logger.exception(
                f"An unexpected error occurred during column retrieval: {e}"
            )
        return None, []

    def get_columns(table: str) -> List[str]:
        """
        Retrieves the column names for a specified BigQuery table.

        Args:
            table (str): The name of the BigQuery table.
        Returns:
            List[str]: A list of column names for the specified table. If the table does not exist or an error occurs, returns an empty list.
        """
        bigquery = BigQueryApi()
        try:
            cols = bigquery.get_columns(table=table)
            return cols
        except Exception as e:
            logger.exception(
                f"An unexpected error occurred during column retrieval: {e}"
            )
        return []

    def _get_metadata_table(
        metadata_type: MetaDataType,
        category: Union[DeviceCategory, MetaDataType],
    ) -> Tuple[Optional[str], List[str]]:
        """
        Retrieve the BigQuery metadata table name and its column names based on the given parameters.

        This function determines the appropriate metadata table and its schema for the specified metadata type
        and category. It queries the BigQuery API to fetch the column names for the table.

        Args:
            metadata_type (MetaDataType): The type of metadata to retrieve (e.g., DEVICES, SITES).
            category (Union[DeviceCategory, MetaDataType]): The category or metadata type.

        Returns:
            Tuple[Optional[str], List[str]]:
                - The table name (str) if found, otherwise None.
                - A list of column names (List[str]) if found, otherwise an empty list.

        Raises:
            KeyError: If the combination of metadata_type and category does not exist in the configuration.
            Exception: Logs and handles unexpected errors during table or column retrieval.

        Notes:
            - The `Config.MetaDataStore` dictionary is used to map metadata types and categories to table names.
            - If the table name is not found or an error occurs, the function returns `None` and an empty list.
        """
        bigquery = BigQueryApi()
        try:
            datasource = Config.MetaDataStore
            table = datasource.get(metadata_type)
            if isinstance(table, dict):
                table = table.get(category)
            cols = bigquery.get_columns(table=table)
            return table, cols
        except KeyError:
            logger.exception(
                f"Invalid combination of metadata_type: {metadata_type} and category: {category}"
            )
        except Exception as e:
            logger.exception(
                f"An unexpected error occurred during table or column retrieval: {e}"
            )
        return None, []

    @staticmethod
    def execute_data_quality_checks(
        device_category: DeviceCategory,
        data_type: DataType,
        data: pd.DataFrame = None,
        frequency: Frequency = None,
    ) -> None:
        """
        Execute data quality checks.

        Notes: If running locally, you might want to run this without async if you want to see the results
        """
        Utils.execute_and_forget_async_task(
            lambda: DataUtils.__perform_data_quality_checks(
                device_category, data_type, data=data, frequency=frequency
            )
        )

    async def __perform_data_quality_checks(
        device_category: DeviceCategory,
        data_type: DataType,
        data: pd.DataFrame = None,
        frequency: Frequency = Frequency.HOURLY,
    ) -> None:
        """
        Perform data quality checks on the provided DataFrame based on the device category.

        This function routes the data quality check to the appropriate Great Expectations validation suite depending on the type of device. It does not modify the original DataFrame or return any results. Intended to run as a fire-and-forget task.

        Args:
            device_category(DeviceCategory): The category of the device(e.g., GAS, LOWCOST).
            data(pd.DataFrame): The raw sensor data to be validated.
            data_type(DataType): The type of data to work with(e.g., RAW, AVERAGE).
        """
        data_asset_name: str = None
        RAW_METHODS = {
            DeviceCategory.GAS: "gaseous_low_cost_sensor_raw_data_check",
            DeviceCategory.LOWCOST: "pm2_5_low_cost_sensor_raw_data",
            DeviceCategory.MOBILE: "pm2_5_low_cost_sensor_raw_data",
            DeviceCategory.BAM: "bam_sensors_raw_data",
        }
        SQL_METHODS = {
            DeviceCategory.GAS: "gaseous_low_cost_sensor_averaged_data_check",
            DeviceCategory.LOWCOST: "pm2_5_low_cost_sensor_average_data",
            DeviceCategory.BAM: "bam_sensors_averaged_data",
        }
        if data_type == DataType.RAW:
            # RAW → Pandas-based validation
            source = AirQoGxExpectations.from_pandas()
            method_name = RAW_METHODS.get(device_category)
        elif data_type in (DataType.AVERAGED, DataType.CONSOLIDATED):
            # SQL → override data_asset_name with project + table name
            source = AirQoGxExpectations.from_sql()
            method_name = SQL_METHODS.get(device_category)
            # TODO SQL using the general tables for now - This needs to be more dynamic
            data_asset_name, _ = DataUtils._get_table(
                data_type, DeviceCategory.GENERAL, frequency
            )
        else:
            raise ValueError(f"Unsupported data_type: {data_type}")

        if not method_name:
            raise ValueError(f"Unsupported device_category: {device_category}")
        func = getattr(source, method_name)

        if data_asset_name:
            func(data_asset_name)
        else:
            func(data)
