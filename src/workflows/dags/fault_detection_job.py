from airflow.decorators import dag, task

from airqo_etl_utils.ml_utils import FaultDetectionUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "AirQo-Fault-Detection",
    tags=["airqo", "fault_detection"],
    schedule="0 1 * * 1",
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_fault_detection_dag():
    @task()
    def fetch_raw_data():
        from airqo_etl_utils.bigquery_api import BigQueryApi

        return BigQueryApi().fetch_raw_readings()

    @task()
    def flag_rule_based_faults(data):
        return FaultDetectionUtils.flag_rule_based_faults(data)

    @task()
    def get_time_features(data):
        return FaultDetectionUtils.get_time_features(data, "hourly")

    @task()
    def get_cyclic_features(data):
        return FaultDetectionUtils.get_cyclic_features(data, "hourly")

    @task()
    def flag_pattern_based_faults(data):
        return FaultDetectionUtils.flag_pattern_based_faults(data)

    @task()
    def process_faulty_devices_percentage(data):
        return FaultDetectionUtils.process_faulty_devices_percentage(data)

    @task()
    def process_faulty_devices_sequence(data):
        return FaultDetectionUtils.process_faulty_devices_fault_sequence(data)

    @task()
    def save_to_mongo(*data):
        return FaultDetectionUtils.save_faulty_devices(*data)

    raw_data = fetch_raw_data()
    rule_based_faults = flag_rule_based_faults(raw_data)
    time_features = get_time_features(raw_data)
    cyclic_features = get_cyclic_features(time_features)
    pattern_based_faults = flag_pattern_based_faults(cyclic_features)
    faulty_devices_percentage = process_faulty_devices_percentage(pattern_based_faults)
    faulty_devices_sequence = process_faulty_devices_sequence(pattern_based_faults)
    save_to_mongo(rule_based_faults, faulty_devices_percentage, faulty_devices_sequence)


airqo_fault_detection_dag()
