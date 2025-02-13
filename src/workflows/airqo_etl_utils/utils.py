import json
import os
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests
from requests import Response
from google.cloud import storage
import joblib

from .constants import ColumnDataType, Pollutant, AirQuality, DataSource, Frequency
from .date import date_to_str

from typing import List, Optional


class Utils:
    @staticmethod
    def get_country_boundaries(country):
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
    def remove_suffix(string: str, suffix):
        if string.endswith(suffix):
            return string[: -len(suffix)]
        else:
            return string[:]

    @staticmethod
    def epa_pollutant_category(value: float, pollutant: Pollutant) -> str:
        if not value:
            return ""

        if pollutant == Pollutant.PM10:
            if value < 55:
                return str(AirQuality.GOOD)
            elif 55 <= value < 155:
                return str(AirQuality.MODERATE)
            elif 155 <= value < 255:
                return str(AirQuality.UNHEALTHY_FSGs)
            elif 255 <= value < 355:
                return str(AirQuality.UNHEALTHY)
            elif 355 <= value < 425:
                return str(AirQuality.VERY_UNHEALTHY)
            elif value >= 425:
                return str(AirQuality.HAZARDOUS)

        elif pollutant == Pollutant.PM2_5:
            if value < 12.1:
                return str(AirQuality.GOOD)
            elif 12.1 <= value < 35.5:
                return str(AirQuality.MODERATE)
            elif 35.5 <= value < 55.5:
                return str(AirQuality.UNHEALTHY_FSGs)
            elif 55.5 <= value < 150.5:
                return str(AirQuality.UNHEALTHY)
            elif 150.5 <= value < 250.5:
                return str(AirQuality.VERY_UNHEALTHY)
            elif value >= 250.5:
                return str(AirQuality.HAZARDOUS)

        elif pollutant == Pollutant.NO2:
            if value < 54:
                return str(AirQuality.GOOD)
            elif 54 <= value < 101:
                return str(AirQuality.MODERATE)
            elif 101 <= value < 361:
                return str(AirQuality.UNHEALTHY_FSGs)
            elif 361 <= value < 650:
                return str(AirQuality.UNHEALTHY)
            elif 650 <= value < 1250:
                return str(AirQuality.VERY_UNHEALTHY)
            elif value >= 1250:
                return str(AirQuality.HAZARDOUS)

        return ""

    @staticmethod
    def populate_missing_columns(
        data: pd.DataFrame, columns: List[str]
    ) -> pd.DataFrame:
        """
        Adds columns from `cols` to the `data`, populating them with None if they are not already present in `data`.

        Args:
            data(pandasDataFrame):
            cols(list): A list of columns to check/create in the shared dataframe.

        Returns:
            An updated pandas dataframe with missing columns populated with None if there were any.
        """
        data_cols = data.columns.to_list()
        for column in columns:
            if column not in data_cols:
                print(f"{column} missing in dataset")
                data[column] = None
        return data

    @staticmethod
    def get_hourly_date_time_values():
        from airqo_etl_utils.date import date_to_str_hours
        from datetime import datetime, timedelta

        hour_of_day = datetime.now(timezone.utc) - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        return start_date_time, end_date_time

    @staticmethod
    def get_tenant(**kwargs) -> str:
        try:
            dag_run = kwargs.get("dag_run")
            tenant = dag_run.conf["tenant"]
        except KeyError:
            tenant = None

        return tenant

    @staticmethod
    def format_dataframe_column_type(
        dataframe: pd.DataFrame,
        data_type: ColumnDataType,
        columns: list,
    ) -> pd.DataFrame:
        if not columns:
            return dataframe
        if data_type == ColumnDataType.FLOAT:
            dataframe[columns] = dataframe[columns].apply(
                pd.to_numeric, errors="coerce"
            )

        if data_type == ColumnDataType.TIMESTAMP:
            dataframe[columns] = dataframe[columns].apply(
                pd.to_datetime, errors="coerce"
            )

        if data_type == ColumnDataType.TIMESTAMP_STR:
            dataframe[columns] = dataframe[columns].apply(
                pd.to_datetime, errors="coerce"
            )

            def _date_to_str(date: datetime):
                try:
                    return date_to_str(date=date)
                except Exception:
                    return None

            for column in columns:
                dataframe[column] = dataframe[column].apply(_date_to_str)

        return dataframe

    @staticmethod
    def load_schema(file_name: str):
        path, _ = os.path.split(__file__)
        file_name_path = f"schema/{file_name}"
        try:
            file_json = open(os.path.join(path, file_name_path))
        except FileNotFoundError:
            file_json = open(os.path.join(path, file_name))

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
        return_dates = []

        array_last_date_time = dates.pop()
        for date in dates:
            end = date + timedelta(hours=frequency.n)
            if end > array_last_date_time:
                end = array_last_date_time
            return_dates.append((date_to_str(date), date_to_str(end)))

        return return_dates

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
    def get_calibration_model_path(city, pollutant: str):
        """
        Constructs the file path for the calibration model based on the given city and pollutant.

        For the pollutant "pm2_5", the calibration model file is assumed to be a random forest model
        with the suffix "_rf.pkl". For any other pollutant, the model file is assumed to be a lasso
        regression model with the suffix "_lasso.pkl". The file path is constructed by concatenating
        the city's value (assumed to be accessible via the 'value' attribute) with the corresponding model suffix.

        Args:
            city: An object representing a city. This object is expected to have a 'value' attribute that
                serves as the base for the model path.
            pollutant (str): The pollutant identifier (e.g., "pm2_5") used to determine the type of calibration model.

        Returns:
            str: The constructed calibration model file path.
        """
        model_type = "_rf.pkl" if pollutant == "pm2_5" else "_lasso.pkl"
        return f"{city.value}{model_type}"
