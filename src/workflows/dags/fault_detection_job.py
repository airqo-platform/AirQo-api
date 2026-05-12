from airflow.decorators import dag, task

from airqo_etl_utils.constants import Frequency
from airqo_etl_utils.ml_utils import FaultDetectionUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from dag_docs import fault_detection_doc
from task_docs import fetch_fault_detection_raw_data_doc


@dag(
    "AirQo-Fault-Detection",
    tags=["airqo", "fault_detection"],
    schedule="0 1 * * 1",
    default_args=AirflowUtils.dag_default_configs(),
    doc_md=fault_detection_doc,
)
def airqo_fault_detection_dag():
    @task(doc_md=fetch_fault_detection_raw_data_doc)
    def run_fault_detection():
        raw_data = FaultDetectionUtils.fetch_fault_detection_raw_data()
        rule_based_faults = FaultDetectionUtils.flag_rule_based_faults(raw_data)
        pattern_based_faults = FaultDetectionUtils.detect_pattern_based_faults(
            raw_data,
            frequency=Frequency.DAILY,
            train_if_missing=False,
        )
        pattern_fault_summaries = FaultDetectionUtils.process_pattern_fault_summaries(
            pattern_based_faults
        )
        FaultDetectionUtils.save_fault_detection_results(
            raw_data,
            rule_based_faults,
            pattern_fault_summaries,
        )
        return {
            "raw_rows": len(raw_data.index),
            "rule_fault_devices": len(rule_based_faults.index),
            "pattern_percentage_fault_devices": len(
                pattern_fault_summaries["faulty_devices_percentage"].index
            ),
            "pattern_sequence_fault_devices": len(
                pattern_fault_summaries["faulty_devices_sequence"].index
            ),
        }

    run_fault_detection()


airqo_fault_detection_dag()
