from datetime import datetime
from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "App-Forecast-Insights",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "forecast"],
)
def app_forecast_insights_etl():
    @task(multiple_outputs=True)
    def extract_insights_forecast_data():
        from airqo_etl_utils.app_insights_utils import (
            create_insights_data,
            transform_old_forecast,
        )
        from airqo_etl_utils.date import (
            date_to_str,
            first_day_of_week,
            first_day_of_month,
        )
        from airqo_etl_utils.commons import fill_nan

        now = datetime.now()
        start_date_time = date_to_str(
            first_day_of_week(first_day_of_month(date_time=now))
        )
        end_date_time = date_to_str(now)

        forecast_data = transform_old_forecast(
            start_date_time=start_date_time, end_date_time=end_date_time
        )
        insights_data = create_insights_data(data=forecast_data)

        return dict({"data": fill_nan(data=insights_data)})

    @task(multiple_outputs=True)
    def extract_api_forecast_data():
        from airqo_etl_utils.app_insights_utils import (
            create_insights_data,
            get_forecast_data,
        )
        from airqo_etl_utils.commons import fill_nan

        forecast_data = get_forecast_data("airqo")
        insights_data = create_insights_data(data=forecast_data)

        return dict({"data": fill_nan(data=insights_data)})

    @task()
    def load(forecast: dict, transformed_forecast: dict):
        from airqo_etl_utils.commons import un_fill_nan
        from airqo_etl_utils.app_insights_utils import save_insights_data
        import pandas as pd

        forecast_insights_data = un_fill_nan(forecast.get("data"))
        transformed_forecast_data = un_fill_nan(transformed_forecast.get("data"))

        forecast_insights_data_df = pd.DataFrame(forecast_insights_data)
        transformed_forecast_data_df = pd.DataFrame(transformed_forecast_data)
        insights_data = pd.concat(
            [forecast_insights_data_df, transformed_forecast_data_df], ignore_index=True
        )

        save_insights_data(
            insights_data=insights_data.to_dict(orient="records"), action="save"
        )

    insights_forecast_data = extract_insights_forecast_data()
    api_forecast_data = extract_api_forecast_data()
    load(forecast=api_forecast_data, transformed_forecast=insights_forecast_data)


@dag(
    "App-Historical-Daily-Insights",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "daily"],
)
def app_historical_daily_insights_etl():
    @task(multiple_outputs=True)
    def average_insights_data(**kwargs):
        from airqo_etl_utils.app_insights_utils import (
            query_insights_data,
            average_insights_data,
        )

        from airqo_etl_utils.commons import get_date_time_values, fill_nan

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        hourly_insights_data = query_insights_data(
            freq="hourly", start_date_time=start_date_time, end_date_time=end_date_time
        )

        ave_insights_data = average_insights_data(
            frequency="daily", data=hourly_insights_data
        )

        return dict({"data": fill_nan(data=ave_insights_data)})

    @task()
    def load(data: dict):
        from airqo_etl_utils.app_insights_utils import (
            save_insights_data,
            create_insights_data,
        )
        from airqo_etl_utils.commons import un_fill_nan

        insights_list = un_fill_nan(data.get("data"))
        insights_data = create_insights_data(data=insights_list)
        save_insights_data(insights_data=insights_data, action="save")

    insights = average_insights_data()
    load(insights)


@dag(
    "App-Daily-Insights",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "daily", "realtime"],
)
def app_daily_insights_etl():
    @task(multiple_outputs=True)
    def average_insights_data():
        from airqo_etl_utils.app_insights_utils import (
            query_insights_data,
            average_insights_data,
        )

        from airqo_etl_utils.commons import fill_nan
        from datetime import datetime

        now = datetime.utcnow()
        start_date_time = datetime.strftime(now, "%Y-%m-%dT00:00:00Z")
        end_date_time = datetime.strftime(now, "%Y-%m-%dT23:59:59Z")

        hourly_insights_data = query_insights_data(
            freq="hourly", start_date_time=start_date_time, end_date_time=end_date_time
        )

        ave_insights_data = average_insights_data(
            frequency="daily", data=hourly_insights_data
        )

        return dict({"data": fill_nan(data=ave_insights_data)})

    @task()
    def load(data: dict):
        from airqo_etl_utils.app_insights_utils import (
            save_insights_data,
            create_insights_data,
        )
        from airqo_etl_utils.commons import un_fill_nan

        insights_list = un_fill_nan(data.get("data"))
        insights_data = create_insights_data(data=insights_list)
        save_insights_data(insights_data=insights_data, action="save")

    insights = average_insights_data()
    load(insights)


