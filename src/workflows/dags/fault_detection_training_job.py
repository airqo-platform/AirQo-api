from airflow.decorators import dag, task

from airqo_etl_utils.config import configuration
from airqo_etl_utils.constants import Frequency
from airqo_etl_utils.ml_utils import FaultDetectionUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from dag_docs import fault_detection_training_doc
from task_docs import (
    fetch_fault_detection_training_data_doc,
    prepare_pattern_detection_features_doc,
    train_fault_detection_model_doc,
)


@dag(
    dag_id="AirQo-fault-detection-model-training",
    schedule="0 2 1 */2 *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "fault_detection", "training-job", "ml"],
    doc_md=fault_detection_training_doc,
)
def airqo_fault_detection_model_training_dag():
    @task(doc_md=fetch_fault_detection_training_data_doc)
    def fetch_training_data():
        from airqo_etl_utils.bigquery_api import BigQueryApi

        return BigQueryApi().fetch_fault_detection_raw_readings(
            lookback_days=configuration.FAULT_DETECTION_TRAINING_LOOKBACK_DAYS,
            device_limit=configuration.FAULT_DETECTION_TRAINING_DEVICE_LIMIT,
            minimum_hourly_records=(
                configuration.FAULT_DETECTION_TRAINING_MIN_HOURLY_RECORDS
            ),
        )

    @task(doc_md=prepare_pattern_detection_features_doc)
    def prepare_pattern_detection_features(data):
        return FaultDetectionUtils.prepare_pattern_detection_features(
            data, Frequency.HOURLY
        )

    @task(doc_md=train_fault_detection_model_doc)
    def train_isolation_forest_model(data):
        return FaultDetectionUtils.train_isolation_forest(data, Frequency.HOURLY)

    @task()
    def save_isolation_forest_model(trained_model):
        return FaultDetectionUtils.save_isolation_forest_model(trained_model)

    raw_data = fetch_training_data()
    pattern_features = prepare_pattern_detection_features(raw_data)
    trained_model = train_isolation_forest_model(pattern_features)
    save_isolation_forest_model(trained_model)


airqo_fault_detection_model_training_dag()
