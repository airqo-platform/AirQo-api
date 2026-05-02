from airflow.decorators import dag, task

from airqo_etl_utils.constants import Frequency
from airqo_etl_utils.ml_utils import FaultDetectionUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from dag_docs import fault_detection_doc
from task_docs import (
    fetch_fault_detection_raw_data_doc,
    flag_pattern_based_faults_doc,
    flag_rule_based_faults_doc,
    process_faulty_devices_percentage_doc,
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
        return FaultDetectionUtils.fetch_fault_detection_raw_data()

    @task(doc_md=flag_rule_based_faults_doc)
    def flag_rule_based_faults(raw_data):
        return FaultDetectionUtils.flag_rule_based_faults(raw_data)

    @task(doc_md=flag_pattern_based_faults_doc)
    def flag_pattern_based_faults(raw_data):
        return FaultDetectionUtils.detect_pattern_based_faults(
            raw_data,
            frequency=Frequency.DAILY,
            train_if_missing=False,
        )

    @task(doc_md=process_faulty_devices_percentage_doc)
    def process_pattern_fault_summaries(pattern_based_faults):
        return FaultDetectionUtils.process_pattern_fault_summaries(
            pattern_based_faults
        )

    @task(doc_md=save_faulty_devices_doc)
    def save_to_mongo(
        raw_data,
        rule_based_faults,
        pattern_fault_summaries,
    ):
        FaultDetectionUtils.save_fault_detection_results(
            raw_data,
            rule_based_faults,
            pattern_fault_summaries,
        )

    raw_data = fetch_raw_data()
    rule_based_faults = flag_rule_based_faults(raw_data)
    pattern_based_faults = flag_pattern_based_faults(raw_data)
    pattern_fault_summaries = process_pattern_fault_summaries(
        pattern_based_faults
    )
    save_to_mongo(
        raw_data,
        rule_based_faults,
        pattern_fault_summaries,
    )


airqo_fault_detection_dag()
