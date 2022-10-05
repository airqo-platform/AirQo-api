import traceback

import pandas as pd

from .airnow_api import AirNowApi
from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .constants import Tenant, DataSource, DeviceCategory
from .data_validator import DataValidationUtils
from .date import str_to_date, date_to_str
from .utils import Utils


class AirnowDataUtils:
    @staticmethod
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

    @staticmethod
    def query_bam_data(
        start_date_time: str, end_date_time: str, devices: pd.DataFrame
    ) -> pd.DataFrame:
        airnow_api = AirNowApi()
        start_date_time = date_to_str(
            str_to_date(start_date_time), str_format="%Y-%m-%dT%H:%M"
        )
        end_date_time = date_to_str(
            str_to_date(end_date_time), str_format="%Y-%m-%dT%H:%M"
        )
        countries_metadata = dict(airnow_api.get_countries_metadata())
        data = []

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
                        device_data["device_number"] = device[0]["device_number"]
                        data.append(device_data)

            except Exception as ex:
                traceback.print_exc()
                print(ex)

        return pd.DataFrame(data)

    @staticmethod
    def extract_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.AIRNOW,
        )

        data = pd.DataFrame()
        devices = pd.DataFrame(AirQoApi().get_devices(tenant=Tenant.AIRQO))

        for start, end in dates:
            query_data = AirnowDataUtils.query_bam_data(
                start_date_time=start, end_date_time=end, devices=devices
            )
            data = pd.concat([data, query_data], ignore_index=True)

        return data

    @staticmethod
    def process_bam_data(data: pd.DataFrame) -> pd.DataFrame:

        device_groups = data.groupby("device_number")
        airnow_data = []
        devices = AirQoApi().get_devices(tenant=Tenant.AIRQO)

        for _, device_group in device_groups:

            device = list(
                filter(
                    lambda x: (
                        x["device_number"] == device_group.iloc[0]["device_number"]
                    ),
                    devices,
                ),
            )[0]

            time_groups = device_group.groupby("UTC")

            for _, time_group in time_groups:
                for _, row in time_group.iterrows():
                    try:
                        pollutant_value = dict(
                            {"pm2_5": None, "pm10": None, "no2": None}
                        )

                        parameter_col_name = AirnowDataUtils.parameter_column_name(
                            row["Parameter"]
                        )

                        pollutant_value[parameter_col_name] = row["Value"]

                        airnow_data.append(
                            {
                                "timestamp": row["UTC"],
                                "tenant": str(Tenant.US_EMBASSY),
                                "site_id": device["site"]["_id"],
                                "device_id": device["_id"],
                                "device_number": device["device_number"],
                                "latitude": row["Latitude"],
                                "longitude": row["Longitude"],
                                "pm2_5": pollutant_value["pm2_5"],
                                "pm10": pollutant_value["pm10"],
                                "no2": pollutant_value["no2"],
                            }
                        )
                    except Exception as ex:
                        print(ex)
                        traceback.print_exc()

        airnow_data = pd.DataFrame(airnow_data)
        airnow_data["timestamp"] = airnow_data["timestamp"].apply(pd.to_datetime)
        return DataValidationUtils.remove_outliers(airnow_data)

    @staticmethod
    def process_latest_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        data["s1_pm2_5"] = data["pm2_5"]
        data["pm2_5_raw_value"] = data["pm2_5"]
        data["pm2_5_calibrated_value"] = data["pm2_5"]

        data["s1_pm10"] = data["pm10"]
        data["pm10_raw_value"] = data["pm10"]
        data["pm10_calibrated_value"] = data["pm10"]

        data["no2_raw_value"] = data["no2"]
        data["no2_calibrated_value"] = data["no2"]

        data.loc[:, "tenant"] = str(Tenant.US_EMBASSY)
        data.loc[:, "device_category"] = str(DeviceCategory.BAM)

        return data
