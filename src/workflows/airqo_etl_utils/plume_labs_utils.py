import datetime

import pandas as pd

from .air_quality_utils import AirQualityUtils
from .constants import DeviceNetwork
from .data_validator import DataValidationUtils
from .date import DateUtils
from .plume_labs_api import PlumeLabsApi


class PlumeLabsUtils:
    @staticmethod
    def extract_sensor_measures(
        start_date_time: str, end_date_time: str, network: DeviceNetwork
    ) -> pd.DataFrame:
        plume_labs_api = PlumeLabsApi()
        data = pd.DataFrame()
        records = plume_labs_api.get_sensor_measures(
            start_date_time=DateUtils.str_to_date(start_date_time),
            end_date_time=DateUtils.str_to_date(end_date_time),
            network=network,
        )

        for record in records:
            device_number = record["device_number"]
            device_id = record["device_id"]
            device_data = pd.json_normalize(record["data"])
            device_data["device_number"] = device_number
            device_data["device_id"] = device_id
            data = data.append(device_data, ignore_index=True)

        data.rename(
            columns={
                "pollutants.no2.value": "no2",
                "pollutants.voc.value": "voc",
                "pollutants.pm25.value": "pm2_5",
                "pollutants.pm10.value": "pm10",
                "pollutants.pm1.value": "pm1",
                "pollutants.no2.pi": "no2_pi",
                "pollutants.voc.pi": "voc_pi",
                "pollutants.pm25.pi": "pm2_5_pi",
                "pollutants.pm10.pi": "pm10_pi",
                "pollutants.pm1.pi": "pm1_pi",
                "date": "timestamp",
            },
            inplace=True,
        )
        data["timestamp"] = data["timestamp"].apply(datetime.datetime.fromtimestamp)
        data.loc[:, "network"] = network.str
        return data[
            [
                "no2",
                "no2_pi",
                "voc",
                "no2_pi",
                "pm2_5",
                "pm2_5_pi",
                "pm10",
                "pm10_pi",
                "pm1",
                "pm1_pi",
                "timestamp",
                "device_number",
                "device_id",
                "network",
            ]
        ]

    @staticmethod
    def extract_sensor_positions(
        start_date_time: str, end_date_time: str, network: DeviceNetwork
    ) -> pd.DataFrame:
        plume_labs_api = PlumeLabsApi()
        data = pd.DataFrame()
        records = plume_labs_api.get_sensor_positions(
            start_date_time=DateUtils.str_to_date(start_date_time),
            end_date_time=DateUtils.str_to_date(end_date_time),
            network=network,
        )

        for record in records:
            device_number = record["device_number"]
            positions = pd.DataFrame(record["positions"])
            positions["device_number"] = device_number
            data = data.append(
                positions,
                ignore_index=True,
            )
        data.rename(
            columns={
                "date": "timestamp",
            },
            inplace=True,
        )
        data["timestamp"] = data["timestamp"].apply(datetime.datetime.fromtimestamp)
        data.loc[:, "network"] = network.str
        return data[
            [
                "horizontal_accuracy",
                "longitude",
                "latitude",
                "timestamp",
                "device_number",
            ]
        ]

    @staticmethod
    def map_gps_coordinates(
        timestamp: datetime.datetime,
        device_positions: pd.DataFrame,
    ) -> pd.Series:
        timestamp = pd.to_datetime(timestamp)
        device_positions.loc[:, "timestamp"] = device_positions["timestamp"].apply(
            pd.to_datetime
        )
        device_positions.index = device_positions["timestamp"]
        device_positions.sort_index(inplace=True)
        index = device_positions.index[
            device_positions.index.get_loc(timestamp, method="nearest")
        ]
        device_positions = device_positions.loc[index].to_dict()
        gps_timestamp = device_positions["timestamp"]
        timestamp_abs_diff = abs((gps_timestamp - timestamp).total_seconds())

        # Temporarily disabled timestamp difference
        # if timestamp_abs_diff > 3600:
        #     return pd.Series(
        #         {
        #             "latitude": None,
        #             "longitude": None,
        #             "horizontal_accuracy": None,
        #             "gps_device_timestamp": None,
        #             "timestamp_abs_diff": None,
        #         }
        #     )

        return pd.Series(
            {
                "latitude": device_positions["latitude"],
                "longitude": device_positions["longitude"],
                "horizontal_accuracy": device_positions["horizontal_accuracy"],
                "gps_device_timestamp": gps_timestamp,
                "timestamp_abs_diff": timestamp_abs_diff,
            }
        )

    @staticmethod
    def merge_sensor_measures_and_positions(
        measures: pd.DataFrame, sensor_positions: pd.DataFrame
    ) -> pd.DataFrame:
        measures.loc[:, "timestamp"] = measures["timestamp"].apply(pd.to_datetime)
        sensor_positions.loc[:, "timestamp"] = sensor_positions["timestamp"].apply(
            pd.to_datetime
        )

        data = pd.DataFrame()

        for _, device_data in measures.groupby("device_number"):
            device_number = device_data.iloc[0]["device_number"]
            device_positions = sensor_positions.loc[
                sensor_positions["device_number"] == device_number
            ]

            if device_positions.empty:
                data = data.append(device_data, ignore_index=True)
                continue

            device_data[
                [
                    "latitude",
                    "longitude",
                    "horizontal_accuracy",
                    "gps_device_timestamp",
                    "timestamp_abs_diff",
                ]
            ] = device_data["timestamp"].apply(
                lambda x: PlumeLabsUtils.map_gps_coordinates(
                    timestamp=x, device_positions=device_positions
                )
            )

            data = pd.concat([data, device_data], ignore_index=True)

        data.loc[:, "network"] = DeviceNetwork.URBAN_BETTER.str
        return data

    @staticmethod
    def clean_data(data: pd.DataFrame, add_air_quality: bool = True) -> pd.DataFrame:
        data = DataValidationUtils.remove_outliers_fix_types(data)
        if add_air_quality:
            data = AirQualityUtils.add_categorisation(data)
        return data
