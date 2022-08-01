import argparse
import base64
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

from airqo_etl_utils.arg_parse_validator import valid_datetime_format
from airqo_etl_utils.date import date_to_str

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class ScheduleDag:
    def __init__(
        self, start_date_time: str, end_date_time: str, logical_date_interval: int
    ) -> None:
        super().__init__()
        self.start_date_time = start_date_time
        self.end_date_time = end_date_time
        self.logical_date_interval = logical_date_interval
        self.authentication = self.get_authentication_string()
        self.BASE_URL = os.getenv("AIRFLOW__WEBSERVER__BASE_URL")

    @staticmethod
    def get_authentication_string() -> str:
        username = os.getenv("ADMIN_USERNAME")
        password = os.getenv("ADMIN_PASSWORD")
        auth_bytes = f"{username}:{password}".encode("ascii")
        base64_bytes = base64.b64encode(auth_bytes)
        base64_string = base64_bytes.decode("ascii")
        return base64_string

    @staticmethod
    def dags() -> dict:
        return dict(
            {
                # AirQo Data
                "airqo_historical_hourly_data": {
                    "name": "AirQo-Historical-Hourly-Measurements",
                    "data_duration": "240H",
                },
                "airqo_historical_raw_data": {
                    "name": "AirQo-Historical-Raw-Measurements",
                    "data_duration": "240H",
                },
                # Weather Data
                "historical_hourly_weather_data": {
                    "name": "Historical-Hourly-Weather-Measurements",
                    "data_duration": "360H",
                },
                "historical_raw_weather_data": {
                    "name": "Historical-Raw-Weather-Measurements",
                    "data_duration": "240H",
                },
                # KCCA Data
                "kcca_historical_hourly_data": {
                    "name": "Kcca-Historical-Hourly-Measurements",
                    "data_duration": "360H",
                },
                "kcca_historical_raw_data": {
                    "name": "Kcca-Historical-Raw-Measurements",
                    "data_duration": "240H",
                },
                # Data warehouse
                "data_warehouse": {
                    "name": "Data-Warehouse-ETL",
                    "data_duration": "360H",
                },
                # Mobile App Data
                "app_historical_daily_insights": {
                    "name": "App-Historical-Daily-Insights",
                    "data_duration": "720H",
                },
                "app_historical_hourly_insights": {
                    "name": "App-Historical-Hourly-Insights",
                    "data_duration": "360H",
                },
                # Mobile devices data
                "historical_urban_better_plume_labs": {
                    "name": "Urban-Better-Plume-Labs-Historical-Raw-Measurements",
                    "data_duration": "240H",
                },
                "historical_urban_better_air_beam": {
                    "name": "Urban-Better-Air-Beam-Historical-Raw-Measurements",
                    "data_duration": "240H",
                },
                # AirNow Data
                "airnow_historical_bam_data": {
                    "name": "Airnow-Historical-Bam-Data",
                    "data_duration": "240H",
                },
                # Nasa Data
                "nasa_historical_raw_data": {
                    "name": "Nasa-Historical-Raw-Data",
                    "data_duration": "240H",
                },
            }
        )

    def post_dag(self, payload: dict, dag: str):

        api_request = requests.post(
            "%sapi/v1/dags/%s/dagRuns" % (self.BASE_URL, dag),
            data=json.dumps(payload),
            headers={
                "Authorization": f"Basic {self.authentication}",
                "Content-Type": "application/json",
            },
        )
        print(f"\n{json.loads(api_request.content)}")

    def schedule(self, dag: str):
        dag = ScheduleDag.dags().get(dag)
        dates = pd.date_range(
            self.start_date_time, self.end_date_time, freq=dag["data_duration"]
        )
        last_date_time = dates.values[len(dates.values) - 1]
        logical_date = datetime.utcnow() + timedelta(hours=30)
        for date in dates:

            start = date_to_str(date)
            query_end_date_time = date + timedelta(hours=dates.freq.n)

            if np.datetime64(query_end_date_time) > last_date_time:
                end = self.end_date_time
            else:
                end = date_to_str(query_end_date_time)

            pay_load = {
                "dag_run_id": f"{start}-{end}",
                "logical_date": date_to_str(logical_date),
                "conf": {"start_date_time": start, "end_date_time": end},
            }
            self.post_dag(payload=pay_load, dag=dag["name"])
            logical_date = logical_date + timedelta(minutes=self.logical_date_interval)


if __name__ == "__main__":
    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    dags = ScheduleDag.dags().keys()
    valid_dag_names = ", ".join([str(name) for name in dags])
    parser = argparse.ArgumentParser(description="DAG configuration")
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
        "--logical_date_minutes_interval",
        required=True,
        type=int,
        help="range interval in minutes",
    )
    parser.add_argument(
        "--dag",
        required=True,
        type=str,
        help=f"DAG. Examples: {valid_dag_names}",
        choices=dags,
    )
    args = parser.parse_args()

    schedule_dag = ScheduleDag(
        start_date_time=args.start,
        end_date_time=args.end,
        logical_date_interval=args.logical_date_minutes_interval,
    )

    schedule_dag.schedule(dag=args.dag)
