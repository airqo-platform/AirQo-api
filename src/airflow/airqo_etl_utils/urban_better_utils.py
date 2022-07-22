import datetime

import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.date import str_to_date
from airqo_etl_utils.plume_labs_api import PlumeLabsApi


class UrbanBetterUtils:
    @staticmethod
    def extract_urban_better_data_from_plume_labs_api(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        plume_labs_api = PlumeLabsApi()
        data = pd.DataFrame(
            [],
            columns=[
                "pollutants.no2.value",
                "pollutants.no2.pi",
                "pollutants.voc.value",
                "pollutants.voc.pi",
                "pollutants.pm25.value",
                "pollutants.pm25.pi",
                "pollutants.pm10.value",
                "pollutants.pm10.pi",
                "pollutants.pm1.value",
                "pollutants.pm1.pi",
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
                "pollutants.no2.value": "no2_raw_value",
                "pollutants.voc.value": "voc_raw_value",
                "pollutants.pm25.value": "pm2_5_raw_value",
                "pollutants.pm10.value": "pm10_raw_value",
                "pollutants.pm1.value": "pm1_raw_value",
                "pollutants.no2.pi": "no2_pi_value",
                "pollutants.voc.pi": "voc_pi_value",
                "pollutants.pm25.pi": "pm2_5_pi_value",
                "pollutants.pm10.pi": "pm10_pi_value",
                "pollutants.pm1.pi": "pm1_pi_value",
                "date": "device_timestamp",
                "device": "device_number",
            },
            inplace=True,
        )
        data["device_timestamp"] = data["device_timestamp"].apply(
            datetime.datetime.fromtimestamp
        )
        return data

    @staticmethod
    def extract_urban_better_sensor_positions_from_plume_labs_api(
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
                "date": "gps_timestamp",
                "device": "device_number",
            },
            inplace=True,
        )
        data["gps_timestamp"] = data["gps_timestamp"].apply(
            datetime.datetime.fromtimestamp
        )
        return data

    @staticmethod
    def get_nearest_gps_coordinates(
        date_time: datetime.datetime,
        sensor_positions: pd.DataFrame,
        timestamp_col="timestamp",
    ) -> dict:
        date_time = pd.to_datetime(date_time)
        sensor_positions[timestamp_col] = sensor_positions[timestamp_col].apply(
            pd.to_datetime
        )
        sensor_positions.index = sensor_positions[timestamp_col]
        sensor_positions.sort_index(inplace=True)
        index = sensor_positions.index[
            sensor_positions.index.get_loc(date_time, method="nearest")
        ]
        return sensor_positions.loc[index].to_dict()

    @staticmethod
    def merge_measures_and_sensor_positions(
        measures: pd.DataFrame, sensor_positions: pd.DataFrame
    ) -> pd.DataFrame:
        measures["device_timestamp"] = measures["device_timestamp"].apply(
            pd.to_datetime
        )
        sensor_positions["gps_timestamp"] = sensor_positions["gps_timestamp"].apply(
            pd.to_datetime
        )

        organization_groups = measures.groupby("organization")
        urban_better_data = []

        for _, organization_group in organization_groups:
            organization = organization_group.iloc[0]["organization"]
            organization_devices_group = organization_group.groupby("device_number")

            for _, organization_device_group in organization_devices_group:
                device_number = organization_group.iloc[0]["device_number"]
                device_positions = sensor_positions.loc[
                    (sensor_positions["organization"] == organization)
                    & (sensor_positions["device_number"] == device_number)
                ]

                for _, value in organization_device_group.iterrows():
                    device_timestamp = value["device_timestamp"]
                    nearest_sensor_position = (
                        UrbanBetterUtils.get_nearest_gps_coordinates(
                            date_time=device_timestamp,
                            sensor_positions=device_positions,
                            timestamp_col="gps_timestamp",
                        )
                    )
                    gps_timestamp = nearest_sensor_position.get("gps_timestamp", None)

                    merged_data = {
                        **value.to_dict(),
                        **nearest_sensor_position,
                        **{
                            "timestamp_abs_diff": abs(
                                (gps_timestamp - device_timestamp).total_seconds()
                            ),
                        },
                    }

                    urban_better_data.append(merged_data)

        urban_better_data_df = pd.DataFrame(urban_better_data)
        urban_better_data_df["tenant"] = "urbanbetter"
        return urban_better_data_df

    @staticmethod
    def process_for_big_query(dataframe: pd.DataFrame) -> pd.DataFrame:
        big_query_api = BigQueryApi()
        if "device_timestamp" in dataframe.columns:
            dataframe.rename(
                columns={
                    "device_timestamp": "timestamp",
                },
                inplace=True,
            )
            dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)

        if "gps_timestamp" in dataframe.columns:
            dataframe.rename(
                columns={
                    "gps_timestamp": "gps_device_timestamp",
                },
                inplace=True,
            )
            dataframe["gps_device_timestamp"] = dataframe["gps_device_timestamp"].apply(
                pd.to_datetime
            )

        return dataframe[
            big_query_api.get_columns(big_query_api.raw_mobile_measurements_table)
        ]
