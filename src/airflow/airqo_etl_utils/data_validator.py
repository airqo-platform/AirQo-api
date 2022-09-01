import numpy as np
import pandas as pd


class DataValidationUtils:
    @staticmethod
    def format_data_types(data: pd.DataFrame, col_data_types: dict) -> pd.DataFrame:

        # formatting floats
        float_columns = col_data_types.get("float", [])
        data[float_columns] = data[float_columns].apply(pd.to_numeric, errors="coerce")

        # formatting integers
        integer_columns = col_data_types.get("integer", [])

        null_data = data[data[integer_columns].isnull().all(axis=1)]
        not_null_data = data[data[integer_columns].notnull().all(axis=1)]
        not_null_data[integer_columns] = not_null_data[integer_columns].apply(np.int64)

        data = pd.concat([null_data, not_null_data], ignore_index=True)

        # formatting timestamp
        timestamp_columns = col_data_types.get("timestamp", [])
        data[timestamp_columns] = data[timestamp_columns].apply(
            pd.to_datetime, errors="coerce"
        )

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
        float_columns = {
            "battery",
            "hdop",
            "altitude",
            "satellites",
            "pm2_5",
            "pm2_5_pi",
            "pm10",
            "pm10_pi",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "no2",
            "no2_raw_value",
            "pm1",
            "pm1_pi",
            "pm1_raw_value",
            "temperature",
            "external_temperature",
            "filter_temperature",
            "device_temperature",
            "latitude",
            "longitude",
            "humidity",
            "device_humidity",
            "filter_humidity",
            "external_humidity",
            "pressure",
            "barometric_pressure",
            "wind_speed",
            "wind_direction",
            "speed",
            "realtime_conc",
            "hourly_conc",
            "short_time_conc",
            "air_flow",
        }

        integer_columns = {
            "status",
        }

        float_columns = list(float_columns & set(data.columns))
        integer_columns = list(integer_columns & set(data.columns))

        col_data_types = {
            "float": float_columns,
            "integer": integer_columns,
            "timestamp": ["timestamp"],
        }
        data = DataValidationUtils.format_data_types(
            data=data, col_data_types=col_data_types
        )

        for col in float_columns:
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
            elif name in ["device_humidity", "humidity", "external_humidity"]:
                name = "humidity"
            elif col in ["device_temperature", "temperature", "external_temperature"]:
                name = "temperature"
            elif name in ["no2", "no2_raw_value"]:
                name = "no2"
            elif name in ["pm1", "pm1_raw_value", "pm1_pi"]:
                name = "pm1"

            data[col] = data[col].apply(
                lambda x: DataValidationUtils.get_valid_value(x, name)
            )

        return data
