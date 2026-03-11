## This module defines Airflow DAGs for training AirQo machine learning forecast models.
## It contains:
## 1. Weekly training for hourly and daily forecast models
## 2. Quarterly training for site-level forecast models

from typing import Dict
from datetime import datetime, timedelta

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
    schedule="0 2 3 */3 *",  # Runs at 02:00 on day 3 of every 3rd month
    default_args={
        **AirflowUtils.dag_default_configs(),
        "retries": 3,  # Retry failed tasks up to 3 times
        "retry_delay": timedelta(minutes=10),  # Wait 10 minutes before retry        
        "retry_exponential_backoff": True,  # Use exponential backoff for retries
        "max_retry_delay": timedelta(minutes=60),  # Maximum delay between retries
    },
    catchup=False,  # Do not backfill missed DAG runs
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job"],
)
def train_forecasting_models():
    """
    Weekly DAG for training both hourly and daily forecasting models.

    Flow for each frequency:
    fetch raw data -> preprocess -> create lag/rolling features ->
    create time features -> create cyclic features -> add location features ->
    train and save model
    """

    @task()
    def fetch_training_data_for_hourly_forecast_model():
        """
        Fetch raw historical data for hourly forecast training.

        The lookback window is controlled by:
        configuration.HOURLY_FORECAST_TRAINING_JOB_SCOPE
        """
        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.HOURLY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(start_date, "train")

    @task()
    def preprocess_training_data_for_hourly_forecast_model(data):
        """
        Clean and standardize hourly raw data before feature engineering.
        """
        return ForecastUtils.preprocess_data(data, "hourly", "train")

    @task()
    def get_hourly_lag_and_rolling_features(data):
        """
        Create lag and rolling statistics for hourly PM2.5.
        """
        return ForecastUtils.get_lag_and_roll_features(data, "pm2_5", "hourly")

    @task()
    def get_hourly_time_features(data):
        """
        Add time-based features such as hour, day, month, weekday, etc.
        """
        return ForecastUtils.get_time_features(data, "hourly")

    @task()
    def get_hourly_cyclic_features(data):
        """
        Add cyclic encodings for periodic variables such as hour-of-day
        and day-of-week.
        """
        return ForecastUtils.get_cyclic_features(data, "hourly")

    @task()
    def get_hourly_location_features(data):
        """
        Add spatial or location-based features to the hourly training dataset.
        """
        return ForecastUtils.get_location_features(data)

    @task()
    def train_and_save_hourly_forecast_model(train_data):
        """
        Train the hourly forecast model and save the trained artifact.
        """
        return ForecastUtils.train_and_save_forecast_models(
            train_data, frequency="hourly"
        )

    @task()
    def fetch_training_data_for_daily_forecast_model():
        """
        Fetch raw historical data for daily forecast training.

        The lookback window is controlled by:
        configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE
        """
        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(start_date, "train")

    @task()
    def preprocess_training_data_for_daily_forecast_model(data):
        """
        Clean and standardize daily raw data before feature engineering.
        """
        return ForecastUtils.preprocess_data(data, "daily", job_type="train")

    @task()
    def get_daily_lag_and_rolling_features(data):
        """
        Create lag and rolling statistics for daily PM2.5.
        """
        return ForecastUtils.get_lag_and_roll_features(data, "pm2_5", "daily")

    @task()
    def get_daily_time_features(data):
        """
        Add time-based features such as day, month, weekday, season, etc.
        """
        return ForecastUtils.get_time_features(data, "daily")

    @task()
    def get_daily_cyclic_features(data):
        """
        Add cyclic encodings for periodic daily variables.
        """
        return ForecastUtils.get_cyclic_features(data, "daily")

    @task()
    def get_daily_location_features(data):
        """
        Add spatial or location-based features to the daily training dataset.
        """
        return ForecastUtils.get_location_features(data)

    @task()
    def train_and_save_daily_model(train_data):
        """
        Train the daily forecast model and save the trained artifact.
        """
        return ForecastUtils.train_and_save_forecast_models(
            train_data, frequency="daily"
        )

    # -----------------------------
    # Hourly forecast training flow
    # -----------------------------
    hourly_data = fetch_training_data_for_hourly_forecast_model()
    hourly_preprocessed_data = preprocess_training_data_for_hourly_forecast_model(
        hourly_data
    )
    hourly_lag_data = get_hourly_lag_and_rolling_features(hourly_preprocessed_data)
    hourly_time_data = get_hourly_time_features(hourly_lag_data)
    hourly_cyclic_data = get_hourly_cyclic_features(hourly_time_data)
    hourly_loc_data = get_hourly_location_features(hourly_cyclic_data)
    train_and_save_hourly_forecast_model(hourly_loc_data)

    # ----------------------------
    # Daily forecast training flow
    # ----------------------------
    daily_data = fetch_training_data_for_daily_forecast_model()
    daily_preprocessed_data = preprocess_training_data_for_daily_forecast_model(
        daily_data
    )
    daily_lag_data = get_daily_lag_and_rolling_features(daily_preprocessed_data)
    daily_time_data = get_daily_time_features(daily_lag_data)
    daily_cyclic_data = get_daily_cyclic_features(daily_time_data)
    daily_loc_data = get_daily_location_features(daily_cyclic_data)
    train_and_save_daily_model(daily_loc_data)


