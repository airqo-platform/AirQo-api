import json
import os
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from .constants import DataType, Pollutant, AirQuality, DataSource
from .date import date_to_str


class Utils:
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
                data[col] = None

        return data

    @staticmethod
    def get_dag_date_time_config(interval_in_days: int = 1, **kwargs):
        try:
            dag_run = kwargs.get("dag_run")
            start_date_time = dag_run.conf["start_date_time"]
            end_date_time = dag_run.conf["end_date_time"]
        except KeyError:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=interval_in_days)
            start_date_time = datetime.strftime(start_date, "%Y-%m-%dT00:00:00Z")
            end_date_time = datetime.strftime(end_date, "%Y-%m-%dT11:59:59Z")

        return start_date_time, end_date_time

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
        data_type: DataType,
        columns: list,
    ) -> pd.DataFrame:
        if not columns:
            return dataframe
        if data_type == DataType.FLOAT:
            dataframe[columns] = dataframe[columns].apply(
                pd.to_numeric, errors="coerce"
            )

        if data_type == DataType.TIMESTAMP:
            dataframe[columns] = dataframe[columns].apply(
                pd.to_datetime, errors="coerce"
            )

        if data_type == DataType.TIMESTAMP_STR:
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
        if data_source == DataSource.TAHMO:
            return "12H"
        if data_source == DataSource.AIRQO:
            return "12H"
        if data_source == DataSource.CLARITY:
            return "6H"
        if data_source == DataSource.PURPLE_AIR:
            return "72H"
        return "1H"

    @staticmethod
    def query_dates_array(data_source: DataSource, start_date_time, end_date_time):
        frequency = Utils.query_frequency(data_source)
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
