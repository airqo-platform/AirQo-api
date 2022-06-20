import traceback
from datetime import datetime

import pandas as pd

from airqo_etl_utils.airnow_api import AirNowApi
from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.date import date_to_str


def extract_airnow_data_from_api(
    start_date_time: str, end_date_time: str
) -> pd.DataFrame:
    airnow_api = AirNowApi()

    countries_metadata = dict(airnow_api.get_countries_metadata())
    devices = pd.DataFrame(AirQoApi().get_devices(tenant="airqo"))
    devices.dropna(subset=["latitude", "longitude"], inplace=True)
    airnow_data = []

    for country in countries_metadata.keys():

        try:

            country_boundary = countries_metadata[country]["country_boundaries"]

            devices_data = airnow_api.get_data(
                start_date_time=start_date_time,
                boundary_box=country_boundary,
                end_date_time=end_date_time,
            )

            if not devices_data:
                print(
                    f"No measurements for {country} : startDateTime {start_date_time} : endDateTime : {end_date_time}"
                )
                continue

            for device_data in devices_data:
                device = list(
                    filter(
                        lambda x: (
                            x["longitude"] == device_data["Longitude"]
                            and x["latitude"] == device_data["Latitude"]
                        ),
                        devices.to_dict("records"),
                    ),
                )
                if len(device) > 0:
                    device_data["device_id"] = device[0]["_id"]
                    airnow_data.append(device_data)

        except Exception as ex:
            traceback.print_exc()
            print(ex)

    dataframe = pd.DataFrame(airnow_data)
    dataframe.drop_duplicates(keep="first", inplace=True)
    return dataframe


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
