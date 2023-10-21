import pandas as pd

from .airqo_api import AirQoApi
from .date import date_to_str


class CalibrationUtils:
    @staticmethod
    def format_calibrated_data(data: pd.DataFrame) -> pd.DataFrame:
        data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

        if "pm2_5_calibrated_value" in data.columns:
            data["pm2_5"] = data["pm2_5_calibrated_value"]
        else:
            data["pm2_5_calibrated_value"] = None
            data["pm2_5"] = None

        if "pm10_calibrated_value" in data.columns:
            data["pm10"] = data["pm10_calibrated_value"]
        else:
            data["pm10_calibrated_value"] = None
            data["pm10"] = None

        data["pm2_5"] = data["pm2_5"].fillna(data["pm2_5_raw_value"])
        data["pm10"] = data["pm10"].fillna(data["pm10_raw_value"])

        return data

    @staticmethod
    def calibrate_airqo_data(data: pd.DataFrame):
        data = data.copy()
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        uncalibrated_data = data.loc[
            (data["s1_pm2_5"].isnull())
            | (data["s1_pm10"].isnull())
            | (data["s2_pm2_5"].isnull())
            | (data["s2_pm10"].isnull())
            | (data["temperature"].isnull())
            | (data["humidity"].isnull())
            | (data["device_number"].isnull())
            | (data["timestamp"].isnull())
        ]

        calibrated_data = pd.DataFrame()
        airqo_api = AirQoApi()

        data_for_calibration = data.dropna(
            subset=[
                "s1_pm2_5",
                "s1_pm10",
                "s2_pm2_5",
                "s2_pm10",
                "temperature",
                "humidity",
                "device_number",
                "timestamp",
            ]
        )

        for _, time_group in data_for_calibration.groupby("timestamp"):
            timestamp = date_to_str(time_group.iloc[0]["timestamp"])
            response = airqo_api.calibrate_data(time=timestamp, data=time_group.copy())

            if not response:
                print("\n\nFailed to calibrate\n\n")
                calibrated_data = pd.concat(
                    [calibrated_data, time_group], ignore_index=True
                )
                continue

            response = pd.DataFrame(response)
            response = response[["calibrated_PM2.5", "calibrated_PM10", "device_id"]]
            response.rename(
                columns={
                    "device_id": "device_number",
                    "calibrated_PM2.5": "pm2_5_calibrated_value",
                    "calibrated_PM10": "pm10_calibrated_value",
                },
                inplace=True,
            )

            for col in ["pm2_5_calibrated_value", "pm10_calibrated_value"]:
                if col in time_group.columns.to_list():
                    del time_group[col]

            merged_data = pd.merge(
                left=time_group,
                right=response,
                how="left",
                on=["device_number"],
            )

            calibrated_data = pd.concat(
                [calibrated_data, merged_data], ignore_index=True
            )

        data = pd.concat([calibrated_data, uncalibrated_data], ignore_index=True)

        return CalibrationUtils.format_calibrated_data(data)
