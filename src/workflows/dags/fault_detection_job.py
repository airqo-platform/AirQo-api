from airflow.decorators import dag, task

from airqo_etl_utils.constants import Frequency
from airqo_etl_utils.ml_utils import FaultDetectionUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from dag_docs import fault_detection_doc
from task_docs import (
    fetch_fault_detection_raw_data_doc,
    flag_rule_based_faults_doc,
    prepare_pattern_detection_features_doc,
    flag_pattern_based_faults_doc,
    process_faulty_devices_percentage_doc,
    process_faulty_devices_sequence_doc,
    save_faulty_devices_doc,
)


@dag(
    "AirQo-Fault-Detection",
    tags=["airqo", "fault_detection"],
    schedule="0 1 * * 1",
    default_args=AirflowUtils.dag_default_configs(),
    doc_md=fault_detection_doc,
)
def airqo_fault_detection_dag():
    @task(doc_md=fetch_fault_detection_raw_data_doc)
    def fetch_raw_data():
        from airqo_etl_utils.bigquery_api import BigQueryApi

        return BigQueryApi().fetch_fault_detection_raw_readings()

    @task(doc_md=flag_rule_based_faults_doc)
    def flag_rule_based_faults(data):
        return FaultDetectionUtils.flag_rule_based_faults(data)

    @task()
    def initialize_device_fault_status(data):
        return FaultDetectionUtils.initialize_device_fault_status(data)

    @task(doc_md=prepare_pattern_detection_features_doc)
    def prepare_pattern_detection_features(data):
        return FaultDetectionUtils.prepare_pattern_detection_features(
            data, Frequency.HOURLY
        )

    @task(doc_md=flag_pattern_based_faults_doc)
    def flag_pattern_based_faults(data):
        return FaultDetectionUtils.flag_pattern_based_faults(
            data, Frequency.HOURLY, train_if_missing=False
        )

    @task(doc_md=process_faulty_devices_percentage_doc)
    def process_faulty_devices_percentage(data):
        return FaultDetectionUtils.process_faulty_devices_percentage(data)

    @task(doc_md=process_faulty_devices_sequence_doc)
    def process_faulty_devices_sequence(data):
        return FaultDetectionUtils.process_faulty_devices_fault_sequence(data)

    @task(doc_md=save_faulty_devices_doc)
    def save_to_mongo(*data):
        return FaultDetectionUtils.save_faulty_devices(*data)

    raw_data = fetch_raw_data()
    device_fault_status = initialize_device_fault_status(raw_data)
    rule_based_faults = flag_rule_based_faults(raw_data)
    pattern_features = prepare_pattern_detection_features(raw_data)
    pattern_based_faults = flag_pattern_based_faults(pattern_features)

    faulty_devices_percentage = process_faulty_devices_percentage(pattern_based_faults)
    faulty_devices_sequence = process_faulty_devices_sequence(pattern_based_faults)
    save_to_mongo(
        device_fault_status,
        rule_based_faults,
        faulty_devices_percentage,
        faulty_devices_sequence,
    )


airqo_fault_detection_dag()
