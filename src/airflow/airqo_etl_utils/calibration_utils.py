import pandas as pd

from airqo_api import AirQoApi
from bigquery_api import BigQueryApi
from date import date_to_str


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
    def extract_hourly_device_measurements(
        start_date_time, end_date_time
    ) -> pd.DataFrame:
        cols = [
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "timestamp",
            "external_temperature",
            "external_humidity",
            "device_number",
            "site_id",
        ]
        bigquery_api = BigQueryApi()
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=cols,
            table=bigquery_api.raw_measurements_table,
            where_fields={"tenant": "airqo"},
        )

        if measurements.empty:
            return pd.DataFrame([], columns=cols)

        measurements = measurements.dropna(subset=["timestamp"])
        measurements["timestamp"] = measurements["timestamp"].apply(pd.to_datetime)
        averaged_measurements = pd.DataFrame()
        devices_groups = measurements.groupby("device_number")

        for _, device_group in devices_groups:
            device_number = device_group.iloc[0]["device_number"]
            device_site_groups = device_group.groupby("site_id")

            for _, device_site in device_site_groups:
                site_id = device_site.iloc[0]["site_id"]
                data = device_site.sort_index(axis=0)
                averages = pd.DataFrame(data.resample("1H", on="timestamp").mean())
                averages["timestamp"] = averages.index
                averages["device_number"] = device_number
                averages["site_id"] = site_id
                averaged_measurements = averaged_measurements.append(
                    averages, ignore_index=True
                )

        return averaged_measurements

    @staticmethod
    def merge_device_measurements_and_weather_data(
        device_measurements: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:

        weather_data["timestamp"] = weather_data["timestamp"].apply(pd.to_datetime)
        device_measurements["timestamp"] = device_measurements["timestamp"].apply(
            pd.to_datetime
        )

        airqo_api = AirQoApi()
        sites = airqo_api.get_sites()
        sites_df = pd.json_normalize(sites)
        sites_df = sites_df[["_id", "nearest_tahmo_station.code"]]
        sites_df.rename(
            columns={"nearest_tahmo_station.code": "station_code", "_id": "site_id"},
            inplace=True,
        )

        device_measurements = pd.merge(
            left=device_measurements, right=sites_df, on=["site_id"], how="left"
        )

        measurements = pd.merge(
            left=device_measurements,
            right=weather_data,
            how="left",
            on=["station_code", "timestamp"],
        )

        measurements["temperature"] = measurements["temperature"].fillna(
            measurements["external_temperature"]
        )

        measurements["humidity"] = measurements["humidity"].fillna(
            measurements["external_humidity"]
        )

        del measurements["external_humidity"]
        del measurements["external_temperature"]
        del measurements["station_code"]

        return measurements

    @staticmethod
    def calibrate_historical_data(measurements: pd.DataFrame):
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
                    "calibrated_PM2.5": "calibrated_pm2_5",
                    "calibrated_PM10": "calibrated_pm10",
                },
                inplace=True,
            )

            calibrated_data = calibrated_data.append(merged_data, ignore_index=True)

        calibrated_data = pd.merge(
            left=calibrated_data,
            right=sites_data,
            how="left",
            on=["device_number", "timestamp"],
        )

        return calibrated_data.append(uncalibrated_data, ignore_index=True)
