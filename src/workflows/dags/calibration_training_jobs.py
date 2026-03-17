"""Airflow DAG: automated calibration model training.

Pairs each collocated LCS + BAM reference monitor (configured via the
``CALIBRATION_COLLOCATED_DEVICES`` env var), trains a ``RandomForestRegressor``
calibration model per country, and deploys to GCS only when the new model
beats the incumbent on all three metrics (R², MAE, RMSE).

Schedule: monthly on the 1st at 03:00 UTC.
"""

from datetime import datetime

from airflow.decorators import dag, task
from dateutil.relativedelta import relativedelta

from airqo_etl_utils.calibration import CalibrationPipeline
from airqo_etl_utils.config import configuration
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from dag_docs import calibration_model_training_doc


@dag(
    dag_id="AirQo-calibration-model-training",
    schedule="0 3 1 * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "calibration", "training-job", "ml"],
    doc_md=calibration_model_training_doc,
)
def calibration_model_training():
    @task()
    def compute_training_window(**context) -> dict:
        """Derive [start, end] dates from the DAG logical date."""
        end = context["logical_date"].replace(hour=0, minute=0, second=0, microsecond=0)
        start = end - relativedelta(
            months=int(configuration.CALIBRATION_TRAINING_MONTHS)
        )
        return {
            "start_date": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "end_date": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

    @task()
    def run_calibration_training(window: dict) -> dict:
        """Fetch → preprocess → train → deploy for every configured country."""
        pipeline = CalibrationPipeline(
            start_date=window["start_date"],
            end_date=window["end_date"],
        )
        results = pipeline.run()

        # Surface per-country outcomes in the logs for easy inspection
        for country, metrics in results.items():
            if "error" in metrics:
                AirflowUtils.dag_failure_notification  # let the DAG log it
            else:
                import logging

                logging.getLogger("airflow.task").info(
                    "country=%s r2=%.3f mae=%.2f rmse=%.2f deployed=%s",
                    country,
                    metrics.get("r2", float("nan")),
                    metrics.get("mae", float("nan")),
                    metrics.get("rmse", float("nan")),
                    metrics.get("deployed"),
                )

        return results

    window = compute_training_window()
    run_calibration_training(window)


calibration_model_training()
