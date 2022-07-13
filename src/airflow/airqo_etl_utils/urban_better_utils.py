import traceback
import datetime

import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.date import date_to_str, str_to_date
from airqo_etl_utils.message_broker import KafkaBrokerClient
from airqo_etl_utils.plume_labs_api import PlumeLabsApi


def extract_urban_better_data_from_api(
    start_date_time: str, end_date_time: str
) -> pd.DataFrame:
    plume_labs_api = PlumeLabsApi()
    data = pd.DataFrame(
        [],
        columns=[
            "pollutants.no2.value",
            "pollutants.voc.value",
            "pollutants.pm25.value",
            "pollutants.pm10.value",
            "pollutants.pm1.value",
            "date",
            "device",
            "organization",
        ],
    )
    api_data = plume_labs_api.get_sensor_measures(
        start_date_time=str_to_date(start_date_time),
        end_date_time=str_to_date(end_date_time),
    )
    for organization_api_data in api_data:
        organization = organization_api_data["organization"]
        organisation_data = organization_api_data["measures"]
        for org_device_data in organisation_data:
            device = org_device_data["device"]
            device_data = pd.json_normalize(org_device_data["device_data"])
            device_data["device"] = device
            device_data["organization"] = organization
            data = data.append(
                device_data[list(data.columns)],
                ignore_index=True,
            )

    data.rename(
        columns={
            "pollutants.no2.value": "no2",
            "pollutants.voc.value": "voc",
            "pollutants.pm25.value": "pm2_5",
            "pollutants.pm10.value": "pm10",
            "pollutants.pm1.value": "pm1",
            "date": "timestamp",
        },
        inplace=True,
    )
    data["timestamp"] = data["timestamp"].apply(datetime.datetime.fromtimestamp)
    return data


def extract_urban_better_sensor_positions_from_api(
    start_date_time: str, end_date_time: str
) -> pd.DataFrame:
    plume_labs_api = PlumeLabsApi()
    data = pd.DataFrame(
        [],
        columns=[
            "horizontal_accuracy",
            "longitude",
            "latitude",
            "date",
            "device",
            "organization",
        ],
    )
    api_data = plume_labs_api.get_sensor_positions(
        start_date_time=str_to_date(start_date_time),
        end_date_time=str_to_date(end_date_time),
    )
    for organization_api_data in api_data:
        organization = organization_api_data["organization"]
        positions = organization_api_data["positions"]
        for device_data in positions:
            device = device_data["device"]
            device_positions = pd.DataFrame(device_data["device_positions"])
            device_positions["device"] = device
            device_positions["organization"] = organization
            data = data.append(
                device_positions,
                ignore_index=True,
            )
    data.rename(
        columns={
            "date": "timestamp",
        },
        inplace=True,
    )
    data["timestamp"] = data["timestamp"].apply(datetime.datetime.fromtimestamp)
    return data


def get_nearest_gps_coordinates(
    date_time: datetime.datetime, sensor_positions: pd.DataFrame
) -> dict:
    date_time = pd.to_datetime(date_time)
    sensor_positions["timestamp"] = sensor_positions["timestamp"].apply(pd.to_datetime)
    sensor_positions.index = sensor_positions["timestamp"]
    sensor_positions.sort_index(inplace=True)
    index = sensor_positions.index[
        sensor_positions.index.get_loc(date_time, method="nearest")
    ]
    return sensor_positions.loc[index].to_dict()


def merge_urban_better_data(
    measures: pd.DataFrame, sensor_positions: pd.DataFrame
) -> pd.DataFrame:
    organization_groups = measures.groupby("organization")
    urban_better_data = []

    for _, organization_group in organization_groups:
        organization = organization_group.iloc[0]["organization"]
        organization_devices_group = organization_group.groupby("device")

        for _, organization_device_group in organization_devices_group:
            device = organization_group.iloc[0]["device"]
            device_positions = sensor_positions.loc[
                (sensor_positions["organization"] == organization)
                & (sensor_positions["device"] == device)
            ]

            for _, value in organization_device_group.iterrows():
                timestamp = value["timestamp"]
                nearest_timestamp = get_nearest_gps_coordinates(
                    date_time=timestamp, sensor_positions=device_positions
                )
                merged_data = {
                    **value.to_dict(),
                    **nearest_timestamp,
                    "device_timestamp": timestamp,
                }
                urban_better_data.append(merged_data)

    urban_better_data_df = pd.DataFrame(urban_better_data)
    urban_better_data_df.rename(
        columns={
            "timestamp": "phone_timestamp",
            "longitude": "phone_longitude",
            "latitude": "phone_latitude",
            "horizontal_accuracy": "phone_horizontal_accuracy",
        },
        inplace=True,
    )
    return urban_better_data_df


def process_for_message_broker(bam_data_dataframe: pd.DataFrame) -> list:
    kafka = KafkaBrokerClient()
    bam_data_dataframe = bam_data_dataframe[
        kafka.get_topic_schema(kafka.bam_measurements_topic)
    ]

    return [row.to_dict() for _, row in bam_data_dataframe.iterrows()]


def process_for_big_query(bam_data_dataframe: pd.DataFrame) -> pd.DataFrame:
    big_query_api = BigQueryApi()
    bam_data_dataframe["timestamp"] = bam_data_dataframe["timestamp"].apply(str_to_date)
    bam_data_dataframe["time"] = bam_data_dataframe["timestamp"]
    return bam_data_dataframe[
        big_query_api.get_columns(big_query_api.hourly_measurements_table)
    ]
