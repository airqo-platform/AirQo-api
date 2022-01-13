import traceback
from datetime import datetime
from datetime import timedelta

import pandas as pd
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from date import date_to_str_hours, date_to_str_days, date_to_str, predict_str_to_date, str_to_date
from utils import save_insights_data, format_measurements_to_insights


def predict_time_to_string(time):
    date_time = predict_str_to_date(time)
    return date_to_str(date_time)


def measurement_time_to_string(time: str, daily=False):
    date_time = str_to_date(time)
    if daily:
        return date_to_str_days(date_time)
    else:
        return date_to_str_hours(date_time)


def get_insights_forecast(tenant):
    airqo_api = AirQoApi()
    columns = ['time', 'pm2_5', 'siteId', 'frequency', 'forecast']
    devices = airqo_api.get_devices(tenant=tenant, active=True)

    forecast_measurements = pd.DataFrame(data=[], columns=columns)

    for device in devices:
        device_dict = dict(device)
        device_number = device_dict.get("device_number", None)
        site_id = device_dict.get("site", None)["_id"]

        if device_number:
            time = int(datetime.utcnow().timestamp())

            forecast = airqo_api.get_forecast(channel_id=device_number, timestamp=time)
            if forecast:
                forecast_df = pd.DataFrame(forecast)

                forecast_cleaned_df = pd.DataFrame(columns=columns)
                forecast_cleaned_df['time'] = forecast_df['prediction_time']
                forecast_cleaned_df['pm2_5'] = forecast_df['prediction_value']
                forecast_cleaned_df['siteId'] = site_id
                forecast_cleaned_df['frequency'] = 'hourly'
                forecast_cleaned_df['forecast'] = True

                forecast_measurements = forecast_measurements.append(forecast_cleaned_df, ignore_index=True)

        # if forecast_measurements.size > 72:
        #     break

    forecast_measurements['time'] = forecast_measurements['time'].apply(lambda x: predict_time_to_string(x))
    forecast_measurements = forecast_measurements[forecast_measurements['pm2_5'].notna()]

    return forecast_measurements.to_dict(orient="records")


def get_insights_averaged_data(tenant):
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant=tenant, active=True)
    averaged_measurements = []

    time = datetime.utcnow()
    hourly_start_time = date_to_str_hours(time - timedelta(hours=4))
    hourly_end_time = date_to_str_hours(time)
    daily_start_time = date_to_str_days(time - timedelta(days=2))
    daily_end_time = date_to_str_days(time)

    print(f'hourly start time : {hourly_start_time}')
    print(f'hourly end time : {hourly_end_time}')
    print(f'hourly start time : {daily_start_time}')
    print(f'hourly end time : {daily_end_time}')

    for device in devices:

        for frequency in ["daily", "hourly"]:

            try:
                if 'name' not in device.keys():
                    print(f'name missing in device keys : {device}')
                    continue

                start_time = hourly_start_time if frequency == "hourly" else daily_start_time
                end_time = hourly_end_time if frequency == "hourly" else daily_end_time
                events = airqo_api.get_events(tenant='airqo', start_time=start_time, frequency=frequency,
                                              end_time=end_time, device=device['name'])

                if not events:
                    print(f"No {frequency} measurements for {device['name']} : "
                          f"startTime {start_time} : endTime : {end_time}")
                    continue

                averaged_measurements.extend(events)

            except Exception as ex:
                print(ex)
                traceback.print_exc()
        #
        # if len(averaged_measurements) > 20:
        #     break

    insights = format_measurements_to_insights(data=averaged_measurements)
    return insights


def create_insights_data(forecast_data_file, averaged_data_file):
    print("creating insights .... ")

    forecast_data = pd.DataFrame(forecast_data_file)
    averaged_data = pd.DataFrame(averaged_data_file)

    insights_data = forecast_data.append(averaged_data, ignore_index=True)
    insights_data['forecast'].fillna(False, inplace=True)

    insights_data.dropna(inplace=True)
    insights_data['frequency'] = insights_data['frequency'].apply(lambda x: str(x).upper())

    return insights_data.to_dict(orient="records")


@dag('App-Insights', schedule_interval="*/40 * * * *",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights'])
def app_insights_etl():
    @task(multiple_outputs=True)
    def extract():
        forecast_data = get_insights_forecast('airqo')
        averaged_data = get_insights_averaged_data('airqo')

        return dict({"forecast_data": forecast_data, "averaged_data": averaged_data})

    @task(multiple_outputs=True)
    def transform(measurements_data: dict):
        forecast_data = measurements_data.get("forecast_data")
        averaged_data = measurements_data.get("averaged_data")

        insights_data = create_insights_data(forecast_data, averaged_data)

        return dict({"insights_data": insights_data})

    @task()
    def load(data: dict):
        insights_data = data.get("insights_data")
        save_insights_data(insights_data=insights_data, action="save")

    extracted_data = extract()
    insights = transform(extracted_data)
    load(insights)


app_insights_etl_dag = app_insights_etl()
