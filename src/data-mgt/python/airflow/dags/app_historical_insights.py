from datetime import datetime
from datetime import timedelta

import pandas as pd
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from date import date_to_str_days, date_to_str, str_to_date
from utils import save_insights_data


def measurement_time_to_string(time, day=None):
    date_time = str_to_date(time)
    if day:
        return date_to_str(date_time)
    else:
        return date_to_str_days(date_time)


def get_insights_historical_data(tenant):
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant=tenant, active=True)
    historical_measurements = []

    time = datetime.utcnow()
    start_time = date_to_str_days(time - timedelta(days=8))
    end_time = date_to_str_days(time)
    print(f'start time : {start_time}')
    print(f'end time : {end_time}')

    for device in devices:
        device_hourly_events = airqo_api.get_events(tenant='airqo', start_time=start_time, frequency='hourly',
                                                    end_time=end_time, device=device['name'], meta_data="site")
        if device_hourly_events:
            historical_measurements.extend(device_hourly_events)

        device_daily_events = airqo_api.get_events(tenant='airqo', start_time=start_time, frequency='daily',
                                                   end_time=end_time, device=device['name'], meta_data="site")
        if device_daily_events:
            historical_measurements.extend(device_daily_events)

    measurements_df = pd.json_normalize(historical_measurements)

    measurements_df['time'] = measurements_df['time'].apply(lambda x: measurement_time_to_string(x))
    measurements_df['average_pm2_5.calibratedValue'].fillna(measurements_df['average_pm2_5.value'], inplace=True)
    measurements_df['average_pm10.calibratedValue'].fillna(measurements_df['average_pm10.value'], inplace=True)

    measurements_df = measurements_df[['time', 'frequency', 'site_id', 'average_pm2_5.calibratedValue',
                                       'average_pm10.calibratedValue']]

    measurements_df.columns = ['time', 'frequency', 'siteId', 'pm2_5', 'pm10']

    measurements_df = measurements_df[measurements_df['pm2_5'].notna()]

    return measurements_df.to_dict(orient="records")


def create_insights_data(averaged_data_file):
    print("creating insights .... ")

    insights_data = pd.DataFrame(averaged_data_file)

    insights_data.dropna(inplace=True)
    insights_data['frequency'] = insights_data['frequency'].apply(lambda x: str(x).upper())

    return insights_data.to_dict(orient="records")


@dag('App-Historical-Insights-Pipeline', schedule_interval="@weekly",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'historical'])
def app_historical_insights_etl():
    @task(multiple_outputs=True)
    def extract():
        historical_data = get_insights_historical_data('airqo')
        return dict({"historical_data": historical_data})

    @task(multiple_outputs=True)
    def transform(measurements_data: dict):
        historical_data = measurements_data.get("historical_data")
        insights_data = create_insights_data(historical_data)

        return dict({"insights_data": insights_data})

    @task()
    def load(data: dict):
        insights_data = data.get("insights_data")
        save_insights_data(insights_data=insights_data, action="save")

    extracted_data = extract()
    insights = transform(extracted_data)
    load(insights)


app_historical_insights_etl_dag = app_historical_insights_etl()
