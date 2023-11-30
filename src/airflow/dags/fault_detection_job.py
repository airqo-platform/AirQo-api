from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.ml_utils import MlPipelineUtils


@dag(
    "AirQo-Fault-Detection",
    tags=["airqo", "fault_detection"],
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_fault_detection_dag():
    @task()
    def fetch_raw_data():
        from airqo_etl_utils.bigquery_api import BigQueryApi

        return BigQueryApi().fetch_raw_readings()

    # Rule-based fault detection
    @task()
    def resample_raw_data(data):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().resample_raw_data(data)


    @task()
    def flag_faults(data):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().flag_faults(data)

    # Machine learning based fault detection

    @task()
    def append_device_coordinates(data):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        return BigQueryApi().add_device_metadata(data)

    @task()
    def generate_time_features(data):
        return MlPipelineUtils.get_time_and_cyclic_features(data, "hourly")

    @task()
    def generate_location_features(data):
        return MlPipelineUtils.get_location_features(data)

    @task()
    def detect_faults(data):
        return MlPipelineUtils.detect_faults(data)


    @task()
    def save_to_mongo(data):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().save_faulty_devices(data)

    raw_data = fetch_raw_data()
    flagged_data = flag_faults(raw_data)
    save_to_mongo(flagged_data)


airqo_fault_detection_dag()
