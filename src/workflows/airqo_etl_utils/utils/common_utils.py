"""Common utilities for data processing, security, and API interactions."""

import asyncio
import logging
import json
import os
import ast
from threading import Thread
from datetime import timedelta
from dataclasses import dataclass
from typing import Any, Dict, Tuple, Coroutine, Optional, Generic, TypeVar, List
from http.client import HTTPResponse
from cryptography.fernet import Fernet
import requests
import pandas as pd
import simplejson

from ..constants import (
    Pollutant,
    DataSource,
    CountryModels,
    CityModels,
    QualityCategorization,
)
from ..date import DateUtils
from ..config import configuration as Config

logger = logging.getLogger("airflow.task")

AsyncTask = Coroutine[Any, Any, Any]

T = TypeVar("T")


@dataclass
class Result(Generic[T]):
    """Result of an operation, which may contain data or an error message.

    Attributes:
        data: The result data. None if the operation failed or no data is available.
        error: An error message if the operation failed; otherwise, None.
    """

    data: Optional[T] = None
    error: Optional[str] = None


class Utils:
    """Utility methods for air quality data processing, security, and API interactions."""

    @staticmethod
    def get_country_boundaries(country: str) -> Dict[str, Any]:
        """Fetch the geographic bounding box of a country using the Nominatim OSM API.

        Args:
            country: The name of the country.

        Returns:
            Dict with keys "west", "east", "south", "north" (float values).

        Raises:
            IndexError: If the API response does not contain valid bounding box data.
            requests.RequestException: If the API request fails.
        """
        response = requests.get(
            f"https://nominatim.openstreetmap.org/search?q={country}&format=json"
        )
        bounding_box = response.json()[0]["boundingbox"]
        return {
            "west": float(bounding_box[0]),
            "east": float(bounding_box[1]),
            "south": float(bounding_box[2]),
            "north": float(bounding_box[3]),
        }

    @staticmethod
    def epa_pollutant_category(value: float, pollutant: Pollutant) -> str:
        """Classify air quality based on pollutant concentration using EPA standards.

        Args:
            value: The concentration of the pollutant.
            pollutant: The type of pollutant (PM10, PM2.5, NO2).

        Returns:
            The air quality category string (e.g., "GOOD", "MODERATE", "UNHEALTHY").
            Empty string if pollutant is not recognized.
        """
        if value is None:
            return ""

        categories: Dict[
            Tuple[float, QualityCategorization]
        ] = Config.AIR_QUALITY_CATEGORY

        if pollutant in categories:
            for threshold, category in categories.get(pollutant):
                if value < threshold:
                    return category.str

        return ""

    @staticmethod
    def load_schema(file_name: str) -> Dict:
        """Load a JSON schema file from the "schema" directory.

        Args:
            file_name: The name of the schema file to load.

        Returns:
            Parsed JSON content of the schema file.

        Raises:
            FileNotFoundError: If the file is not found.
        """
        path, _ = os.path.split(__file__)
        file_name_path = f"../schema/{file_name}"
        try:
            file_json = open(os.path.join(path, file_name_path))
        except FileNotFoundError:
            file_json = open(os.path.join(path, file_name))
            logger.exception(f"Schema not found at {file_name_path}")

        return json.load(file_json)

    @staticmethod
    def query_frequency(data_source: DataSource) -> str:
        """Determine the query frequency for a given data source.

        Args:
            data_source: The data source enum value.

        Returns:
            Frequency string (e.g., "12H", "24H"). Defaults to "1H" if unknown.
        """
        frequency_map = {
            DataSource.THINGSPEAK: "12H",
            DataSource.AIRNOW: "12H",
            DataSource.BIGQUERY: "720H",
            DataSource.TAHMO: "24H",
            DataSource.AIRQO: "12H",
            DataSource.CLARITY: "6H",
            DataSource.PURPLE_AIR: "72H",
        }
        return frequency_map.get(data_source, "1H")

    @staticmethod
    def query_dates_array(
        data_source: DataSource,
        start_date_time,
        end_date_time,
    ) -> List[Tuple[str, str]]:
        """Generate date ranges based on the specified time period and frequency.

        Creates an array of date ranges starting from `start_date_time` to `end_date_time`,
        with each range having a frequency determined by the data source.

        Args:
            data_source: The source of data to determine frequency.
            start_date_time: The start date and time for the query range.
            end_date_time: The end date and time for the query range.

        Returns:
            List of tuples containing (start_date_str, end_date_str) for each time range.

        Raises:
            ValueError: If dates cannot be parsed.
        """
        freq = Utils.query_frequency(data_source)
        try:
            start_dt = pd.to_datetime(start_date_time)
            end_dt = pd.to_datetime(end_date_time)
        except Exception as e:
            raise ValueError(
                f"Invalid date format for start_date_time or end_date_time: {e}. "
                "Expected ISO 8601 or pandas-recognized date string."
            )
        dates = pd.date_range(start_dt, end_dt, freq=freq)
        frequency = dates.freq

        if dates.values.size == 1:
            dates = dates.append(pd.Index([pd.to_datetime(end_date_time)]))

        dates = [pd.to_datetime(str(date)) for date in dates.values]
        dates_new = []

        array_last_date_time = dates.pop()
        for date in dates:
            end = date + timedelta(hours=frequency.n)
            if end > array_last_date_time:
                end = array_last_date_time
            dates_new.append((DateUtils.date_to_str(date), DateUtils.date_to_str(end)))
        return dates_new

    @staticmethod
    def year_months_query_array(year: int):
        """Generate query date ranges for all months of a given year.

        Args:
            year: The year to generate month ranges for.

        Returns:
            List of (start_date_str, end_date_str) tuples for each month.
        """
        months = [
            "01",
            "02",
            "03",
            "04",
            "05",
            "06",
            "07",
            "08",
            "09",
            "10",
            "11",
            "12",
        ]
        last_month = months.pop()
        dates = []
        for month in months:
            next_month = f"{int(month) + 1}"
            if len(next_month) != 2:
                next_month = f"0{next_month}"
            dates.append(
                (f"{year}-{month}-01T00:00:00Z", f"{year}-{next_month}-01T00:00:00Z")
            )

        dates.append(
            (f"{year}-{last_month}-01T00:00:00Z", f"{int(year) + 1}-01-01T00:00:00Z")
        )

        return dates

    @staticmethod
    def get_calibration_model_path(calibrateby: Any, pollutant: str) -> str:
        """Construct the file path for a calibration model.

        Args:
            calibrateby: City or country object with a 'str' attribute.
            pollutant: Pollutant identifier (e.g., "pm2_5").

        Returns:
            The model file path (e.g., "city_name_rf.pkl").
        """
        model_type = "_rf.pkl" if pollutant == "pm2_5" else "_lasso.pkl"
        if isinstance(calibrateby, (CountryModels, CityModels)):
            return f"{calibrateby.str}{model_type}"

        return f"{calibrateby}{model_type}"

    @staticmethod
    def execute_and_forget_async_task(job: AsyncTask) -> None:
        """Execute an asynchronous coroutine in a background thread.

        Ensures async tasks run to completion without resource leaks. The thread
        is non-daemon to prevent premature termination.

        Args:
            job: An awaitable coroutine object to be executed asynchronously.
        """

        def _run():
            loop = None
            try:
                # Create and set new event loop for this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

                # Run the coroutine to completion
                loop.run_until_complete(job())

            except Exception as e:
                logger.exception(f"Async task failed: {e}")
            finally:
                # Ensure proper cleanup
                if loop and not loop.is_closed():
                    loop.close()

        # Use non-daemon thread to ensure completion
        thread = Thread(target=_run, daemon=False)
        thread.start()

        # Don't join() to maintain "fire and forget" behavior

    @staticmethod
    def parse_api_response(
        response: HTTPResponse, url: str, file_name: Optional[str] = None
    ) -> Optional[Any]:
        """Parse an HTTP API response handling JSON or binary content.

        Args:
            response: The response object from an HTTP client.
            url: The URL used to make the request (for logging).
            file_name: File name to use when saving binary responses to `/tmp/`.

        Returns:
            Parsed JSON object if successful JSON response.
            True if binary file is saved successfully.
            None if parsing or saving fails.
        """
        status = getattr(response, "status_code", getattr(response, "status", None))
        content = getattr(response, "content", getattr(response, "data", None))

        if status is None:
            logger.error(f"Unable to determine response status from {url}")

        if 200 <= status < 300:
            if not content:
                logger.warning(f"No response data returned from request: {url}")
                return None
            try:
                return simplejson.loads(content)
            except simplejson.JSONDecodeError:
                logger.exception("Response can't be parsed")
            except UnicodeDecodeError:
                logger.exception("Response can't be parsed. Might be a file")
                try:
                    if file_name:
                        with open(f"/tmp/{file_name}", "wb") as f:
                            f.write(content)
                        return True
                except Exception as e:
                    logger.error(f"Failed to save binary file: {e}")

        return None

    @staticmethod
    def encrypt_key(data: str) -> str:
        """Encrypt a string using Fernet.

        Args:
            data: The string to be encrypted.

        Returns:
            The encrypted string (token).

        Raises:
            ValueError: If encryption fails.
            TypeError: If input data is not a string.
        """
        try:
            if not isinstance(data, str):
                raise TypeError("Input data must be a string.")
            secret_key = bytes(Config.SECRET_KEY, "utf-8")
            cipher_suite = Fernet(secret_key)
            token = cipher_suite.encrypt(data.encode("utf-8"))
            return token.decode("utf-8")
        except Exception as e:
            logger.exception(f"Failed to encrypt data: {e}")

    @staticmethod
    def decrypt_key(token: bytes) -> str:
        """Decrypt an encrypted token using Fernet.

        Args:
            token: The encrypted token (bytes).

        Returns:
            The decrypted token as a UTF-8 string.

        Raises:
            InvalidToken: If the token cannot be decrypted.
        """
        try:
            if not isinstance(token, bytes):
                raise TypeError("Input token must be bytes.")
            secret_key = bytes(Config.SECRET_KEY, "utf-8")
            cipher_suite = Fernet(secret_key)
            decrypted = cipher_suite.decrypt(token)
            return decrypted.decode("utf-8")
        except Exception as e:
            logger.exception(f"Failed to decrypt token: {e}")


