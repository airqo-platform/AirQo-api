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
    import pandas as pd

    @task()
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

        now = datetime.now()
        start_date_time = date_to_str(
            first_day_of_week(first_day_of_month(date_time=now))
        )
        end_date_time = date_to_str(now)

        forecast_data = transform_old_forecast(
            start_date_time=start_date_time, end_date_time=end_date_time
        )
        insights_data = create_insights_data(data=forecast_data)

        return insights_data

    @task()
    def extract_api_forecast_data():
        from airqo_etl_utils.app_insights_utils import (
            create_insights_data,
            get_forecast_data,
        )

        forecast_data = get_forecast_data("airqo")
        insights_data = create_insights_data(data=forecast_data)

        return insights_data

    @task()
    def load(forecast: pd.DataFrame):
        from airqo_etl_utils.app_insights_utils import save_insights_data

        save_insights_data(
            insights_data=forecast.to_dict(orient="records"),
            action="save",
            partition=1,
        )

    api_forecast_data = extract_api_forecast_data()
    load(forecast=api_forecast_data)


@dag(
    "App-Historical-Daily-Insights",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "daily"],
)
def app_historical_daily_insights_etl():
    import pandas as pd

    @task()
    def average_insights_data(**kwargs):
        from airqo_etl_utils.app_insights_utils import (
            query_insights_data,
            average_insights_data,
        )

        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        hourly_insights_data = query_insights_data(
            freq="hourly", start_date_time=start_date_time, end_date_time=end_date_time
        )

        ave_insights_data = average_insights_data(
            frequency="daily", data=hourly_insights_data
        )

        return ave_insights_data

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.app_insights_utils import (
            save_insights_data,
            create_insights_data,
        )

        insights_data = create_insights_data(data=data)
        save_insights_data(insights_data=insights_data, action="save", partition=2)

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
    import pandas as pd

    @task()
    def average_insights_data():
        from airqo_etl_utils.app_insights_utils import (
            query_insights_data,
            average_insights_data,
        )

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

        return ave_insights_data

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.app_insights_utils import (
            save_insights_data,
            create_insights_data,
        )

        insights_data = create_insights_data(data=data)
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
    import pandas as pd

    @task()
    def extract_airqo_data(**kwargs):
        from airqo_etl_utils.app_insights_utils import (
            create_insights_data_from_bigquery,
        )

        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        hourly_insights_data = create_insights_data_from_bigquery(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

        return hourly_insights_data

    @task()
    def load_hourly_insights(data: pd.DataFrame):
        from airqo_etl_utils.app_insights_utils import (
            save_insights_data,
            create_insights_data,
        )

        insights_data = create_insights_data(data=data)
        save_insights_data(insights_data=insights_data, action="save", partition=2)

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
    @task()
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

        return insights_data

    @task()
    def load_hourly_insights(data: dict):
        from airqo_etl_utils.app_insights_utils import save_insights_data

        insights_data = data.get("data")
        save_insights_data(insights_data=insights_data, action="save")

    hourly_data = extract_airqo_data()
    load_hourly_insights(hourly_data)


@dag(
    "App-Insights-cleanup",
    schedule_interval="@daily",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["insights", "empty"],
)
def insights_cleanup_etl():
    import pandas as pd

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

    @task()
    def create_empty_insights():

        from airqo_etl_utils.airqo_api import AirQoApi

        import random
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

        return pd.DataFrame(insights)

    @task()
    def query_insights_data():
        from airqo_etl_utils.app_insights_utils import query_insights_data

        all_insights_data = query_insights_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            all_data=True,
            freq="",
        )

        return all_insights_data

    @task()
    def filter_insights(
        empty_insights_data: pd.DataFrame, available_insights_data: pd.DataFrame
    ):

        insights_data = pd.concat(
            [empty_insights_data, available_insights_data]
        ).drop_duplicates(keep=False, subset=["siteId", "time", "frequency"])

        return insights_data

    @task()
    def load(insights_data: pd.DataFrame):

        from airqo_etl_utils.app_insights_utils import save_insights_data

        save_insights_data(insights_data=insights_data, action="insert", partition=2)

    empty_insights = create_empty_insights()
    available_insights = query_insights_data()
    filtered_insights = filter_insights(
        empty_insights_data=empty_insights, available_insights_data=available_insights
    )
    load(insights_data=filtered_insights)


app_forecast_insights_etl_dag = app_forecast_insights_etl()
app_historical_daily_insights_etl_dag = app_historical_daily_insights_etl()
app_historical_hourly_insights_etl_dag = app_historical_hourly_insights_etl()
app_daily_insights_etl_dag = app_daily_insights_etl()
insights_cleanup_etl_dag = insights_cleanup_etl()
