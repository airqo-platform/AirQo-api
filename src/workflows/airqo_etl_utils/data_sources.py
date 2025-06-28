import os
from datetime import datetime

from typing import Any, Dict, List, Union, Tuple, Optional

import json
import requests

import pandas as pd

from .utils import Utils
from .config import configuration
import logging

logger = logging.getLogger("airflow.task")


class DataSourcesApis:
    def __init__(self):
        self.THINGSPEAK_CHANNEL_URL = configuration.THINGSPEAK_CHANNEL_URL

    def thingspeak(
        self,
        device_number: int,
        start_date_time: str,
        end_date_time: str,
        read_key: str,
    ) -> Optional[Tuple[List[Dict[str, Any]], Dict[str, Any], bool]]:
        """
        Fetch data from a ThingSpeak channel for a specific device within a time range.

        Args:
            device_number (int): The ThingSpeak channel ID corresponding to the device.
            start_date_time (str): The start timestamp in ISO 8601 format (e.g., "YYYY-MM-DDTHH:mm:ssZ").
            end_date_time (str): The end timestamp in ISO 8601 format.
            read_key (str): The API key to authenticate the request for the specified channel.

        Returns:
            Optional[Tuple[List[Dict[str, Any]], Dict[str, Any], bool]]:
                - A list of dictionaries containing the channel feeds data.
                - A dictionary containing metadata about the channel.
                - Returns `None` if no valid data is found or an error occurs.

        Raises:
            requests.exceptions.RequestException: For issues with the HTTP request.
            ValueError: If the response data is invalid or malformed.
            Exception: For any other unexpected errors.
        """

        data: List[Dict[str, Any]] = None
        meta_data: Dict[str, Any] = None
        data_available: bool = True
        try:
            url = f"{self.THINGSPEAK_CHANNEL_URL}{device_number}/feeds.json?start={start_date_time}&end={end_date_time}&api_key={read_key}"

            response_data = json.loads(
                requests.get(url, timeout=100.0).content.decode("utf-8")
            )
            if (response_data != -1) and ("feeds" in response_data):
                data = response_data.get("feeds", {})
                meta_data = response_data.get("channel", {})

        except requests.exceptions.RequestException as req_err:
            logger.error(f"Request error while fetching ThingSpeak data: {req_err}")
        except ValueError as val_err:
            logger.error(f"Value error: {val_err}")
        except Exception as ex:
            logger.exception(f"An unexpected error occurred: {ex}")

        if not data:
            data_available = False
            logger.exception(
                f"{device_number} does not have data between {start_date_time} and {end_date_time}"
            )

        return data, meta_data, data_available

    def iqair(
        self, device: Dict[str, Any], resolution: str = "instant"
    ) -> Union[List, Dict]:
        """
        Retrieve data from the IQAir API for a specific device and resolution.

        Args:
            device (Dict[str, Any]): A dictionary containing device details, such as:
                - api_code (str): The base URL or endpoint for the API.
                - serial_number (str): The unique identifier for the device.
            resolution (str): The data resolution to retrieve. Options include:
                - "current": Real-time data (default).
                - "instant": Instantaneous measurements.
                - "hourly": Hourly aggregated data.
                - "daily": Daily aggregated data.
                - "monthly": Monthly aggregated data.

        Returns:
            Union[List, Dict]: A list or dictionary containing the retrieved data, or `None` in case of errors or no data.

        Raises:
            ValueError: If an invalid resolution is provided or if the response data is invalid or malformed.
            requests.exceptions.RequestException: For issues with the HTTP request.
            Exception: For any other unexpected errors.
        """
        resolution = configuration.DATA_RESOLUTION_MAPPING.get("iqair").get(
            resolution, "instant"
        )
        valid_resolutions = {"current", "instant", "hourly", "daily", "monthly"}
        historical_resolutions = {"instant", "hourly", "daily", "monthly"}

        if resolution not in valid_resolutions:
            raise ValueError(
                f"Invalid resolution '{resolution}'. Choose from {valid_resolutions}."
            )

        # Determine the appropriate API resolution path
        api_resolution = (
            "historical" if resolution in historical_resolutions else resolution
        )
        data = None
        response_data = None
        try:
            base_url = device.get("api_code", "").rstrip("/")
            device_id = device.get("serial_number")
            if base_url and device_id and not pd.isna(base_url):
                url = f"{base_url}/{device_id}"
                logger.info(f"Fetching data from URL: {url}")

                response = requests.get(url, timeout=10)
                response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
                response_data = response.json()

            if response_data and api_resolution in response_data:
                if resolution == "current":
                    data = response_data.get("current")
                else:
                    historical_data = response_data.get("historical", {})
                    data = historical_data.get(resolution, [])
        except requests.exceptions.RequestException as req_err:
            logger.error(f"Request error while fetching IQAir data: {req_err}")
        except ValueError as val_err:
            logger.error(f"Value error: {val_err}")
        except Exception as ex:
            logger.exception(f"An unexpected error occurred: {ex}")
        return data

    def nomads(self) -> str:
        """
        Downloads a GRIB2 data file from the NOMADS server using a constructed URL,
        and logs the success of the operation.

        Returns:
            Optional[str]: The path to the downloaded file if successful, otherwise None.
        """
        base_url, endpoint, file_name = self.__nomads_url_util()
        url = f"{base_url}{endpoint}"
        response = requests.get(url, timeout=10)
        downloaded_file = Utils.parse_api_response(
            response, base_url, file_name=file_name
        )
        if downloaded_file:
            logger.info(f"GRIB2 file downloaded successfully: {downloaded_file}")
        else:
            logger.warning("Failed to download GRIB2 file from NOMADS.")
            return None

        return downloaded_file

    def __nomads_url_util(
        self, grib_filename: str = "gdas.t00z.pgrb2.0p25.f000"
    ) -> str:
        """
        Constructs a URL to download filtered GDAS 0.25-degree GRIB2 data from the NOMADS (NOAA Operational Model Archive and Distribution System) server.

        The URL includes:
        - A default or user-specified GRIB2 file name.
        - Automatically resolved date using today's date in YYYYMMDD format.
        - Parameters for UGRD and VGRD (wind components) at 10 meters above ground.

        Parameters:
            grib_filename(str): The GRIB2 file name to fetch. Defaults to GDAS 00z forecast step 0.

        Returns:
            str: Fully formed NOMADS data request URL.
        """
        today_str = datetime.today().strftime("%Y%m%d")
        base_url = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gdas_0p25.pl"
        endpoint = (
            f"?dir=%2Fgdas.{today_str}%2F00%2Fatmos"
            f"&file={grib_filename}"
            f"&var_UGRD=on&var_VGRD=on"
            f"&lev_10_m_above_ground=on"
        )

        return base_url, endpoint, grib_filename
