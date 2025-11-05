import json
import os
import asyncio
from threading import Thread
from datetime import timedelta
import pandas as pd
from http.client import HTTPResponse
import simplejson

import requests
from typing import (
    Any,
    Dict,
    Tuple,
    Coroutine,
    Optional,
    Generic,
    TypeVar,
    Union,
)
from dataclasses import dataclass
from cryptography.fernet import Fernet

from .constants import (
    Pollutant,
    DataSource,
    CountryModels,
    CityModels,
    QualityCategorization,
)
from .date import date_to_str
from .config import configuration as Config

import logging

logger = logging.getLogger("airflow.task")

AsyncTask = Coroutine[Any, Any, Any]

T = TypeVar("T")


@dataclass
class Result(Generic[T]):
    """
    Represents the result of an operation, which may contain data or an error message.

    Attributes:
        data (Optional[T]): The result data. This will be None if the operation failed or no data is available.
        error (Optional[str]): An error message if the operation failed; otherwise, None.
    """

    data: Optional[T] = None
    error: Optional[str] = None


class Utils:
    @staticmethod
    def get_country_boundaries(country: str) -> Dict[str, Any]:
        """
        Fetch the geographic bounding box of a given country using the Nominatim OpenStreetMap API.

        Args:
            country(str): The name of the country to retrieve boundaries for.

        Returns:
            Dict: A dictionary containing the country's bounding box coordinates with keys:
                - "west" (float): Western boundary longitude
                - "east" (float): Eastern boundary longitude
                - "south" (float): Southern boundary latitude
                - "north" (float): Northern boundary latitude

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
        """
        Classifies air quality based on pollutant concentration using EPA standards.

        Args:
            value (float | None): The concentration of the pollutant.
            pollutant (Pollutant): The type of pollutant (PM10, PM2.5, NO2).

        Returns:
            str: The air quality category as defined by the EPA.

        Air Quality Categories:
            - GOOD
            - MODERATE
            - UNHEALTHY FOR SENSITIVE GROUPS (FSGs)
            - UNHEALTHY
            - VERY UNHEALTHY
            - HAZARDOUS

        If the pollutant is not recognized, an empty string is returned.
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
        """
        Load a JSON schema file from the "schema" directory or the given file path.

        Args:
            file_name(str): The name of the schema file to load.

        Returns:
            Dict: The parsed JSON content of the schema file.

        Raises:
            FileNotFoundError: If the file is not found in either the "schema" directory or the given path.
        """
        path, _ = os.path.split(__file__)
        file_name_path = f"schema/{file_name}"
        try:
            file_json = open(os.path.join(path, file_name_path))
        except FileNotFoundError:
            file_json = open(os.path.join(path, file_name))
            logger.exception(f"Schema not found at {file_name_path}")

        return json.load(file_json)

    @staticmethod
    def query_frequency(data_source: DataSource) -> str:
        """
        Determines the query frequency for a given data source.

        This function maps a specified data source to a corresponding frequency string,
        which is used to schedule data queries or processing intervals. If the data source
        is not recognized, a default frequency of "1H" (one hour) is returned.

        Args:
            data_source (DataSource): The data source for which the query frequency is required.

        Returns:
            str: The frequency string associated with the data source (e.g., "12H" for 12 hours).
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
    ):
        """
        Generates an array of date ranges based on the specified time period and frequency.

        This function creates an array of date ranges starting from `start_date_time` to `end_date_time`,
        with each range having a frequency determined by `freq`. If `freq` is not provided, it is retrieved
        from the `Utils.query_frequency()` method based on the provided `data_source`. The date ranges are
        split such that each range's end time does not exceed the specified `end_date_time`. The function returns
        a list of tuples, where each tuple represents a start and end date in string format.

        Args:
            data_source(DataSource): The source of data to determine frequency.
            start_date_time(str): The start date and time for the query range.
            end_date_time(str): The end date and time for the query range.

        Returns:
            list: A list of tuples, where each tuple contains the start and end date (as strings) for each time range within the specified period.
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
            dates_new.append((date_to_str(date), date_to_str(end)))
        return dates_new

    @staticmethod
    def year_months_query_array(year: int):
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
    def test_data(data: pd.DataFrame, bucket_name: str, destination_file: str):
        from google.cloud import storage

        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_file)
        data.reset_index(drop=True, inplace=True)
        blob.upload_from_string(data.to_csv(index=False), "text/csv")

        print(
            "{} with contents {} has been uploaded to {}.".format(
                destination_file, len(data), bucket_name
            )
        )

    @staticmethod
    def get_calibration_model_path(calibrateby: Any, pollutant: str) -> str:
        """
        Constructs the file path for the calibration model based on the given  or country and pollutant.

        For the pollutant "pm2_5", the calibration model file is assumed to be a random forest model
        with the suffix "_rf.pkl". For any other pollutant, the model file is assumed to be a lasso
        regression model with the suffix "_lasso.pkl". The file path is constructed by concatenating
        the city's value (assumed to be accessible via the 'value' attribute) with the corresponding model suffix.

        Args:
            calibrateby: An object representing a city or country. This object is expected to have a 'value' attribute that
                serves as the base for the model path.
            pollutant (str): The pollutant identifier (e.g., "pm2_5") used to determine the type of calibration model.

        Returns:
            str: The constructed calibration model file path.
        """
        model_type = "_rf.pkl" if pollutant == "pm2_5" else "_lasso.pkl"
        if isinstance(calibrateby, (CountryModels, CityModels)):
            return f"{calibrateby.str}{model_type}"

        return f"{calibrateby}{model_type}"

    @staticmethod
    def execute_and_forget_async_task(job: AsyncTask) -> None:
        """
        Executes an asynchronous coroutine in a background daemon thread without blocking the main thread.

        This function is useful for "execute-and-forget" style background tasks, where the result of the coroutine is not needed immediately, and you don't want the main application to wait for its completion.

        Args:
            job(Coroutine): An awaitable coroutine object to be executed asynchronously.

        Notes:
            - The coroutine is executed inside a new event loop.
            - The thread is marked as a daemon, so it won't prevent the program from exiting.
            - Exceptions in the coroutine are not propagated to the main thread. Handle them within the coroutine.
        """

        def _run():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(job())
            finally:
                loop.close()

        Thread(target=_run, daemon=True).start()

    @staticmethod
    def parse_api_response(
        response: HTTPResponse, url: str, file_name: Optional[str] = None
    ) -> Optional[Any]:
        """
        Parses an HTTP API response and handles two types of expected responses:

        1. If the response contains JSON and is within the 2xx range, it attempts to parse and return the JSON content.
        2. If the response is binary (non-JSON), it saves the file to `/tmp/{file_name}`.

        Args:
            response(HTTPResponse): The response object returned from an HTTP client.
            url(str): The URL used to make the request (for logging/debugging purposes).
            file_name(Optional[str]): The file name (without path) to use when saving binary responses.

        Returns:
            Optional[Any]:
                - Parsed JSON object if response is valid JSON.
                - True if binary file is saved successfully.
                - None if parsing or saving fails.
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
                    filepath = os.path.join("/tmp", file_name)
                    with open(filepath, "wb") as f:
                        f.write(content)
                    logger.info(f"Binary response saved to: {filepath}")
                    return filepath
                except Exception as e:
                    logger.exception(f"Failed to parse or save binary response: {e}")
        return None

    @staticmethod
    def encrypt_key(data: str) -> str:
        """
        Encrypts a given string using a secret key.

        Args:
            data (str): The string to be encrypted.

        Returns:
            str: The encrypted string (token).

        Raises:
            ValueError: If the secret key is not properly configured or invalid.
            TypeError: If the input data is not a string.

        Note:
            The encryption process relies on the `Config.SECRET_KEY` being a valid key
            for the Fernet encryption scheme.
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
            # raise ValueError("Encryption failed due to an error.") from e

    @staticmethod
    def decrypt_key(token: bytes) -> str:
        """
        Decrypts an encrypted token using a secret key.

        Args:
            token (str): The encrypted token to be decrypted.

        Returns:
            str: The decrypted token as a UTF-8 string.

        Raises:
            InvalidToken: If the token cannot be decrypted due to an invalid or incorrect secret key.
        """
        try:
            if not isinstance(token, bytes):
                raise TypeError("Input token must be a bytes.")
            secret_key = bytes(Config.SECRET_KEY, "utf-8")
            cipher_suite = Fernet(secret_key)
            decrypted = cipher_suite.decrypt(token)
            return decrypted.decode("utf-8")
        except Exception as e:
            logger.exception(f"Failed to decrypt token: {e}")
            # raise ValueError("Decryption failed due to an error.") from e
