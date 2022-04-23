import argparse
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from airqo_etl_utils.arg_parse_validator import valid_datetime_format

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

sys.path.append("/")


def kcca_hourly_measurements(start_date_time: str, end_date_time: str):
    from airqo_etl_utils.kcca_utils import (
        extract_kcca_measurements,
        transform_kcca_measurements_for_api,
        transform_kcca_data_for_message_broker,
        transform_kcca_data_for_bigquery,
    )
    from airqo_etl_utils.bigquery_api import BigQueryApi

    kcca_unclean_data = extract_kcca_measurements(
        start_time=start_date_time, end_time=end_date_time, freq="hourly"
    )
    pd.DataFrame(kcca_unclean_data).to_csv(
        path_or_buf="outputs/kcca_unclean_data.csv", index=False
    )

    # API
    cleaned_data = transform_kcca_measurements_for_api(kcca_unclean_data)
    pd.DataFrame(cleaned_data).to_csv(path_or_buf="kcca_cleaned_data.csv", index=False)

    # Message Broker
    message_broker_data = transform_kcca_data_for_message_broker(
        kcca_unclean_data, frequency="hourly"
    )
    pd.DataFrame(message_broker_data).to_csv(
        path_or_buf="kcca_message_broker_data.csv", index=False
    )

    # Big Query
    bigquery_data = transform_kcca_data_for_bigquery(data=kcca_unclean_data)
    bigquery_data_df = pd.DataFrame(bigquery_data)
    bigquery_api = BigQueryApi()
    bigquery_data_df = bigquery_api.validate_data(
        dataframe=bigquery_data_df, table=bigquery_api.hourly_measurements_table
    )
    bigquery_data_df.to_csv(path_or_buf="kcca_data_for_bigquery.csv", index=False)


def data_warehouse(start_date_time: str, end_date_time: str):
    from airqo_etl_utils.data_warehouse_utils import (
        query_hourly_measurements,
        query_hourly_weather_data,
        extract_sites_meta_data,
        merge_measurements_weather_sites,
    )
    from airqo_etl_utils.bigquery_api import BigQueryApi

    hourly_device_measurements = query_hourly_measurements(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
    )
    pd.DataFrame(hourly_device_measurements).to_csv(
        path_or_buf="hourly_device_measurements.csv", index=False
    )

    hourly_weather_measurements = query_hourly_weather_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
    )
    pd.DataFrame(hourly_weather_measurements).to_csv(
        path_or_buf="hourly_weather_measurements.csv", index=False
    )

    sites_meta_data = extract_sites_meta_data()
    pd.DataFrame(sites_meta_data).to_csv(path_or_buf="sites_meta_data.csv", index=False)

    data = merge_measurements_weather_sites(
        measurements_data=hourly_device_measurements,
        weather_data=hourly_weather_measurements,
        sites=sites_meta_data,
    )

    data_df = pd.DataFrame(data)
    bigquery_api = BigQueryApi()
    data_df = bigquery_api.validate_data(
        dataframe=data_df, table=bigquery_api.analytics_table
    )
    data_df.to_csv(path_or_buf="data_warehouse.csv", index=False)


