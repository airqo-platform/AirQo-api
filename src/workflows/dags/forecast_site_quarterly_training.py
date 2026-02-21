"""Quarterly site-level PM2.5 model training DAG.

Trains and saves:
- daily_pm25_mean_model.pkl
- daily_pm25_low_model.pkl (10th quantile)
- daily_pm25_high_model.pkl (90th quantile)
"""

from typing import Dict

import pandas as pd

from airqo_etl_utils.ml_utils import ForecastModelTrainer, ForecastSiteUtils

try:
    from airflow.decorators import dag, task
    from airqo_etl_utils.workflows_custom_utils import AirflowUtils
    AIRFLOW_AVAILABLE = True
except Exception:
    dag = None
    task = None
    AirflowUtils = None
    AIRFLOW_AVAILABLE = False


def run_site_forecast_quarterly_training() -> Dict[str, Dict]:
    return ForecastSiteUtils.run_site_forecast_quarterly_training()


if AIRFLOW_AVAILABLE:

    @dag(
        "AirQo-site-forecast-quarterly-training-job",
        schedule="0 2 1 */3 *",
        default_args=AirflowUtils.dag_default_configs(),
        catchup=False,
        tags=["airqo", "forecast", "site-level", "training-job", "quarterly"],
    )
    def train_site_forecast_models_quarterly():
        @task()
        def fetch_training_data() -> pd.DataFrame:
            return ForecastSiteUtils._fetch_site_forecast_training_data()

        @task()
        def build_features(raw_data: pd.DataFrame) -> pd.DataFrame:
            return ForecastSiteUtils._build_site_forecast_features(raw_data)

        @task()
        def train_mean_model(featured_data: pd.DataFrame) -> Dict:
            features = ForecastSiteUtils._select_numeric_training_features(featured_data)
            bucket_config = ForecastSiteUtils._get_model_bucket_config()
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
        def train_low_q10_model(featured_data: pd.DataFrame) -> Dict:
            features = ForecastSiteUtils._select_numeric_training_features(featured_data)
            bucket_config = ForecastSiteUtils._get_model_bucket_config()
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
        def train_high_q90_model(featured_data: pd.DataFrame) -> Dict:
            features = ForecastSiteUtils._select_numeric_training_features(featured_data)
            bucket_config = ForecastSiteUtils._get_model_bucket_config()
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

        @task(task_id="inserting_model_in_bucket")
        def inserting_model_in_bucket(
            mean_metrics: Dict,
            low_q10_metrics: Dict,
            high_q90_metrics: Dict,
        ) -> Dict[str, Dict]:
            return {
                "mean": mean_metrics,
                "low_q10": low_q10_metrics,
                "high_q90": high_q90_metrics,
            }

        raw_data = fetch_training_data()
        featured_data = build_features(raw_data)
        mean_metrics = train_mean_model(featured_data)
        low_q10_metrics = train_low_q10_model(featured_data)
        high_q90_metrics = train_high_q90_model(featured_data)

        inserting_model_in_bucket(mean_metrics, low_q10_metrics, high_q90_metrics)


    train_site_forecast_models_quarterly()
