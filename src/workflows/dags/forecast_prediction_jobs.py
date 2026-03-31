## This module contains DAGS for prediction/inference jobs of AirQo.
from airflow.decorators import dag, task
from airflow.utils.trigger_rule import TriggerRule
from datetime import datetime, timedelta, timezone
import logging

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.ml_utils import BaseMlUtils, ForecastModelTrainer, ForecastUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from airqo_etl_utils.constants import Frequency
from airqo_etl_utils.constants import SITE_DAILY_FORECAST_MET_COLUMNS
from airqo_etl_utils.date import DateUtils

logger = logging.getLogger("airflow.task")


def _has_site_forecast_met_data(data) -> bool:
    """Check if the enriched site forecast data contains any MET.no weather values."""
    if data is None or getattr(data, "empty", True):
        return False

    return any(
        column in data.columns and data[column].notna().any()
        for column in SITE_DAILY_FORECAST_MET_COLUMNS
    )


@dag(
    "AirQo-forecasting-job",
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "hourly-forecast", "daily-forecast", "prediction-job"],
)
def make_forecasts():
    """Run the hourly and daily PM2.5 forecast pipelines.
    This DAG is the legacy device forecast flow. It fetches device-level
    prediction history from BigQuery, engineers the full model feature set
    explicitly in the DAG, then persists forecasts to both BigQuery and MongoDB.
    
    """
    bucket = Config.FORECAST_MODELS_BUCKET
    project_id = Config.GOOGLE_CLOUD_PROJECT_ID

    ### Hourly forecast tasks
    @task()
    def get_historical_data_for_hourly_forecasts():
        start_date = datetime.now(timezone.utc) - timedelta(
            hours=int(Config.HOURLY_FORECAST_PREDICTION_JOB_SCOPE)
        )

        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(start_date, "predict")

    @task()
    def preprocess_historical_data_hourly_forecast(data):
        return BaseMlUtils.preprocess_data(data, Frequency.HOURLY, job_type="predict")

    @task
    def generate_lag_and_rolling_features_hourly_forecast(data):
        return BaseMlUtils.get_lag_and_roll_features(data, "pm2_5", Frequency.HOURLY)

    @task()
    def get_time_features_hourly_forecast(data):
        return BaseMlUtils.get_time_features(data, Frequency.HOURLY)

    @task()
    def get_cyclic_features_hourly_forecast(data):
        return BaseMlUtils.get_cyclic_features(data, Frequency.HOURLY)

    @task()
    def get_location_features_hourly_forecast(data):
        return BaseMlUtils.get_location_features(data)

    @task()
    def make_hourly_forecasts(data):
        return ForecastUtils.generate_forecasts(
            data=data,
            project_name=project_id,
            bucket_name=bucket,
            frequency=Frequency.HOURLY,
        )

    @task()
    def save_hourly_forecasts_to_bigquery(data):
        bigquery_api = BigQueryApi()
        bigquery_api.load_data(data, Config.BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE)

    @task()
    def save_hourly_forecasts_to_mongo(data):
        ForecastUtils.save_forecasts_to_mongo(data, Frequency.HOURLY)

    # Daily forecast tasks
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def get_historical_data_for_daily_forecasts(**kwargs):

        execution_date = kwargs["dag_run"].execution_date
        start_date = execution_date - timedelta(
            days=int(Config.DAILY_FORECAST_PREDICTION_JOB_SCOPE)
        )

        start_date = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(start_date, "predict")

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def preprocess_historical_data_daily_forecast(data):
        return BaseMlUtils.preprocess_data(data, Frequency.DAILY, job_type="predict")

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def generate_lag_and_rolling_features_daily_forecast(data):
        return BaseMlUtils.get_lag_and_roll_features(data, "pm2_5", Frequency.DAILY)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def get_time_features_daily_forecast(data):
        return BaseMlUtils.get_time_features(data, Frequency.DAILY)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def get_cyclic_features_daily_forecast(data):
        return BaseMlUtils.get_cyclic_features(data, Frequency.DAILY)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def get_location_features_daily_forecast(data):
        return BaseMlUtils.get_location_features(data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def make_daily_forecasts(data):
        return ForecastUtils.generate_forecasts(
            data=data,
            project_name=project_id,
            bucket_name=bucket,
            frequency=Frequency.DAILY,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_daily_forecasts_to_bigquery(data):
        bigquery_api = BigQueryApi()
        bigquery_api.load_data(data, Config.BIGQUERY_DAILY_FORECAST_EVENTS_TABLE)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_daily_forecasts_to_mongo(data):
        ForecastUtils.save_forecasts_to_mongo(data, Frequency.DAILY)

    # Hourly forecast pipeline
    hourly_data = get_historical_data_for_hourly_forecasts()
    hourly_preprocessed_data = preprocess_historical_data_hourly_forecast(hourly_data)
    hourly_lag_and_roll_features = generate_lag_and_rolling_features_hourly_forecast(
        hourly_preprocessed_data
    )
    hourly_time_features = get_time_features_hourly_forecast(
        hourly_lag_and_roll_features
    )
    hourly_cyclic_features = get_cyclic_features_hourly_forecast(hourly_time_features)
    hourly_location_features = get_location_features_hourly_forecast(
        hourly_cyclic_features
    )
    hourly_forecasts = make_hourly_forecasts(hourly_location_features)
    save_hourly_forecasts_to_bigquery(hourly_forecasts)
    save_hourly_forecasts_to_mongo(hourly_forecasts)

    # Daily forecast pipeline
    daily_data = get_historical_data_for_daily_forecasts()
    daily_preprocessed_data = preprocess_historical_data_daily_forecast(daily_data)
    daily_lag_and_roll_features = generate_lag_and_rolling_features_daily_forecast(
        daily_preprocessed_data
    )
    daily_time_features = get_time_features_daily_forecast(daily_lag_and_roll_features)
    daily_cyclic_features = get_cyclic_features_daily_forecast(daily_time_features)
    daily_location_features = get_location_features_daily_forecast(
        daily_cyclic_features
    )
    daily_forecasts = make_daily_forecasts(daily_location_features)
    save_daily_forecasts_to_bigquery(daily_forecasts)
    save_daily_forecasts_to_mongo(daily_forecasts)
make_forecasts()

@dag(
    "AirQo-site-daily-forecasting-job_Q",
    schedule="0 3 * * *",
    default_args={
        **AirflowUtils.dag_default_configs(),
        "retries": 3,
        "retry_delay": timedelta(minutes=10),
        "retry_exponential_backoff": True,
        "max_retry_delay": timedelta(minutes=60),
    },
    catchup=False,
    tags=["airqo", "forecast", "site-level", "prediction-job", "daily"],
    description="Daily site-level PM forecasting pipeline.",
)
def make_site_daily_forecasts():
    """Run the site-level daily PM2.5 forecast pipeline.

    Key characteristics:
    - Uses site-level prediction data prepared inside ``ForecastModelTrainer``.
    - Allows sparse recent data so newly deployed sites can still receive a
      forecast.
    - Saves the PM forecast to MongoDB first.
    - Attempts MET.no enrichment afterwards and only applies the update when
      weather fields are actually returned.
    """    
    @task()
    def fetch_site_prediction_data(**kwargs):
        """Fetch site-level prediction history for the configured lookback window."""
        execution_date = kwargs["dag_run"].execution_date
        lookback_days = int(Config.DAILY_FORECAST_PREDICTION_JOB_SCOPE or 30)
        return ForecastModelTrainer.fetch_site_prediction_data(
            execution_date=execution_date,
            lookback_days=lookback_days,
        )

    @task()
    def generate_site_forecasts(data):
        """Generate forward site-level daily forecasts without MET enrichment."""
        horizon = int(Config.DAILY_FORECAST_HORIZON or 7)
        return ForecastModelTrainer.generate_site_daily_forecasts(
            data,
            horizon=horizon,
            include_met_no_weather=False,
        )

    @task()
    
    def enrich_site_forecasts_with_met(data):
        """Enrich site-level daily forecasts with MET.no weather data."""
        return ForecastModelTrainer._enrich_site_daily_forecasts_with_met_no_weather(
            data,
            fail_on_error=True,
        )

    @task()
    def save_site_forecasts_to_mongodb(data):
        """Save site-level daily forecasts to MongoDB."""
        return ForecastModelTrainer.save_site_daily_forecasts_to_mongo(data)

    @task(trigger_rule=TriggerRule.ALL_DONE)
    def resolve_site_forecasts_for_met_updates(**kwargs):
        """Resolve site-level daily forecasts for MET.no weather updates."""
        taskinstance = kwargs.get("ti") or kwargs.get("task_instance")
        enriched_data = taskinstance.xcom_pull(
            task_ids="enrich_site_forecasts_with_met"
        )

        if enriched_data is not None and _has_site_forecast_met_data(enriched_data):
            return enriched_data

        logger.warning(
            "MET enrichment failed or returned no MET values. Keeping PM forecast already saved in MongoDB."
        )
        return None

    @task()
    def update_site_forecasts_met_in_mongodb(data):
        """Update site-level daily forecasts in MongoDB with MET.no weather data."""
        if data is None:
            return {"updated": False, "reason": "met_unavailable"}

        details = ForecastModelTrainer.save_site_daily_forecasts_to_mongo(data)
        return {"updated": True, "details": details}

    site_data = fetch_site_prediction_data()
    site_forecasts = generate_site_forecasts(site_data)
    mongodb_save = save_site_forecasts_to_mongodb(site_forecasts)
    site_forecasts_with_met = enrich_site_forecasts_with_met(site_forecasts)
    mongodb_save >> site_forecasts_with_met
    site_forecasts_for_met_updates = resolve_site_forecasts_for_met_updates()
    site_forecasts_with_met >> site_forecasts_for_met_updates
    update_site_forecasts_met_in_mongodb(site_forecasts_for_met_updates)

site_daily_forecast_prediction_dag = make_site_daily_forecasts()
