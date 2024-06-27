from airflow.decorators import dag, task
from great_expectations.data_context import DataContext
from airflow.providers.great_expectations.operators.great_expectations import GreatExpectationsOperator
from airqo_etl_utils.config import configuration
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.constants import Frequency
from dag_docs import airqo_realtime_low_cost_measurements_doc
from task_docs import (
    extract_raw_airqo_data_doc,
    clean_data_raw_data_doc,
    send_raw_measurements_to_bigquery_doc,
)


@dag(
    "AirQo-Historical-Hourly-Measurements",
    schedule="0 0 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "hourly", "historical", "low cost"],
)
def airqo_historical_hourly_measurements():
    import pandas as pd

    @task()
    def extract_device_measurements(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=7, **kwargs
        )
        return AirQoDataUtils.extract_aggregated_raw_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def extract_weather_data(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return WeatherDataUtils.extract_hourly_weather_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def merge_data(device_measurements: pd.DataFrame, weather_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=device_measurements, weather_data=weather_data
        )

    @task()
    def calibrate_data(measurements: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.calibrate_data(data=measurements)

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.process_aggregated_data_for_bigquery(data=data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.hourly_measurements_table,
        )

    @task()
    def send_hourly_measurements_to_api(airqo_data: pd.DataFrame, **kwargs):
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:
            from airqo_etl_utils.airqo_api import AirQoApi
            from airqo_etl_utils.airqo_utils import AirQoDataUtils

            data = AirQoDataUtils.process_data_for_api(
                airqo_data, frequency=Frequency.HOURLY
            )

            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=data)
        else:
            print("The send to API parameter has been set to false")

    @task()
    def send_hourly_measurements_to_message_broker(data: pd.DataFrame):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.constants import Tenant

        data = DataValidationUtils.process_for_message_broker(
            data=data, tenant=Tenant.AIRQO
        )
        MessageBrokerUtils.update_hourly_data_topic(data=data)

    # Define Great Expectations tasks
    validate_schema = GreatExpectationsOperator(
        task_id='validate_air_quality_schema',
        expectation_suite_name='air_quality_schema_validation',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_data_quality = GreatExpectationsOperator(
        task_id='validate_air_quality_data_quality',
        expectation_suite_name='gx/expectations',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_uniqueness_integrity = GreatExpectationsOperator(
        task_id='validate_air_quality_uniqueness_integrity',
        expectation_suite_name='air_quality_uniqueness_integrity',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_temporal_consistency = GreatExpectationsOperator(
        task_id='validate_air_quality_temporal_consistency',
        expectation_suite_name='air_quality_temporal_consistency',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_completeness = GreatExpectationsOperator(
        task_id='validate_air_quality_completeness',
        expectation_suite_name='air_quality_completeness',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_referential_integrity = GreatExpectationsOperator(
        task_id='validate_air_quality_referential_integrity',
        expectation_suite_name='air_quality_referential_integrity',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    extracted_device_measurements = extract_device_measurements()
    extracted_weather_data = extract_weather_data()
    merged_data = merge_data(
        device_measurements=extracted_device_measurements,
        weather_data=extracted_weather_data,
    )
    calibrated_data = calibrate_data(merged_data)
    load(calibrated_data)
    send_hourly_measurements_to_api(calibrated_data)
    send_hourly_measurements_to_message_broker(calibrated_data)

    # Set task dependencies for validation
    fetched_data >> validate_schema
    fetched_data >> validate_data_quality
    fetched_data >> validate_uniqueness_integrity
    fetched_data >> validate_temporal_consistency
    fetched_data >> validate_completeness
    fetched_data >> validate_referential_integrity


@dag(
    "AirQo-Historical-Raw-Low-Cost-Measurements",
    schedule="0 4 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "raw", "historical", "low cost"],
)
def airqo_historical_raw_measurements():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.constants import DeviceCategory

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=2, **kwargs
        )
        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOW_COST,
        )

    @task()
    def clean_data_raw_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.clean_low_cost_sensor_data(data=data)

    @task()
    def extract_device_deployment_logs():
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.extract_devices_deployment_logs()

    @task()
    def map_site_ids(airqo_data: pd.DataFrame, deployment_logs: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.map_site_ids_to_historical_data(
            data=airqo_data, deployment_logs=deployment_logs
        )

    @task()
    def load_data(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = AirQoDataUtils.process_raw_data_for_bigquery(data=airqo_data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.raw_measurements_table,
        )

    @task()
    def send_raw_measurements_to_api(airqo_data: pd.DataFrame, **kwargs):
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:
            from airqo_etl_utils.airqo_api import AirQoApi
            from airqo_etl_utils.airqo_utils import AirQoDataUtils

            data = AirQoDataUtils.process_data_for_api(
                airqo_data, frequency=Frequency.RAW
            )

            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=data)
        else:
            print("The send to API parameter has been set to false")

    @task()
    def send_raw_measurements_to_message_broker(data: pd.DataFrame):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.constants import Tenant

        data = DataValidationUtils.process_for_message_broker(
            data=data, tenant=Tenant.AIRQO
        )
        MessageBrokerUtils.update_raw_data_topic(data=data)

    # Great Expectations tasks
    validate_schema = GreatExpectationsOperator(
        task_id='validate_raw_air_quality_schema',
        expectation_suite_name='raw_air_quality_schema_validation',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_raw_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_data_quality = GreatExpectationsOperator(
        task_id='validate_raw_air_quality_data_quality',
        expectation_suite_name='raw_air_quality_data_quality',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_raw_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_uniqueness_integrity = GreatExpectationsOperator(
        task_id='validate_raw_air_quality_uniqueness_integrity',
        expectation_suite_name='raw_air_quality_uniqueness_integrity',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_raw_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_temporal_consistency = GreatExpectationsOperator(
        task_id='validate_raw_air_quality_temporal_consistency',
        expectation_suite_name='raw_air_quality_temporal_consistency',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_raw_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_completeness = GreatExpectationsOperator(
        task_id='validate_raw_air_quality_completeness',
        expectation_suite_name='raw_air_quality_completeness',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_raw_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    validate_referential_integrity = GreatExpectationsOperator(
        task_id='validate_raw_air_quality_referential_integrity',
        expectation_suite_name='raw_air_quality_referential_integrity',
        batch_kwargs={
            'datasource': 'bigquery_datasource',
            'dataset': 'your_dataset',
            'table': 'temp_raw_air_quality_data'
        },
        data_context_root_dir='gx/expectations'
    )

    extracted_data = extract_raw_data()
    cleaned_data = clean_data_raw_data(extracted_data)
    device_deployment_logs = extract_device_deployment_logs()
    mapped_site_ids_data = map_site_ids(
        airqo_data=cleaned_data, deployment_logs=device_deployment_logs
    )
    load_data(mapped_site_ids_data)
    send_raw_measurements_to_api(mapped_site_ids_data)
    send_raw_measurements_to_message_broker(mapped_site_ids_data)

    # task dependencies for validation
    fetched_data >> validate_schema
    fetched_data >> validate_data_quality
    fetched_data >> validate_uniqueness_integrity
    fetched_data >> validate_temporal_consistency
    fetched_data >> validate_completeness
    fetched_data >> validate_referential_integrity
