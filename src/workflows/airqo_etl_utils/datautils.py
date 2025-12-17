import uuid
import numpy as np
import pandas as pd
import json
import os
from pathlib import Path
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
from .date import DateUtils
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
        Retrieve devices data for specified device network and category.

        Attempts to load devices data from either cached CSV file or API. The function
        prioritizes cached data for performance, falling back to API if cache is unavailable.
        In production environment, only deployed devices are returned.

        Args:
            device_category (Optional[DeviceCategory]): Category of devices to filter by. If None, returns all categories.
            device_network (Optional[DeviceNetwork]): Network of devices to filter by. If None, returns all networks.
            preferred_source (Optional[str]): Data source preference. Defaults to "cache". Options: "cache", "api". The "api" option offers richer devices data.

        Returns:
            pd.DataFrame: DataFrame containing device information including device_number,
                         network, device_category, deployed status, and other metadata.
                         Empty DataFrame if no devices match the criteria.

        Raises:
            RuntimeError: If devices data cannot be obtained from either cache or API.

        Note:
            In production environment, automatically filters to deployed=True devices only.
            Device numbers with missing values are filled with -1 in cached data.
        """
        # TODO: Add bigquery as a source of devices as a 3rd option and also centralize any device cleaning logic
        # There might be some repeated devices data cleaning/column renaming/normalization logic in other places
        local_file_path = "/tmp/devices.csv"
        devices: pd.DataFrame = pd.DataFrame()

        if preferred_source == "cache":
            try:
                devices = DataUtils._load_devices_from_cache(local_file_path)
                if preferred_source == "cache" and not devices.empty:
                    devices = DataUtils._process_cached_devices(
                        devices, device_category, device_network
                    )
            except Exception as e:
                logger.exception(f"Failed to load cached devices: {e}")

        if devices.empty:
            try:
                devices = DataUtils.fetch_devices_from_api()
            except Exception as e:
                logger.exception(f"Failed to fetch devices from API: {e}")

        if devices.empty:
            raise RuntimeError(
                "Failed to retrieve devices data from both cache and API."
            )

        # TODO: Review deployed status metadata field usage
        if Config.ENVIRONMENT == "production":
            devices = devices[devices.deployed == True]

        if device_category:
            devices = devices.loc[devices.device_category == device_category.str]

        if device_network:
            devices = devices.loc[devices.network == device_network.str]

        return devices

    @staticmethod
    def _load_devices_from_cache(file_path: str) -> pd.DataFrame:
        """
        Load devices data from local cache file.

        Attempts to read devices data from the specified cache file path.
        Handles various file-related exceptions gracefully with appropriate logging.

        Args:
            file_path (str): Path to the cached devices CSV file

        Returns:
            pd.DataFrame: Loaded devices data or empty DataFrame if loading fails

        Note:
            Logs informational messages for common issues like missing files or empty data.
            Uses MetaDataType.DEVICES.str for data loading configuration.
        """
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

    @staticmethod
    def _process_cached_devices(
        devices: pd.DataFrame,
        device_category: Optional[DeviceCategory] = None,
        device_network: Optional[DeviceNetwork] = None,
    ) -> pd.DataFrame:
        """
        Process and filter cached devices data.

        Cleans device_number column by filling missing values with -1 and converting
        to integer type. Applies optional filtering by device category and network.

        Args:
            devices (pd.DataFrame): Raw devices DataFrame from cache
            device_category (Optional[DeviceCategory]): Category filter to apply
            device_network (Optional[DeviceNetwork]): Network filter to apply

        Returns:
            pd.DataFrame: Processed and filtered devices DataFrame with clean device_number
                         column and applied filters.

        Note:
            Missing device numbers are standardized to -1 before conversion to int type.
        """

        devices["device_number"] = devices["device_number"].fillna(-1).astype(int)

        if device_category:
            devices = devices.loc[devices.device_category == device_category.str]

        if device_network:
            devices = devices.loc[devices.network == device_network.str]

        return devices

    @staticmethod
    def _extract_keys(devices: pd.DataFrame, network: DeviceNetwork) -> Dict[int, str]:
        """
        Extract device number to key mapping from devices DataFrame.

        Creates a dictionary mapping device numbers to their corresponding keys
        for devices in the specified network. Used for device authentication
        and identification purposes.

        Args:
            devices (pd.DataFrame): Devices DataFrame containing device_number and key columns
            network (DeviceNetwork): Network to filter devices by

        Returns:
            Dict[int, str]: Mapping of device numbers to their corresponding keys for devices in the specified network.

        Note:
            Only processes devices that belong to the specified network.
        """
        keys = dict(
            zip(
                devices.loc[devices.network == network.str, "device_number"].to_numpy(),
                devices.loc[devices.network == network.str, "key"].to_numpy(),
            )
        )
        return keys

    @staticmethod
    def get_sites(
        network: Optional[DeviceNetwork] = None,
        preferred_source: Optional[str] = "cache",
    ) -> pd.DataFrame:
        """
        Retrieve monitoring sites data for specified network.

        Attempts to load sites data from cached CSV file or API. Prioritizes
        cached data for performance, falling back to API if cache is unavailable.
        Sites can be filtered by network if specified.

        Args:
            network (Optional[DeviceNetwork]): Network to filter sites by.
                                             If None, returns sites from all networks.
            preferred_source (Optional[str]): Data source preference. Defaults to "cache". Options: "cache", "api". The "api" options offers richer sites data.

        Returns:
            pd.DataFrame: DataFrame containing site information including site_id,
                         network, location coordinates, and other site metadata.
                         Empty DataFrame if no sites match the criteria.

        Raises:
            RuntimeError: If sites data cannot be obtained from either cache or API.

        Note:
            Uses local cache at /tmp/sites.csv for performance optimization.
        """
        local_file_path = "/tmp/sites.csv"
        sites: pd.DataFrame = pd.DataFrame()

        if preferred_source == "cache":
            try:
                sites = DataUtils.load_cached_data(
                    local_file_path, MetaDataType.SITES.str
                )
            except Exception as e:
                logger.exception(f"Failed to load cached: {e}")

        if sites.empty:
            try:
                datautils = DataUtils()
                sites = datautils.fetch_sites_from_api()
            except Exception as e:
                logger.exception(f"Failed to fetch sites from API: {e}")

        if network:
            sites = sites.loc[sites.network == network.str]

        if sites.empty:
            raise RuntimeError("Failed to retrieve cached/api sites data.")
        return sites

    def fetch_sites_from_api(self) -> pd.DataFrame:
        """
        Fetch all site metadata from the external API.

        Retrieves site information from the DataApi endpoint and converts the response
        into a normalized pandas DataFrame. Applies site metadata normalization and
        handles API failures gracefully.

        Returns:
            pd.DataFrame: DataFrame containing site metadata including site_id, network,
                         coordinates, names, and other site attributes. Returns empty
                         DataFrame if API call fails.

        Note:
            Logs exceptions internally without propagating errors. Uses
            sites_metadata_normalizer() for data standardization.
        """
        data_api: DataApi = DataApi()
        sites_data: pd.DataFrame = pd.DataFrame()
        try:
            sites_data = data_api.get_sites()
            sites_data = pd.DataFrame(sites_data)
            self.sites_metadata_normalizer(sites_data)

        except Exception as e:
            logger.exception(f"Failed to load sites data from api. {e}")
        return sites_data

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
        Extract sensor measurements from network devices for specified time range.

        Retrieves air quality measurements from ThingSpeak API for devices in the specified
        category. Supports filtering by device IDs and handles mobile device categorization.
        Uses parallel processing for efficient data extraction from multiple devices.

        Args:
            start_date_time (str): Start date and time in ISO 8601 format
            end_date_time (str): End date and time in ISO 8601 format
            device_category (DeviceCategory): Category of devices (BAM, LOWCOST, or MOBILE)
            device_network (Optional[DeviceNetwork]): Network filter for devices
            resolution (Frequency): Data frequency/resolution. Defaults to RAW.
            device_ids (Optional[List[str]]): Specific device IDs to extract. If None,
                                            extracts from all devices in category.

        Returns:
            pd.DataFrame: Combined measurements DataFrame from all specified devices.
                         Includes timestamp, device metadata, and sensor readings.
                         Empty DataFrame if no data found.

        Note:
            MOBILE category is internally mapped to LOWCOST devices with mobility=True
            and mount_type='vehicle'. Uses ThreadPoolExecutor for parallel processing.
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

    @staticmethod
    def __per_device_data(
        device: Dict[str, Any],
        dates: List[str],
        config: Dict[str, Any],
        resolution: Frequency,
    ) -> Optional[pd.DataFrame]:
        """
        Fetch and process data for a single device across specified dates.

        Extracts raw data from device API, processes it according to the provided
        configuration, and enriches it with metadata. Used internally by
        extract_devices_data() for parallel processing of multiple devices.

        Args:
            device (Dict[str, Any]): Device metadata including identifiers and configuration
            dates (List[str]): List of date strings for data extraction period
            config (Dict[str, Any]): Device category configuration parameters
            resolution (Frequency): Data granularity (RAW, HOURLY, DAILY, etc.)

        Returns:
            Optional[pd.DataFrame]: Processed device data with metadata enrichment.
                                   None if no valid data available for the device.

        Note:
            This is a private method used internally for parallel device processing.
            Handles data extraction, processing, and metadata enrichment in sequence.
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
        Compute metadata for devices or sites within a maintenance-based time window.

        Calculates metadata for a specific device or site by querying BigQuery within
        a 30-day window from the most recent maintenance or offset date. Used for
        data quality assessment and device performance monitoring.

        Args:
            table (str): BigQuery table name to query for metadata
            unique_id (str): Unique identifier column name (e.g., "device_id", "site_id")
            entity (Dict[str, Any]): Entity details containing:
                                   - device_maintenance: Last maintenance date
                                   - next_offset_date: Previous offset date
                                   - Unique identifier value
            column (Dict[str, Any]): Column configuration for metadata computation
            frequency (Optional[Frequency]): Computation frequency. Defaults to WEEKLY.

        Returns:
            pd.DataFrame: Computed metadata DataFrame. Returns empty DataFrame if
                         end date is in the future or no data available.

        Note:
            Supports weekly, monthly, and yearly frequencies. Uses 30-day window
            from maintenance/offset date for calculation period.
        """
        device_maintenance = entity.get(
            "recent_maintenance_date", entity.get("device_maintenance", None)
        )
        if device_maintenance is None or pd.isna(device_maintenance):
            logger.info("Device maintenance date is missing or invalid.")
            return pd.DataFrame()

        device_previous_offset = entity.get("next_offset_date")
        start_date = max(
            device_maintenance,
            device_maintenance
            if device_previous_offset is None or pd.isna(device_previous_offset)
            else device_previous_offset,
        )
        entity_id = entity.get(unique_id)
        extra_id = entity.get("site_id") if unique_id == "device_id" else None
        end_date = start_date + timedelta(days=frequency.value)
        if end_date > datetime.now(timezone.utc):
            logger.info("End date cannot be in the future.")
            return pd.DataFrame()

        start_date = DateUtils.date_to_str(start_date)
        end_date = DateUtils.date_to_str(end_date)
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
            data["run_id"] = str(uuid.uuid4())
            if extra_id:
                data["site_id"] = extra_id
            data["created"] = datetime.now(timezone.utc)
            data["recent_maintenance_date"] = pd.to_datetime(
                device_maintenance, errors="coerce"
            )
            data.dropna(
                inplace=True,
                how="any",
                subset=[
                    "pollutant",
                    "minimum",
                    "maximum",
                    "average",
                    "stdv",
                    "site_id",
                ],
            )
        return data

    @staticmethod
    def compute_device_site_metadata_batch(
        table: str,
        entity_list: List[Dict[str, Any]],
        pollutants_list: List[str],
        unique_id: str,
        start_date: str,
        end_date: str,
    ) -> pd.DataFrame:
        """
        Computes metadata for all devices or sites by batching the computation process.
        Args:
            table (str): BigQuery table name to query for metadata
            entity_list (List[Dict[str, Any]]): List of entities (devices or sites) with their details
            pollutants_list (List[str]): List of pollutants to compute metadata for
            unique_id (str): Unique identifier column name (e.g., "device_id", "site_id")
            start_date (str): Start date for the metadata computation period in ISO 8601 format
            end_date (str): End date for the metadata computation period in ISO 8601 format
        Returns:
            pd.DataFrame: Computed metadata DataFrame. Returns empty DataFrame if
                         end date is in the future or no data available.
        Raises:
            RuntimeError: If metadata computation fails for all entities
            google.api_core.exceptions.GoogleAPIError: If BigQuery API call fails
        """
        # Figure out how to batch the computation given different maintenance dates
        pass

    @staticmethod
    def load_cached_data(local_file_path: str, file_name: str) -> pd.DataFrame:
        """
        Download and load cached CSV data from Google Cloud Storage.

        Attempts to download the specified cached file from GCS and load it as
        a pandas DataFrame. If the local file doesn't exist, downloads from GCS.
        Handles file loading with appropriate error handling and logging.

        Args:
            local_file_path (str): Local file system path for the cached file
            file_name (str): Name of the file in GCS bucket (used for download)

        Returns:
            pd.DataFrame: Loaded cached data. Returns empty DataFrame if
                         file doesn't exist or loading fails.

        Raises:
            FileNotFoundError: If neither local cache nor GCS file exists
            Exception: For other file loading or download errors

        Note:
            Downloads from GCS only if local cache file is not available.
            Uses download_file_from_gcs() utility for GCS operations.
        """
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
        """
        Fetch device metadata from the external device registry API.

        Retrieves comprehensive device information from the DataApi endpoint and
        converts it to a normalized pandas DataFrame. Fills missing device_number
        values with -1 for consistency.

        Returns:
            pd.DataFrame: DataFrame containing device metadata including device_id,
                         device_number, network, device_category, deployed status,
                         and other device attributes. Returns empty DataFrame if
                         API call fails.

        Note:
            Logs exceptions internally without propagating errors. Ensures device_number
            consistency by filling missing values with -1. Used as fallback when
            cached device data is unavailable.
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
                if not keys:
                    raise ValueError("Failed to retrieve device keys from API.")
                devices["key"] = devices["device_number"].map(keys)
        except Exception as e:
            logger.exception(
                f"Failed to fetch devices or read keys from device_registry. {e}"
            )

        return devices

    @staticmethod
    def device_metadata_normalizer(devices: pd.DataFrame) -> None:
        """
        Normalize and clean device metadata DataFrame in-place.

        Standardizes device metadata by renaming columns, converting data types,
        and cleaning values. Handles status mapping, type conversions, and
        removes duplicates to ensure consistent device data structure.

        Args:
            devices(pd.DataFrame): Raw device metadata DataFrame to normalize

        Returns:
            None: Modifies the DataFrame in-place

        Note:
            - Maps status values: "deployed"->True, "not deployed"/"recalled"->False
            - Renames columns to snake_case convention
            - Removes duplicates based on device_id column
            - Modifies the original DataFrame rather than returning a new one
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

    @staticmethod
    def sites_metadata_normalizer(sites: pd.DataFrame) -> None:
        """
        Normalize and clean site metadata DataFrame in-place.

        Standardizes site metadata by renaming columns to snake_case convention,
        converting data types, parsing list fields, and removing duplicates.
        Ensures consistent site data structure across the application.

        Args:
            sites (pd.DataFrame): Raw site metadata DataFrame to normalize

        Returns:
            None: Modifies the DataFrame in-place

        Note:
            - Renames columns to snake_case convention (e.g., createdAt -> created_at)
            - Parses string representations of lists into actual list objects
            - Removes duplicate entries based on site_id column
            - Modifies the original DataFrame rather than returning a new one
        """
        sites.rename(
            columns={
                "search_name": "display_name",
                "_id": "id",
                "location_name": "display_location",
            },
            inplace=True,
        )

        if "id" in sites.columns:
            sites.drop_duplicates(subset=["id"], keep="first", inplace=True)

    @staticmethod
    def _extract_device_api_data(
        device: pd.Series,
        dates: List[Tuple[str, str]],
        config: dict,
        resolution: Frequency,
    ) -> Tuple[pd.DataFrame, dict]:
        """
        Extract and normalize API data for a single device based on network type.

        Retrieves time-series data from device APIs according to the device's network
        (AirQo ThingSpeak or IQAir). Handles network-specific data fetching patterns
        and applies appropriate field mappings to normalize the response data.

        Args:
            device (pd.Series): Device metadata including device_number, network, and key
            dates (List[Tuple[str, str]]): List of (start_date, end_date) tuples for data extraction
            config (dict): Configuration with network-specific field mappings under "mapping" key
            resolution (Frequency): Data resolution for certain networks (used by IQAir)

        Returns:
            Tuple[pd.DataFrame, dict]:
                - Normalized DataFrame with mapped API data
                - Metadata dictionary from API response (may be empty)
                Returns (empty DataFrame, empty dict) if extraction fails.

        Note:
            - AirQo devices: Iterates through date ranges, aggregates ThingSpeak responses
            - IQAir devices: Single API call with resolution parameter
            - Requires valid device_number for AirQo networks
            - Logs exceptions without propagating errors
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
            key = (
                Utils.decrypt_key(bytes(key, "utf-8")) if isinstance(key, str) else None
            )

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
        else:
            try:
                match network:
                    case DeviceNetwork.IQAIR.str:
                        mapping = config["mapping"][network]
                        result = data_source_api.iqair(device, resolution=resolution)
                    case DeviceNetwork.AIRGRADIENT.str:
                        mapping = config["mapping"][network]
                        result = data_source_api.air_gradient(device, dates)

                if result.data:
                    return DataUtils.map_and_extract_data(mapping, result.data), {}
                else:
                    logger.info(
                        f"No data returned from {device.get('device_id')} for the given date range"
                    )
            except Exception as e:
                logger.exception(
                    f"An error occurred: {e} - device {device.get('name')}"
                )
        return pd.DataFrame(), {}

    @staticmethod
    def _process_and_append_device_data(
        device: pd.Series, data: pd.DataFrame, meta_data: dict, config: dict
    ) -> Optional[pd.DataFrame]:
        """
        Process and enrich device API data with metadata and required columns.

        Ensures all required columns exist, enriches data with device metadata,
        and corrects location coordinates using fallback values. Handles both
        stationary and mobile device data processing.

        Args:
            device (pd.Series): Device metadata including device_id, site_id, coordinates
            data (pd.DataFrame): Raw API data from device. Can be empty.
            meta_data (dict): Global metadata providing fallback coordinates
            config (dict): Configuration with required column lists:
                          - field_8_cols: Extra required field names
                          - other_fields_cols: Additional required field names

        Returns:
            Optional[pd.DataFrame]: Enriched DataFrame with device metadata and corrected
                                   coordinates. None if input data is empty.

        Note:
            - Replaces 0.0 or NaN coordinates with fallback values from device/meta_data
            - Mobile devices use device coordinates as fallback
            - Stationary devices prefer meta_data coordinates over device coordinates
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
        Extract air quality data from BigQuery with filtering and cleaning options.

        Queries BigQuery tables for air quality measurements within specified time range
        and applies optional filtering, aggregation, and outlier removal. Supports
        different data types, frequencies, and device categories.

        Args:
            datatype (DataType): Type of data to extract from source asset
            start_date_time (str): Start of time range in ISO 8601 format
            end_date_time (str): End of time range in ISO 8601 format
            frequency (Frequency): Data frequency (RAW, HOURLY, etc.)
            device_category (DeviceCategory): Category of devices to query
            device_network (Optional[DeviceNetwork]): Network filter for devices
            dynamic_query (Optional[bool]): If True, returns aggregated data grouped
                                          by device identifiers. Defaults to False.
            remove_outliers (Optional[bool]): Whether to remove outliers. Defaults to True.
            data_filter (Optional[Dict[str, Any]]): Column filters e.g. {"device_id": ["aq_001"]}
            use_cache (Optional[bool]): Whether to use BigQuery cache. Defaults to False.

        Returns:
            pd.DataFrame: Cleaned DataFrame containing air quality data. Returns empty
                         DataFrame if no data found or extraction fails.

        Raises:
            ValueError: If frequency is unsupported or no table mapping found.

        Note:
            LOWCOST category is automatically mapped to GENERAL category for table lookup.
        """
        bigquery_api = BigQueryApi()
        table: str = None

        if not device_category or device_category == DeviceCategory.LOWCOST:
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
        frequency: Optional[Frequency] = Frequency.WEEKLY,
        filter: Dict[str, Any] = None,
        baseline_run: Optional[bool] = False,
        order: Optional[str] = "DESC",
    ) -> pd.DataFrame:
        """
        Extracts the most recent record for a specific metadata type and unique ID given some sort of ordering.

        Args:
            metadata_type (MetaDataType): The type of metadata to extract.
            unique_id (str): The unique ID of the record to extract.
            offset_column (str): The column to use for offsetting the results.
            frequency (Optional[Frequency]): The frequency of the data. Defaults to WEEKLY.
            filter (Dict[str, Any]): Additional filters to apply to the query.
            order (Optional[str]): The order of the results. Defaults to "DESC".

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

        data = big_query_api.fetch_record_by_order(
            metadata_table,
            unique_id,
            offset_column=offset_column,
            columns=cols,
            frequency=frequency,
            filter=filter,
            baseline_run=baseline_run,
            order=order,
        )
        return data

    @staticmethod
    def extract_purpleair_data(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        """
        Extract PurpleAir sensor data from NASA network devices for specified time range.

        Queries PurpleAir sensors deployed in the NASA network to collect air quality
        measurements. Enriches the data with device metadata including location
        coordinates and device identifiers.

        Args:
            start_date_time (str): Start datetime in ISO 8601 format
            end_date_time (str): End datetime in ISO 8601 format

        Returns:
            pd.DataFrame: Combined DataFrame containing sensor readings with metadata
                         (device_number, device_id, latitude, longitude). Returns
                         empty DataFrame if no data available for the time range.

        Note:
            Uses DataSource.PURPLE_AIR for date range splitting and processes
            data from all NASA network devices in parallel queries.
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
        Query PurpleAir API for specific sensor data within time range.

        Retrieves air quality measurements from a specific PurpleAir sensor
        using the DataApi interface. Converts the API response into a
        standardized pandas DataFrame format.

        Args:
            start_date_time (str): Start datetime in ISO 8601 format
            end_date_time (str): End datetime in ISO 8601 format
            device_number (int): PurpleAir sensor ID to query

        Returns:
            pd.DataFrame: DataFrame with sensor measurements using API response
                         fields as columns. Returns empty DataFrame if no data found.

        Note:
            Response format includes 'fields' (column names) and 'data' (measurements)
            which are converted into a structured DataFrame.
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
        exclude_cols: Optional[List[str]] = None,
    ) -> pd.DataFrame:
        """
        Remove duplicate rows and fill missing values using intelligent grouping.

        Identifies and handles duplicate records based on ID and timestamp columns.
        For duplicates, fills missing values using forward/backward filling within
        groups, then retains only the first occurrence. Non-essential NaN rows are dropped.

        Args:
            data (pd.DataFrame): Input DataFrame to process
            timestamp_col (str): Column name containing timestamps for duplicate detection
            id_col (str): Column name for identifying duplicates (e.g., 'device_id')
            group_col (str): Column name for grouping during value filling (e.g., 'site_id')
            exclude_cols (Optional[List[str]]): Columns to exclude from forward/backward filling

        Returns:
            pd.DataFrame: Cleaned DataFrame with duplicates removed and missing values filled
                         intelligently within groups.

        Note:
            - Drops rows where all non-essential columns are NaN
            - Uses forward and backward filling within groups for duplicates
            - Preserves first occurrence of duplicate records after filling
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
        data["timestamp"] = data["timestamp"].apply(DateUtils.date_to_str)
        devices = DataUtils.get_devices()
        devices = devices[["id", "device_id", "network"]]
        devices = devices.drop_duplicates(subset="device_id", keep="first")
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
            # Pass copy as pandas does not guarantee returned data to be a view or copy
            DataUtils.execute_data_quality_checks(
                device_category,
                data_type,
                data[data["network"] == DeviceNetwork.AIRQO.str].copy(),
                frequency,
                async_mode=False,
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
            data["last_updated"] = DateUtils.date_to_str(datetime.now(timezone.utc))
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
                DateUtils.str_to_date(sdate).strftime("%Y-%m-%dT%H:%M"),
                DateUtils.str_to_date(edate).strftime("%Y-%m-%dT%H:%M"),
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
        async_mode: bool = True,
    ) -> None:
        """
        Execute data quality checks asynchronously using ThreadPoolExecutor.

        Args:
            device_category: The category of the device (e.g., GAS, LOWCOST)
            data_type: The type of data to work with (e.g., RAW, AVERAGE)
            data: The sensor data to be validated (for RAW data types)
            frequency: The frequency of the data processing (e.g., HOURLY)
            async_mode: If False, runs synchronously for testing/debugging

        Notes:
            - Uses ThreadPoolExecutor for proper resource management in Airflow
            - Comprehensive error handling prevents worker crashes
            - Set async_mode=False for local testing to see immediate results
        """
        if not async_mode:
            # Synchronous execution for testing/debugging
            DataUtils.__perform_data_quality_checks(
                device_category, data_type, data=data, frequency=frequency
            )
            return

        try:

            def run_quality_checks():
                try:
                    DataUtils.__perform_data_quality_checks(
                        device_category, data_type, data=data, frequency=frequency
                    )
                except Exception as e:
                    logger.error(
                        f"Data quality check failed for {device_category.value} {data_type.value}: {e}",
                        exc_info=True,
                    )

            with ThreadPoolExecutor(
                max_workers=1, thread_name_prefix="data_quality_"
            ) as executor:
                future = executor.submit(run_quality_checks)
                # Don't wait for completion (fire-and-forget)
                # ThreadPoolExecutor handles cleanup automatically

        except Exception as e:

            logger.error(
                f"Data quality check failed for {device_category.value} {data_type.value}: {e}",
                exc_info=True,
            )

    @staticmethod
    def execute_data_quality_checks_bulk(
        validation_requests: List[Dict[str, Any]], max_workers: Optional[int] = None
    ) -> None:
        """
        Execute multiple data quality checks concurrently using multiprocessing.

        Optimized for high-volume scenarios where multiple device categories
        need validation simultaneously. Uses process-based parallelism for
        CPU-intensive validation workloads.

        Args:
            validation_requests: List of dicts with keys: device_category, data_type, data, frequency
            max_workers: Maximum number of processes (defaults to CPU count)

        Example:
            >>> requests = [
            ...     {
            ...         'device_category': DeviceCategory.LOWCOST,
            ...         'data_type': DataType.RAW,
            ...         'data': lowcost_df,
            ...         'frequency': Frequency.HOURLY
            ...     },
            ...     {
            ...         'device_category': DeviceCategory.BAM,
            ...         'data_type': DataType.AVERAGED,
            ...         'data': None,
            ...         'frequency': Frequency.HOURLY
            ...     }
            ... ]
            >>> DataUtils.execute_data_quality_checks_bulk(requests)
        """
        if not validation_requests:
            return

        try:

            def process_validation_request(request: Dict[str, Any]) -> Dict[str, Any]:
                """Process a single validation request in separate process."""
                try:
                    DataUtils.__perform_data_quality_checks(
                        device_category=request["device_category"],
                        data_type=request["data_type"],
                        data=request.get("data"),
                        frequency=request.get("frequency", Frequency.HOURLY),
                    )
                except Exception as e:
                    logger.error(
                        f"Data quality check failed for {request['device_category'].value} {request['data_type'].value}: {e}",
                        exc_info=True,
                    )

            # Use process pool for CPU-intensive validation work
            max_workers = max_workers or min(
                len(validation_requests), os.cpu_count() or 2
            )

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all validation requests
                futures = [
                    executor.submit(process_validation_request, request)
                    for request in validation_requests
                ]

                # Fire-and-forget: don't wait for results in production
                # Results could be collected if needed for monitoring
                logger.info(
                    f"Submitted {len(futures)} data quality validation jobs to process pool"
                )

        except Exception as e:
            logger.exception(f"Bulk data quality check failed: {e}", exc_info=True)

    @staticmethod
    def __perform_data_quality_checks(
        device_category: DeviceCategory,
        data_type: DataType,
        data: pd.DataFrame = None,
        frequency: Frequency = Frequency.HOURLY,
    ) -> None:
        """
        Perform synchronous data quality checks on the provided DataFrame based on the device category.

        This function routes the data quality check to the appropriate Great Expectations validation suite
        depending on the type of device. It runs synchronously since Great Expectations validation is
        inherently synchronous. Designed to be called from background threads for non-blocking execution.

        Args:
            device_category: The category of the device (e.g., GAS, LOWCOST)
            data_type: The type of data to work with (e.g., RAW, AVERAGE)
            data: The raw sensor data to be validated (required for RAW data types)
            frequency: The frequency of data processing for determining table names

        Raises:
            ValueError: If device_category or data_type is unsupported
            Exception: If validation execution fails
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

        try:
            if data_type == DataType.RAW:
                # RAW → Pandas-based validation
                source = AirQoGxExpectations.from_pandas()
                method_name = RAW_METHODS.get(device_category)
                if data is None:
                    logger.warning(
                        f"No data provided for RAW validation of {device_category.value}"
                    )
                    return
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
                logger.info(
                    f"Running SQL-based validation for {device_category.value} on {data_asset_name}"
                )
                func(data_asset_name)
            else:
                logger.info(
                    f"Running DataFrame-based validation for {device_category.value} with {len(data)} records"
                )
                func(data)

            logger.info(
                f"Data quality validation completed successfully for {device_category.value} {data_type.value}"
            )

        except Exception as e:
            logger.exception(
                f"Data quality validation failed for {device_category.value} {data_type.value}: {str(e)}"
            )
