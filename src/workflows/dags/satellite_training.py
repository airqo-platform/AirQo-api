from datetime import datetime, timedelta, timezone

import pandas as pd
from airflow.decorators import dag, task

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.satellite_model_training import SatelliteModelTrainer
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    dag_id="AirQo-satellite-model-training-job",
    schedule="0 0 1 * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "training-job", "satellite", "sentinel-2", "pm2.5"],
)
def train_satellite_model():
    @task()
    def fetch_airqo_daily_training_data() -> pd.DataFrame:
        end_timestamp = datetime.now(timezone.utc).replace(
            minute=0,
            second=0,
            microsecond=0,
        )
        start_timestamp = end_timestamp - timedelta(
            days=configuration.SATELLITE_TRAINING_LOOKBACK_DAYS
        )
        return BigQueryApi().fetch_airqo_daily_data_for_satellite_training(
            start_date_time=start_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            end_date_time=end_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            min_site_days=configuration.SATELLITE_TRAINING_MIN_SITE_DAYS,
            min_day_hours=configuration.SATELLITE_TRAINING_MIN_DAY_HOURS,
        )

    @task()
    def merge_with_sentinel2_features(airqo_daily_data: pd.DataFrame) -> pd.DataFrame:
        return SatelliteModelTrainer.enrich_airqo_daily_with_sentinel2(airqo_daily_data)

    @task()
    def train_and_save_model(training_data: pd.DataFrame):
        return SatelliteModelTrainer.train_and_upload(training_data)

    airqo_daily_data = fetch_airqo_daily_training_data()
    training_data = merge_with_sentinel2_features(airqo_daily_data)
    train_and_save_model(training_data)


train_satellite_model()
