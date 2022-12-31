import traceback

import pandas as pd

from .airnow_api import AirNowApi
from .airqo_api import AirQoApi
from .constants import Tenant, DataSource, DeviceCategory, Frequency
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
    def query_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
        airnow_api = AirNowApi()
        start_date_time = date_to_str(
            str_to_date(start_date_time), str_format="%Y-%m-%dT%H:%M"
        )
        end_date_time = date_to_str(
            str_to_date(end_date_time), str_format="%Y-%m-%dT%H:%M"
        )

        data = airnow_api.get_data(
            start_date_time=start_date_time,
            boundary_box="-16.9530804676,-33.957634112,54.8058474018,37.2697926495",
            end_date_time=end_date_time,
        )

        return pd.DataFrame(data)

    @staticmethod
    def extract_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.AIRNOW,
        )

        data = pd.DataFrame()

        for start, end in dates:
            query_data = AirnowDataUtils.query_bam_data(
                start_date_time=start, end_date_time=end
            )
            data = pd.concat([data, query_data], ignore_index=True)

        return data

    @staticmethod
    def process_bam_data(data: pd.DataFrame) -> pd.DataFrame:

        air_now_data = []

        devices = AirQoApi().get_tenant_devices(tenant=Tenant.US_EMBASSY)
        for _, row in data.iterrows():
            try:
                device_id = row["FullAQSCode"]
                device_details = list(
                    filter(lambda y: str(device_id) in y["device_codes"], devices)
                )[0]

                pollutant_value = dict({"pm2_5": None, "pm10": None, "no2": None})

                parameter_col_name = AirnowDataUtils.parameter_column_name(
                    row["Parameter"]
                )

                pollutant_value[parameter_col_name] = row["Value"]
                air_now_data.append(
                    {
                        "timestamp": row["UTC"],
                        "tenant": str(Tenant.US_EMBASSY),
                        "site_id": device_details.get("site_id"),
                        "device_id": device_details.get("device_id"),
                        "mongo_id": device_details.get("mongo_id"),
                        "device_number": device_details.get("device_number"),
                        "frequency": str(Frequency.HOURLY),
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

        air_now_data = pd.DataFrame(air_now_data)
        return DataValidationUtils.remove_outliers(air_now_data)

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