@dag(
    "AirQo-site-forecast-quarterly-training-job",
    schedule="0 2 1 */3 *",  # Runs at 02:00 on day 1 of every 3rd month
    default_args={
        **AirflowUtils.dag_default_configs(),
        "retries": 3,  # Retry failed tasks up to 3 times
        "retry_delay": timedelta(minutes=10),  # Wait 10 minutes before retry
        "retry_exponential_backoff": True,  # Use exponential backoff for retries
        "max_retry_delay": timedelta(minutes=60),  # Maximum delay between retries
    },
    catchup=False,
    tags=["airqo", "forecast", "site-level", "training-job", "quarterly"],
)
def train_site_forecast_models_quarterly():
    """
    Quarterly DAG for training site-level PM2.5 forecasting models.

    Models trained:
    - Mean model
    - Min model
    - Max model
    - Low quantile model (alpha=0.1)
    - High quantile model (alpha=0.9)

    Common flow:
    fetch raw site data -> build features -> train each model -> deploy placeholder
    """
    from airqo_etl_utils.ml_utils import ForecastModelTrainer

    @task()
    def fetch_training_data() -> pd.DataFrame:
        """
        Fetch site-level historical training data used for quarterly retraining.
        """
        return ForecastModelTrainer.fetch_site_forecast_training_data()

    @task()
    def build_features(raw_data: pd.DataFrame) -> pd.DataFrame:
        """
        Build all model-ready features from the raw site-level data.
        """
        return ForecastModelTrainer._build_site_forecast_features(raw_data)

    @task()
    def train_mean_model(featured_data: pd.DataFrame) -> Dict:
        """
        Train the point forecast model for mean PM2.5 and save it to GCS.
        """
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

    @task()
    def deploy_mean_model(training_metrics: Dict) -> Dict:
        """
        Placeholder deployment task for the mean model.

        Currently returns training metrics only.
        Replace this with actual deployment or registration logic if needed.
        """
        return training_metrics

    @task()
    def train_min_model(featured_data: pd.DataFrame) -> Dict:
        """
        Train the point forecast model for minimum PM2.5 and save it to GCS.
        """
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

    @task()
    def deploy_min_model(training_metrics: Dict) -> Dict:
        """
        Placeholder deployment task for the min model.
        """
        return training_metrics

    @task()
    def train_max_model(featured_data: pd.DataFrame) -> Dict:
        """
        Train the point forecast model for maximum PM2.5 and save it to GCS.
        """
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

    @task()
    def deploy_max_model(training_metrics: Dict) -> Dict:
        """
        Placeholder deployment task for the max model.
        """
        return training_metrics

    @task()
    def train_low_quantile_model(featured_data: pd.DataFrame) -> Dict:
        """
        Train the lower quantile PM2.5 model at alpha=0.1 and save it to GCS.
        """
        features = ForecastModelTrainer._select_numeric_training_features(featured_data)
        bucket_config = ForecastModelTrainer._get_model_bucket_config()

        return ForecastModelTrainer.train_quantile_and_save_to_gcs(
            featured_data,
            alpha=0.1,
            features=features,
            target="pm25_mean",
            date_col="day",
            project_name=bucket_config["project_name"],
            bucket_name=bucket_config["bucket_name"],
            blob_name="daily_pm25_low_model.pkl",
        )

    @task()
    def deploy_low_quantile_model(training_metrics: Dict) -> Dict:
        """
        Placeholder deployment task for the low quantile model.
        """
        return training_metrics

    @task()
    def train_high_quantile_model(featured_data: pd.DataFrame) -> Dict:
        """
        Train the upper quantile PM2.5 model at alpha=0.9 and save it to GCS.
        """
        features = ForecastModelTrainer._select_numeric_training_features(featured_data)
        bucket_config = ForecastModelTrainer._get_model_bucket_config()

        return ForecastModelTrainer.train_quantile_and_save_to_gcs(
            featured_data,
            alpha=0.9,
            features=features,
            target="pm25_mean",
            date_col="day",
            project_name=bucket_config["project_name"],
            bucket_name=bucket_config["bucket_name"],
            blob_name="daily_pm25_high_model.pkl",
        )

    @task()
    def deploy_high_quantile_model(training_metrics: Dict) -> Dict:
        """
        Placeholder deployment task for the high quantile model.
        """
        return training_metrics

    # --------------------------------------
    # Shared site-level data preparation flow
    # --------------------------------------
    raw_data = fetch_training_data()
    featured_data = build_features(raw_data)

    # -------------------------------------------------------
    # Train each model independently from the same feature set
    # These training branches can run in parallel in Airflow
    # -------------------------------------------------------
    mean_metrics = train_mean_model(featured_data)
    deploy_mean_model(mean_metrics)

    min_metrics = train_min_model(featured_data)
    deploy_min_model(min_metrics)

    max_metrics = train_max_model(featured_data)
    deploy_max_model(max_metrics)

    low_quantile_metrics = train_low_quantile_model(featured_data)
    deploy_low_quantile_model(low_quantile_metrics)

    high_quantile_metrics = train_high_quantile_model(featured_data)
    deploy_high_quantile_model(high_quantile_metrics)


# Instantiate DAGs at module level so Airflow can discover them.
forecast_training_dag = train_forecasting_models()
site_forecast_quarterly_dag = train_site_forecast_models_quarterly()