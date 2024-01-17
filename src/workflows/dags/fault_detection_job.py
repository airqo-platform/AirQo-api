import pandas as pd
from airflow.decorators import dag, task

from airqo_etl_utils.ml_utils import MlPipelineUtils
from models.ml_models import Frequency
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


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
    def resample_raw_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().resample_raw_data(data)

    @task()
    def flag_faults(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().flag_faults(data)

    # Machine learning based fault detection

    @task()
    def append_device_coordinates(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        return BigQueryApi().add_device_metadata(data)

    @task()
    def generate_time_features(data):
        return MlPipelineUtils.get_time_and_cyclic_features(data, Frequency.HOURLY)

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

    # Rule-based fault detection
    raw_data = fetch_raw_data()
    resampled_data = resample_raw_data(raw_data)
    flagged_data = flag_faults(resampled_data)

    # Machine learning based fault detection
    data_with_device_coordinates = append_device_coordinates(flagged_data)
    time_features_data = generate_time_features(data_with_device_coordinates)
    location_features_data = generate_location_features(time_features_data)
    faulty_devices_data = detect_faults(location_features_data)

    # Save to mongo
    save_to_mongo(flagged_data)
    save_to_mongo(faulty_devices_data)


airqo_fault_detection_dag()
