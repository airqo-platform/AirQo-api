import concurrent.futures
import time
import ast
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

import pandas as pd

from .data_api import DataApi
from .config import configuration as Config
from .constants import DataSource, DataType, Frequency, DeviceCategory
from .datautils import DataUtils
from .openweather_api import OpenWeatherApi
from .utils import Utils


class WeatherDataUtils:
    @staticmethod
    def extract_weather_data(
        data_type: DataType,
        start_date_time: str,
        end_date_time: str,
        frequency: Frequency,
        remove_outliers: Optional[bool] = False,
    ) -> pd.DataFrame:
        """
        Extracts hourly weather data from BigQuery for a specified time range.

        The function queries weather data from BigQuery using the hourly frequency and ensures that the returned DataFrame contains the expected columns based on the schema of the `hourly_weather_table`. If no data is found, an empty DataFrame with the correct schema is returned.

        Args:
            start_date_time(str): The start of the time range in ISO 8601 format.
            end_date_time(str): The end of the time range in ISO 8601 format.

        Returns:
            pd.DataFrame: A pandas DataFrame containing the extracted weather data or an empty DataFrame with the expected schema if no data is found.
        """
        measurements = DataUtils.extract_data_from_bigquery(
            data_type,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=frequency,
            device_category=DeviceCategory.WEATHER,
            remove_outliers=remove_outliers,
        )

        return measurements

    @staticmethod
    def get_nearest_weather_stations(records: pd.DataFrame) -> list:
        """
        Retrieves the nearest weather stations for a given of location(s).

        This function takes a pd.DataFrame of records containing latitude and longitude values, fetches the nearest weather stations for each record using the AirQo API and appends the results to the original records.

        Args:
            records(pd.DataFrame): A pd.DataFrame of sites data where each site has `latitude` and `longitude` keys.

        Returns:
            List[Dict]: A list of updated dictionaries, each containing the original record data along with an additional `weather_stations` key, which holds a list of nearby weather stations.

        """
        data = []
        data_api = DataApi()

        for _, record in records.iterrows():
            weather_stations = data_api.get_nearest_weather_stations(
                latitude=record.get("latitude"),
                longitude=record.get("longitude"),
            )
            if len(weather_stations) > 0:
                data.append(
                    {
                        **record,
                        **{"weather_stations": weather_stations},
                    }
                )

        return data

    @staticmethod
    def get_weather_stations(meta_data: List[Dict]) -> pd.DataFrame:
        """
        Retrieves the nearest weather stations for a list of metadata records and structures the data into a DataFrame.

        This function takes a list of metadata records containing latitude and longitude values,
        fetches the nearest weather stations for each record using the AirQo API, and returns a Pandas DataFrame
        with relevant station information.

        Args:
            meta_data (List[Dict]): A list of dictionaries where each dictionary contains at least the `latitude` and `longitude` keys.

        Returns:
            pd.DataFrame: A DataFrame containing the original metadata along with the nearest weather station information. The resulting DataFrame includes columns such as `station_code` and `distance` to the station.
        """
        data = []
        data_api = DataApi()

        for record in meta_data:
            weather_stations = data_api.get_nearest_weather_stations(
                latitude=record.get("latitude"),
                longitude=record.get("longitude"),
            )
            for station in weather_stations:
                station = dict(station)
                data.append(
                    {
                        **record,
                        **{
                            "station_code": station.get("code"),
                            "distance": station.get("distance"),
                        },
                    }
                )
        return pd.DataFrame(data)

    @staticmethod
    def query_raw_data_from_tahmo(
        start_date_time, end_date_time, station_codes: Optional[List] = None
    ) -> pd.DataFrame:
        """
        Queries raw measurement data from the TAHMO API for a specified time range.

        If a list of station codes is not provided, the function retrieves site data using DataUtils.get_sites()
        and automatically extracts station codes from the 'weather_stations' field in each site record.
        The function then constructs a list of unique station codes and divides the overall time range into segments
        using Utils.query_dates_array. For each time segment, the TAHMO API is queried for measurements related to
        the consolidated station codes. The resulting measurements are aggregated into a single Pandas DataFrame.
        If no measurements are found, an empty DataFrame with columns ["value", "variable", "time", "station"] is returned.

        Args:
            start_date_time(str): The start date and time for querying data.
            end_date_time(str): The end date and time for querying data.
            station_codes(Optional[List[str]]): A list of station codes to query. If None, station codes will be automatically extracted from site data.

        Returns:
            pd.DataFrame: A DataFrame containing the queried measurement data. If no measurements are retrieved, an empty DataFrame with the columns ["value", "variable", "time", "station"] is returned.
        """
        if not station_codes:
            sites = DataUtils.get_sites()
            sites.rename(columns={"id": "site_id"}, inplace=True)
            station_codes = []
            for _, site in sites.iterrows():
                weather_stations = ast.literal_eval(site.get("weather_stations", []))
                station_codes.extend(
                    weather_station.get("code", "")
                    for weather_station in weather_stations
                )

        station_codes = list(set(station_codes))

        measurements: List = []

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.TAHMO,
        )

        for start, end in dates:
            range_measurements = DataUtils.extract_tahmo_data(start, end, station_codes)
            measurements.extend(range_measurements)

        measurements = (
            pd.DataFrame(data=measurements)
            if measurements
            else pd.DataFrame([], columns=["value", "variable", "time", "station"])
        )

        return measurements

    @staticmethod
    def fetch_openweathermap_data_for_sites(sites: pd.DataFrame) -> pd.DataFrame:
        """
        A utility class for fetching weather data from OpenWeatherMap API
        for multiple sites in parallel batches.
        """

        def process_batch(
            batch_of_coordinates: List[Dict[str, Any]]
        ) -> List[Dict[str, Any]]:
            """
            Fetches weather data from OpenWeatherMap API for a given list of sites.

            This function processes site coordinates in batches, makes concurrent API
            requests to OpenWeatherMap, and returns the results as a pandas DataFrame.

            Args:
                sites (pd.DataFrame): A DataFrame containing site information with "latitude"
                                    and "longitude" columns.

            Returns:
                pd.DataFrame: A DataFrame containing weather data for each site, including
                            temperature, humidity, pressure, wind speed, and other parameters.

            Raises:
                ValueError: If the `sites` DataFrame does not contain the required columns.
            """

            with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
                results = executor.map(
                    OpenWeatherApi.get_current_weather_for_each_site,
                    batch_of_coordinates,
                )
            return [
                {
                    "timestamp": datetime.fromtimestamp(
                        result.get("dt", 0), tz=timezone.utc
                    ).strftime("%Y-%m-%d %H:%M:%S"),
                    "latitude": result.get("coord", {}).get("lat", 0),
                    "longitude": result.get("coord", {}).get("lon", 0),
                    "temperature": result.get("main", {}).get("temp", 0),
                    "humidity": result.get("main", {}).get("humidity", 0),
                    "pressure": result.get("main", {}).get("pressure", 0),
                    "wind_speed": result.get("wind", {}).get("speed", 0),
                    "wind_direction": result.get("wind", {}).get("deg", 0),
                    "wind_gust": result.get("wind", {}).get(
                        "gust", 0
                    ),  # Uncomment if needed
                    "weather_description": result.get("weather", [{}])[0].get(
                        "description", ""
                    ),
                    "sea_level": result.get("main", {}).get("sea_level", 0),
                    "ground_level": result.get("main", {}).get("grnd_level", 0),
                    "visibility": result.get("visibility", 0),
                    "cloudiness": result.get("clouds", {}).get("all", 0),
                    "rain": result.get("rain", {}).get("1h", 0),  # Uncomment if needed
                }
                for result in results
                if "main" in result
            ]

        coordinates_tuples = []
        for _, site in sites.iterrows():
            coordinates_tuples.append((site.get("latitude"), site.get("longitude")))

        weather_data = []
        for i in range(
            0, len(coordinates_tuples), int(Config.OPENWEATHER_DATA_BATCH_SIZE)
        ):
            batch = coordinates_tuples[i : i + int(Config.OPENWEATHER_DATA_BATCH_SIZE)]
            weather_data.extend(process_batch(batch))
            if i + int(Config.OPENWEATHER_DATA_BATCH_SIZE) < len(coordinates_tuples):
                time.sleep(60)

        return pd.DataFrame(weather_data)
