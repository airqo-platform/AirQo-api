from datetime import datetime
from airflow.decorators import dag, task

from airflow_utils.commons import slack_dag_failure_notification


@dag(
    "App-Forecast-Insights",
    schedule_interval="@hourly",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "forecast"],
)
def app_forecast_insights_etl():
    @task(multiple_outputs=True)
    def extract_forecast_data():

        from airflow_utils.app_insights_utils import (
            create_insights_data,
            get_forecast_data,
        )

        forecast_data = get_forecast_data("airqo")
        insights_data = create_insights_data(data=forecast_data)

        return dict({"data": insights_data})

    @task()
    def load(data: dict):
        from airflow_utils.app_insights_utils import save_insights_data

        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    insights = extract_forecast_data()
    load(insights)


@dag(
    "App-Daily-Insights",
    schedule_interval="0 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "daily"],
)
def app_daily_insights_etl():
    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):

        from airflow_utils.app_insights_utils import (
            create_insights_data,
            get_airqo_data,
            time_values,
            average_hourly_insights,
        )

        start_time, end_time = time_values(**kwargs)

        if not start_time or not end_time:

            hour_of_day = datetime.utcnow()
            if hour_of_day.hour <= 1:
                return dict({"data": []})

            start_time = datetime.strftime(hour_of_day, "%Y-%m-%dT00:00:00Z")
            end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT23:59:59Z")

        measurements_data = get_airqo_data(
            freq="hourly", start_time=start_time, end_time=end_time
        )
        insights_data = create_insights_data(data=measurements_data)

        ave_insights_data = average_hourly_insights(insights_data)

        return {"data": ave_insights_data}

    @task()
    def load(data: dict):
        from airflow_utils.app_insights_utils import save_insights_data

        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    insights = extract_airqo_data()
    load(insights)


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
        from airflow_utils.app_insights_utils import (
            create_insights_data,
            get_airqo_data,
            time_values,
        )

        start_time, end_time = time_values(**kwargs)
        measurements_data = get_airqo_data(
            freq="hourly", start_time=start_time, end_time=end_time
        )
        insights_data = create_insights_data(data=measurements_data)

        return {"data": insights_data}

    @task()
    def load_hourly_insights(data: dict):
        from airflow_utils.app_insights_utils import save_insights_data

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
    @task()
    def load_place_holders():

        from airflow_utils.airqo_api import AirQoApi
        from airflow_utils.date import (
            date_to_str_hours,
            date_to_str_days,
            first_day_of_week,
            last_day_of_week,
            first_day_of_month,
            last_day_of_month,
        )
        from airflow_utils.app_insights_utils import save_insights_data
        import random
        import pandas as pd

        start_time = date_to_str_days(
            first_day_of_week(first_day_of_month(date_time=datetime.now()))
        )
        end_time = date_to_str_days(
            last_day_of_week(last_day_of_month(date_time=datetime.now()))
        )

        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(tenant="airqo")
        empty_insights = []

        dates = pd.date_range(start_time, end_time, freq="1H")
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
                    empty_insights.append(hourly_insight)
                except Exception as ex:
                    print(ex)

        dates = pd.date_range(start_time, end_time, freq="24H")
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
                    empty_insights.append(daily_insight)
                except Exception as ex:
                    print(ex)
        save_insights_data(insights_data=empty_insights, action="insert")

    @task()
    def delete_old_insights():

        from airflow_utils.date import (
            first_day_of_week,
            last_day_of_week,
            first_day_of_month,
            last_day_of_month,
        )
        from airflow_utils.app_insights_utils import save_insights_data
        from datetime import datetime, timedelta

        start_time = first_day_of_week(
            first_day_of_month(date_time=datetime.now())
        ) - timedelta(days=7)
        end_time = last_day_of_week(
            last_day_of_month(date_time=datetime.now())
        ) + timedelta(days=7)

        save_insights_data(
            insights_data=[], action="delete", start_time=start_time, end_time=end_time
        )

    load_place_holders()
    # delete_old_insights()


app_forecast_insights_etl_dag = app_forecast_insights_etl()
app_hourly_insights_etl_dag = app_hourly_insights_etl()
app_daily_insights_etl_dag = app_daily_insights_etl()
insights_cleanup_etl_dag = insights_cleanup_etl()