def airqo_hourly_measurements(start_date_time: str, end_date_time: str):
    from airqo_etl_utils.airqo_utils import (
        extract_airqo_data_from_thingspeak,
        average_airqo_data,
        extract_airqo_weather_data_from_tahmo,
        merge_airqo_and_weather_data,
        calibrate_hourly_airqo_measurements,
        restructure_airqo_data,
    )
    from airqo_etl_utils.bigquery_api import BigQueryApi

    # extract_airqo_data
    raw_airqo_data = extract_airqo_data_from_thingspeak(
        start_time=start_date_time, end_time=end_date_time
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

    bigquery_data_df = pd.DataFrame(restructure_data)
    bigquery_api = BigQueryApi()
    bigquery_data_df = bigquery_api.validate_data(
        dataframe=bigquery_data_df, table=bigquery_api.hourly_measurements_table
    )
    bigquery_data_df.to_csv(path_or_buf="airqo_data_for_bigquery.csv", index=False)

    # restructure data for message broker
    restructure_data = restructure_airqo_data(
        data=calibrated_data, destination="message-broker"
    )
    pd.DataFrame(restructure_data).to_csv(
        path_or_buf="airqo_data_for_message_broker.csv", index=False
    )


def insights_forecast():
    from airqo_etl_utils.app_insights_utils import (
        create_insights_data,
        get_forecast_data,
        transform_old_forecast,
    )

    from airqo_etl_utils.date import date_to_str, first_day_of_week, first_day_of_month

    now = datetime.now()
    start_date_time = date_to_str(first_day_of_week(first_day_of_month(date_time=now)))
    end_date_time = date_to_str(now)

    old_forecast = transform_old_forecast(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    pd.DataFrame(old_forecast).to_csv(path_or_buf="old_forecast_data.csv", index=False)

    forecast_data = get_forecast_data("airqo")
    pd.DataFrame(forecast_data).to_csv(path_or_buf="forecast_data.csv", index=False)

    insights_data = create_insights_data(data=forecast_data)
    pd.DataFrame(insights_data).to_csv(
        path_or_buf="insights_forecast_data.csv", index=False
    )


def daily_insights(start_date_time: str, end_date_time: str):
    from airqo_etl_utils.app_insights_utils import (
        query_insights_data,
        average_insights_data,
        create_insights_data,
    )

    hourly_insights_data = query_insights_data(
        freq="hourly", start_date_time=start_date_time, end_date_time=end_date_time
    )
    pd.DataFrame(hourly_insights_data).to_csv(
        path_or_buf="hourly_insights_airqo_data.csv", index=False
    )

    daily_insights_data = average_insights_data(
        frequency="daily", data=hourly_insights_data
    )
    pd.DataFrame(daily_insights_data).to_csv(
        path_or_buf="daily_insights_airqo_data.csv", index=False
    )

    insights_data = create_insights_data(daily_insights_data)
    pd.DataFrame(insights_data).to_csv(path_or_buf="insights_data.csv", index=False)


def weather_data(start_date_time: str, end_date_time: str):
    from airqo_etl_utils.weather_data_utils import (
        resample_weather_data,
        query_weather_data_from_tahmo,
        add_site_info_to_weather_data,
        transform_weather_data_for_bigquery,
    )
    from airqo_etl_utils.bigquery_api import BigQueryApi

    raw_weather_data = query_weather_data_from_tahmo(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    pd.DataFrame(raw_weather_data).to_csv(
        path_or_buf="raw_weather_data.csv", index=False
    )

    hourly_weather_data = resample_weather_data(
        data=raw_weather_data, frequency="hourly"
    )
    pd.DataFrame(hourly_weather_data).to_csv(
        path_or_buf="hourly_weather_data.csv", index=False
    )

    sites_weather_data = add_site_info_to_weather_data(data=hourly_weather_data)
    pd.DataFrame(sites_weather_data).to_csv(
        path_or_buf="sites_weather_data.csv", index=False
    )

    bigquery_data = transform_weather_data_for_bigquery(data=sites_weather_data)
    bigquery_data_df = pd.DataFrame(bigquery_data)
    bigquery_api = BigQueryApi()
    bigquery_data_df = bigquery_api.validate_data(
        dataframe=bigquery_data_df, table=bigquery_api.hourly_weather_table
    )
    bigquery_data_df.to_csv(path_or_buf="bigquery_weather_data.csv", index=False)


def meta_data():
    from airqo_etl_utils.meta_data_utils import extract_meta_data
    from airqo_etl_utils.bigquery_api import BigQueryApi

    sites = extract_meta_data(component="sites")
    sites_df = pd.DataFrame(sites)
    sites_df.to_csv(path_or_buf="sites_data.csv", index=False)

    bigquery_api = BigQueryApi()
    bigquery_data_df = bigquery_api.validate_data(
        dataframe=sites_df, table=bigquery_api.sites_table
    )
    bigquery_data_df.to_csv(path_or_buf="bigquery_sites_data.csv", index=False)

    devices = extract_meta_data(component="devices")
    devices_df = pd.DataFrame(devices)
    devices_df.to_csv(path_or_buf="devices_data.csv", index=False)

    bigquery_api = BigQueryApi()
    bigquery_data_df = bigquery_api.validate_data(
        dataframe=devices_df, table=bigquery_api.devices_table
    )
    bigquery_data_df.to_csv(path_or_buf="bigquery_devices_data.csv", index=False)


if __name__ == "__main__":

    from airqo_etl_utils.date import date_to_str_hours

    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    default_args_start = date_to_str_hours(hour_of_day)
    default_args_end = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    parser = argparse.ArgumentParser(description="Test functions configuration")
    parser.add_argument(
        "--start",
        default=default_args_start,
        required=False,
        type=valid_datetime_format,
        help='start datetime in format "yyyy-MM-ddThh:mm:ssZ"',
    )
    parser.add_argument(
        "--end",
        required=False,
        default=default_args_end,
        type=valid_datetime_format,
        help='end datetime in format "yyyy-MM-ddThh:mm:ssZ"',
    )
    parser.add_argument(
        "--action",
        required=True,
        type=str.lower,
        help="range interval in minutes",
        choices=[
            "airqo_hourly_data",
            "weather_data",
            "data_warehouse",
            "kcca_hourly_data",
            "daily_insights_data",
            "forecast_insights_data",
            "meta_data",
        ],
    )

    args = parser.parse_args()

    if args.action == "airqo_hourly_data":
        airqo_hourly_measurements(start_date_time=args.start, end_date_time=args.end)

    elif args.action == "weather_data":
        weather_data(start_date_time=args.start, end_date_time=args.end)

    elif args.action == "data_warehouse":
        data_warehouse(start_date_time=args.start, end_date_time=args.end)

    elif args.action == "kcca_hourly_data":
        kcca_hourly_measurements(start_date_time=args.start, end_date_time=args.end)

    elif args.action == "daily_insights_data":
        daily_insights(start_date_time=args.start, end_date_time=args.end)

    elif args.action == "forecast_insights_data":
        insights_forecast()

    elif args.action == "meta_data":
        meta_data()

    else:
        pass
