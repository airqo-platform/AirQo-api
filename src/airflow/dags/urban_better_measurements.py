from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Urban-Better-Plume-Labs-Historical-Raw-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["urban better", "raw", "historical", "plume labs"],
)
def historical_raw_measurements_etl__plume_labs():
    import pandas as pd

    @task()
    def extract_measures(**kwargs):

        from airqo_etl_utils.utils import Utils
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        start_date_time, end_date_time = Utils.get_dag_date_time_config(**kwargs)
        return UrbanBetterUtils.extract_raw_data_from_plume_labs(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_sensor_positions(**kwargs):

        from airqo_etl_utils.utils import Utils
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        start_date_time, end_date_time = Utils.get_dag_date_time_config(**kwargs)
        return UrbanBetterUtils.extract_sensor_positions_from_plume_labs(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def merge_datasets(devices_measures: pd.DataFrame, sensor_positions: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.merge_measures_and_sensor_positions(
            measures=devices_measures, sensor_positions=sensor_positions
        )

    @task()
    def load_unclean_data(urban_better_data: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = UrbanBetterUtils.process_for_big_query(dataframe=urban_better_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.unclean_mobile_raw_measurements_table,
        )

    @task()
    def clean_data(data: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.clean_raw_data(data)

    @task()
    def load_clean_data(urban_better_data: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = UrbanBetterUtils.process_for_big_query(dataframe=urban_better_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.clean_mobile_raw_measurements_table,
        )

    measures = extract_measures()
    device_sensor_positions = extract_sensor_positions()
    merged_data = merge_datasets(
        devices_measures=measures, sensor_positions=device_sensor_positions
    )
    load_unclean_data(merged_data)
    cleaned_data = clean_data(merged_data)
    load_clean_data(cleaned_data)


@dag(
    "Urban-Better-Plume-Labs-Realtime-Raw-Measurements",
    schedule_interval="0 2 * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["urban better", "realtime", "raw", "plume labs"],
)
def realtime_measurements_etl__plume_labs():
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=25)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task()
    def extract_measures():
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.extract_raw_data_from_plume_labs(
            start_date_time=start_time, end_date_time=end_time
        )

    @task()
    def extract_sensor_positions():
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.extract_sensor_positions_from_plume_labs(
            start_date_time=start_time, end_date_time=end_time
        )

    @task()
    def merge_datasets(devices_measures: pd.DataFrame, sensor_positions: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.merge_measures_and_sensor_positions(
            measures=devices_measures, sensor_positions=sensor_positions
        )

    @task()
    def load_unclean_data(urban_better_data: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = UrbanBetterUtils.process_for_big_query(dataframe=urban_better_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.unclean_mobile_raw_measurements_table,
        )

    @task()
    def clean_data(data: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.clean_raw_data(data)

    @task()
    def load_clean_data(urban_better_data: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = UrbanBetterUtils.process_for_big_query(dataframe=urban_better_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.clean_mobile_raw_measurements_table,
        )

    devices_measures_data = extract_measures()
    sensor_positions_data = extract_sensor_positions()
    merged_data = merge_datasets(
        devices_measures=devices_measures_data, sensor_positions=sensor_positions_data
    )
    load_unclean_data(merged_data)
    cleaned_data = clean_data(merged_data)
    load_clean_data(cleaned_data)


@dag(
    "Urban-Better-Air-Beam-Historical-Raw-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["urban better", "historical", "raw", "air beam"],
)
def historical_measurements_etl__air_beam():
    import pandas as pd

    @task()
    def extract_stream_ids(**kwargs):
        from airqo_etl_utils.utils import Utils
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        start_date_time, end_date_time = Utils.get_dag_date_time_config(**kwargs)
        return UrbanBetterUtils.extract_stream_ids_from_air_beam(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_measurements(ids: pd.DataFrame, **kwargs):
        from airqo_etl_utils.utils import Utils
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        start_date_time, end_date_time = Utils.get_dag_date_time_config(**kwargs)
        return UrbanBetterUtils.extract_measurements_from_air_beam(
            start_date_time=start_date_time, end_date_time=end_date_time, stream_ids=ids
        )

    @task()
    def transform(data: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.clean_raw_data(data)

    @task()
    def load(data: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        restructured_data = UrbanBetterUtils.process_for_big_query(dataframe=data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=restructured_data,
            table=big_query_api.clean_mobile_raw_measurements_table,
        )

    stream_ids = extract_stream_ids()
    measurements = extract_measurements(stream_ids)
    transformed_data = transform(measurements)
    load(transformed_data)


@dag(
    "Urban-Better-Air-Beam-Realtime-Raw-Measurements",
    schedule_interval="10 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
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
    def transform(data: pd.DataFrame):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        return UrbanBetterUtils.clean_raw_data(data)

    @task()
    def load(data: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        restructured_data = UrbanBetterUtils.process_for_big_query(dataframe=data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=restructured_data,
            table=big_query_api.clean_mobile_raw_measurements_table,
        )

    stream_ids = extract_stream_ids()
    measurements = extract_measurements(stream_ids)
    transformed_data = transform(measurements)
    load(transformed_data)


realtime_measurements_etl__plume_labs_dag = realtime_measurements_etl__plume_labs()
realtime_measurements_etl__air_beam_dag = realtime_measurements_etl__air_beam()
historical_measurements_etl__air_beam_dag = historical_measurements_etl__air_beam()
historical_raw_measurements_etl__plume_labs_dag = (
    historical_raw_measurements_etl__plume_labs()
)
