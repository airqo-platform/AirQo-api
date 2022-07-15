import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.bigquery_api import BigQueryApi


def extract_raw_device_measurements_from_bigquery(
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
        tenant="airqo",
    )

    if measurements.empty:
        return pd.DataFrame([], columns=cols)

    measurements = measurements.dropna(subset=["timestamp"])
    measurements["timestamp"] = pd.to_datetime(measurements["timestamp"])
    averaged_measurements = pd.DataFrame()
    devices_groups = measurements.groupby("device_number")

    for _, device_group in devices_groups:
        device_number = device_group.iloc[0]["device_number"]
        device_site_groups = device_group.groupby("site_id")

        for _, device_site in device_site_groups:
            site_id = device_site.iloc[0]["site_id"]
            data = device_site.sort_index(axis=0)
            averages = pd.DataFrame(data.resample("1H", on="timestamp").mean())
            averages["device_number"] = device_number
            averages["site_id"] = site_id
            averaged_measurements = averaged_measurements.append(
                averages, ignore_index=True
            )

    return averaged_measurements


def extract_raw_weather_data_from_bigquery(
    start_date_time, end_date_time
) -> pd.DataFrame:
    bigquery_api = BigQueryApi()

    cols = ["site_id", "timestamp", "temperature", "humidity"]
    measurements = bigquery_api.query_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=cols,
        table=bigquery_api.raw_weather_table,
        tenant="airqo",
    )

    if measurements.empty:
        return pd.DataFrame([], columns=cols)

    measurements = measurements.dropna(subset=["timestamp"])
    measurements["timestamp"] = pd.to_datetime(measurements["timestamp"])

    averaged_measurements = pd.DataFrame()
    sites_groups = measurements.groupby("site_id")

    for _, site_weather in sites_groups:
        site_id = site_weather.iloc[0]["site_id"]
        site_weather = measurements.sort_index(axis=0)
        averages = pd.DataFrame(site_weather.resample("1H", on="timestamp").mean())
        averages["site_id"] = site_id
        averaged_measurements = averaged_measurements.append(
            averages, ignore_index=True
        )

    return averaged_measurements


def merge_device_measurements_and_weather_data(
    device_measurements: pd.DataFrame, weather_data: pd.DataFrame
) -> pd.DataFrame:
    weather_data["timestamp"] = pd.to_datetime(weather_data["timestamp"])
    weather_data["timestamp"] = pd.to_datetime(weather_data["timestamp"])

    measurements = pd.merge(
        left=device_measurements,
        right=weather_data,
        how="left",
        on=["site_id", "timestamp"],
    )

    measurements["temperature"] = measurements["temperature"].fillna(
        measurements["external_temperature"]
    )

    measurements["humidity"] = measurements["humidity"].fillna(
        measurements["external_humidity"]
    )

    del measurements["external_humidity"]
    del measurements["external_temperature"]

    return measurements


def calibrate_historical_data(measurements: pd.DataFrame):
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

    data_for_calibration = measurements[cols].dropna(subset=cols)
    calibrated_data = pd.DataFrame()

    timestamp_groups = data_for_calibration.groupby("timestamp")
    airqo_api = AirQoApi()
    col_mappings = {col: col for col in cols}

    for _, time_group in timestamp_groups:
        data = time_group.copy()
        timestamp = data.iloc[0]["timestamp"]
        response = airqo_api.calibrate_data(
            time=timestamp, data=data, cols=col_mappings
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
