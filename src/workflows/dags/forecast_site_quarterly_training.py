"""Quarterly site-level PM2.5 model training DAG.

Trains and saves:
- daily_pm25_mean_model.pkl
- daily_pm25_low_model.pkl (10th quantile)
- daily_pm25_high_model.pkl (90th quantile)
"""

from datetime import datetime
from typing import Dict

import pandas as pd
from dateutil.relativedelta import relativedelta

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import DateUtils
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
    current_date = datetime.today()
    start_date = current_date - relativedelta(months=60)  # Number of months used in training data

    start_date_str = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
    end_date_str = DateUtils.date_to_str(current_date, str_format="%Y-%m-%d")

    raw_data = BigQueryApi().fetch_site_data_for_forecast_jobs(
        start_date_time=start_date_str,
        end_date_time=end_date_str,
        job_type="train",
        min_hours=18,
    )

    if raw_data.empty:
        raise ValueError("No site forecast training data found in the selected period.")

    featured_data = ForecastSiteUtils.add_time_lag_roll_features(
        raw_data,
        date_col="day",
        site_col="site_id",
        target_col="pm25_mean",
        lags=(1, 2, 3, 7, 14),
        rolling_window=(7, 14),
        roll_shift=1,
        dropna=True,
    )

    if featured_data.empty:
        raise ValueError("Feature engineering produced an empty dataframe.")

    featured_data = featured_data.copy()
    featured_data = pd.get_dummies(
        featured_data,
        columns=["site_id"],
        prefix="site",
        dtype="int64",
    )

    excluded = {
        "day",
        "site_id",
        "site_name",
        "pm25_mean",
        "pm25_min",
        "pm25_max",
        "n_hours",
    }
    features = [
        col
        for col in featured_data.columns
        if col not in excluded and pd.api.types.is_numeric_dtype(featured_data[col])
    ]

    if not features:
        raise ValueError("No numeric features available for training.")

    project_name = configuration.GOOGLE_CLOUD_PROJECT_ID
    bucket_name = configuration.FORECAST_MODELS_BUCKET
    if not project_name or not bucket_name:
        raise ValueError(
            "Missing required config: GOOGLE_CLOUD_PROJECT_ID or FORECAST_MODELS_BUCKET."
        )

    results: Dict[str, Dict] = {}

    results["mean"] = ForecastModelTrainer.train_point_and_save_to_gcs(
        featured_data,
        features=features,
        target="pm25_mean",
        model_kind="mean",
        date_col="day",
        project_name=project_name,
        bucket_name=bucket_name,
        blob_name="daily_pm25_mean_model.pkl",
    )

    results["low_q10"] = ForecastModelTrainer.train_quantile_and_save_to_gcs(
        featured_data,
        alpha=0.1,
        features=features,
        target="pm25_mean",
        date_col="day",
        project_name=project_name,
        bucket_name=bucket_name,
        blob_name="daily_pm25_low_model.pkl",
    )

    results["high_q90"] = ForecastModelTrainer.train_quantile_and_save_to_gcs(
        featured_data,
        alpha=0.9,
        features=features,
        target="pm25_mean",
        date_col="day",
        project_name=project_name,
        bucket_name=bucket_name,
        blob_name="daily_pm25_high_model.pkl",
    )

    return results


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
        def run_training() -> Dict[str, Dict]:
            return run_site_forecast_quarterly_training()

        run_training()


    train_site_forecast_models_quarterly()
