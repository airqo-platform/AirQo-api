from airflow.decorators import dag, task

from airqo_etl_utils.config import configuration
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from dag_docs import extract_store_devices_data_in_kafka


@dag(
    "AirQo-devices-to-kafka-pipeline",
    schedule="0 0 * * *",
    doc_md=extract_store_devices_data_in_kafka,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["devices", "kafka"],
)
def airqo_devices_data():
    import pandas as pd
    from airqo_etl_utils.airqo_utils import AirQoApi

    @task()
    def extract_devices(**kwargs) -> pd.DataFrame:
        airqo_api = AirQoApi()
        return airqo_api.get_devices()

    @task()
    def send_device_data_to_broker(devices: pd.DataFrame, **kwargs) -> None:
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.data_validator import DataValidationUtils

        data_validation = DataValidationUtils()
        devices = data_validation.transform_devices(
            devices=devices, taskinstance=kwargs["ti"]
        )
        if not devices.empty:
            broker = MessageBrokerUtils()
            broker.publish_to_topic(
                data=devices,
                topic=configuration.DEVICES_TOPIC,
                column_key="device_name",
            )

    extracted_device = extract_devices()
    send_device_data_to_broker(extracted_device)


airqo_devices_data()
