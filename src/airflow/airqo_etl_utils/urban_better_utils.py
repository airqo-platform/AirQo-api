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
            "no2",
            "voc",
            "pm2_5",
            "pm10",
            "pm1",
            "timestamp",
            "device",
            "organization",
        ],
    )
    api_data = plume_labs_api.get_data(
        start_date_time=str_to_date(start_date_time),
        end_date_time=str_to_date(end_date_time),
    )
    for organization_api_data in api_data:
        organization = organization_api_data["organization"]
        organisation_data = organization_api_data["data"]
        for org_device_data in organisation_data:
            device = org_device_data["device"]
            device_data = pd.json_normalize(org_device_data["device_data"])

            device_data.rename(
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
            device_data["device"] = device
            device_data["organization"] = organization
            data = data.append(
                device_data[list(data.columns)],
                ignore_index=True,
            )

    data["timestamp"] = data["timestamp"].apply(datetime.datetime.fromtimestamp)
    return data


def parameter_column_name(parameter: str) -> str:
    parameter = parameter.lower()
    if parameter == "pm2.5":
        return "pm2_5"
    elif parameter == "pm10":
        return "pm10"
    elif parameter == "no2":
        return "no2"
    else:
        raise Exception(f"Unknown parameter {parameter}")


def process_airnow_data(data: pd.DataFrame) -> pd.DataFrame:
    device_groups = data.groupby("device_id")
    airnow_data = []
    devices = AirQoApi().get_devices(tenant="airqo")

    for _, device_group in device_groups:

        device = list(
            filter(lambda x: (x["_id"] == device_group.iloc[0]["device_id"]), devices),
        )[0]

        time_groups = device_group.groupby("UTC")

        for _, time_group in time_groups:
            for _, row in time_group.iterrows():
                try:
                    pollutant_value = dict({"pm2_5": None, "pm10": None, "no2": None})

                    parameter_col_name = parameter_column_name(row["Parameter"])

                    pollutant_value[parameter_col_name] = row["Value"]

                    airnow_data.append(
                        {
                            "timestamp": date_to_str(
                                datetime.strptime(row["UTC"], "%Y-%m-%dT%H:%M")
                            ),
                            "tenant": device["tenant"],
                            "site_id": device["site"]["_id"],
                            "device_id": device["_id"],
                            "device_number": device["device_number"],
                            "device": device["name"],
                            "latitude": row["Latitude"],
                            "longitude": row["Longitude"],
                            "pm2_5": pollutant_value["pm2_5"],
                            "s1_pm2_5": pollutant_value["pm2_5"],
                            "s2_pm2_5": None,
                            "pm2_5_raw_value": pollutant_value["pm2_5"],
                            "pm2_5_calibrated_value": pollutant_value["pm2_5"],
                            "pm10": pollutant_value["pm10"],
                            "s1_pm10": pollutant_value["pm10"],
                            "s2_pm10": None,
                            "pm10_raw_value": pollutant_value["pm10"],
                            "pm10_calibrated_value": pollutant_value["pm10"],
                            "no2": pollutant_value["no2"],
                            "no2_raw_value": pollutant_value["no2"],
                            "no2_calibrated_value": pollutant_value["no2"],
                            "pm1": None,
                            "pm1_raw_value": None,
                            "pm1_calibrated_value": None,
                            "external_temperature": None,
                            "external_humidity": None,
                            "wind_speed": None,
                            "altitude": None,
                        }
                    )
                except Exception as ex:
                    print(ex)
                    traceback.print_exc()

    print(f"Airnow data => {len(airnow_data)}")
    return pd.DataFrame(airnow_data)


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
