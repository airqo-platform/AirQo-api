import argparse
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from airqo_etl_utils.airqo_utils import calibrate_hourly_airqo_measurements
from airqo_etl_utils.arg_parse_validator import valid_datetime_format
from airqo_etl_utils.bigquery_api import BigQueryApi


BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

sys.path.append(".")


def calibrate_historical_data(start_date_time, end_date_time, tenant):
    bigquery_api = BigQueryApi()

    device_measurements = bigquery_api.query_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=[
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "timestamp",
            "device_number",
            "site_id",
            "external_temperature",
            "external_humidity",
        ],
        table=bigquery_api.hourly_measurements_table,
        tenant=tenant,
    )

    weather_data = bigquery_api.query_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=["site_id", "timestamp", "temperature", "humidity"],
        table=bigquery_api.hourly_weather_table,
        tenant=tenant,
    )

    measurements = pd.merge(
        left=device_measurements,
        right=weather_data,
        on=["site_id", "timestamp"],
        how="left",
    )

    measurements = measurements.dropna(
        subset=[
            "site_id",
            "device_number",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "timestamp",
        ]
    )

    measurements["humidity"] = measurements["humidity"].fillna(
        measurements["external_humidity"]
    )
    measurements["temperature"] = measurements["temperature"].fillna(
        measurements["external_temperature"]
    )

    del measurements["external_temperature"]
    del measurements["external_humidity"]

    measurements = measurements.dropna(subset=["temperature", "humidity"])

    measurements.rename(
        columns={"timestamp": "time", "device_number": "device_id"}, inplace=True
    )

    n = 1000
    measurements_list = [
        measurements[i : i + n] for i in range(0, measurements.shape[0], n)
    ]
    index = 0
    for chunk in measurements_list:
        calibrated_data = calibrate_hourly_airqo_measurements(measurements=chunk)
        calibrated_data.rename(
            columns={
                "time": "timestamp",
                "device_id": "device_number",
                "calibrated_pm2_5": "pm2_5_calibrated_value",
                "calibrated_pm10": "pm10_calibrated_value",
            },
            inplace=True,
        )
        calibrated_data["tenant"] = tenant
        bigquery_api.validate_data(
            dataframe=calibrated_data,
            table=bigquery_api.calibrated_hourly_measurements_table,
        )
        calibrated_data.to_csv(
            path_or_buf=f"historical_calibrated_data_{index}.csv", index=False
        )
        index = index + 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test functions configuration")
    parser.add_argument(
        "--start",
        required=True,
        type=valid_datetime_format,
        help='start datetime in format "yyyy-MM-ddThh:mm:ssZ"',
    )
    parser.add_argument(
        "--end",
        required=True,
        type=valid_datetime_format,
        help='end datetime in format "yyyy-MM-ddThh:mm:ssZ"',
    )
    parser.add_argument(
        "--tenant",
        required=False,
        type=str.lower,
        default="airqo",
    )
    args = parser.parse_args()

    calibrate_historical_data(
        start_date_time=args.start, end_date_time=args.end, tenant=args.tenant
    )
