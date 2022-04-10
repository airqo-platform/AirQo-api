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
    def dag_frequency(dag: str) -> int:
        mapping = dict(
            {
                "airqo_historical_hourly_data": 240,
                "historical_weather_data": 360,
                "data_warehouse": 360,
                "kcca_historical_hourly_data": 360,
                "app_historical_daily_insights": 720,
                "app_historical_hourly_insights": 360,
            }
        )
        return mapping.get(dag)

    @staticmethod
    def dag_names() -> dict:
        return dict(
            {
                "airqo_historical_hourly_data": "AirQo-Historical-Hourly-Measurements",
                "historical_weather_data": "Historical-Hourly-Weather-Measurements",
                "data_warehouse": "Data-Warehouse-ETL",
                "kcca_historical_hourly_data": "Kcca-Historical-Hourly-Measurements",
                "app_historical_daily_insights": "App-Historical-Daily-Insights",
                "app_historical_hourly_insights": "App-Historical-Hourly-Insights",
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
        frequency = self.dag_frequency(dag=dag)
        dates = pd.date_range(
            self.start_date_time, self.end_date_time, freq=f"{frequency}H"
        )
        last_date_time = dates.values[len(dates.values) - 1]
        logical_date = datetime.utcnow() + timedelta(minutes=30)
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
                "conf": {"startDateTime": start, "endDateTime": end},
            }
            self.post_dag(payload=pay_load, dag=self.dag_names().get(dag))
            logical_date = logical_date + timedelta(minutes=self.logical_date_interval)


if __name__ == "__main__":
    hour_of_day = datetime.utcnow() - timedelta(hours=1)

    valid_dag_names = ", ".join([str(name) for name in ScheduleDag.dag_names()])
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
        "--dag", required=True, type=str, help=f"DAG. Examples: {valid_dag_names}"
    )
    args = parser.parse_args()

    schedule_dag = ScheduleDag(
        start_date_time=args.start,
        end_date_time=args.end,
        logical_date_interval=args.logical_date_minutes_interval,
    )

    if args.dag in ScheduleDag.dag_names().keys():
        schedule_dag.schedule(dag=args.dag)
    else:
        raise Exception(f"Invalid dag. Valid values are {valid_dag_names}")
