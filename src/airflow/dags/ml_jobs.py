from airflow.decorators import dag, task
from task_docs import (
    extract_raw_airqo_data_doc
)


@dag(
    "AirQo_Fault_Detection_DAG",
    tags=["airqo", "fault_detection"],
)
def airqo_fault_detection_dag():
    @task(
        doc_md=extract_raw_airqo_data_doc,
    )
    def fetch_raw_data():
        from airqo_etl_utils.airqo_utils import BigQueryApi

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
