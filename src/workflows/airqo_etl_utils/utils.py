import json
import os
from datetime import datetime, timedelta, timezone
import pandas as pd
import requests
from requests import Response
from typing import List, Any, Dict, Tuple

from .constants import (
    ColumnDataType,
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
    def handle_api_error(response: Response):
        try:
            print("URL:", response._request_url)
            print("Response:", response.data)
        except Exception as ex:
            print("Error while handling API error:", ex)
        finally:
            print("API request failed with status code:", response.status)

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
        dates = pd.date_range(start_date_time, end_date_time, freq=freq)
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
        if isinstance(calibrateby, CountryModels) or isinstance(
            calibrateby, CityModels
        ):
            return f"{calibrateby.value}{model_type}"

        return f"{calibrateby}{model_type}"
