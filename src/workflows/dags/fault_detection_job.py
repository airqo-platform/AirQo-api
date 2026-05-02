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
    def fetch_raw_data():
        from airqo_etl_utils.bigquery_api import BigQueryApi

        raw_data = BigQueryApi().fetch_fault_detection_raw_readings()
        device_fault_status = FaultDetectionUtils.initialize_device_fault_status(
            raw_data
        )
        rule_based_faults = FaultDetectionUtils.flag_rule_based_faults(raw_data)
        pattern_based_faults = FaultDetectionUtils.detect_pattern_based_faults(
            raw_data, frequency=Frequency.DAILY, train_if_missing=False
        )
        faulty_devices_percentage = (
            FaultDetectionUtils.process_faulty_devices_percentage(
                pattern_based_faults
            )
        )
        faulty_devices_sequence = (
            FaultDetectionUtils.process_faulty_devices_fault_sequence(
                pattern_based_faults
            )
        )
        FaultDetectionUtils.save_faulty_devices(
            device_fault_status,
            rule_based_faults,
            faulty_devices_percentage,
            faulty_devices_sequence,
        )
        return {
            "raw_rows": len(raw_data.index),
            "device_count": raw_data["device_id"].nunique(),
            "frequency": Frequency.DAILY.str,
            "rule_fault_devices": len(rule_based_faults.index),
            "pattern_scored_rows": len(pattern_based_faults.index),
            "anomaly_percentage_fault_devices": len(
                faulty_devices_percentage.index
            ),
            "anomaly_sequence_fault_devices": len(faulty_devices_sequence.index),
        }

    fetch_raw_data()


airqo_fault_detection_dag()
