import argparse
import os
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from airqo_etl_utils.arg_parse_validator import valid_datetime_format
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.commons import download_file_from_gcs
from airqo_etl_utils.constants import JobAction

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


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
        path_or_buf="kcca_unclean_data.csv", index=False
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


def app_notifications():
    from airqo_etl_utils.app_notification_utils import (
        create_notification_messages,
        NOTIFICATION_TEMPLATE_MAPPER,
    )
    from airqo_etl_utils.firebase_api import FirebaseApi

    recipients_by_countries = FirebaseApi.get_notification_recipients_by_countries(
        ["+256", "+255", "+254"]
    )
    recipients_by_countries.to_csv(path_or_buf="recipients.csv", index=False)

    recipients = FirebaseApi.get_notification_recipients_by_timezone_offset(16)
    recipients.to_csv(path_or_buf="recipients.csv", index=False)

    templates = FirebaseApi.get_notification_templates(
        NOTIFICATION_TEMPLATE_MAPPER["monday_morning"]
    )
    pd.DataFrame(templates).to_csv(path_or_buf="templates.csv", index=False)

    notification_messages = create_notification_messages(
        templates=templates, recipients=recipients
    )
    notification_messages.to_csv(path_or_buf="notification_messages.csv", index=False)


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


def upload_to_gcs():
    test_data = pd.DataFrame([{"name": "joe doe"}])
    download_file_from_gcs(
        bucket_name="airflow_xcom",
        source_file="test_data.csv",
        destination_file="test_data.csv",
    )


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


def calibrate_historical_data(start_date_time, end_date_time, tenant):
    from airqo_etl_utils.airqo_utils import calibrate_hourly_airqo_measurements
    from airqo_etl_utils.bigquery_api import BigQueryApi

    bigquery_api = BigQueryApi()

    device_measurements = bigquery_api.query_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=[
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "timestamp",
            "device_number",
            "site_id",
            "external_temperature",
            "external_humidity",
        ],
        table=bigquery_api.hourly_measurements_table,
        tenant=tenant,
    )

    weather_data = bigquery_api.query_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=["site_id", "timestamp", "temperature", "humidity"],
        table=bigquery_api.hourly_weather_table,
        tenant=tenant,
    )

    measurements = pd.merge(
        left=device_measurements,
        right=weather_data,
        on=["site_id", "timestamp"],
        how="left",
    )

    measurements = measurements.dropna(
        subset=[
            "site_id",
            "device_number",
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "timestamp",
        ]
    )

    measurements["humidity"] = measurements["humidity"].fillna(
        measurements["external_humidity"]
    )
    measurements["temperature"] = measurements["temperature"].fillna(
        measurements["external_temperature"]
    )

    del measurements["external_temperature"]
    del measurements["external_humidity"]

    measurements = measurements.dropna(subset=["temperature", "humidity"])

    measurements.rename(
        columns={"timestamp": "time", "device_number": "device_id"}, inplace=True
    )

    n = 1000
    measurements_list = [
        measurements[i : i + n] for i in range(0, measurements.shape[0], n)
    ]
    index = 0
    for chunk in measurements_list:
        calibrated_data = calibrate_hourly_airqo_measurements(measurements=chunk)
        calibrated_data.rename(
            columns={
                "time": "timestamp",
                "device_id": "device_number",
                "calibrated_pm2_5": "pm2_5_calibrated_value",
                "calibrated_pm10": "pm10_calibrated_value",
            },
            inplace=True,
        )
        calibrated_data["tenant"] = tenant
        bigquery_api.validate_data(
            dataframe=calibrated_data,
            table=bigquery_api.calibrated_hourly_measurements_table,
        )
        calibrated_data.to_csv(
            path_or_buf=f"historical_calibrated_data_{index}.csv", index=False
        )
        index = index + 1


