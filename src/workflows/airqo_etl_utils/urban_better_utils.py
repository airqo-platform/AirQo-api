import pandas as pd

from .air_beam_api import AirBeamApi
from .air_quality_utils import AirQualityUtils
from .config import configuration as Config
from .constants import DeviceNetwork

from .date import DateUtils


class UrbanBetterUtils:
    @staticmethod
    def extract_stream_ids_from_air_beam(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        start_date_time = DateUtils.str_to_date(start_date_time)
        end_date_time = DateUtils.str_to_date(end_date_time)

        air_beam_api = AirBeamApi()

        usernames = Config.AIR_BEAM_USERNAMES.split(",")
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
        start_date_time = DateUtils.str_to_date(start_date_time)
        end_date_time = DateUtils.str_to_date(end_date_time)
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

        measurements["network"] = DeviceNetwork.URBANBETTER.str
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
        data["network"] = DeviceNetwork.URBANBETTER.str

        return AirQualityUtils.add_categorisation(data)
