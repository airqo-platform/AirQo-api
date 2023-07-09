from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "Urban-Better-Plume-Labs-Historical-Raw-Measurements",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["urban better", "raw", "historical", "plume labs"],
)
def historical_raw_measurements_etl__plume_labs():
    import pandas as pd

    @task()
    def extract_measures(**kwargs):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(historical=True, **kwargs)
        return PlumeLabsUtils.extract_sensor_measures(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )

    @task()
    def load_measures(sensor_measures: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.raw_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=sensor_measures, table=table, tenant=Tenant.URBAN_BETTER
        )

        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def extract_sensor_positions(**kwargs):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(historical=True, **kwargs)
        return PlumeLabsUtils.extract_sensor_positions(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )

    @task()
    def load_sensor_positions(sensor_positions: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.sensor_positions_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=sensor_positions, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=data, table=table)

    measures = extract_measures()
    load_measures(measures)
    device_sensor_positions = extract_sensor_positions()
    load_sensor_positions(device_sensor_positions)


@dag(
    "Urban-Better-Plume-Labs-Historical-Processed-Measurements",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["urban better", "processed", "historical", "plume labs"],
)
def historical_processed_measurements_etl__plume_labs():
    import pandas as pd

    @task()
    def extract_measures(**kwargs):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(historical=True, **kwargs)
        return PlumeLabsUtils.extract_sensor_measures(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )

    @task()
    def load_measures(sensor_measures: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.raw_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=sensor_measures, table=table, tenant=Tenant.URBAN_BETTER
        )

        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def extract_sensor_positions(**kwargs):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(historical=True, **kwargs)
        return PlumeLabsUtils.extract_sensor_positions(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )

    @task()
    def load_sensor_positions(sensor_positions: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.sensor_positions_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=sensor_positions, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def merge_datasets(devices_measures: pd.DataFrame, sensor_positions: pd.DataFrame):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

        return PlumeLabsUtils.merge_sensor_measures_and_positions(
            measures=devices_measures, sensor_positions=sensor_positions
        )

    @task()
    def load_unclean_data(urban_better_data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.unclean_mobile_raw_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=urban_better_data, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def add_air_quality_data(data: pd.DataFrame):
        from airqo_etl_utils.air_quality_utils import AirQualityUtils

        return AirQualityUtils.add_categorisation(data)

    @task()
    def clean_data(data: pd.DataFrame):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

        return PlumeLabsUtils.clean_data(data)

    @task()
    def load_clean_data(urban_better_data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.clean_mobile_raw_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=urban_better_data, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=data, table=table)

    measures = extract_measures()
    load_measures(measures)
    device_sensor_positions = extract_sensor_positions()
    load_sensor_positions(device_sensor_positions)
    merged_data = merge_datasets(
        devices_measures=measures, sensor_positions=device_sensor_positions
    )
    load_unclean_data(merged_data)
    cleaned_data = clean_data(merged_data)
    air_quality_data = add_air_quality_data(cleaned_data)
    load_clean_data(air_quality_data)


@dag(
    "Urban-Better-Plume-Labs-Realtime-Raw-Measurements",
    schedule="0 2 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["urban better", "realtime", "raw", "plume labs"],
)
def realtime_measurements_etl__plume_labs():
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=25)
    start_date_time = date_to_str_hours(hour_of_day)
    end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task()
    def extract_measures():
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.constants import Tenant

        return PlumeLabsUtils.extract_sensor_measures(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )

    @task()
    def load_measures(sensor_measures: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.raw_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=sensor_measures, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def extract_sensor_positions():
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.constants import Tenant

        return PlumeLabsUtils.extract_sensor_positions(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )

    @task()
    def load_sensor_positions(sensor_positions: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.sensor_positions_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=sensor_positions, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def merge_datasets(devices_measures: pd.DataFrame, sensor_positions: pd.DataFrame):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

        return PlumeLabsUtils.merge_sensor_measures_and_positions(
            measures=devices_measures, sensor_positions=sensor_positions
        )

    @task()
    def load_unclean_data(urban_better_data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.unclean_mobile_raw_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=urban_better_data, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def add_air_quality_data(data: pd.DataFrame):
        from airqo_etl_utils.air_quality_utils import AirQualityUtils

        return AirQualityUtils.add_categorisation(data)

    @task()
    def clean_data(data: pd.DataFrame):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

        return PlumeLabsUtils.clean_data(data)

    @task()
    def load_clean_data(urban_better_data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.clean_mobile_raw_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=urban_better_data, table=table, tenant=Tenant.URBAN_BETTER
        )

        big_query_api.load_data(dataframe=data, table=table)

    devices_measures_data = extract_measures()
    load_measures(devices_measures_data)
    sensor_positions_data = extract_sensor_positions()
    load_sensor_positions(sensor_positions_data)
    merged_data = merge_datasets(
        devices_measures=devices_measures_data, sensor_positions=sensor_positions_data
    )
    load_unclean_data(merged_data)
    cleaned_data = clean_data(merged_data)
    air_quality_data = add_air_quality_data(cleaned_data)
    load_clean_data(air_quality_data)


@dag(
    "Urban-Better-Air-Beam-Historical-Raw-Measurements",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["urban better", "historical", "raw", "air beam"],
)
def historical_measurements_etl__air_beam():
    import pandas as pd

    @task()
    def extract_stream_ids(**kwargs):     
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(historical=True, **kwargs)
        return UrbanBetterUtils.extract_stream_ids_from_air_beam(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_measurements(ids: pd.DataFrame, **kwargs):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(historical=True, **kwargs)
        return UrbanBetterUtils.extract_measurements_from_air_beam(
            start_date_time=start_date_time, end_date_time=end_date_time, stream_ids=ids
        )

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.clean_mobile_raw_measurements_table
        restructured_data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=restructured_data, table=table)

    stream_ids = extract_stream_ids()
    measurements = extract_measurements(stream_ids)
    load(measurements)


@dag(
    "Urban-Better-Air-Beam-Realtime-Raw-Measurements",
    schedule="10 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["urban better", "realtime", "raw", "air beam"],
)
def realtime_measurements_etl__air_beam():
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task()
    def extract_stream_ids():
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.extract_stream_ids_from_air_beam(
            start_date_time=start_time, end_date_time=end_time
        )

    @task()
    def extract_measurements(ids: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.extract_measurements_from_air_beam(
            start_date_time=start_time, end_date_time=end_time, stream_ids=ids
        )

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import Tenant

        big_query_api = BigQueryApi()
        table = big_query_api.clean_mobile_raw_measurements_table
        restructured_data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=table, tenant=Tenant.URBAN_BETTER
        )
        big_query_api.load_data(dataframe=restructured_data, table=table)

    stream_ids = extract_stream_ids()
    measurements = extract_measurements(stream_ids)
    load(measurements)


realtime_measurements_etl__plume_labs()
realtime_measurements_etl__air_beam()
historical_measurements_etl__air_beam()
historical_raw_measurements_etl__plume_labs()
historical_processed_measurements_etl__plume_labs()
