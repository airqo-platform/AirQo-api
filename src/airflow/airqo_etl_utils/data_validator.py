import pandas as pd

from .commons import get_valid_value


class DataValidationUtils:
    @staticmethod
    def get_valid_values(raw_value: pd.DataFrame) -> pd.DataFrame:
        valid_data = raw_value.copy()
        columns = valid_data.columns

        if "timestamp" in columns:
            valid_data["timestamp"] = valid_data["timestamp"].apply(
                lambda x: pd.to_datetime(x, errors="coerce")
            )

        if "battery" in columns:
            valid_data["battery"] = valid_data["battery"].apply(
                lambda x: get_valid_value(x, "battery")
            )

        if "hdop" in columns:
            valid_data["hdop"] = valid_data["hdop"].apply(
                lambda x: get_valid_value(x, "hdop")
            )

        if "altitude" in columns:
            valid_data["altitude"] = valid_data["altitude"].apply(
                lambda x: get_valid_value(x, "altitude")
            )

        if "satellites" in columns:
            valid_data["satellites"] = valid_data["satellites"].apply(
                lambda x: get_valid_value(x, "satellites")
            )

        if "pm2_5" in columns:
            valid_data["pm2_5"] = valid_data["pm2_5"].apply(
                lambda x: get_valid_value(x, "pm2_5")
            )

        if "s1_pm2_5" in columns:
            valid_data["s1_pm2_5"] = valid_data["s1_pm2_5"].apply(
                lambda x: get_valid_value(x, "pm2_5")
            )

        if "pm10" in columns:
            valid_data["pm10"] = valid_data["pm10"].apply(
                lambda x: get_valid_value(x, "pm10")
            )

        if "s1_pm10" in columns:
            valid_data["s1_pm10"] = valid_data["s1_pm10"].apply(
                lambda x: get_valid_value(x, "pm10")
            )

        if "humidity" in columns:
            valid_data["humidity"] = valid_data["humidity"].apply(
                lambda x: get_valid_value(x, "humidity")
            )

        if "humidity" in columns:
            valid_data["humidity"] = valid_data["humidity"].apply(
                lambda x: get_valid_value(x, "humidity")
            )

        if "wind_speed" in columns:
            valid_data["wind_speed"] = valid_data["wind_speed"].apply(
                lambda x: get_valid_value(x, "wind_speed")
            )

        if "pressure" in columns:
            valid_data["pressure"] = valid_data["pressure"].apply(
                lambda x: get_valid_value(x, "pressure")
            )

        if "device_humidity" in columns:
            valid_data["device_humidity"] = valid_data["device_humidity"].apply(
                lambda x: get_valid_value(x, "humidity")
            )

        if "device_temperature" in columns:
            valid_data["device_temperature"] = valid_data["device_temperature"].apply(
                lambda x: get_valid_value(x, "temperature")
            )

        return valid_data
