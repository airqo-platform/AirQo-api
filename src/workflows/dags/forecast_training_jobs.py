## This DAG contains jobs for all training jobs for machine learning models.
from typing import Dict
from datetime import datetime

from airflow.decorators import dag, task
from dateutil.relativedelta import relativedelta

import pandas as pd
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.ml_utils import ForecastUtils
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
        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(start_date, "train")

    @task()
    def preprocess_training_data_for_hourly_forecast_model(data):
        return ForecastUtils.preprocess_data(data, "hourly", "train")

    @task()
    def get_hourly_lag_and_rolling_features(data):
        return ForecastUtils.get_lag_and_roll_features(data, "pm2_5", "hourly")

    @task()
    def get_hourly_time_features(data):
        return ForecastUtils.get_time_features(data, "hourly")

    @task()
    def get_hourly_cyclic_features(data):
        return ForecastUtils.get_cyclic_features(data, "hourly")

    @task()
    def get_location_features(data):
        return ForecastUtils.get_location_features(data)

    @task()
    def train_and_save_hourly_forecast_model(train_data):
        return ForecastUtils.train_and_save_forecast_models(
            train_data, frequency="hourly"
        )

    # Daily forecast tasks
    @task()
    def fetch_training_data_for_daily_forecast_model():
        from dateutil.relativedelta import relativedelta

        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(start_date, "train")

    @task()
    def preprocess_training_data_for_daily_forecast_model(data):
        return ForecastUtils.preprocess_data(data, "daily", job_type="train")

    @task()
    def get_daily_lag_and_rolling_features(data):
        return ForecastUtils.get_lag_and_roll_features(data, "pm2_5", "daily")

    @task()
    def get_daily_time_features(data):
        return ForecastUtils.get_time_features(data, "daily")

    @task()
    def get_daily_cyclic_features(data):
        return ForecastUtils.get_cyclic_features(data, "daily")

    @task()
    def get_location_features(data):
        return ForecastUtils.get_location_features(data)

    @task()
    def train_and_save_daily_model(train_data):
        return ForecastUtils.train_and_save_forecast_models(
            train_data, frequency="daily"
        )

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


@dag(
    "AirQo-site-forecast-quarterly-training-job",
    schedule="0 2 1 */3 *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "forecast", "site-level", "training-job", "quarterly"],
)
def train_site_forecast_models_quarterly():
    from airqo_etl_utils.ml_utils import ForecastModelTrainer

    @task()
    def fetch_training_data_for_mean_model() -> pd.DataFrame:
        return ForecastModelTrainer.fetch_site_forecast_training_data()

    @task()
    def build_features_for_mean_model(raw_data: pd.DataFrame) -> pd.DataFrame:
        return ForecastModelTrainer._build_site_forecast_features(raw_data)

    @task()
    def train_mean_model(featured_data: pd.DataFrame) -> Dict:
        features = ForecastModelTrainer._select_numeric_training_features(featured_data)
        bucket_config = ForecastModelTrainer._get_model_bucket_config()
        return ForecastModelTrainer.train_point_and_save_to_gcs(
            featured_data,
            features=features,
            target="pm25_mean",
            model_kind="mean",
            date_col="day",
            project_name=bucket_config["project_name"],
            bucket_name=bucket_config["bucket_name"],
            blob_name="daily_pm25_mean_model.pkl",
        )

    @task(task_id="deploy_mean_model")
    def deploy_mean_model(training_metrics: Dict) -> Dict:
        # Training already performs conditional deployment to GCS.
        return training_metrics

    @task()
    def fetch_training_data_for_min_model() -> pd.DataFrame:
        return ForecastModelTrainer.fetch_site_forecast_training_data()

    @task()
    def build_features_for_min_model(raw_data: pd.DataFrame) -> pd.DataFrame:
        return ForecastModelTrainer._build_site_forecast_features(raw_data)

    @task()
    def train_min_model(featured_data: pd.DataFrame) -> Dict:
        features = ForecastModelTrainer._select_numeric_training_features(featured_data)
        bucket_config = ForecastModelTrainer._get_model_bucket_config()
        return ForecastModelTrainer.train_point_and_save_to_gcs(
            featured_data,
            features=features,
            target="pm25_min",
            model_kind="min",
            date_col="day",
            project_name=bucket_config["project_name"],
            bucket_name=bucket_config["bucket_name"],
            blob_name="daily_pm25_min_model.pkl",
        )

    @task(task_id="deploy_min_model")
    def deploy_min_model(training_metrics: Dict) -> Dict:
        # Training already performs conditional deployment to GCS.
        return training_metrics

    @task()
    def fetch_training_data_for_max_model() -> pd.DataFrame:
        return ForecastModelTrainer.fetch_site_forecast_training_data()

    @task()
    def build_features_for_max_model(raw_data: pd.DataFrame) -> pd.DataFrame:
        return ForecastModelTrainer._build_site_forecast_features(raw_data)

    @task()
    def train_max_model(featured_data: pd.DataFrame) -> Dict:
        features = ForecastModelTrainer._select_numeric_training_features(featured_data)
        bucket_config = ForecastModelTrainer._get_model_bucket_config()
        return ForecastModelTrainer.train_point_and_save_to_gcs(
            featured_data,
            features=features,
            target="pm25_max",
            model_kind="max",
            date_col="day",
            project_name=bucket_config["project_name"],
            bucket_name=bucket_config["bucket_name"],
            blob_name="daily_pm25_max_model.pkl",
        )

    @task(task_id="deploy_max_model")
    def deploy_max_model(training_metrics: Dict) -> Dict:
        # Training already performs conditional deployment to GCS.
        return training_metrics

    mean_raw_data = fetch_training_data_for_mean_model()
    mean_featured_data = build_features_for_mean_model(mean_raw_data)
    mean_metrics = train_mean_model(mean_featured_data)
    deploy_mean_model(mean_metrics)

    min_raw_data = fetch_training_data_for_min_model()
    min_featured_data = build_features_for_min_model(min_raw_data)
    min_metrics = train_min_model(min_featured_data)
    deploy_min_model(min_metrics)

    max_raw_data = fetch_training_data_for_max_model()
    max_featured_data = build_features_for_max_model(max_raw_data)
    max_metrics = train_max_model(max_featured_data)
    deploy_max_model(max_metrics)


train_site_forecast_models_quarterly()
train_forecasting_models()
