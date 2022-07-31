import json
import os
from datetime import datetime, timedelta

import pandas as pd

from .constants import DataType
from .date import date_to_str


class Utils:
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
    def get_air_quality(pm2_5: float) -> str:
        if pm2_5 <= 12.09:
            return "Good"
        elif 12.1 <= pm2_5 <= 35.49:
            return "Moderate"
        elif 35.5 <= pm2_5 <= 55.49:
            return "Unhealthy For Sensitive Groups"
        elif 55.5 <= pm2_5 <= 150.49:
            return "Unhealthy"
        elif 150.5 <= pm2_5 <= 250.49:
            return "Very Unhealthy"
        elif pm2_5 >= 250.5:
            return "Hazardous"
        return ""
