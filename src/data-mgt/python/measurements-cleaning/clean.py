import json

import pandas as pd


def convert_to_numeric(original_value):
    return pd.to_numeric(original_value, errors='coerce')


def convert_to_tenant(original_value):
    if f'{original_value}'.strip().lower() == 'kcca':
        return 'kcca'
    elif f'{original_value}'.strip().lower() == 'airqo':
        return 'airqo'
    else:
        return None


class Clean:

    def __init__(self, data) -> None:
        self.__raw_measurements = pd.DataFrame(data)
        self.__raw_measurements = pd.json_normalize(self.__raw_measurements.to_dict(orient="records"))
        super().__init__()

    def clean_measurements(self):

        # self.__raw_measurements['pm2_5.value'] = self.__raw_measurements['pm2_5.value'].astype(str)
        self.__convert_to_floats()
        self.__check_tenant()
        self.__remove_outliers()

    def __check_tenant(self):
        self.__raw_measurements['tenant'] = self.__raw_measurements['tenant'].apply(convert_to_tenant)

    def __convert_to_floats(self):
        self.__raw_measurements[['pm2_5.value', 's2_pm2_5.value']] = self.__raw_measurements[
            ["pm2_5.value", "s2_pm2_5.value"]].apply(convert_to_numeric)

        self.__raw_measurements[['pm10.value', 's2_pm10.value']] = self.__raw_measurements[
            ["pm10.value", "s2_pm10.value"]].apply(convert_to_numeric)

        self.__raw_measurements['externalTemperature.value'] = self.__raw_measurements[
            'externalTemperature.value'].apply(convert_to_numeric)

        self.__raw_measurements['externalHumidity.value'] = self.__raw_measurements[
            'externalHumidity.value'].apply(convert_to_numeric)

    def __remove_outliers(self):

        self.__raw_measurements = self.__raw_measurements[
            (self.__raw_measurements['pm2_5'] >= 0) & (self.__raw_measurements['pm2_5'] <= 500.4)]
        self.__raw_measurements = self.__raw_measurements[
            (self.__raw_measurements['s2_pm2_5'] >= 0) & (self.__raw_measurements['s2_pm2_5'] <= 500.4)]
        self.__raw_measurements = self.__raw_measurements[
            (self.__raw_measurements['pm10'] >= 0) & (self.__raw_measurements['pm10'] <= 500.4)]
        self.__raw_measurements = self.__raw_measurements[
            (self.__raw_measurements['s2_pm10'] >= 0) & (self.__raw_measurements['s2_pm10'] <= 500.4)]
        self.__raw_measurements = self.__raw_measurements[
            (self.__raw_measurements['temperature'] >= 0) & (self.__raw_measurements['temperature'] <= 45)]
        self.__raw_measurements = self.__raw_measurements[
            (self.__raw_measurements['humidity'] >= 0) & (self.__raw_measurements['humidity'] <= 99)]

    def get_cleaned_measurements(self):
        cleaned_measurements = []

        for _, row in self.__raw_measurements.iterrows():
            cleaned_measurement = dict({
                "tenant": row["tenant"],
                "frequency": row["frequency"],
                "time": row["time"],
                "device": row["device"],
                "device_id": row["device_id"],
                "site_id": row["site_id"],
                "device_number": row["device_number"],
                "location": {
                    "latitude": row["location.latitude"],
                    "longitude": row["longitude.latitude"],
                },
                "internalTemperature": {
                    "value": row["internalTemperature.value"]
                },
                "internalHumidity": {
                    "value": row["internalHumidity.value"]
                },
                "externalTemperature": {
                    "value": row["externalTemperature.value"]
                },
                "externalHumidity": {
                    "value": row["externalHumidity.value"]
                },
                "externalPressure": {
                    "value": row["externalPressure.value"]
                },
                "speed": {
                    "value": row["speed.value"]
                },
                "altitude": {
                    "value": row["altitude.value"]
                },
                "battery": {
                    "value": row["battery.value"]
                },
                "satellites": {
                    "value": row["satellites.value"]
                },
                "hdop": {
                    "value": row["hdop.value"]
                },
                "pm10": {
                    "value": row["pm10.value"],
                    "calibratedValue": row["pm10.calibratedValue"],
                    "uncertaintyValue": row["pm10.uncertaintyValue"],
                    "standardDeviationValue": row["pm10.standardDeviationValue"]
                },
                "pm2_5": {
                    "value": row["pm2_5.value"],
                    "calibratedValue": row["pm2_5.calibratedValue"],
                    "uncertaintyValue": row["pm2_5.uncertaintyValue"],
                    "standardDeviationValue": row["pm2_5.standardDeviationValue"]
                },
                "no2": {
                    "value": row["no2.value"],
                    "calibratedValue": row["no2.calibratedValue"],
                    "uncertaintyValue": row["no2.uncertaintyValue"],
                    "standardDeviationValue": row["no2.standardDeviationValue"]
                },
                "pm1": {
                    "value": row["pm1.value"],
                    "calibratedValue": row["pm1.calibratedValue"],
                    "uncertaintyValue": row["pm1.uncertaintyValue"],
                    "standardDeviationValue": row["pm1.standardDeviationValue"]
                },
                "s2_pm10": {
                    "value": row["s2_pm10.value"],
                    "calibratedValue": row["s2_pm10.calibratedValue"],
                    "uncertaintyValue": row["s2_pm10.uncertaintyValue"],
                    "standardDeviationValue": row["s2_pm10.standardDeviationValue"]
                },
                "s2_pm2_5": {
                    "value": row["s2_pm2_5.value"],
                    "calibratedValue": row["s2_pm2_5.calibratedValue"],
                    "uncertaintyValue": row["s2_pm2_5.uncertaintyValue"],
                    "standardDeviationValue": row["s2_pm2_5.standardDeviationValue"]
                },
            })
            cleaned_measurements.append(cleaned_measurement)

        return json.dumps(cleaned_measurements)