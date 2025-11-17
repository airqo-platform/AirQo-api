from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "Data-Summary",
    schedule="0 4 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["summary"],
)
def data_summary():
    import pandas as pd

    def extract(**kwargs):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from datetime import datetime, timedelta, timezone
        from airqo_etl_utils.date import DateUtils

        try:
            date_time = kwargs.get("params", {}).get("start_date_time")
            date_time = DateUtils.str_to_date(date_time)
        except Exception as ex:
            print(ex)
            date_time = datetime.now(timezone.utc) - timedelta(days=2)

        bigquery_api = BigQueryApi()
        return bigquery_api.get_devices_hourly_data(day=date_time)

    @task()
    def compute_summary(data: pd.DataFrame):
        from airqo_etl_utils.data_summary_utils import DataSummaryUtils

        return DataSummaryUtils.compute_devices_summary(data=data)

    @task()
    def save_summary(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        bigquery_api = BigQueryApi()
        bigquery_api.save_devices_summary_data(data=data)

    hourly_data = extract()
    summary = compute_summary(hourly_data)
    save_summary(summary)


# data_summary()
# TODO This is not being used. Will be deleted with all it's utilities once a data health analytics dashboard is in place.
