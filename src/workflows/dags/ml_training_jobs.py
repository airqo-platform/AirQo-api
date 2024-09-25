from datetime import datetime

import pandas as pd
from airflow.decorators import dag, task
from dateutil.relativedelta import relativedelta

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.ml_utils import BaseMlUtils, SatelliteUtils, ForecastUtils
from airqo_etl_utils.satellilte_utils import SatelliteMLUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "AirQo-forecast-models-training-job",
    schedule="0 1 * * 0",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job"],
)
def train_forecasting_models():
    # Tasks for training hourly forecast job
    @task()
    def fetch_training_data_for_hourly_forecast_model():
        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.HOURLY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_data(start_date, "train")

    @task()
    def preprocess_training_data_for_hourly_forecast_model(data):
        return BaseMlUtils.preprocess_data(data, "hourly", "train")

    @task()
    def get_hourly_lag_and_rolling_features(data):
        return BaseMlUtils.get_lag_and_roll_features(data, "pm2_5", "hourly")

    @task()
    def get_hourly_time_features(data):
        return BaseMlUtils.get_time_features(data, "hourly")

    @task()
    def get_hourly_cyclic_features(data):
        return BaseMlUtils.get_cyclic_features(data, "hourly")

    @task()
    def get_location_features(data):
        return BaseMlUtils.get_location_features(data)

    @task()
    def train_and_save_hourly_forecast_model(train_data):
        return ForecastUtils.train_and_save_forecast_models(train_data, frequency="hourly")

    # Daily forecast tasks
    @task()
    def fetch_training_data_for_daily_forecast_model():
        from dateutil.relativedelta import relativedelta
        from datetime import datetime

        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_data(start_date, "train")

    @task()
    def preprocess_training_data_for_daily_forecast_model(data):
        return BaseMlUtils.preprocess_data(data, "daily", job_type="train")

    @task()
    def get_daily_lag_and_rolling_features(data):
        return BaseMlUtils.get_lag_and_roll_features(data, "pm2_5", "daily")

    @task()
    def get_daily_time_features(data):
        return BaseMlUtils.get_time_features(data, "daily")

    @task()
    def get_daily_cyclic_features(data):
        return BaseMlUtils.get_cyclic_features(data, "daily")

    @task()
    def get_location_features(data):
        return BaseMlUtils.get_location_features(data)

    @task()
    def train_and_save_daily_model(train_data):
        return ForecastUtils.train_and_save_forecast_models(train_data, "daily")

    hourly_data = fetch_training_data_for_hourly_forecast_model()
    hourly_preprocessed_data = preprocess_training_data_for_hourly_forecast_model(
        hourly_data
    )
    hourly_lag_data = get_hourly_lag_and_rolling_features(hourly_preprocessed_data)
    hourly_time_data = get_hourly_time_features(hourly_lag_data)
    hourly_cyclic_data = get_hourly_cyclic_features(hourly_time_data)
    hourly_loc_data = get_location_features(hourly_cyclic_data)
    train_and_save_hourly_forecast_model(hourly_loc_data)

    daily_data = fetch_training_data_for_daily_forecast_model()
    daily_preprocessed_data = preprocess_training_data_for_daily_forecast_model(
        daily_data
    )
    daily_lag_data = get_daily_lag_and_rolling_features(daily_preprocessed_data)
    daily_time_data = get_daily_time_features(daily_lag_data)
    daily_cyclic_data = get_daily_cyclic_features(daily_time_data)
    daily_loc_data = get_location_features(daily_cyclic_data)
    train_and_save_daily_model(daily_loc_data)


train_forecasting_models()


@dag(
    "AirQo-satellite-model-training-job",
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job", "satellite"],
)
def training_job():
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
        return BigQueryApi().fetch_data(start_date, "train")

    @task()
    def merge_datasets(ground_data: pd.DataFrame, satellite_data: pd.DataFrame) -> pd.DataFrame:
        return satellite_data.merge(ground_data, on='timestamp')

    @task()
    def label_encoding(data):
        return SatelliteUtils.encode(data, 'LabelEncoder')

    @task()
    def time_related_features(data):
        return BaseMlUtils.get_time_features(data, 'daily')

    @task()
    def lag_features_extraction(data, frequency):
        return SatelliteUtils.lag_features(data, frequency='hourly')

    @task()
    def train_and_save_model(train_data):
        return BaseMlUtils.train_and_save_satellite_models(train_data)

    st_data = fetch_historical_satellite_data()
    # st_data = formatting_variables(st_data)
    gm_data = fetch_historical_ground_monitor_data()
    merged_data = merge_datasets(gm_data, st_data)
    encoded_data = label_encoding(merged_data)
    time_data = time_related_features(merged_data)
    lag_data = lag_features_extraction(merged_data, 'hourly')
    train_and_save_model(lag_data)


training_job()
