## This module defines the Airflow DAG for quarterly site-level hourly forecast
## model training.

from datetime import timedelta
from typing import Dict

from airflow.decorators import dag, task
import pandas as pd

from airqo_etl_utils.ml_utils import ForecastModelTrainer
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from dag_docs import site_hourly_forecast_training_doc


@dag(
    "AirQo-site-hourly-forecast-quarterly-training-job",
    schedule="0 2 1 */3 *",  # Runs at 02:00 on day 1 of every 3rd month
    default_args={
        **AirflowUtils.dag_default_configs(),
        "retries": 3,  # Retry failed tasks up to 3 times
        "retry_delay": timedelta(minutes=10),  # Wait 10 minutes before retry
        "retry_exponential_backoff": True,  # Use exponential backoff for retries
        "max_retry_delay": timedelta(minutes=60),  # Maximum delay between retries
    },
    catchup=False,
    tags=["airqo", "forecast", "site-level", "hourly", "training-job", "quarterly"],
    doc_md=site_hourly_forecast_training_doc,
)
def train_site_hourly_forecast_models_quarterly():
    """
    Quarterly DAG for training site-level hourly PM2.5 forecasting models.

    MLflow logging and GCS model persistence are handled inside
    ForecastModelTrainer.
    """

    @task()
    def fetch_hourly_training_data() -> pd.DataFrame:
        """Fetch 3 months of site-level hourly historical training data."""
        return ForecastModelTrainer.fetch_site_hourly_forecast_training_data()

    @task()
    def build_hourly_features(raw_data: pd.DataFrame) -> pd.DataFrame:
        """Build model-ready hourly features from raw site-level hourly data."""
        return ForecastModelTrainer._build_site_hourly_forecast_features(raw_data)

    @task()
    def train_hourly_mean_model(featured_data: pd.DataFrame) -> Dict:
        """Train the hourly point forecast model for mean PM2.5."""
        return ForecastModelTrainer.train_site_hourly_point_forecast_model(
            featured_data,
            target="pm25_mean",
            model_kind="mean",
            blob_name="hourly_10day_pm25_mean_model.pkl",
        )

    @task()
    def train_hourly_min_model(featured_data: pd.DataFrame) -> Dict:
        """Train the hourly point forecast model for minimum PM2.5."""
        return ForecastModelTrainer.train_site_hourly_point_forecast_model(
            featured_data,
            target="pm25_min",
            model_kind="min",
            blob_name="hourly_10day_pm25_min_model.pkl",
        )

    @task()
    def train_hourly_max_model(featured_data: pd.DataFrame) -> Dict:
        """Train the hourly point forecast model for maximum PM2.5."""
        return ForecastModelTrainer.train_site_hourly_point_forecast_model(
            featured_data,
            target="pm25_max",
            model_kind="max",
            blob_name="hourly_10day_pm25_max_model.pkl",
        )

    @task()
    def train_hourly_low_quantile_model(featured_data: pd.DataFrame) -> Dict:
        """Train the lower quantile hourly PM2.5 model at alpha=0.1."""
        return ForecastModelTrainer.train_site_hourly_quantile_forecast_model(
            featured_data,
            alpha=0.1,
            blob_name="hourly_10day_pm25_low_model.pkl",
        )

    @task()
    def train_hourly_high_quantile_model(featured_data: pd.DataFrame) -> Dict:
        """Train the upper quantile hourly PM2.5 model at alpha=0.9."""
        return ForecastModelTrainer.train_site_hourly_quantile_forecast_model(
            featured_data,
            alpha=0.9,
            blob_name="hourly_10day_pm25_high_model.pkl",
        )

    hourly_raw_data = fetch_hourly_training_data()
    hourly_featured_data = build_hourly_features(hourly_raw_data)

    train_hourly_mean_model(hourly_featured_data)
    train_hourly_min_model(hourly_featured_data)
    train_hourly_max_model(hourly_featured_data)
    train_hourly_low_quantile_model(hourly_featured_data)
    train_hourly_high_quantile_model(hourly_featured_data)


# Instantiate DAG at module level so Airflow can discover it.
site_hourly_forecast_quarterly_dag = train_site_hourly_forecast_models_quarterly()
