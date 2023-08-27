from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


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

    @task()
    def flag_faults(data):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().flag_faults(data)

    @task()
    def save_to_mongo(data):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().save_faulty_devices(data)

    raw_data = fetch_raw_data()
    flagged_data = flag_faults(raw_data)
    save_to_mongo(flagged_data)


airqo_fault_detection_dag()
