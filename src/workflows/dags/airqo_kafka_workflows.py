from airflow.decorators import dag, task

from airqo_etl_utils.config import configuration
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from dag_docs import extract_store_devices_data_in_kafka
from datetime import timedelta
from typing import List, Dict, Any


@dag(
    "AirQo-devices-to-kafka-pipeline",
    schedule="0 0 * * *",
    doc_md=extract_store_devices_data_in_kafka,
    catchup=False,
    tags=["devices", "kafka"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_devices_data():
    import pandas as pd
    from airqo_etl_utils.airqo_utils import AirQoApi

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_devices() -> pd.DataFrame:
        airqo_api = AirQoApi()
        return airqo_api.get_devices()

    @task()
    def transform_devices(devices: List[Dict[str, Any]], **kwargs) -> pd.DataFrame:
        from airqo_etl_utils.data_validator import DataValidationUtils

        devices = DataValidationUtils.transform_devices(
            devices=devices, taskinstance=kwargs["ti"]
        )
        return devices

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_device_data_to_broker(devices: pd.DataFrame) -> None:
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils

        if not devices.empty:
            broker = MessageBrokerUtils()
            broker.publish_to_topic(
                data=devices,
                topic=configuration.DEVICES_TOPIC,
                column_key="device_name",
            )

    extracted_devices = extract_devices()
    transformed_devices = transform_devices(extracted_devices)
    send_device_data_to_broker(transformed_devices)


airqo_devices_data()