# Utility functions for file and data handling


def delete_old_files(files: List[str]) -> None:
    """Delete the specified list of files if they exist.

    Args:
        files: A list of file paths to delete.

    Logs:
        - Info message for each successfully deleted file.
        - Warning message if deletion fails for a file.
    """
    for file_path in files:
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"Deleted file: {file_path}")
            else:
                logger.debug(f"File not found, skipping: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to delete file '{file_path}': {e}")


def drop_rows_with_bad_data(
    data_type: str, data: pd.DataFrame, exclude: Optional[List[str]] = None
) -> pd.DataFrame:
    """Remove rows where most numeric values are missing.

    Args:
        data_type: The data type to filter columns by (e.g., "number" for numeric).
        data: The input DataFrame to process.
        exclude: Column names to exclude from the check.

    Returns:
        Filtered DataFrame where rows have at least two non-null values in
        selected numeric columns.
    """
    if exclude is None:
        exclude = []
    numeric_columns = data.select_dtypes(include=[data_type]).columns.difference(
        exclude
    )
    return data[data[numeric_columns].count(axis=1) > 1]


def has_valid_dict(value: str) -> bool:
    """Check whether a string represents a valid, non-empty dictionary.

    Args:
        value: A string potentially representing a dictionary.

    Returns:
        True if the input is a string representation of a non-empty dict,
        False otherwise.
    """
    try:
        if not isinstance(value, str):
            return False
        parsed = ast.literal_eval(value)
        return isinstance(parsed, dict) and len(parsed) > 0
    except (ValueError, SyntaxError):
        return False
