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


def _log_context(**context):
    parts = [f"{key}={value}" for key, value in context.items() if value is not None]
    return f" ({', '.join(parts)})" if parts else ""


def _has_site_forecast_met_data(data) -> bool:
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
    @task()
    def fetch_site_prediction_data(**kwargs):
        execution_date = kwargs["dag_run"].execution_date
        end_date = execution_date - timedelta(days=1)
        lookback_days = int(Config.DAILY_FORECAST_PREDICTION_JOB_SCOPE or 30)
        start_date = end_date - timedelta(days=lookback_days)
        start_date_str = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        end_date_str = DateUtils.date_to_str(end_date, str_format="%Y-%m-%d")

        try:
            return BigQueryApi().fetch_raw_site_data_for_forecast_jobs(
                start_date_time=start_date_str,
                end_date_time=end_date_str,
            )
        except Exception as exc:
            logger.exception(
                "Failed to fetch site prediction data%s: %s",
                _log_context(
                    execution_date=execution_date,
                    start_date=start_date_str,
                    end_date=end_date_str,
                    lookback_days=lookback_days,
                ),
                exc,
            )
            raise

    @task()
    def generate_site_forecasts(data):
        horizon = int(Config.DAILY_FORECAST_HORIZON or 7)
        try:
            return ForecastModelTrainer.generate_site_daily_forecasts(
                data,
                horizon=horizon,
                include_met_no_weather=False,
            )
        except Exception as exc:
            logger.exception(
                "Failed to generate site daily forecasts%s: %s",
                _log_context(horizon=horizon, input_rows=len(data) if data is not None else None),
                exc,
            )
            raise

    @task(
        retries=3,
        retry_delay=timedelta(minutes=10),
        retry_exponential_backoff=True,
        max_retry_delay=timedelta(minutes=60),
    )
    def enrich_site_forecasts_with_met(data):
        try:
            return ForecastModelTrainer._enrich_site_daily_forecasts_with_met_no_weather(
                data,
                fail_on_error=True,
            )
        except Exception as exc:
            logger.exception(
                "MET enrichment failed%s. Airflow will retry before fallback: %s",
                _log_context(rows=len(data) if data is not None else None),
                exc,
            )
            raise

    @task(trigger_rule=TriggerRule.ALL_DONE)
    def resolve_site_forecasts_for_met_updates(**kwargs):
        taskinstance = kwargs.get("ti") or kwargs.get("task_instance")
        enriched_data = taskinstance.xcom_pull(
            task_ids="enrich_site_forecasts_with_met"
        )

        if enriched_data is not None:
            return enriched_data

        logger.warning(
            "MET enrichment failed after retries. Skipping MET column updates."
        )
        return None

    @task()
    def save_site_forecasts_to_mongodb(data):
        try:
            details = ForecastModelTrainer._save_site_daily_forecasts_to_mongo(data)
            return {"target": "mongodb", "success": True, "details": details}
        except Exception as exc:
            logger.exception(
                "Failed to save site forecasts to MongoDB%s: %s",
                _log_context(rows=len(data) if data is not None else None),
                exc,
            )
            return {"target": "mongodb", "success": False, "error": str(exc)}

    @task()
    def save_site_forecasts_to_aws(data):
        try:
            details = ForecastModelTrainer._save_site_daily_forecasts_to_aws(data)
            return {"target": "aws", "success": True, "details": details}
        except Exception as exc:
            logger.exception(
                "Failed to save site forecasts to AWS%s: %s",
                _log_context(rows=len(data) if data is not None else None),
                exc,
            )
            return {"target": "aws", "success": False, "error": str(exc)}

    @task()
    def save_site_forecasts_to_bigquery(data):
        try:
            details = ForecastModelTrainer._save_site_daily_forecasts_to_bigquery(data)
            return {"target": "bigquery", "success": True, "details": details}
        except Exception as exc:
            logger.exception(
                "Failed to save site forecasts to BigQuery%s: %s",
                _log_context(rows=len(data) if data is not None else None),
                exc,
            )
            return {"target": "bigquery", "success": False, "error": str(exc)}

    @task()
    def validate_site_forecast_saves(mongodb_result, aws_result, bigquery_result):
        results = [mongodb_result, aws_result, bigquery_result]
        succeeded = [result["target"] for result in results if result.get("success")]
        failed = [result for result in results if not result.get("success")]

        for result in failed:
            logger.error(
                "Site forecast persistence target failed%s: %s",
                _log_context(target=result.get("target")),
                result.get("error"),
            )

        if not succeeded:
            logger.error("Failed to save site forecasts to every configured target: %s", results)
            raise RuntimeError(
                f"Failed to save site forecasts to all targets: {results}"
            )

        if failed:
            logger.warning(
                "Site forecasts saved with partial success. Successful targets: %s. Failed targets: %s",
                succeeded,
                [result.get("target") for result in failed],
            )

        return {
            "saved_to": succeeded,
            "results": results,
        }

    @task()
    def update_site_forecast_met_in_mongodb(data):
        if not _has_site_forecast_met_data(data):
            return {"target": "mongodb", "success": True, "skipped": True}

        try:
            details = ForecastModelTrainer._save_site_daily_forecasts_to_mongo(data)
            return {"target": "mongodb", "success": True, "details": details}
        except Exception as exc:
            logger.exception(
                "Failed to update site forecast MET columns in MongoDB%s: %s",
                _log_context(rows=len(data) if data is not None else None),
                exc,
            )
            return {"target": "mongodb", "success": False, "error": str(exc)}

    @task()
    def update_site_forecast_met_in_aws(data):
        if not _has_site_forecast_met_data(data):
            return {"target": "aws", "success": True, "skipped": True}

        try:
            details = ForecastModelTrainer._save_site_daily_forecasts_to_aws(data)
            return {"target": "aws", "success": True, "details": details}
        except Exception as exc:
            logger.exception(
                "Failed to update site forecast MET columns in AWS%s: %s",
                _log_context(rows=len(data) if data is not None else None),
                exc,
            )
            return {"target": "aws", "success": False, "error": str(exc)}

    @task()
    def update_site_forecast_met_in_bigquery(data):
        if not _has_site_forecast_met_data(data):
            return {"target": "bigquery", "success": True, "skipped": True}

        try:
            details = ForecastModelTrainer._save_site_daily_forecasts_to_bigquery(data)
            return {"target": "bigquery", "success": True, "details": details}
        except Exception as exc:
            logger.exception(
                "Failed to update site forecast MET columns in BigQuery%s: %s",
                _log_context(rows=len(data) if data is not None else None),
                exc,
            )
            return {"target": "bigquery", "success": False, "error": str(exc)}

    @task(trigger_rule=TriggerRule.ALL_DONE)
    def summarize_site_forecast_met_updates(
        mongodb_result, aws_result, bigquery_result
    ):
        results = [mongodb_result, aws_result, bigquery_result]
        failed = [result for result in results if not result.get("success")]
        updated = [
            result["target"]
            for result in results
            if result.get("success") and not result.get("skipped")
        ]
        skipped = [
            result["target"]
            for result in results
            if result.get("success") and result.get("skipped")
        ]

        for result in failed:
            logger.error(
                "Site forecast MET update target failed%s: %s",
                _log_context(target=result.get("target")),
                result.get("error"),
            )

        if updated:
            logger.info("Updated MET columns for site forecasts in targets: %s", updated)

        if skipped:
            logger.info("Skipped MET column updates for targets: %s", skipped)

        return {
            "updated_targets": updated,
            "skipped_targets": skipped,
            "failed_targets": [result.get("target") for result in failed],
        }

    site_data = fetch_site_prediction_data()
    site_forecasts = generate_site_forecasts(site_data)
    mongodb_result = save_site_forecasts_to_mongodb(site_forecasts)
    aws_result = save_site_forecasts_to_aws(site_forecasts)
    bigquery_result = save_site_forecasts_to_bigquery(site_forecasts)
    save_result = validate_site_forecast_saves(
        mongodb_result, aws_result, bigquery_result
    )

    site_forecasts_with_met = enrich_site_forecasts_with_met(site_forecasts)
    save_result >> site_forecasts_with_met
    site_forecasts_for_met_updates = resolve_site_forecasts_for_met_updates()
    site_forecasts_with_met >> site_forecasts_for_met_updates
    met_mongodb_result = update_site_forecast_met_in_mongodb(
        site_forecasts_for_met_updates
    )
    met_aws_result = update_site_forecast_met_in_aws(site_forecasts_for_met_updates)
    met_bigquery_result = update_site_forecast_met_in_bigquery(
        site_forecasts_for_met_updates
    )
    summarize_site_forecast_met_updates(
        met_mongodb_result, met_aws_result, met_bigquery_result
    )

site_daily_forecast_prediction_dag = make_site_daily_forecasts()
