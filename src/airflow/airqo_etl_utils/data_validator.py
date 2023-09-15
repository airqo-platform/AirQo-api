import traceback

import numpy as np
import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import Tenant, ColumnDataType, Frequency
from airqo_etl_utils.date import date_to_str


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
            for col in integers:
                data[col] = data[col].str.replace('[^\d]', '', regex=True)  
                data[col] = data[col].str.strip()  
                data[col] = data[col].replace('', -1)  
                data[col] = data[col].astype(np.int64) 

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
