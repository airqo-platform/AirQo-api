import argparse
import base64
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

from airqo_etl_utils.arg_parse_validator import valid_datetime_format
from airqo_etl_utils.constants import DataSource
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.utils import Utils

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class ScheduleDag:
    def __init__(
        self, start_date_time: str, end_date_time: str, dag_duration: int
    ) -> None:
        super().__init__()
        self.start_date_time = start_date_time
        self.end_date_time = end_date_time
        self.dag_duration = dag_duration
        self.authentication = ScheduleDag.get_authentication_string()
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
                    "data_source": DataSource.BIGQUERY,
                    "dag_duration": 2,
                },
                "airqo_historical_raw_data": {
                    "name": "AirQo-Historical-Raw-Low-Cost-Measurements",
                    "data_source": DataSource.THINGSPEAK,
                    "dag_duration": 5,
                },
                "airqo_calibrated_data": {
                    "name": "Calibrate-AirQo-Measurements",
                    "data_source": DataSource.BIGQUERY,
                    "dag_duration": 120,
                    "dates_frequency": "120H",
                },
                # Weather Data
                "historical_hourly_weather_data": {
                    "name": "Historical-Hourly-Weather-Measurements",
                    "data_source": DataSource.BIGQUERY,
                    "dag_duration": 1,
                },
                "historical_raw_weather_data": {
                    "name": "Historical-Raw-Weather-Measurements",
                    "data_source": DataSource.TAHMO,
                    "dag_duration": 1,
                },
                # KCCA Data
                "kcca_historical_hourly_data": {
                    "name": "Kcca-Historical-Hourly-Measurements",
                    "data_source": DataSource.BIGQUERY,
                    "dag_duration": 2,
                },
                "kcca_historical_raw_data": {
                    "name": "Kcca-Historical-Raw-Measurements",
                    "data_source": DataSource.CLARITY,
                    "dag_duration": 5,
                },
                # Consolidated Data
                "consolidated_data": {
                    "name": "Consolidated-Data-ETL",
                    "data_source": DataSource.BIGQUERY,
                    "dag_duration": 5,
                },
                # Mobile devices data
                "historical_urban_better_plume_labs": {
                    "name": "Urban-Better-Plume-Labs-Historical-Raw-Measurements",
                    "data_source": DataSource.PLUME_LABS,
                    "dag_duration": 5,
                },
                "historical_urban_better_air_beam": {
                    "name": "Urban-Better-Air-Beam-Historical-Raw-Measurements",
                },
                # AirNow Data
                "airnow_historical_bam_data": {
                    "name": "Airnow-Historical-Bam-Data",
                    "data_source": DataSource.AIRNOW,
                    "dag_duration": 5,
                },
                # Nasa Data
                "nasa_historical_raw_data": {
                    "name": "Nasa-Historical-Raw-Data",
                    "data_source": DataSource.PURPLE_AIR,
                    "dag_duration": 5,
                },
            }
        )

    def post_dag(self, payload: dict, dag: str) -> bool:
        api_request = requests.post(
            f"{self.BASE_URL}api/v1/dags/{dag}/dagRuns",
            data=json.dumps(payload),
            headers={
                "Authorization": f"Basic {self.authentication}",
                "Content-Type": "application/json",
            },
        )
        print(f"\n{json.loads(api_request.content)}")
        return api_request.status_code == 200

    def schedule(self, dag: str):
        dag = ScheduleDag.dags().get(dag)
        dag_start_time = datetime.utcnow() + timedelta(minutes=1)
        dag_duration = (
            dag.get("dag_duration", None)
            if self.dag_duration == -1
            else self.dag_duration
        )

        dates = Utils.query_dates_array(
            start_date_time=self.start_date_time,
            end_date_time=self.end_date_time,
            data_source=dag["data_source"],
            freq=dag.get("dates_frequency", None),
        )
        for start, end in dates:
            pay_load = {
                "dag_run_id": f"{start}-{end}",
                "logical_date": date_to_str(dag_start_time),
                "conf": {"start_date_time": start, "end_date_time": end},
            }
            success = self.post_dag(payload=pay_load, dag=dag["name"])
            if not success:
                continue
            dag_start_time = dag_start_time + timedelta(minutes=dag_duration)


if __name__ == "__main__":
    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    dags = ScheduleDag.dags().keys()
    dag_names = ", ".join([str(name) for name in dags])
    parser = argparse.ArgumentParser(description="DAG configuration")
    parser.add_argument(
        "--start",
        required=True,
        type=valid_datetime_format,
        help="start datetime (yyyy-MM-ddThh:mm:ssZ)",
    )
    parser.add_argument(
        "--end",
        required=True,
        type=valid_datetime_format,
        help="end datetime (yyyy-MM-ddThh:mm:ssZ)",
    )
    parser.add_argument(
        "--dag",
        required=True,
        type=str,
        help=f"DAG. Examples: {dag_names}",
        choices=dags,
    )
    parser.add_argument(
        "--dag_duration",
        type=int,
        default=-1,
        help="dag duration in minutes",
    )
    args = parser.parse_args()

    schedule_dag = ScheduleDag(
        start_date_time=args.start,
        end_date_time=args.end,
        dag_duration=args.dag_duration,
    )

    schedule_dag.schedule(dag=args.dag)
