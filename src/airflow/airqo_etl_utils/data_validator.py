import pandas as pd

from commons import get_valid_value


class DataValidationUtils:
    @staticmethod
    def get_validate_values(raw_value: pd.DataFrame) -> pd.DataFrame:
        valid_data = raw_value.copy()
        columns = valid_data.columns

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

        if "temperature" in columns:
            valid_data["temperature"] = valid_data["temperature"].apply(
                lambda x: get_valid_value(x, "temperature")
            )

        if "internalHumidity" in columns:
            valid_data["internalHumidity"] = valid_data["internalHumidity"].apply(
                lambda x: get_valid_value(x, "humidity")
            )

        if "internalTemperature" in columns:
            valid_data["internalTemperature"] = valid_data["internalTemperature"].apply(
                lambda x: get_valid_value(x, "temperature")
            )

        return valid_data
