from datetime import datetime, timezone

import pandas as pd
from airflow.decorators import dag, task
from dateutil.relativedelta import relativedelta

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.ml_utils import SatelliteUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    dag_id="AirQo-satellite-model-training-job",
    schedule="0 0 1 * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job", "satellite"],
)
def train_satellite_model():
    @task()
    def fetch_historical_satellite_data():

        start_date = datetime.now(timezone.utc) - relativedelta(
            months=int(configuration.SATELLITE_TRAINING_SCOPE)
        )
        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_satellite_readings(start_date)

    @task()
    def fetch_historical_ground_monitor_data():
        current_date = datetime.now(timezone.utc)
        start_date = current_date - relativedelta(
            months=int(configuration.SATELLITE_TRAINING_SCOPE)
        )
        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_satellite_job(start_date, "train")

    @task()
    def merge_datasets(
        ground_data: pd.DataFrame, satellite_data: pd.DataFrame
    ) -> pd.DataFrame:
        ground_data["timestamp"] = pd.to_datetime(ground_data["timestamp"])
        satellite_data["timestamp"] = pd.to_datetime(satellite_data["timestamp"])

        ground_data["city"] = ground_data["city"].str.lower()
        satellite_data["city"] = satellite_data["city"].str.lower()
        return ground_data.merge(satellite_data, on=["timestamp", "city"], how="left")

    @task()
    def time_related_features(data):
        return SatelliteUtils.get_time_features(data, "daily")

    # @task()
    # def lag_features_extraction(data, frequency):
    #     return SatelliteUtils.lag_features(
    #         data, frequency=frequency, target_col="pm2_5"
    #     )

    @task()
    def train_and_save_model(train_data):
        return SatelliteUtils.train_satellite_model(train_data)

    st_data = fetch_historical_satellite_data()
    gm_data = fetch_historical_ground_monitor_data()
    merged_data = merge_datasets(gm_data, st_data)
    time_data = time_related_features(merged_data)
    # lag_data = lag_features_extraction(time_data, "daily")
    train_and_save_model(time_data)


train_satellite_model()
