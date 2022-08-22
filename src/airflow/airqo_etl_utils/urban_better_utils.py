import datetime

import pandas as pd

from .air_beam_api import AirBeamApi
from .bigquery_api import BigQueryApi
from .config import configuration
from .constants import Tenant, Pollutant
from .data_validator import DataValidationUtils
from .date import str_to_date
from .plume_labs_api import PlumeLabsApi
from .utils import Utils


class UrbanBetterUtils:
    @staticmethod
    def extract_stream_ids_from_air_beam(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:

        start_date_time = str_to_date(start_date_time)
        end_date_time = str_to_date(end_date_time)

        air_beam_api = AirBeamApi()

        usernames = configuration.AIR_BEAM_USERNAMES.split(",")
        stream_ids = []
        for username in usernames:
            for pollutant in ["pm2.5", "pm10", "pm1", "rh", "f"]:

                api_response = air_beam_api.get_stream_ids(
                    start_date_time=start_date_time,
                    end_date_time=end_date_time,
                    username=username,
                    pollutant=pollutant,
                )
                if not api_response:
                    continue

                sessions = dict(api_response).get("sessions", [])
                for session in sessions:
                    streams = dict(session).get("streams", {})
                    for stream in streams.keys():
                        stream_id = dict(streams.get(stream)).get("id", None)
                        device_id = dict(streams.get(stream)).get(
                            "sensor_package_name", None
                        )
                        if stream_id:
                            stream_ids.append(
                                {
                                    "stream_id": stream_id,
                                    "pollutant": pollutant,
                                    "device_id": device_id,
                                }
                            )

        return pd.DataFrame(stream_ids)

    @staticmethod
    def extract_measurements_from_air_beam(
        start_date_time: str, end_date_time: str, stream_ids: pd.DataFrame
    ) -> pd.DataFrame:
        start_date_time = str_to_date(start_date_time)
        end_date_time = str_to_date(end_date_time)
        air_beam_api = AirBeamApi()
        measurements = pd.DataFrame()
        for _, row in stream_ids.iterrows():
            stream_id = row["stream_id"]
            api_response = air_beam_api.get_measurements(
                start_date_time=start_date_time,
                end_date_time=end_date_time,
                stream_id=stream_id,
            )

            if api_response:
                pollutant = row["pollutant"]
                stream_df = pd.DataFrame(api_response)
                stream_df["device_id"] = row["device_id"]

                if pollutant == "pm2.5":
                    stream_df.rename(columns={"value": "pm2_5"}, inplace=True)
                if pollutant == "pm10":
                    stream_df.rename(columns={"value": "pm10"}, inplace=True)
                if pollutant == "pm1":
                    stream_df.rename(columns={"value": "pm1"}, inplace=True)
                if pollutant == "rh":
                    stream_df.rename(columns={"value": "humidity"}, inplace=True)
                if pollutant == "f":
                    stream_df.rename(columns={"value": "temperature"}, inplace=True)

                measurements = measurements.append(stream_df, ignore_index=True)

        pm2_5_data = measurements[
            ["pm2_5", "time", "device_id", "latitude", "longitude"]
        ].dropna(subset=["pm2_5"])
        pm10_data = measurements[
            ["pm10", "time", "device_id", "latitude", "longitude"]
        ].dropna(subset=["pm10"])

        measurements = pd.merge(
            left=pm2_5_data,
            right=pm10_data,
            on=["time", "device_id", "latitude", "longitude"],
            how="outer",
        )

        measurements["tenant"] = str(Tenant.URBAN_BETTER)
        measurements.rename(
            columns={
                "time": "timestamp",
            },
            inplace=True,
        )

        measurements["timestamp"] = pd.to_datetime(measurements["timestamp"], unit="ms")
        if "temperature" in measurements.columns:
            measurements["temperature"] = measurements["temperature"].apply(
                lambda x: ((x - 32) * 5 / 9)
            )

        return measurements

    @staticmethod
    def format_air_beam_data_from_csv(data: pd.DataFrame) -> pd.DataFrame:
        data = data.copy()
        data.rename(
            columns={
                "Timestamp": "timestamp",
                "Session_Name": "device_id",
                "Latitude": "latitude",
                "Longitude": "longitude",
                "AirBeam3-F": "temperature",
                "AirBeam3-PM1": "pm1",
                "AirBeam3-PM10": "pm10",
                "AirBeam3-PM2.5": "pm2_5",
                "AirBeam3-RH": "humidity",
            },
            inplace=True,
        )

        data["temperature"] = data["temperature"].apply(lambda x: ((x - 32) * 5 / 9))
        data["tenant"] = str(Tenant.URBAN_BETTER)

        return UrbanBetterUtils.clean_raw_data(data)

    @staticmethod
    def add_air_quality(data: pd.DataFrame) -> pd.DataFrame:

        if "pm2_5" in list(data.columns):
            data["pm2_5_category"] = data["pm2_5"].apply(
                lambda x: Utils.epa_pollutant_category(
                    pollutant=Pollutant.PM2_5, value=x
                )
            )

        if "pm10" in list(data.columns):
            data["pm10_category"] = data["pm10"].apply(
                lambda x: Utils.epa_pollutant_category(
                    pollutant=Pollutant.PM10, value=x
                )
            )

        if "no2" in list(data.columns):
            data["no2_category"] = data["no2"].apply(
                lambda x: Utils.epa_pollutant_category(pollutant=Pollutant.NO2, value=x)
            )

        return data

    @staticmethod
    def extract_raw_data_from_plume_labs(
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
                "device_number",
                "device_id",
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
                device_number = org_device_data["device_number"]
                device_id = org_device_data["device_id"]
                device_data = pd.json_normalize(org_device_data["device_data"])
                device_data["device_number"] = device_number
                device_data["device_id"] = device_id
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
        return data

    @staticmethod
    def clean_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        cleaned_data = DataValidationUtils.remove_outliers(data)
        return UrbanBetterUtils.add_air_quality(cleaned_data)

    @staticmethod
    def extract_sensor_positions_from_plume_labs(
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
                "date": "gps_device_timestamp",
                "device": "device_number",
            },
            inplace=True,
        )
        data["gps_device_timestamp"] = data["gps_device_timestamp"].apply(
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
        measures["timestamp"] = measures["timestamp"].apply(pd.to_datetime)
        sensor_positions["gps_device_timestamp"] = sensor_positions[
            "gps_device_timestamp"
        ].apply(pd.to_datetime)

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
                    device_timestamp = value["timestamp"]
                    nearest_sensor_position = (
                        UrbanBetterUtils.get_nearest_gps_coordinates(
                            date_time=device_timestamp,
                            sensor_positions=device_positions,
                            timestamp_col="gps_device_timestamp",
                        )
                    )
                    gps_timestamp = nearest_sensor_position.get(
                        "gps_device_timestamp", None
                    )

                    merged_data = {
                        **nearest_sensor_position,
                        **value.to_dict(),
                        **{
                            "timestamp_abs_diff": abs(
                                (gps_timestamp - device_timestamp).total_seconds()
                            ),
                        },
                    }

                    urban_better_data.append(merged_data)

        urban_better_data_df = pd.DataFrame(urban_better_data)
        urban_better_data_df["tenant"] = str(Tenant.URBAN_BETTER)
        return urban_better_data_df

    @staticmethod
    def process_for_big_query(dataframe: pd.DataFrame) -> pd.DataFrame:
        big_query_api = BigQueryApi()

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        if "gps_device_timestamp" in dataframe.columns:
            dataframe["gps_device_timestamp"] = dataframe["gps_device_timestamp"].apply(
                pd.to_datetime
            )
        columns = big_query_api.get_columns(
            big_query_api.clean_mobile_raw_measurements_table
        )

        dataframe = Utils.populate_missing_columns(data=dataframe, cols=columns)

        return dataframe[columns]
