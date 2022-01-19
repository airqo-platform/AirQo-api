import sys
from datetime import datetime, timedelta

import pandas as pd

from airqo_measurements import extract_airqo_data_from_thingspeak, average_airqo_data, \
    extract_airqo_weather_data_from_tahmo, merge_airqo_and_weather_data, calibrate_hourly_airqo_measurements, \
    restructure_airqo_data
from app_insights import extract_airqo_data, create_insights_data, extract_insights_forecast
from dags.airqoApi import AirQoApi
from date import date_to_str_hours
from kcca_measurements import extract_kcca_measurements, transform_kcca_measurements
from utils import clean_up_task


def kcca():
    kcca_unclean_data = extract_kcca_measurements("2021-01-01T08:00:00Z", "2021-01-01T12:00:00Z", "hourly")
    cleaned_data = transform_kcca_measurements(kcca_unclean_data)

    airqo_api = AirQoApi()
    airqo_api.save_events(measurements=cleaned_data, tenant='kcca')


def airqo_hourly_measurements():
    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, '%Y-%m-%dT%H:59:59Z')

    # extract_airqo_data
    raw_airqo_data = extract_airqo_data_from_thingspeak(start_time=start_time, end_time=end_time)
    pd.DataFrame(raw_airqo_data).to_csv(path_or_buf='raw_airqo_data.csv', index=False)
    average_data = average_airqo_data(data=raw_airqo_data, frequency='hourly')
    pd.DataFrame(average_data).to_csv(path_or_buf='average_data.csv', index=False)

    # extract_weather_data
    airqo_weather_data = extract_airqo_weather_data_from_tahmo(start_time=start_time, end_time=end_time)
    pd.DataFrame(airqo_weather_data).to_csv(path_or_buf='airqo_weather_data.csv', index=False)

    # merge_data
    merged_measurements = merge_airqo_and_weather_data(airqo_data=average_data, weather_data=airqo_weather_data)
    pd.DataFrame(merged_measurements).to_csv(path_or_buf='data.csv', index=False)

    # calibrate data
    calibrated_data = calibrate_hourly_airqo_measurements(measurements=merged_measurements)
    pd.DataFrame(calibrated_data).to_csv(path_or_buf='calibrated_data.csv', index=False)

    # restructure data
    restructure_data = restructure_airqo_data(calibrated_data)
    pd.DataFrame(restructure_data).to_csv(path_or_buf='restructured_data.csv', index=False)


def insights_data():
    extract_insights_forecast("airqo", "test-insights-forecast.csv")
    extract_airqo_data("airqo", "test-insights-averaged.csv")
    create_insights_data("test-insights-forecast.csv", "test-insights-averaged.csv", "insights.json")
    clean_up_task(["test-insights-forecast.csv", "test-insights-averaged.csv", "insights.json"])


if __name__ == "__main__":

    strings_list = sys.argv
    action = f"{strings_list[1]}"

    if action == "airqo_hourly_data":
        airqo_hourly_measurements()

    else:
        raise Exception('Invalid arguments')
