from datetime import datetime

import pandas as pd
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from date import date_to_str_days, first_day_of_month, first_day_of_week
from utils import save_insights_data, format_measurements_to_insights


# def measurement_time_to_string(time: str, daily=False):
#     date_time = str_to_date(time)
#     if daily:
#         return date_to_str_days(date_time)
#     else:
#         return date_to_str_hours(date_time)


def get_insights_historical_data(tenant: str):
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant=tenant, active=True)
    historical_measurements = []

    time = datetime.utcnow()
    start_time = date_to_str_days(first_day_of_week(first_day_of_month(date_time=time)))
    end_time = date_to_str_days(time)
    print(f'start time : {start_time}')
    print(f'end time : {end_time}')

    for device in devices:
        device_hourly_events = airqo_api.get_events(tenant='airqo', start_time=start_time, frequency='hourly',
                                                    end_time=end_time, device=device['name'])
        if device_hourly_events:
            historical_measurements.extend(device_hourly_events)

        device_daily_events = airqo_api.get_events(tenant='airqo', start_time=start_time, frequency='daily',
                                                   end_time=end_time, device=device['name'])
        if device_daily_events:
            historical_measurements.extend(device_daily_events)

    insights = format_measurements_to_insights(data=historical_measurements)
    return insights

    # measurements_df = pd.DataFrame(historical_measurements)
    #
    # measurements_df['average_pm2_5.calibratedValue'].fillna(measurements_df['average_pm2_5.value'], inplace=True)
    # measurements_df['average_pm10.calibratedValue'].fillna(measurements_df['average_pm10.value'], inplace=True)
    #
    # measurements_df = measurements_df[['time', 'frequency', 'site_id', 'average_pm2_5.calibratedValue',
    #                                    'average_pm10.calibratedValue']]
    #
    # measurements_df.columns = ['time', 'frequency', 'siteId', 'pm2_5', 'pm10']
    # measurements_df = measurements_df[measurements_df['pm2_5'].notna()]
    # measurements_df['frequency'] = measurements_df['frequency'].apply(lambda x: str(x).upper())
    #
    # hourly_measurements_df = measurements_df[measurements_df["frequency"] == "HOURLY"]
    # hourly_measurements_df['time'] = hourly_measurements_df['time'].apply(
    #     lambda x: measurement_time_to_string(x, daily=False))
    #
    # daily_measurements_df = measurements_df[measurements_df["frequency"] == "DAILY"]
    # daily_measurements_df['time'] = daily_measurements_df['time'].apply(
    #     lambda x: measurement_time_to_string(x, daily=True))
    #
    # return hourly_measurements_df.to_dict(orient="records").extend(daily_measurements_df.to_dict(orient="records"))


def create_insights_data(averaged_data_file):
    print("creating insights .... ")

    insights_data = pd.DataFrame(averaged_data_file)

    insights_data.dropna(inplace=True)
    insights_data['frequency'] = insights_data['frequency'].apply(lambda x: str(x).upper())

    return insights_data.to_dict(orient="records")


@dag('App-Historical-Insights', schedule_interval="@weekly",
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
