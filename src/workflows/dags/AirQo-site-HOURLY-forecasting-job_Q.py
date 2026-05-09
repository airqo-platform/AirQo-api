"""Site-level hourly PM2.5 forecast DAG."""

from datetime import timedelta

from airflow.decorators import dag, task
from airflow.utils.trigger_rule import TriggerRule

from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.ml_utils import ForecastModelTrainer
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from dag_docs import site_hourly_forecasting_doc
from task_docs import (
    enrich_site_hourly_forecasts_with_met_doc,
    fetch_site_hourly_prediction_data_doc,
    generate_site_hourly_forecasts_doc,
    resolve_site_hourly_forecasts_for_met_updates_doc,
    save_site_hourly_forecasts_to_mongodb_doc,
    update_site_hourly_forecasts_met_in_mongodb_doc,
)


@dag(
    "AirQo-site-HOURLY-forecasting-job_Q", 
    schedule="0 3 * * *",  # Runs daily at 3:00 AM
    default_args={
        **AirflowUtils.dag_default_configs(),
        "retries": 3,
        "retry_delay": timedelta(minutes=10),
        "retry_exponential_backoff": True,
        "max_retry_delay": timedelta(minutes=60),
    },
    catchup=False,
    tags=["airqo", "forecast", "site-level", "prediction-job", "hourly"],
    description="Hourly site-level PM2.5 forecasting pipeline.",
    doc_md=site_hourly_forecasting_doc,
)
def make_site_hourly_forecasts():
    """Run the site-level hourly PM2.5 forecast pipeline."""

    @task(doc_md=fetch_site_hourly_prediction_data_doc)
    def fetch_site_prediction_data(**kwargs):
        execution_date = kwargs["dag_run"].execution_date
        lookback_days = int(Config.SITE_HOURLY_FORECAST_LOOKBACK_DAYS or 14)
        return ForecastModelTrainer.fetch_site_hourly_prediction_data(
            execution_date=execution_date,
            lookback_days=lookback_days,
            min_hours=2,
        )

    @task(doc_md=generate_site_hourly_forecasts_doc)
    def generate_site_forecasts(data):
        horizon_hours = int(Config.SITE_HOURLY_FORECAST_HORIZON_HOURS or 240)
        return ForecastModelTrainer.generate_site_hourly_forecasts(
            data,
            horizon_hours=horizon_hours,
            include_met_no_weather=False,
        )

    @task(doc_md=save_site_hourly_forecasts_to_mongodb_doc)
    def save_site_forecasts_to_mongodb(data):
        return ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(data)

    @task(doc_md=enrich_site_hourly_forecasts_with_met_doc)
    def enrich_site_forecasts_with_met(data):
        return ForecastModelTrainer._enrich_site_hourly_forecasts_with_met_no_weather(
            data,
            fail_on_error=True,
        )

    @task(
        trigger_rule=TriggerRule.ALL_DONE,
        doc_md=resolve_site_hourly_forecasts_for_met_updates_doc,
    )
    def resolve_site_forecasts_for_met_updates(**kwargs):
        taskinstance = kwargs.get("ti") or kwargs.get("task_instance")
        enriched_data = taskinstance.xcom_pull(
            task_ids="enrich_site_forecasts_with_met"
        )
        return ForecastModelTrainer.resolve_site_hourly_forecasts_for_met_updates(
            enriched_data
        )

    @task(doc_md=update_site_hourly_forecasts_met_in_mongodb_doc)
    def update_site_forecasts_met_in_mongodb(data):
        if data is None:
            return {"updated": False, "reason": "met_unavailable"}

        details = ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(data)
        return {"updated": True, "details": details}

    site_data = fetch_site_prediction_data()
    site_forecasts = generate_site_forecasts(site_data)
    mongodb_save = save_site_forecasts_to_mongodb(site_forecasts)
    site_forecasts_with_met = enrich_site_forecasts_with_met(site_forecasts)
    mongodb_save >> site_forecasts_with_met
    site_forecasts_for_met_updates = resolve_site_forecasts_for_met_updates()
    site_forecasts_with_met >> site_forecasts_for_met_updates
    update_site_forecasts_met_in_mongodb(site_forecasts_for_met_updates)


site_hourly_forecast_prediction_dag = make_site_hourly_forecasts()
