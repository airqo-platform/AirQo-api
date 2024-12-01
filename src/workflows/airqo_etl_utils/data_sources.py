import json

import pandas as pd
import requests

from .config import configuration
import logging
from typing import Any, Dict, List, Union, Tuple, Optional

logger = logging.getLogger(__name__)


class DataSourcesApis:
    def __init__(self):
        self.THINGSPEAK_CHANNEL_URL = configuration.THINGSPEAK_CHANNEL_URL

    def query_data(
        self,
        device_number: int,
        start_date_time: str,
        end_date_time: str,
        read_key: str,
    ) -> pd.DataFrame:
        data = pd.DataFrame([])

        try:
            url = f"{self.THINGSPEAK_CHANNEL_URL}{device_number}/feeds.json?start={start_date_time}&end={end_date_time}&api_key={read_key}"
            print(f"{url}")

            response = json.loads(
                requests.get(url, timeout=100.0).content.decode("utf-8")
            )

            if (response != -1) and ("feeds" in response):
                data = pd.DataFrame(response["feeds"])
                data.attrs["meta_data"] = response["channel"]

        except Exception as ex:
            logger.exception(f"An error occured: {ex}")

        return data

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
            logger.info(f"Fetching data from URL: {url}")

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
                f"Device does not have data between {start_date_time} and {end_date_time}"
            )

        return data, meta_data, data_available

    def iqair(
        self, device: Dict[str, Any], resolution: str = "current"
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
        try:
            base_url = device.get("api_code")
            device_id = device.get("serial_number")
            if not base_url or not device_id:
                logger.exception(
                    "Device information must include 'api_code' and 'serial_number'."
                )

            url = f"{base_url}/{device_id}"
            logger.info(f"Fetching data from URL: {url}")

            response = requests.get(url, timeout=10)
            response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
            response_data = response.json()

            if api_resolution in response_data:
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
