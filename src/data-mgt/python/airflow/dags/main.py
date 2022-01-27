import sys
from datetime import datetime, timedelta

import pandas as pd

from airqo_measurements import extract_airqo_data_from_thingspeak, average_airqo_data, \
    extract_airqo_weather_data_from_tahmo, merge_airqo_and_weather_data, calibrate_hourly_airqo_measurements, \
    extract_airqo_devices_deployment_history, restructure_airqo_data_for_api, restructure_airqo_data_for_bigquery
from date import date_to_str_hours
from kcca_measurements import extract_kcca_measurements, transform_kcca_measurements


def kcca():
    kcca_unclean_data = extract_kcca_measurements("2021-01-01T08:00:00Z", "2021-01-01T12:00:00Z", "hourly")
    pd.DataFrame(kcca_unclean_data).to_csv(path_or_buf='kcca_unclean_data.csv', index=False)
    cleaned_data = transform_kcca_measurements(kcca_unclean_data)
    pd.DataFrame(cleaned_data).to_csv(path_or_buf='kcca_cleaned_data.csv', index=False)


def airqo_hourly_measurements():
    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, '%Y-%m-%dT%H:59:59Z')
    # start_time = '2020-01-01T16:00:00Z'
    # end_time = '2020-01-01T17:00:00Z'

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

    # device logs
    device_logs = extract_airqo_devices_deployment_history()
    pd.DataFrame(device_logs).to_csv(path_or_buf='device_logs.csv', index=False)

    # restructure data
    restructure_data = restructure_airqo_data_for_api(data=calibrated_data, devices_logs=device_logs)
    pd.DataFrame(restructure_data).to_csv(path_or_buf='restructured_data_for_api.csv', index=False)

    # restructure data for bigquery
    restructure_data = restructure_airqo_data_for_bigquery(data=calibrated_data, devices_logs=device_logs)
    pd.DataFrame(restructure_data).to_csv(path_or_buf='restructured_data_for_bigquery.csv', index=False)


def insights_data():
    # extract airqo data
    # start_time = '2020-01-01T16:00:00Z'
    # end_time = '2020-01-01T17:00:00Z'
    airqo_data = extract_airqo_data(tenant="airqo")
    pd.DataFrame(airqo_data).to_csv(path_or_buf='insights_airqo_data.csv', index=False)

    # extract forecast data
    forecast_data = extract_insights_forecast(tenant="airqo")
    pd.DataFrame(forecast_data).to_csv(path_or_buf='insights_forecast_data.csv', index=False)


if __name__ == "__main__":
    strings_list = sys.argv
    action = f"{strings_list[1]}"

    if action == "airqo_hourly_data":
        airqo_hourly_measurements()
    elif action == "kcca_hourly_data":
        kcca()
    elif action == "insights_data":
        insights_data()

    else:
        raise Exception('Invalid arguments')
