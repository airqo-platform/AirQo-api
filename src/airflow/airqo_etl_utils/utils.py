import json
import os
from datetime import datetime, timedelta

import pandas as pd
import requests
from requests import Response

from .constants import ColumnDataType, Pollutant, AirQuality, DataSource
from .date import date_to_str


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
    def populate_missing_columns(data: pd.DataFrame, cols: list) -> pd.DataFrame:
        for col in cols:
            if col not in list(data.columns):
                print(f"{col} missing in dataset")
                data.loc[:, col] = None

        return data


    @staticmethod
    def get_hourly_date_time_values():
        from airqo_etl_utils.date import date_to_str_hours
        from datetime import datetime, timedelta

        hour_of_day = datetime.utcnow() - timedelta(hours=1)
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
        if data_source == DataSource.THINGSPEAK:
            return "12H"
        if data_source == DataSource.AIRNOW:
            return "12H"
        if data_source == DataSource.BIGQUERY:
            return "720H"
        if data_source == DataSource.TAHMO:
            return "24H"
        if data_source == DataSource.AIRQO:
            return "12H"
        if data_source == DataSource.CLARITY:
            return "6H"
        if data_source == DataSource.PURPLE_AIR:
            return "72H"
        return "1H"

    @staticmethod
    def handle_api_error(response: Response):
        try:
            print(response.request.url)
            print(response.request.body)
        except Exception as ex:
            print(ex)
        finally:
            print(response.content)
            print(f"API request failed with status code {response.status_code}")

    @staticmethod
    def query_dates_array(
        data_source: DataSource, start_date_time, end_date_time, freq: str = None
    ):
        frequency = Utils.query_frequency(data_source) if freq is None else freq
        dates = pd.date_range(start_date_time, end_date_time, freq=frequency)
        freq = dates.freq

        if dates.values.size == 1:
            dates = dates.append(pd.Index([pd.to_datetime(end_date_time)]))

        dates = [pd.to_datetime(str(date)) for date in dates.values]
        return_dates = []

        array_last_date_time = dates.pop()
        for date in dates:
            end = date + timedelta(hours=freq.n)
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
