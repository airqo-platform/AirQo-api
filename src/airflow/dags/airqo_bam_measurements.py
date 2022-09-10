from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "AirQo-Historical-Bam-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "historical", "bam"],
)
def bam_historical_measurements_etl():
    import pandas as pd

    @task()
    def extract_bam_data(**kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.utils import Utils
        from airqo_etl_utils.constants import DeviceCategory

        start_date_time, end_date_time = Utils.get_dag_date_time_config(**kwargs)

        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.BAM,
        )

    @task()
    def save_unclean_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import DataType
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.UNCLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.raw_bam_measurements_table,
        )

    @task()
    def clean_bam_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.clean_bam_data(data=data)

    @task()
    def save_clean_bam_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import DataType
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.CLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.bam_measurements_table,
        )

    unclean_data = extract_bam_data()
    save_unclean_data(unclean_data)
    measurements = clean_bam_data(unclean_data)
    save_clean_bam_data(measurements)


@dag(
    "AirQo-Realtime-Bam-Measurements",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "bam", "realtime"],
)
def bam_realtime_measurements_etl():
    import pandas as pd

    @task()
    def extract_bam_data():
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.constants import DeviceCategory

        start_date_time, end_date_time = DateUtils.get_query_date_time_values()

        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.BAM,
        )

    @task()
    def save_unclean_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import DataType
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.UNCLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.raw_bam_measurements_table,
        )

    @task()
    def clean_bam_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.clean_bam_data(data=data)

    @task()
    def save_clean_bam_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import DataType
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.CLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.bam_measurements_table,
        )

    unclean_data = extract_bam_data()
    save_unclean_data(unclean_data)
    measurements = clean_bam_data(unclean_data)
    save_clean_bam_data(measurements)


realtime_measurements_etl_dag = bam_realtime_measurements_etl()
historical_measurements_etl_dag = bam_historical_measurements_etl()
