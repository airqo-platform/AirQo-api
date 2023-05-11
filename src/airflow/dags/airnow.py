from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils

from airqo_etl_utils.airnow_api import AirNowApi

from airqo_etl_utils.constants import DataSource


@dag(
    "Airnow-Historical-Bam-Data",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["bam", "airnow", "historical"],
)
def airnow_bam_historical_data():
    import pandas as pd

    @task()
    def extract_bam_data(**kwargs):
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        airnow_api = AirNowApi()
        networks = airnow_api.get_networks()
        extracted_bam_data = pd.DataFrame()

        for network in networks:
            if network["data_source"] == DataSource.AIRNOW:
                network_data = AirnowDataUtils.extract_bam_data(
                    api_key=network["api_key"],
                    start_date_time=start_date_time,
                    end_date_time=end_date_time,
                )
                extracted_bam_data = pd.concat(
                    [extracted_bam_data, network_data], ignore_index=True
                )

        return extracted_bam_data

    @task()
    def process_data(airnow_data: pd.DataFrame):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        return AirnowDataUtils.process_bam_data(data=airnow_data)

    @task()
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.data_validator import DataValidationUtils

        big_query_api = BigQueryApi()
        table = big_query_api.bam_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=data, tenant=Tenant.US_EMBASSY, table=table
        )
        big_query_api.load_data(data, table=big_query_api.bam_measurements_table)

    extracted_bam_data = extract_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_bigquery(processed_bam_data)


@dag(
    "Airnow-Realtime-Bam-Data",
    schedule="30 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["bam", "airnow", "realtime"],
)
def airnow_bam_realtime_data():
    import pandas as pd

    @task()
    def extract_bam_data():
        from airqo_etl_utils.airnow_utils import AirnowDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_query_date_time_values()

        networks = AirNowApi().get_networks()
        extracted_bam_data = pd.DataFrame()
        for network in networks:
            if network["data_source"] == DataSource.AIRNOW:
                network_data = AirnowDataUtils.extract_bam_data(
                    api_key=network["api_key"],
                    start_date_time=start_date_time,
                    end_date_time=end_date_time,
                )
                extracted_bam_data = pd.concat(
                    [extracted_bam_data, network_data], ignore_index=True
                )

        return extracted_bam_data

    @task()
    def process_data(data: pd.DataFrame):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        processed_data =pd.DataFrame()
        networks = AirNowApi().get_networks()
        for network in networks:
          network_data = AirnowDataUtils.process_bam_data(data=data, tenant=network["network"])
          processed_data = pd.concat([processed_data, network_data], ignore_index=True)

        return processed_data

    @task()
    def send_to_message_broker(data: pd.DataFrame):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils

        MessageBrokerUtils.update_hourly_data_topic(data=data)

    @task()
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.data_validator import DataValidationUtils

        big_query_api = BigQueryApi()
        table = big_query_api.bam_measurements_table
        processed_data = pd.DataFrame()
        networks = AirNowApi().get_networks()
        for network in networks:
            network_data = DataValidationUtils.process_for_big_query(
                    dataframe=data, tenant=network["network"], table=table
                )
            processed_data = pd.concat([processed_data, network_data], ignore_index=True)
            
        big_query_api.load_data(dataframe=processed_data, table=table)

    @task()
    def send_to_api(data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.airqo_api import AirQoApi

        data = DataValidationUtils.process_data_for_api(data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=data)

    extracted_bam_data = extract_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_bigquery(processed_bam_data)
    send_to_message_broker(processed_bam_data)
    send_to_api(processed_bam_data)


airnow_bam_realtime_data()
airnow_bam_historical_data()