def merge_historical_calibrated_data(
    path_to_uncalibrated_data: str, path_to_calibrated_data: str
):
    hourly_device_measurements = pd.read_csv(path_to_uncalibrated_data)

    kcca_data = hourly_device_measurements.loc[
        hourly_device_measurements["tenant"] == "kcca"
    ]
    airqo_data = hourly_device_measurements.loc[
        hourly_device_measurements["tenant"] == "airqo"
    ]

    calibrated_airqo_data = pd.read_csv(
        path_to_calibrated_data,
        usecols=[
            "device_number",
            "timestamp",
            "pm2_5_calibrated_value",
            "pm10_calibrated_value",
            "temperature",
            "humidity",
        ],
    )

    calibrated_airqo_data.rename(
        columns={
            "pm2_5_calibrated_value": "new_pm2_5",
            "pm10_calibrated_value": "new_pm10",
            "temperature": "new_external_temperature",
            "humidity": "new_external_humidity",
        },
        inplace=True,
    )

    airqo_data = pd.merge(
        left=airqo_data,
        right=calibrated_airqo_data,
        how="left",
        on=["timestamp", "device_number"],
    )

    uncalibrated_airqo_data = airqo_data.loc[
        (airqo_data["new_pm2_5"].isnull()) & (airqo_data["new_pm10"].isnull())
    ]

    del uncalibrated_airqo_data["new_pm2_5"]
    del uncalibrated_airqo_data["new_pm10"]
    del uncalibrated_airqo_data["new_external_temperature"]
    del uncalibrated_airqo_data["new_external_humidity"]

    calibrated_airqo_data = airqo_data.loc[
        (airqo_data["new_pm2_5"].notnull()) & (airqo_data["new_pm10"].notnull())
    ]

    calibrated_airqo_data["pm2_5"] = calibrated_airqo_data["new_pm2_5"]
    calibrated_airqo_data["pm2_5_calibrated_value"] = calibrated_airqo_data["new_pm2_5"]
    calibrated_airqo_data["pm10"] = calibrated_airqo_data["new_pm10"]
    calibrated_airqo_data["pm10_calibrated_value"] = calibrated_airqo_data["new_pm10"]
    calibrated_airqo_data["external_temperature"] = calibrated_airqo_data[
        "new_external_temperature"
    ]
    calibrated_airqo_data["external_humidity"] = calibrated_airqo_data[
        "new_external_humidity"
    ]

    del calibrated_airqo_data["new_pm2_5"]
    del calibrated_airqo_data["new_pm10"]
    del calibrated_airqo_data["new_external_temperature"]
    del calibrated_airqo_data["new_external_humidity"]

    assert sorted(list(calibrated_airqo_data.columns)) == sorted(
        list(uncalibrated_airqo_data.columns)
    )

    airqo_data = pd.concat(
        [calibrated_airqo_data, uncalibrated_airqo_data]
    ).drop_duplicates(
        subset=["timestamp", "device_number"], keep="first", ignore_index=True
    )

    merged_data = pd.concat([airqo_data, kcca_data], ignore_index=True)

    assert (
        sorted(list(airqo_data.columns))
        == sorted(list(kcca_data.columns))
        == sorted(list(merged_data.columns))
    )

    merged_data.to_csv("calibrated_merged_data.csv", index=False)

    with pd.option_context(
        "display.max_rows",
        None,
        "display.max_columns",
        None,
        "display.precision",
        3,
    ):
        print(merged_data.head(8))

    big_query_api = BigQueryApi()
    big_query_api.load_data(
        dataframe=merged_data,
        table=big_query_api.hourly_measurements_table,
        job_action=JobAction.OVERWRITE,
    )


def airnow_bam_data():
    from airqo_etl_utils.airnow_utils import (
        extract_airnow_data_from_api,
        process_airnow_data,
        process_for_message_broker,
        process_for_big_query,
    )

    extracted_bam_data = extract_airnow_data_from_api(
        start_date_time="2022-06-13T18:00", end_date_time="2022-06-13T18:00"
    )
    extracted_bam_data.to_csv("airnow_unprocessed_data.csv", index=False)

    processed_bam_data = process_airnow_data(extracted_bam_data)
    processed_bam_data.to_csv("airnow_processed_data.csv", index=False)

    message_broker_data = pd.DataFrame(process_for_message_broker(processed_bam_data))
    message_broker_data.to_csv("airnow_message_broker_data.csv", index=False)

    bigquery_data = pd.DataFrame(process_for_big_query(processed_bam_data))
    bigquery_data.to_csv("airnow_bigquery_data.csv", index=False)


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
        "--tenant",
        required=False,
        type=str.lower,
        default="airqo",
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
            "upload_to_gcs",
            "app_notifications",
            "calibrate_historical_data",
            "airnow_bam_data",
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

    elif args.action == "app_notifications":
        app_notifications()

    elif args.action == "meta_data":
        meta_data()

    elif args.action == "upload_to_gcs":
        upload_to_gcs()

    elif args.action == "calibrate_historical_data":
        calibrate_historical_data(
            start_date_time=args.start, end_date_time=args.end, tenant=args.tenant
        )
    elif args.action == "airnow_bam_data":
        airnow_bam_data()
    else:
        pass
