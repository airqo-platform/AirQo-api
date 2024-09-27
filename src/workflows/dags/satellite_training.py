from datetime import datetime

import pandas as pd
from airflow.decorators import dag, task
from dateutil.relativedelta import relativedelta

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.ml_utils import SatelliteUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "AirQo-satellite-model-training-job",
    schedule="0 0 1 * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job", "satellite"],
)
def train_satelllite_model():
    @task()
    def fetch_historical_satellite_data():
        from datetime import datetime, timedelta, timezone

        start_date = datetime.now(timezone.utc) - timedelta(
            hours=int(configuration.HOURLY_FORECAST_PREDICTION_JOB_SCOPE)
        )
        from airqo_etl_utils.date import date_to_str

        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_satellite_readings(start_date)

    @task()
    def fetch_historical_ground_monitor_data():
        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_satellite_job(start_date, "train")
        # resample data on daily basis using mean

    @task()
    def merge_datasets(ground_data: pd.DataFrame, satellite_data: pd.DataFrame) -> pd.DataFrame:
        ground_data = ground_data.groupby('site_id').resample("D", on='timestamp').mean(numeric_only=True)
        ground_data.reset_index(inplace=True)
        return satellite_data.merge(ground_data, on='timestamp')

    @task()
    def label_encoding(data):
        return SatelliteUtils.encode(data, 'LabelEncoder')

    @task()
    def time_related_features(data):
        return SatelliteUtils.get_time_features(data, 'daily')

    @task()
    def lag_features_extraction(data, frequency):
        return SatelliteUtils.lag_features(data, frequency=frequency, target_col='pm2_5')

    @task()
    def train_and_save_model(train_data):
        return SatelliteUtils.train_satellite_model(train_data)

    st_data = fetch_historical_satellite_data()
    gm_data = fetch_historical_ground_monitor_data()
    merged_data = merge_datasets(gm_data, st_data)
    encoded_data = label_encoding(merged_data)
    time_data = time_related_features(encoded_data)
    lag_data = lag_features_extraction(time_data, 'daily')
    train_and_save_model(lag_data)


train_satelllite_model()
