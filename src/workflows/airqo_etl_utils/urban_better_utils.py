import pandas as pd

from .air_quality_utils import AirQualityUtils
from .config import configuration as Config
from .constants import DeviceNetwork
from .date import DateUtils


class UrbanBetterUtils:
    @staticmethod
    def extract_measurements_from_air_beam(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        """Fetch and transform AirBeam mobile session measurements for a date range.

        Internally uses :class:`~airqo_etl_utils.sources.airbeam_adapter.AirBeamAdapter`
        which handles the two-step retrieval (stream IDs → measurements) transparently.
        Usernames are read from ``configuration.AIR_BEAM_USERNAMES``.

        Args:
            start_date_time (str): Start of the date range in ISO 8601 format
                (e.g. ``"2024-11-01T00:00:00Z"``).
            end_date_time (str): End of the date range in ISO 8601 format
                (e.g. ``"2024-11-01T01:00:00Z"``).

        Returns:
            pd.DataFrame: Measurements with columns ``timestamp``, ``device_id``,
            ``latitude``, ``longitude``, ``pm2_5``, ``pm10``, and ``network``
            (set to ``DeviceNetwork.URBANBETTER``). Temperature values are converted
            from Fahrenheit to Celsius when present.
        """
        from airqo_etl_utils.sources import fetch_from_adapter

        start = DateUtils.str_to_date(start_date_time)
        end = DateUtils.str_to_date(end_date_time)

        start_iso = start.strftime("%Y-%m-%dT%H:%M:%SZ")
        end_iso = end.strftime("%Y-%m-%dT%H:%M:%SZ")

        result = fetch_from_adapter(
            DeviceNetwork.AIRBEAM,
            dates=[(start_iso, end_iso)],
            device={"usernames": Config.AIR_BEAM_USERNAMES},
        )
        records = (result.data or {}).get("records", [])
        if not records:
            return pd.DataFrame()

        measurements = pd.DataFrame(records)

        pollutant_rename = {
            "pm2.5": "pm2_5",
            "pm10": "pm10",
            "pm1": "pm1",
            "rh": "humidity",
            "f": "temperature",
        }
        if "pollutant" in measurements.columns and "value" in measurements.columns:
            for pollutant, col_name in pollutant_rename.items():
                mask = measurements["pollutant"] == pollutant
                if mask.any():
                    measurements.loc[mask, col_name] = measurements.loc[mask, "value"]
            measurements.drop(
                columns=["pollutant", "value"], errors="ignore", inplace=True
            )

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
        measurements.rename(columns={"time": "timestamp"}, inplace=True)
        measurements["timestamp"] = pd.to_datetime(measurements["timestamp"], unit="ms")

        if "temperature" in measurements.columns:
            measurements["temperature"] = measurements["temperature"].apply(
                lambda x: ((x - 32) * 5 / 9)
            )

        return measurements

    @staticmethod
    def format_air_beam_data_from_csv(data: pd.DataFrame) -> pd.DataFrame:
        """Convert a raw AirBeam3 CSV export into a standardised DataFrame.

        Args:
            data (pd.DataFrame): Raw CSV data with columns ``Timestamp``,
                ``Session_Name``, ``Latitude``, ``Longitude``, ``AirBeam3-F``,
                ``AirBeam3-PM1``, ``AirBeam3-PM10``, ``AirBeam3-PM2.5``,
                ``AirBeam3-RH``.

        Returns:
            pd.DataFrame: Renamed and converted DataFrame with AQI categories added.
            Temperature is converted from Fahrenheit to Celsius.
        """
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
