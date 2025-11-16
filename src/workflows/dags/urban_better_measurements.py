from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.constants import (
    DeviceNetwork,
    DataType,
    DeviceCategory,
    Frequency,
    MetaDataType,
)
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.date import DateUtils


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
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)
        return PlumeLabsUtils.extract_sensor_measures(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.URBANBETTER,
        )

    @task()
    def load_measures(sensor_measures: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            sensor_measures, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def extract_sensor_positions(**kwargs):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return PlumeLabsUtils.extract_sensor_positions(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.URBANBETTER,
        )

    @task()
    def load_sensor_positions(sensor_positions: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            sensor_positions,
            DataType.EXTRAS,
            DeviceCategory.LOWCOST,
            Frequency.NONE,
            device_network=DeviceNetwork.URBANBETTER,
            extra_type=MetaDataType.SENSORPOSITIONS,
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
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return PlumeLabsUtils.extract_sensor_measures(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.URBANBETTER,
        )

    @task()
    def load_measures(sensor_measures: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            sensor_measures, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def extract_sensor_positions(**kwargs):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return PlumeLabsUtils.extract_sensor_positions(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.URBANBETTER,
        )

    @task()
    def load_sensor_positions(sensor_positions: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            sensor_positions,
            DataType.EXTRAS,
            DeviceCategory.LOWCOST,
            Frequency.NONE,
            device_network=DeviceNetwork.URBANBETTER,
            extra_type=MetaDataType.SENSORPOSITIONS,
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
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            urban_better_data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
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
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            urban_better_data, DataType.RAW, DeviceCategory.MOBILE, Frequency.RAW
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

    from datetime import datetime, timedelta, timezone

    hour_of_day = datetime.now(timezone.utc) - timedelta(hours=25)
    start_date_time = DateUtils.date_to_str(
        hour_of_day, str_format="%Y-%m-%dT%H:00:00Z"
    )
    end_date_time = DateUtils.date_to_str(hour_of_day, str_format="%Y-%m-%dT%H:59:59Z")

    @task()
    def extract_measures():
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

        return PlumeLabsUtils.extract_sensor_measures(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.URBANBETTER,
        )

    @task()
    def load_measures(sensor_measures: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            sensor_measures, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task()
    def extract_sensor_positions():
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

        return PlumeLabsUtils.extract_sensor_positions(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.URBANBETTER,
        )

    @task()
    def load_sensor_positions(sensor_positions: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            sensor_positions,
            DataType.EXTRAS,
            DeviceCategory.LOWCOST,
            Frequency.NONE,
            device_network=DeviceNetwork.URBANBETTER,
            extra_type=MetaDataType.SENSORPOSITIONS,
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
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            urban_better_data, DataType.RAW, DeviceCategory.MOBILE, Frequency.NONE
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
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            urban_better_data, DataType.RAW, DeviceCategory.MOBILE, Frequency.RAW
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

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return UrbanBetterUtils.extract_stream_ids_from_air_beam(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_measurements(ids: pd.DataFrame, **kwargs):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return UrbanBetterUtils.extract_measurements_from_air_beam(
            start_date_time=start_date_time, end_date_time=end_date_time, stream_ids=ids
        )

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.MOBILE, Frequency.RAW
        )
        big_query_api.load_data(dataframe=data, table=table)

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

    from datetime import datetime, timedelta, timezone

    hour_of_day = datetime.now(timezone.utc) - timedelta(hours=1)
    start_time = DateUtils.date_to_str(hour_of_day, str_format="%Y-%m-%dT%H:00:00Z")
    end_time = DateUtils.date_to_str(hour_of_day, str_format="%Y-%m-%dT%H:59:59Z")

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
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.MOBILE, Frequency.RAW
        )
        big_query_api.load_data(dataframe=data, table=table)

    stream_ids = extract_stream_ids()
    measurements = extract_measurements(stream_ids)
    load(measurements)


realtime_measurements_etl__plume_labs()
realtime_measurements_etl__air_beam()
historical_measurements_etl__air_beam()
historical_raw_measurements_etl__plume_labs()
historical_processed_measurements_etl__plume_labs()
