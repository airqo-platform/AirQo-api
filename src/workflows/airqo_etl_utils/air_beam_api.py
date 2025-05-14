from datetime import datetime
import json

import pandas as pd

from .data_api import DataApi
from .constants import DeviceNetwork


class AirBeamApi:
    def get_stream_ids(
        self,
        start_date_time: datetime,
        end_date_time: datetime,
        username: str,
        pollutant: str,
    ):
        """
        Retrieves stream IDs for AirBeam mobile sessions within a specified date range and for a given user and pollutant.

        Args:
            start_date_time(datetime): Start of the time range for session search.
            end_date_time(datetime): End of the time range for session search.
            username(str): Username associated with the sensor sessions.
            pollutant(str): Pollutant name (e.g., 'pm1', 'pm2.5', 'pm10') to filter sensor data.

        Returns:
            Any: The response from the Data API, typically a JSON object containing session stream IDs.
        """
        params = {
            "q": json.dumps(
                {
                    "time_from": int(start_date_time.timestamp()),
                    "time_to": int(end_date_time.timestamp()),
                    "tags": "",
                    "usernames": username,
                    "west": 10.581214853439886,
                    "east": 38.08577769782265,
                    "south": -36.799337832603314,
                    "north": -19.260169583742446,
                    "limit": 100,
                    "offset": 0,
                    "sensor_name": f"airbeam3-{pollutant}",
                    "measurement_type": "Particulate Matter",
                    "unit_symbol": "µg/m³",
                }
            )
        }
        data_api = DataApi()
        return data_api.__request(
            endpoint=f"mobile/sessions.json",
            params=params,
            network=DeviceNetwork.AIRBEAM,
        )

    def get_measurements(
        self,
        start_date_time: datetime,
        end_date_time: datetime,
        stream_id: int,
    ) -> pd.DataFrame:
        """
        Retrieve measurement data for a specific stream within a given time range.

        This method calls an external data API to fetch sensor measurements corresponding
        to the provided stream ID, between the specified start and end timestamps.

        Args:
            start_date_time(datetime): The beginning of the time range to query.
            end_date_time(datetime): The end of the time range to query.
            stream_id(int): The unique identifier of the data stream to fetch measurements for.

        Returns:
            pd.DataFrame: A DataFrame containing the measurement data returned by the API.
        """
        params = {
            "start_time": int(start_date_time.timestamp())
            * 1000,  # Convert to milli seconds
            "end_time": int(end_date_time.timestamp())
            * 1000,  # Convert to milli seconds
            "stream_ids": stream_id,
        }
        data_api = DataApi()
        return data_api.__request(
            endpoint=f"measurements.json", params=params, network=DeviceNetwork.AIRBEAM
        )