@dag(
    "App-Historical-Hourly-Insights",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "hourly", "historical"],
)
def app_historical_hourly_insights_etl():
    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):
        from airqo_etl_utils.app_insights_utils import (
            create_insights_data_from_bigquery,
        )

        from airqo_etl_utils.commons import get_date_time_values, fill_nan

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        hourly_insights_data = create_insights_data_from_bigquery(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

        return dict({"data": fill_nan(data=hourly_insights_data)})

    @task()
    def load_hourly_insights(data: dict):
        from airqo_etl_utils.app_insights_utils import (
            save_insights_data,
            create_insights_data,
        )
        from airqo_etl_utils.commons import un_fill_nan

        insights_list = un_fill_nan(data.get("data"))
        insights_data = create_insights_data(data=insights_list)
        save_insights_data(insights_data=insights_data, action="save")

    insights = extract_airqo_data()
    load_hourly_insights(insights)


@dag(
    "App-Hourly-Insights",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "hourly"],
)
def app_hourly_insights_etl():
    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):
        from airqo_etl_utils.app_insights_utils import (
            create_insights_data,
            get_airqo_data,
        )

        from airqo_etl_utils.commons import get_date_time_values

        start_time, end_time = get_date_time_values(**kwargs)
        measurements_data = get_airqo_data(
            freq="hourly", start_time=start_time, end_time=end_time
        )
        insights_data = create_insights_data(data=measurements_data)

        return {"data": insights_data}

    @task()
    def load_hourly_insights(data: dict):
        from airqo_etl_utils.app_insights_utils import save_insights_data

        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    hourly_data = extract_airqo_data()
    load_hourly_insights(hourly_data)


@dag(
    "App-Insights-cleanup",
    schedule_interval="@weekly",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "empty"],
)
def insights_cleanup_etl():
    from airqo_etl_utils.date import (
        date_to_str_days,
        first_day_of_week,
        last_day_of_week,
        first_day_of_month,
        last_day_of_month,
    )

    start_date_time = date_to_str_days(
        first_day_of_week(first_day_of_month(date_time=datetime.now()))
    )
    end_date_time = date_to_str_days(
        last_day_of_week(last_day_of_month(date_time=datetime.now()))
    )

    @task(multiple_outputs=True)
    def create_empty_insights():

        from airqo_etl_utils.airqo_api import AirQoApi

        from airqo_etl_utils.commons import fill_nan
        import random
        import pandas as pd
        from airqo_etl_utils.date import (
            date_to_str_days,
            date_to_str_hours,
        )

        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(tenant="airqo")
        insights = []

        dates = pd.date_range(start_date_time, end_date_time, freq="1H")
        for date in dates:
            date_time = date_to_str_hours(date)
            for site in sites:
                try:
                    hourly_insight = {
                        "time": date_time,
                        "pm2_5": random.uniform(50.0, 150.0),
                        "pm10": random.uniform(50.0, 150.0),
                        "empty": True,
                        "frequency": "HOURLY",
                        "forecast": False,
                        "siteId": site["_id"],
                    }
                    insights.append(hourly_insight)
                except Exception as ex:
                    print(ex)

        dates = pd.date_range(start_date_time, end_date_time, freq="24H")
        for date in dates:
            date_time = date_to_str_days(date)
            for site in sites:
                try:
                    daily_insight = {
                        "time": date_time,
                        "pm2_5": random.uniform(50.0, 150.0),
                        "pm10": random.uniform(50.0, 150.0),
                        "empty": True,
                        "frequency": "DAILY",
                        "forecast": False,
                        "siteId": site["_id"],
                    }
                    insights.append(daily_insight)
                except Exception as ex:
                    print(ex)

        return dict({"data": fill_nan(data=insights)})

    @task(multiple_outputs=True)
    def query_insights_data():
        from airqo_etl_utils.app_insights_utils import query_insights_data

        from airqo_etl_utils.commons import fill_nan

        all_insights_data = query_insights_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            all_data=True,
            freq="",
        )

        return dict({"data": fill_nan(data=all_insights_data)})

    @task(multiple_outputs=True)
    def filter_insights(empty_insights_data: dict, available_insights_data: dict):

        from airqo_etl_utils.commons import fill_nan, un_fill_nan

        import pandas as pd

        insights_data_df = pd.DataFrame(
            data=un_fill_nan(available_insights_data.get("data"))
        )
        empty_insights_data_df = pd.DataFrame(
            data=un_fill_nan(empty_insights_data.get("data"))
        )

        insights_data = pd.concat(
            [empty_insights_data_df, insights_data_df]
        ).drop_duplicates(keep=False, subset=["siteId", "time", "frequency"])

        return dict({"data": fill_nan(data=insights_data.to_dict(orient="records"))})

    @task()
    def load(insights_data: dict):
        from airqo_etl_utils.commons import un_fill_nan

        empty_insights_data = un_fill_nan(insights_data.get("data"))
        from airqo_etl_utils.app_insights_utils import save_insights_data

        save_insights_data(insights_data=empty_insights_data, action="insert")

    empty_insights = create_empty_insights()
    available_insights = query_insights_data()
    filtered_insights = filter_insights(
        empty_insights_data=empty_insights, available_insights_data=available_insights
    )
    load(insights_data=filtered_insights)


app_forecast_insights_etl_dag = app_forecast_insights_etl()
app_historical_daily_insights_etl_dag = app_historical_daily_insights_etl()
app_daily_insights_etl_dag = app_daily_insights_etl()
insights_cleanup_etl_dag = insights_cleanup_etl()
