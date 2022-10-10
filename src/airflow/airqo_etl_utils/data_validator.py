import numpy as np
import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import Tenant, ColumnDataType
from airqo_etl_utils.utils import Utils


class DataValidationUtils:
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

        data[floats] = data[floats].apply(pd.to_numeric, errors="coerce")
        data[timestamps] = data[timestamps].apply(pd.to_datetime, errors="coerce")

        # formatting integers
        if integers:
            integers_data = data.copy()[integers]
            integers_data.fillna(value=-1, inplace=True)
            data.fillna(integers_data, inplace=True)
            data[integers] = data[integers].apply(np.int64)

        return data

    @staticmethod
    def get_valid_value(value, name):

        if (name == "pm2_5" or name == "pm10") and (value < 1 or value > 1000):
            return None
        elif name == "latitude" and (value < -90 or value > 90):
            return None
        elif name == "longitude" and (value < -180 or value > 180):
            return None
        elif name == "battery" and (value < 2.7 or value > 5):
            return None
        elif name == "no2" and (value < 0 or value > 2049):
            return None
        elif (name == "altitude" or name == "hdop") and value <= 0:
            return None
        elif name == "satellites" and (value <= 0 or value > 50):
            return None
        elif (name == "temperature") and (value <= 0 or value > 45):
            return None
        elif (name == "humidity") and (value <= 0 or value > 99):
            return None
        elif name == "pressure" and (value < 30 or value > 110):
            return None
        else:
            pass

        return value

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

        columns = []
        columns.extend(float_columns)
        columns.extend(integer_columns)
        columns.extend(timestamp_columns)

        for col in columns:
            name = col
            if name in [
                "pm2_5",
                "s1_pm2_5",
                "s2_pm2_5",
                "pm2_5_pi",
                "pm2_5_raw_value",
                "pm2_5_calibrated_value",
            ]:
                name = "pm2_5"
            elif name in [
                "pm10",
                "s1_pm10",
                "s2_pm10",
                "pm10_pi",
                "pm10_raw_value",
                "pm10_calibrated_value",
            ]:
                name = "pm10"
            elif name in ["device_humidity", "humidity"]:
                name = "humidity"
            elif col in ["device_temperature", "temperature"]:
                name = "temperature"
            elif name in ["no2", "no2_raw_value", "no2_calibrated_value"]:
                name = "no2"
            elif name in ["pm1", "pm1_raw_value", "pm1_pi"]:
                name = "pm1"

            data.loc[:, col] = data[col].apply(
                lambda x: DataValidationUtils.get_valid_value(x, name)
            )

        return data

    @staticmethod
    def process_for_big_query(
        dataframe: pd.DataFrame, table: str, tenant: Tenant
    ) -> pd.DataFrame:
        from airqo_etl_utils.bigquery_api import BigQueryApi

        columns = BigQueryApi().get_columns(table)
        if tenant != Tenant.ALL:
            dataframe.loc[:, "tenant"] = str(tenant)
        dataframe = Utils.populate_missing_columns(data=dataframe, cols=columns)
        return dataframe[columns]

    @staticmethod
    def convert_pressure_values(value):
        try:
            return float(value) * 0.1
        except Exception:
            return value
