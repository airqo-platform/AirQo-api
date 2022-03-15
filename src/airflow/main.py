import os
import sys
from datetime import datetime, timedelta

import pandas as pd
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


sys.path.append("/")


def kcca():
    from airflow_utils.kcca_utils import (
        extract_kcca_measurements,
        transform_kcca_measurements_for_api,
        transform_kcca_data_for_message_broker,
    )

    kcca_unclean_data = extract_kcca_measurements(
        "2021-01-01T08:00:00Z", "2021-01-01T12:00:00Z", "hourly"
    )
    pd.DataFrame(kcca_unclean_data).to_csv(
        path_or_buf="kcca_unclean_data.csv", index=False
    )
    cleaned_data = transform_kcca_measurements_for_api(kcca_unclean_data)
    pd.DataFrame(cleaned_data).to_csv(path_or_buf="kcca_cleaned_data.csv", index=False)

    bigquery_data = transform_kcca_data_for_message_broker(
        kcca_unclean_data, frequency="hourly"
    )
    pd.DataFrame(bigquery_data).to_csv(
        path_or_buf="kcca_data_for_bigquery.csv", index=False
    )


def kcca_historical_hourly_data(start_date_time: str, end_date_time: str):
    from airflow_utils.kcca_utils import (
        extract_kcca_measurements,
        transform_kcca_hourly_data_for_bigquery,
    )
    from airflow_utils.date import date_to_str_hours

    if start_date_time == "" or end_date_time == "":
        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    kcca_unclean_data = extract_kcca_measurements(
        start_time=start_date_time, end_time=end_date_time, freq="hourly"
    )
    pd.DataFrame(kcca_unclean_data).to_csv(
        path_or_buf="kcca_unclean_data.csv", index=False
    )

    cleaned_data = transform_kcca_hourly_data_for_bigquery(kcca_unclean_data)
    pd.DataFrame(cleaned_data).to_csv(path_or_buf="kcca_cleaned_data.csv", index=False)


def airqo_hourly_measurements(start_date_time: str, end_date_time: str):
    from airflow_utils.airqo_utils import (
        extract_airqo_data_from_thingspeak,
        average_airqo_data,
        extract_airqo_weather_data_from_tahmo,
        merge_airqo_and_weather_data,
        calibrate_hourly_airqo_measurements,
        restructure_airqo_data,
    )
    from airflow_utils.date import date_to_str_hours

    if start_date_time == "" or end_date_time == "":
        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    # extract_airqo_data
    raw_airqo_data = extract_airqo_data_from_thingspeak(
        start_time=start_date_time, end_time=end_date_time, all_devices=False
    )
    pd.DataFrame(raw_airqo_data).to_csv(path_or_buf="raw_airqo_data.csv", index=False)
    average_data = average_airqo_data(data=raw_airqo_data, frequency="hourly")
    pd.DataFrame(average_data).to_csv(
        path_or_buf="averaged_airqo_data.csv", index=False
    )

    # extract_weather_data
    airqo_weather_data = extract_airqo_weather_data_from_tahmo(
        start_time=start_date_time, end_time=end_date_time
    )
    pd.DataFrame(airqo_weather_data).to_csv(
        path_or_buf="tahmo_weather_data.csv", index=False
    )

    # merge_data
    merged_measurements = merge_airqo_and_weather_data(
        airqo_data=average_data, weather_data=airqo_weather_data
    )
    pd.DataFrame(merged_measurements).to_csv(
        path_or_buf="merged_airqo_data.csv", index=False
    )

    # calibrate data
    calibrated_data = calibrate_hourly_airqo_measurements(
        measurements=merged_measurements
    )
    pd.DataFrame(calibrated_data).to_csv(
        path_or_buf="calibrated_airqo_data.csv", index=False
    )

    # restructure data for api
    restructure_data = restructure_airqo_data(data=calibrated_data, destination="api")
    pd.DataFrame(restructure_data).to_csv(
        path_or_buf="airqo_data_for_api.csv", index=False
    )

    # restructure data for bigquery
    restructure_data = restructure_airqo_data(
        data=calibrated_data, destination="bigquery"
    )
    pd.DataFrame(restructure_data).to_csv(
        path_or_buf="airqo_data_for_bigquery.csv", index=False
    )

    # restructure data for message broker
    restructure_data = restructure_airqo_data(
        data=calibrated_data, destination="message-broker"
    )
    pd.DataFrame(restructure_data).to_csv(
        path_or_buf="airqo_data_for_message_broker.csv", index=False
    )


def insights_data():
    # extract airqo data
    # start_time = '2020-01-01T16:00:00Z'
    # end_time = '2020-01-01T17:00:00Z'
    airqo_data = extract_airqo_data(tenant="airqo")
    pd.DataFrame(airqo_data).to_csv(path_or_buf="insights_airqo_data.csv", index=False)

    # extract forecast data
    forecast_data = extract_insights_forecast(tenant="airqo")
    pd.DataFrame(forecast_data).to_csv(
        path_or_buf="insights_forecast_data.csv", index=False
    )


if __name__ == "__main__":

    args = sys.argv[1:]
    if len(args) == 0:
        raise Exception(
            "Missing required action argument. Valid arguments are airqo_hourly_data,"
            " kcca_hourly_data, kcca_historical_hourly_data. "
            "For example `python main.py airqo_hourly_data 2022-01-01T10:00:00Z 2022-01-01T17:00:00Z`"
        )

    action = args[0]
    start_time = ""
    end_time = ""

    if len(args) >= 3:
        start_time = args[1]
        end_time = args[2]

    if action == "airqo_hourly_data":
        airqo_hourly_measurements(start_date_time=start_time, end_date_time=end_time)
    elif action == "kcca_hourly_data":
        kcca()
    elif action == "kcca_historical_hourly_data":
        kcca_historical_hourly_data(start_date_time=start_time, end_date_time=end_time)
    elif action == "insights_data":
        insights_data()

    else:
        raise Exception("Invalid arguments")
