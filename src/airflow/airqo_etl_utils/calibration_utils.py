import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .date import date_to_str


class CalibrationUtils:
    @staticmethod
    def extract_hourly_weather_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        cols = ["station_code", "timestamp", "temperature", "humidity"]
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=cols,
            table=bigquery_api.hourly_weather_table,
        )

        if measurements.empty:
            return pd.DataFrame([], columns=cols)
        return measurements

    @staticmethod
    def calibrate_mobile_devices_data(measurements: pd.DataFrame):
        measurements = measurements.copy()
        measurements["timestamp"] = measurements["timestamp"].apply(pd.to_datetime)
        uncalibrated_data = measurements.loc[
            (measurements["s1_pm2_5"].isnull())
            | (measurements["s1_pm10"].isnull())
            | (measurements["s2_pm2_5"].isnull())
            | (measurements["s2_pm10"].isnull())
            | (measurements["temperature"].isnull())
            | (measurements["humidity"].isnull())
            | (measurements["device_number"].isnull())
            | (measurements["timestamp"].isnull())
        ]
        data_for_calibration = measurements.dropna(
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

        col_mappings = {col: col for col in measurements.columns}
        calibrated_data = pd.DataFrame()

        airqo_api = AirQoApi()
        timestamp_groups = data_for_calibration.groupby("timestamp")

        for _, time_group in timestamp_groups:
            data = time_group.copy()

            timestamp = date_to_str(data.iloc[0]["timestamp"])
            response = airqo_api.calibrate_data(
                time=timestamp, data=data.copy(), cols=col_mappings
            )

            response_df = pd.DataFrame(
                response, columns=["calibrated_PM2.5", "calibrated_PM10", "device_id"]
            )
            merged_data = pd.merge(
                left=data,
                right=response_df,
                how="left",
                right_on=["device_id"],
                left_on=["device_number"],
            )
            merged_data.rename(
                columns={
                    "calibrated_PM2.5": "pm2_5_calibrated_value",
                    "calibrated_PM10": "pm10_calibrated_value",
                },
                inplace=True,
            )

            calibrated_data = calibrated_data.append(merged_data, ignore_index=True)

        return calibrated_data.append(uncalibrated_data, ignore_index=True)

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
    def calibrate_airqo_data(measurements: pd.DataFrame):
        measurements["timestamp"] = measurements["timestamp"].apply(pd.to_datetime)

        sites_data = measurements[["site_id", "device_number", "timestamp"]]
        uncalibrated_data = measurements.loc[
            (measurements["s1_pm2_5"].isnull())
            | (measurements["s1_pm10"].isnull())
            | (measurements["s2_pm2_5"].isnull())
            | (measurements["s2_pm10"].isnull())
            | (measurements["temperature"].isnull())
            | (measurements["humidity"].isnull())
            | (measurements["device_number"].isnull())
            | (measurements["timestamp"].isnull())
        ]
        cols = [
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "temperature",
            "humidity",
            "device_number",
            "timestamp",
        ]

        calibrated_data = pd.DataFrame()
        airqo_api = AirQoApi()

        data_for_calibration = measurements[cols].dropna(subset=cols)

        timestamp_groups = data_for_calibration.groupby("timestamp")
        col_mappings = {col: col for col in cols}

        for _, time_group in timestamp_groups:
            data = time_group.copy()

            timestamp = date_to_str(data.iloc[0]["timestamp"])
            response = airqo_api.calibrate_data(
                time=timestamp, data=data.copy(), cols=col_mappings
            )

            response_df = pd.DataFrame(response)[
                ["calibrated_PM2.5", "calibrated_PM10", "device_id"]
            ]

            merged_data = pd.merge(
                left=data,
                right=response_df,
                how="left",
                right_on=["device_id"],
                left_on=["device_number"],
            )

            calibrated_data = calibrated_data.append(merged_data, ignore_index=True)

        calibrated_data.rename(
            columns={
                "calibrated_PM2.5": "pm2_5_calibrated_value",
                "calibrated_PM10": "pm10_calibrated_value",
            },
            inplace=True,
        )

        calibrated_data = pd.merge(
            left=calibrated_data,
            right=sites_data,
            how="left",
            on=["device_number", "timestamp"],
        )

        data = calibrated_data.append(uncalibrated_data, ignore_index=True)

        return CalibrationUtils.format_calibrated_data(data)
