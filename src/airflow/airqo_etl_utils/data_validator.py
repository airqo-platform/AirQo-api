import pandas as pd


class DataValidationUtils:
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
    def get_valid_values(data: pd.DataFrame) -> pd.DataFrame:
        float_columns = {
            "battery",
            "hdop",
            "altitude",
            "satellites",
            "pm2_5",
            "pm10",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "no2",
            "no2_raw_value",
            "pm1",
            "pm1_raw_value",
            "external_temperature",
            "external_humidity",
            "latitude",
            "longitude",
            "humidity",
            "temperature",
            "device_humidity",
            "device_temperature",
            "pressure",
            "wind_speed",
            "speed",
        }

        float_columns = list(float_columns & set(data.columns))

        data[float_columns] = data[float_columns].apply(pd.to_numeric, errors="coerce")
        if "timestamp" in data.columns:
            data["timestamp"] = data["timestamp"].apply(
                lambda x: pd.to_datetime(x, errors="coerce")
            )

        for col in float_columns:
            name = col
            if name in [
                "pm2_5",
                "s1_pm2_5",
                "s2_pm2_5",
                "pm2_5_raw_value",
                "pm2_5_calibrated_value",
            ]:
                name = "pm2_5"
            elif name in [
                "pm10",
                "s1_pm10",
                "s2_pm10",
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
            elif name in ["pm1", "pm1_raw_value"]:
                name = "pm1"

            data[col] = data[col].apply(
                lambda x: DataValidationUtils.get_valid_value(x, name)
            )

        return data
