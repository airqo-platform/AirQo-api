from airflow.decorators import dag, task

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from task_docs import (
    extract_raw_airqo_data_doc,
)


@dag(
    "AirQo-Fault-Detection",
    tags=["airqo", "fault_detection"],
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_fault_detection_dag():
    @task(
        doc_md=extract_raw_airqo_data_doc,
    )
    def fetch_raw_data():
        return BigQueryApi().fetch_raw_readings()

    @task()
    def flag_faults(data):
        return AirQoDataUtils().flag_faults(data)

    @task()
    def save_to_mongo(data):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils().save_faulty_devices(data)

    raw_data = fetch_raw_data()
    flagged_data = flag_faults(raw_data)
    save_to_mongo(flagged_data)


airqo_fault_detection_dag()
