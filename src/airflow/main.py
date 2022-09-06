import argparse
import os
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.arg_parse_validator import valid_datetime_format
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.calibration_utils import CalibrationUtils
from airqo_etl_utils.commons import download_file_from_gcs
from airqo_etl_utils.constants import (
    JobAction,
    Frequency,
    Tenant,
    DeviceCategory,
    DataType,
)
from airqo_etl_utils.weather_data_utils import WeatherDataUtils

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


def airqo_historical_hourly_data():

    start_date_time = "2022-01-01T10:00:00Z"
    end_date_time = "2022-01-01T17:00:00Z"

    hourly_device_measurements = AirQoDataUtils.extract_aggregated_raw_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
    )
    hourly_device_measurements.to_csv(
        path_or_buf="hourly_device_measurements.csv", index=False
    )

    hourly_weather_data = WeatherDataUtils.extract_hourly_weather_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
    )
    hourly_weather_data.to_csv(path_or_buf="hourly_weather_data.csv", index=False)

    merged_data = AirQoDataUtils.merge_aggregated_weather_data(
        airqo_data=hourly_device_measurements, weather_data=hourly_weather_data
    )
    merged_data.to_csv(path_or_buf="merged_data.csv", index=False)

    calibrated_data = CalibrationUtils.calibrate_airqo_data(data=merged_data)
    calibrated_data.to_csv(path_or_buf="calibrated_data.csv", index=False)

    bigquery_data = AirQoDataUtils.process_aggregated_data_for_bigquery(
        data=calibrated_data
    )
    bigquery_data.to_csv(path_or_buf="bigquery_data.csv", index=False)


def airqo_historical_raw_data():
    start_date_time = "2022-01-01T10:00:00Z"
    end_date_time = "2022-01-01T17:00:00Z"

    low_cost_sensors_data = AirQoDataUtils.extract_devices_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        device_category=DeviceCategory.LOW_COST,
    )
    low_cost_sensors_data.to_csv(path_or_buf="low_cost_sensors_data.csv", index=False)

    deployment_logs = AirQoDataUtils.extract_devices_deployment_logs()
    deployment_logs.to_csv(path_or_buf="deployment_logs.csv", index=False)

    historical_data = AirQoDataUtils.map_site_ids_to_historical_data(
        data=low_cost_sensors_data, deployment_logs=deployment_logs
    )
    historical_data.to_csv(path_or_buf="historical_data.csv", index=False)

    bigquery_data = AirQoDataUtils.process_raw_data_for_bigquery(data=historical_data)
    bigquery_data.to_csv(path_or_buf="bigquery_data.csv", index=False)


