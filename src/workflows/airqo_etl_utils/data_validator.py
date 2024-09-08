import traceback
from itertools import chain

import numpy as np
import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import Tenant, ColumnDataType, Frequency
from airqo_etl_utils.date import date_to_str
from typing import Any
from .config import configuration


class DataValidationUtils:
    VALID_SENSOR_RANGES = {
        "pm2_5": (1, 1000),
        "pm10": (1, 1000),
        "latitude": (-90, 90),
        "longitude": (-180, 180),
        "battery": (2.7, 5),
        "no2": (0, 2049),
        "altitude": (0, float("inf")),
        "hdop": (0, float("inf")),
        "satellites": (1, 50),
        "temperature": (0, 45),
        "humidity": (0, 99),
        "pressure": (30, 110),
        "tvoc": (0, 10),
        "co2": (400, 3000),
        "hcho": (0, float("inf")),
        "intaketemperature": (0, 45),
        "intakehumidity": (0, 99),
    }

    @staticmethod
    def format_data_types(
        data: pd.DataFrame,
        floats: list = None,
        integers: list = None,
        timestamps: list = None,
    ) -> pd.DataFrame:
        floats = [] if floats is None else floats
        integers = [] if integers is None else integers
        timestamps = [] if timestamps is None else timestamps

        # This drops rows that have data that cannot be converted
        data[floats] = data[floats].apply(pd.to_numeric, errors="coerce")
        data[timestamps] = data[timestamps].apply(pd.to_datetime, errors="coerce")

        # formatting integers
        if integers:
            for col in integers:
                if data[col].dtype != "str":
                    data[col] = data[col].astype(str)
                data[col] = data[col].str.replace("[^\d]", "", regex=True)
                data[col] = data[col].str.strip()
                data[col] = data[col].replace("", -1)
                data[col] = data[col].astype(np.int64)

        return data

    @staticmethod
    def get_valid_value(column_name: str, row_value: Any) -> Any:
        """
        Checks if column values fall with in specific ranges.

        Args:
            column_name(str): Name of column to validate
            row_value(Any): Actual value to validate against valid sensor ranges.

        Return:
            None if value does not fall with in the valid range otherwise returns the value passed.
        """
        if column_name in DataValidationUtils.VALID_SENSOR_RANGES:
            min_val, max_val = DataValidationUtils.VALID_SENSOR_RANGES[column_name]
            if not (min_val <= row_value <= max_val):
                return None

        return row_value

    @staticmethod
    def remove_outliers(data: pd.DataFrame) -> pd.DataFrame:
        big_query_api = BigQueryApi()
        float_columns = set(
            big_query_api.get_columns(table="all", column_type=ColumnDataType.FLOAT)
        )
        integer_columns = set(
            big_query_api.get_columns(table="all", column_type=ColumnDataType.INTEGER)
        )
        timestamp_columns = set(
            big_query_api.get_columns(table="all", column_type=ColumnDataType.TIMESTAMP)
        )

        float_columns = list(float_columns & set(data.columns))
        integer_columns = list(integer_columns & set(data.columns))
        timestamp_columns = list(timestamp_columns & set(data.columns))

        data = DataValidationUtils.format_data_types(
            data=data,
            floats=float_columns,
            integers=integer_columns,
            timestamps=timestamp_columns,
        )

        columns = list(chain(float_columns, integer_columns, timestamp_columns))

        for col in columns:
            name = configuration.AIRQO_DATA_COLUMN_NAME_MAPPING.get(col, None)
            data.loc[:, col] = data[col].apply(
                lambda x: DataValidationUtils.get_valid_value(
                    column_name=name, row_value=x
                )
            )

        return data

    @staticmethod
    def fill_missing_columns(data: pd.DataFrame, cols: list) -> pd.DataFrame:
        for col in cols:
            if col not in list(data.columns):
                print(f"{col} missing in dataframe")
                data.loc[:, col] = None

        return data

    @staticmethod
    def process_for_big_query(dataframe: pd.DataFrame, table: str) -> pd.DataFrame:
        columns = BigQueryApi().get_columns(table)
        dataframe = DataValidationUtils.fill_missing_columns(
            data=dataframe, cols=columns
        )
        dataframe = DataValidationUtils.remove_outliers(dataframe)
        return dataframe[columns]

    @staticmethod
    def process_for_message_broker(
        data: pd.DataFrame, tenant: Tenant, frequency: Frequency = Frequency.HOURLY
    ) -> pd.DataFrame:
        data.loc[:, "frequency"] = str(frequency)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].apply(date_to_str)
        if tenant != Tenant.ALL:
            data.loc[:, "tenant"] = str(tenant)
        return data

    @staticmethod
    def convert_pressure_values(value):
        try:
            return float(value) * 0.1
        except Exception:
            return value

    @staticmethod
    def process_data_for_api(data: pd.DataFrame) -> list:
        restructured_data = []

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        bigquery_api = BigQueryApi()
        cols = bigquery_api.get_columns(bigquery_api.hourly_measurements_table)
        cols.append("battery")
        data = DataValidationUtils.fill_missing_columns(data, cols=cols)

        for _, row in data.iterrows():
            try:
                row_data = {
                    "device": row["device_id"],
                    "device_id": row["mongo_id"],
                    "site_id": row["site_id"],
                    "device_number": row["device_number"],
                    "tenant": str(Tenant.AIRQO),
                    "network": row["tenant"],
                    "location": {
                        "latitude": {"value": row["latitude"]},
                        "longitude": {"value": row["longitude"]},
                    },
                    "frequency": row["frequency"],
                    "time": row["timestamp"],
                    "pm2_5": {
                        "value": row["pm2_5"],
                        "calibratedValue": row["pm2_5_calibrated_value"],
                    },
                    "pm10": {
                        "value": row["pm10"],
                        "calibratedValue": row["pm10_calibrated_value"],
                    },
                    "average_pm2_5": {
                        "value": row["pm2_5"],
                        "calibratedValue": row["pm2_5_calibrated_value"],
                    },
                    "average_pm10": {
                        "value": row["pm10"],
                        "calibratedValue": row["pm10_calibrated_value"],
                    },
                    "no2": {
                        "value": row["no2"],
                        "calibratedValue": row["no2_calibrated_value"],
                    },
                    "s1_pm2_5": {"value": row["s1_pm2_5"]},
                    "s1_pm10": {"value": row["s1_pm10"]},
                    "s2_pm2_5": {"value": row["s2_pm2_5"]},
                    "s2_pm10": {"value": row["s2_pm10"]},
                    "battery": {"value": row["battery"]},
                    "altitude": {"value": row["altitude"]},
                    "speed": {"value": row["wind_speed"]},
                    "satellites": {"value": row["satellites"]},
                    "hdop": {"value": row["hdop"]},
                    "externalTemperature": {"value": row["temperature"]},
                    "externalHumidity": {"value": row["humidity"]},
                    "internalTemperature": {"value": row["device_temperature"]},
                    "internalHumidity": {"value": row["device_humidity"]},
                    "externalPressure": {"value": row["vapor_pressure"]},
                }

                if row_data["site_id"] is None or row_data["site_id"] is np.nan:
                    row_data.pop("site_id")

                restructured_data.append(row_data)

            except Exception as ex:
                traceback.print_exc()
                print(ex)

        return restructured_data
