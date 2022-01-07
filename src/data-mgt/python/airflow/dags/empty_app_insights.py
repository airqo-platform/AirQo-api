import random
from datetime import datetime
from datetime import timedelta

import pandas as pd
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from config import configuration
from date import date_to_str_hours, date_to_str_days
from kafka_client import KafkaBrokerClient


def save_insights_data(insights_data):
    print("saving insights .... ")

    data = {
        "data": insights_data,
        "action": "insert"
    }

    kafka = KafkaBrokerClient()
    kafka.send_data(info=data, topic=configuration.INSIGHTS_MEASUREMENTS_TOPIC)


@dag('Empty-App-Insights-Pipeline', schedule_interval="@daily",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'empty'])
def app_empty_insights_etl():
    @task()
    def load():
        start_time = date_to_str_days(datetime.utcnow() - timedelta(days=23))
        end_time = date_to_str_days(datetime.utcnow() + timedelta(days=23))
        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(tenant="airqo")
        empty_insights = []

        dates = pd.date_range(start_time, end_time, freq='1H')
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

        dates = pd.date_range(start_time, end_time, freq='24H')
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

        save_insights_data(empty_insights)

    load()


app_empty_insights_dag = app_empty_insights_etl()