def airqo_realtime_data():
    from airqo_etl_utils.airqo_utils import AirQoDataUtils
    from airqo_etl_utils.app_insights_utils import AirQoAppUtils
    from airqo_etl_utils.weather_data_utils import WeatherDataUtils

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour = datetime.utcnow() - timedelta(hours=1)
    start_date_time = date_to_str_hours(hour)
    end_date_time = datetime.strftime(hour, "%Y-%m-%dT%H:59:59Z")

    low_cost_sensors_data = AirQoDataUtils.extract_devices_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        device_category=DeviceCategory.LOW_COST,
    )

    low_cost_sensors_data.to_csv(path_or_buf="low_cost_sensors_data.csv", index=False)

    bigquery_data = AirQoDataUtils.process_raw_data_for_bigquery(
        data=low_cost_sensors_data
    )
    bigquery_data.to_csv(path_or_buf="low_cost_sensors_bigquery_data.csv", index=False)

    aggregated_sensors_data = AirQoDataUtils.aggregate_low_cost_sensors_data(
        data=low_cost_sensors_data
    )
    aggregated_sensors_data.to_csv(
        path_or_buf="aggregated_sensors_data.csv", index=False
    )

    aggregated_weather_data = WeatherDataUtils.extract_hourly_data(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    aggregated_weather_data.to_csv(
        path_or_buf="aggregated_weather_data.csv", index=False
    )

    merged_data = AirQoDataUtils.merge_aggregated_weather_data(
        airqo_data=aggregated_sensors_data, weather_data=aggregated_weather_data
    )
    merged_data.to_csv(path_or_buf="merged_data.csv", index=False)

    calibrated_data = CalibrationUtils.calibrate_airqo_data(data=merged_data)
    calibrated_data.to_csv(path_or_buf="calibrated_data.csv", index=False)

    bigquery_data = AirQoDataUtils.process_aggregated_data_for_bigquery(
        data=calibrated_data
    )
    bigquery_data.to_csv(path_or_buf="calibrated_bigquery_data.csv", index=False)

    insights_data = AirQoAppUtils.format_data_to_insights(
        data=calibrated_data, frequency=Frequency.HOURLY
    )
    insights_data.to_csv(path_or_buf="insights_data.csv", index=False)

    message_broker_data = AirQoDataUtils.process_data_for_message_broker(
        data=calibrated_data, frequency=Frequency.HOURLY
    )
    pd.DataFrame(message_broker_data).to_csv(
        path_or_buf="message_broker_data.csv", index=False
    )


def insights_forecast():
    from airqo_etl_utils.app_insights_utils import AirQoAppUtils

    from airqo_etl_utils.date import date_to_str, first_day_of_week, first_day_of_month

    now = datetime.now()
    start_date_time = date_to_str(first_day_of_week(first_day_of_month(date_time=now)))
    end_date_time = date_to_str(now)

    old_forecast = AirQoAppUtils.transform_old_forecast(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    pd.DataFrame(old_forecast).to_csv(path_or_buf="old_forecast_data.csv", index=False)

    forecast_data = AirQoAppUtils.extract_forecast_data()
    pd.DataFrame(forecast_data).to_csv(path_or_buf="forecast_data.csv", index=False)

    insights_data = AirQoAppUtils.create_insights(data=forecast_data)
    pd.DataFrame(insights_data).to_csv(
        path_or_buf="insights_forecast_data.csv", index=False
    )


def app_notifications():
    from airqo_etl_utils.app_notification_utils import (
        get_notification_recipients,
        get_notification_templates,
        create_notification_messages,
        NOTIFICATION_TEMPLATE_MAPPER,
    )

    recipients = get_notification_recipients(16)
    recipients.to_csv(path_or_buf="recipients.csv", index=False)

    templates = get_notification_templates(
        NOTIFICATION_TEMPLATE_MAPPER["monday_morning"]
    )
    pd.DataFrame(templates).to_csv(path_or_buf="templates.csv", index=False)

    notification_messages = create_notification_messages(
        templates=templates, recipients=recipients
    )
    notification_messages.to_csv(path_or_buf="notification_messages.csv", index=False)


def daily_insights(start_date_time: str, end_date_time: str):
    from airqo_etl_utils.app_insights_utils import AirQoAppUtils

    hourly_insights_data = AirQoAppUtils.extract_insights(
        freq="hourly", start_date_time=start_date_time, end_date_time=end_date_time
    )
    pd.DataFrame(hourly_insights_data).to_csv(
        path_or_buf="hourly_insights_airqo_data.csv", index=False
    )

    daily_insights_data = AirQoAppUtils.average_insights(
        frequency="daily", data=hourly_insights_data
    )
    pd.DataFrame(daily_insights_data).to_csv(
        path_or_buf="daily_insights_airqo_data.csv", index=False
    )

    insights_data = AirQoAppUtils.create_insights(daily_insights_data)
    pd.DataFrame(insights_data).to_csv(path_or_buf="insights_data.csv", index=False)


def weather_data():
    from airqo_etl_utils.weather_data_utils import WeatherDataUtils

    start_date_time = "2022-01-01T10:00:00Z"
    end_date_time = "2022-01-01T17:00:00Z"

    raw_weather_data = WeatherDataUtils.query_raw_data_from_tahmo(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    raw_weather_data.to_csv(path_or_buf="raw_weather_data.csv", index=False)

    cleaned_weather_data = WeatherDataUtils.transform_raw_data(data=raw_weather_data)
    cleaned_weather_data.to_csv(path_or_buf="cleaned_weather_data.csv", index=False)

    hourly_weather_data = WeatherDataUtils.aggregate_data(data=cleaned_weather_data)
    hourly_weather_data.to_csv(path_or_buf="hourly_weather_data.csv", index=False)

    bigquery_weather_data = WeatherDataUtils.transform_for_bigquery(
        data=hourly_weather_data
    )
    bigquery_weather_data.to_csv(path_or_buf="bigquery_weather_data.csv", index=False)


def upload_to_gcs():
    download_file_from_gcs(
        bucket_name="airflow_xcom",
        source_file="test_data.csv",
        destination_file="test_data.csv",
    )


def meta_data():
    from airqo_etl_utils.meta_data_utils import MetaDataUtils
    from airqo_etl_utils.bigquery_api import BigQueryApi

    sites = MetaDataUtils.extract_meta_data(component="sites")
    sites_df = pd.DataFrame(sites)
    sites_df.to_csv(path_or_buf="sites_data.csv", index=False)

    bigquery_api = BigQueryApi()
    bigquery_data_df = bigquery_api.validate_data(
        dataframe=sites_df, table=bigquery_api.sites_table
    )
    bigquery_data_df.to_csv(path_or_buf="bigquery_sites_data.csv", index=False)

    devices = MetaDataUtils.extract_meta_data(component="devices")
    devices_df = pd.DataFrame(devices)
    devices_df.to_csv(path_or_buf="devices_data.csv", index=False)

    bigquery_api = BigQueryApi()
    bigquery_data_df = bigquery_api.validate_data(
        dataframe=devices_df, table=bigquery_api.devices_table
    )
    bigquery_data_df.to_csv(path_or_buf="bigquery_devices_data.csv", index=False)


def calibrate_historical_data():
    from airqo_etl_utils.calibration_utils import CalibrationUtils
    from airqo_etl_utils.airqo_utils import AirQoDataUtils

    start_date_time = "2022-01-01T00:00:00Z"
    end_date_time = "2022-01-10T00:00:00Z"

    hourly_weather_data = WeatherDataUtils.extract_hourly_weather_data(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    hourly_weather_data.to_csv("historical_weather_data.csv", index=False)

    device_measurements = AirQoDataUtils.extract_aggregated_raw_data(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    device_measurements.to_csv("historical_device_measurements.csv", index=False)

    merged_data = AirQoDataUtils.merge_aggregated_weather_data(
        airqo_data=device_measurements,
        weather_data=hourly_weather_data,
    )
    merged_data.to_csv("historical_merged_data.csv", index=False)

    calibrated_data = CalibrationUtils.calibrate_airqo_data(
        data=merged_data,
    )
    calibrated_data.to_csv("historical_calibrated_data.csv", index=False)


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
    from airqo_etl_utils.airnow_utils import AirnowDataUtils

    extracted_bam_data = AirnowDataUtils.extract_bam_data(
        start_date_time="2019-01-01T00:00:00Z", end_date_time="2022-08-01T00:00:00Z"
    )
    extracted_bam_data.to_csv("airnow_unprocessed_data.csv", index=False)

    processed_bam_data = AirnowDataUtils.process_bam_data(extracted_bam_data)
    processed_bam_data.to_csv("airnow_processed_data.csv", index=False)

    bigquery_data = AirnowDataUtils.process_for_bigquery(processed_bam_data)
    bigquery_data.to_csv("airnow_bigquery_data.csv", index=False)


def nasa_purple_air_data():
    from airqo_etl_utils.purple_air_utils import PurpleDataUtils

    extracted_data = PurpleDataUtils.extract_data(
        start_date_time="2022-07-28T19:00:00Z", end_date_time="2022-07-28T19:59:59Z"
    )
    extracted_data.to_csv("purple_air_unprocessed_data.csv", index=False)

    processed_data = PurpleDataUtils.process_data(extracted_data)
    processed_data.to_csv("purple_air_processed_data.csv", index=False)

    bigquery_data = PurpleDataUtils.process_for_bigquery(processed_data)
    bigquery_data.to_csv("purple_air_bigquery_data.csv", index=False)


def airqo_bam_data():
    from airqo_etl_utils.airqo_utils import AirQoDataUtils

    extracted_bam_data = AirQoDataUtils.extract_devices_data(
        start_date_time="2022-07-28T19:00:00Z",
        end_date_time="2022-07-28T19:59:59Z",
        device_category=DeviceCategory.BAM,
    )
    extracted_bam_data.to_csv("airqo_bam_unprocessed_data.csv", index=False)

    processed_bam_data = AirQoDataUtils.clean_bam_data(extracted_bam_data)
    processed_bam_data.to_csv("airqo_bam_processed_data.csv", index=False)

    bigquery_data = AirQoDataUtils.format_data_for_bigquery(
        data=processed_bam_data, data_type=DataType.CLEAN_BAM_DATA
    )
    bigquery_data.to_csv("airqo_bam_bigquery_data.csv", index=False)


def urban_better_data_from_plume_labs():
    from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
    from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

    start_date_time = "2022-08-13T00:00:00Z"
    end_date_time = "2022-08-13T23:59:59Z"

    measures = PlumeLabsUtils.extract_sensor_measures(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        tenant=Tenant.URBAN_BETTER,
    )
    measures.to_csv("measures_data.csv", index=False)

    sensor_positions = PlumeLabsUtils.extract_sensor_positions(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        tenant=Tenant.URBAN_BETTER,
    )
    sensor_positions.to_csv("sensor_positions_data.csv", index=False)

    urban_better_data = PlumeLabsUtils.merge_sensor_measures_and_positions(
        measures=measures,
        sensor_positions=sensor_positions,
    )
    urban_better_data.to_csv("urban_better_unprocessed_data.csv", index=False)

    bigquery_data = pd.DataFrame(
        UrbanBetterUtils.process_for_big_query(dataframe=urban_better_data)
    )
    bigquery_data.to_csv("urban_better_bigquery_data.csv", index=False)


def urban_better_data_from_air_beam():
    from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

    start_date_time = "2022-07-21T07:00:00Z"
    end_date_time = "2022-07-21T17:00:00Z"
    stream_ids = UrbanBetterUtils.extract_stream_ids_from_air_beam(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    stream_ids.to_csv("urban_better_air_beam_stream_ids.csv", index=False)

    measurements = UrbanBetterUtils.extract_measurements_from_air_beam(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        stream_ids=stream_ids,
    )
    measurements.to_csv("urban_better_air_beam_measurements.csv", index=False)

    bigquery_data = pd.DataFrame(
        UrbanBetterUtils.process_for_big_query(dataframe=measurements)
    )
    bigquery_data.to_csv("urban_better_air_beam_bigquery_data.csv", index=False)


def urban_better_data_from_bigquery():
    from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

    bigquery_api = BigQueryApi()
    data = bigquery_api.query_data(
        start_date_time="2022-01-01T00:00:00Z",
        end_date_time="2023-01-01T00:00:00Z",
        table=bigquery_api.clean_mobile_raw_measurements_table,
        where_fields={"tenant": str(Tenant.URBAN_BETTER)},
    )

    data.to_csv("urban_better_big_query_data_backup.csv", index=False)

    # data = pd.read_csv("urban_better_big_query_data_backup.csv")

    data = UrbanBetterUtils.add_air_quality(data)
    data.to_csv("urban_better_processed_data.csv", index=False)

    bigquery_data = pd.DataFrame(UrbanBetterUtils.process_for_big_query(dataframe=data))
    bigquery_data.to_csv("urban_better_bigquery_data.csv", index=False)


def urban_better_data_from_air_beam_csv():
    from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

    for x in range(1, 19):
        data = pd.read_csv(f"dataset_{x}.csv")

        measurements = UrbanBetterUtils.format_air_beam_data_from_csv(
            data=data,
        )

        measurements.to_csv(f"urban_better_air_beam_measurements_{x}.csv", index=False)

        bigquery_data = pd.DataFrame(
            UrbanBetterUtils.process_for_big_query(dataframe=measurements)
        )
        bigquery_data.to_csv(
            f"urban_better_air_beam_bigquery_data_{x}.csv", index=False
        )


def airqo_mobile_device_measurements():
    from airqo_etl_utils.airqo_utils import AirQoDataUtils
    from airqo_etl_utils.weather_data_utils import WeatherDataUtils

    input_meta_data = [
        {
            "latitude": 0.2959788757479883,
            "longitude": 32.57946554294726,
            "start_date_time": "2022-07-20T10:00:00Z",
            "end_date_time": "2022-07-20T18:00:00Z",
            "device_number": 1575539,
        },
        {
            "latitude": 0.2959788757479883,
            "longitude": 32.57946554294726,
            "start_date_time": "2022-07-20T10:00:00Z",
            "end_date_time": "2022-07-20T18:00:00Z",
            "device_number": 1606118,
        },
        {
            "latitude": 0.30112943343101545,
            "longitude": 32.587149313048286,
            "start_date_time": "2022-07-21T10:00:00Z",
            "end_date_time": "2022-07-21T18:00:00Z",
            "device_number": 1351544,
        },
        {
            "latitude": 0.30112943343101545,
            "longitude": 32.587149313048286,
            "start_date_time": "2022-07-21T10:00:00Z",
            "end_date_time": "2022-07-21T18:00:00Z",
            "device_number": 1371829,
        },
    ]

    raw_data = AirQoDataUtils.extract_mobile_low_cost_sensors_data(
        meta_data=input_meta_data
    )
    raw_data.to_csv("raw_device_measurements_data.csv", index=False)

    aggregated_mobile_devices_data = AirQoDataUtils.aggregate_low_cost_sensors_data(
        raw_data
    )
    aggregated_mobile_devices_data.to_csv(
        "aggregated_mobile_devices_data.csv", index=False
    )

    weather_stations = WeatherDataUtils.get_weather_stations(meta_data=input_meta_data)
    weather_stations.to_csv("weather_stations.csv", index=False)

    mobile_devices_weather_data = (
        AirQoDataUtils.extract_aggregated_mobile_devices_weather_data(
            data=weather_stations
        )
    )
    mobile_devices_weather_data.to_csv("mobile_devices_weather_data.csv", index=False)

    merged_mobile_devices_data = (
        AirQoDataUtils.merge_aggregated_mobile_devices_data_and_weather_data(
            measurements=aggregated_mobile_devices_data,
            weather_data=mobile_devices_weather_data,
        )
    )
    merged_mobile_devices_data.to_csv("merged_mobile_devices_data.csv", index=False)

    calibrated_mobile_devices_data = CalibrationUtils.calibrate_airqo_data(
        data=merged_mobile_devices_data
    )
    calibrated_mobile_devices_data.to_csv(
        "calibrated_mobile_devices_data.csv", index=False
    )

    bigquery_data = AirQoDataUtils.restructure_airqo_mobile_data_for_bigquery(
        calibrated_mobile_devices_data
    )
    bigquery_api = BigQueryApi()
    bigquery_data = bigquery_api.validate_data(
        dataframe=bigquery_data, table=bigquery_api.airqo_mobile_measurements_table
    )
    bigquery_data.to_csv("bigquery_mobile_devices_data.csv", index=False)


def airqo_historical_csv_bam_data():

    """
    Processes AirQo reference monitors data from a csv file "airqo_historical_bam_data.csv"
    into a format that is required for storage in BigQuery reference monitors data table.

    The resultant file "airqo_bam_bigquery_data.csv" contains data that matches the format required by BigQuery
    reference monitors data table and hence, ready for import.

    The input csv file is assumed to have stored data for the reference monitors
    1192542 and 1192541 as -24517  and -24516 respectively.
    """

    from airqo_etl_utils.airqo_utils import AirQoDataUtils

    devices = AirQoApi().get_devices(tenant=Tenant.AIRQO, category=DeviceCategory.BAM)

    unclean_data = pd.read_csv(
        "airqo_historical_bam_data.csv",
    )

    def update_device_details(device_number):
        device_id = None
        device = []
        if device_number == -24517:
            device_number = 1192542
            device = list(
                filter(lambda x: (x["device_number"] == device_number), devices)
            )

        if device_number == -24516:
            device_number = 1192541
            device = list(
                filter(lambda x: (x["device_number"] == device_number), devices)
            )

        if device:
            device_id = dict(device[0]).get("name", None)

        return pd.Series({"device_number": device_number, "device_id": device_id})

    unclean_data[["device_number", "device_id"]] = unclean_data["device_number"].apply(
        lambda x: update_device_details(x)
    )

    bigquery_data = AirQoDataUtils.format_data_for_bigquery(
        data=unclean_data, data_type=DataType.UNCLEAN_BAM_DATA
    )
    bigquery_data.to_csv("airqo_unclean_bam_bigquery_data.csv", index=False)

    clean_data = AirQoDataUtils.clean_bam_data(data=unclean_data)
    bigquery_data = AirQoDataUtils.format_data_for_bigquery(
        data=clean_data, data_type=DataType.CLEAN_BAM_DATA
    )
    bigquery_data.to_csv("airqo_clean_bam_bigquery_data.csv", index=False)


def airqo_historical_api_bam_data():
    from airqo_etl_utils.airqo_utils import AirQoDataUtils

    start_date_time = "2022-08-01T00:00:00Z"
    end_date_time = "2022-09-01T00:00:00Z"

    unclean_data = AirQoDataUtils.extract_devices_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        device_category=DeviceCategory.BAM,
    )
    unclean_data.to_csv("unclean_airqo_bam_data.csv", index=False)

    clean_bam_data = AirQoDataUtils.clean_bam_data(unclean_data)
    clean_bam_data.to_csv("clean_airqo_bam_data.csv", index=False)

    unclean_data = AirQoDataUtils.format_data_for_bigquery(
        data=unclean_data, data_type=DataType.CLEAN_BAM_DATA
    )
    unclean_data.to_csv("bigquery_unclean_airqo_bam_data.csv", index=False)

    clean_bam_data = AirQoDataUtils.format_data_for_bigquery(
        data=clean_bam_data, data_type=DataType.CLEAN_BAM_DATA
    )
    clean_bam_data.to_csv("bigquery_clean_airqo_bam_data.csv", index=False)


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
            "airqo_realtime_data",
            "airqo_historical_raw_data",
            "airqo_historical_hourly_data",
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
            "urban_better_data_plume_labs",
            "urban_better_data_air_beam",
            "airqo_mobile_device_measurements",
            "airqo_bam_data",
            "nasa_purple_air_data",
            "airqo_historical_bam_data",
            "airqo_historical_api_bam_data",
        ],
    )

    args = parser.parse_args()

    if args.action == "airqo_realtime_data":
        airqo_realtime_data()

    if args.action == "airqo_historical_raw_data":
        airqo_historical_raw_data()

    if args.action == "airqo_historical_hourly_data":
        airqo_historical_hourly_data()

    elif args.action == "weather_data":
        weather_data()

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
        calibrate_historical_data()

    elif args.action == "airnow_bam_data":
        airnow_bam_data()

    elif args.action == "airqo_historical_csv_bam_data":
        airqo_historical_csv_bam_data()

    elif args.action == "airqo_historical_api_bam_data":
        airqo_historical_api_bam_data()

    elif args.action == "airqo_bam_data":
        airqo_bam_data()

    elif args.action == "nasa_purple_air_data":
        nasa_purple_air_data()

    elif args.action == "urban_better_data_plume_labs":
        urban_better_data_from_plume_labs()

    elif args.action == "urban_better_data_biq_query":
        urban_better_data_from_bigquery()

    elif args.action == "urban_better_data_air_beam":
        urban_better_data_from_air_beam_csv()
        urban_better_data_from_air_beam()

    elif args.action == "airqo_mobile_device_measurements":
        airqo_mobile_device_measurements()

    else:
        pass
