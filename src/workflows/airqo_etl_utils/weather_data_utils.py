import concurrent.futures
import time
from datetime import datetime, timezone

import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .config import configuration
from .constants import DataSource, DataType, Frequency, DeviceCategory
from .data_validator import DataValidationUtils
from .datautils import DataUtils
from .openweather_api import OpenWeatherApi
from .tahmo_api import TahmoApi
from .utils import Utils
import numpy as np


class WeatherDataUtils:
    @staticmethod
    def extract_weather_data(
        data_type: DataType,
        start_date_time: str,
        end_date_time: str,
        frequency: Frequency,
        remove_outliers: bool = False,
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

        bigquery_api = BigQueryApi()

        expected_columns = bigquery_api.get_columns(
            table=bigquery_api.hourly_weather_table
        )
        return (
            pd.DataFrame(columns=expected_columns)
            if measurements.empty
            else measurements
        )

    @staticmethod
    def get_nearest_weather_stations(records: list) -> list:
        data = []
        airqo_api = AirQoApi()

        for record in records:
            weather_stations = airqo_api.get_nearest_weather_stations(
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
    def get_weather_stations(meta_data: list) -> pd.DataFrame:
        data = []
        airqo_api = AirQoApi()

        for record in meta_data:
            weather_stations = airqo_api.get_nearest_weather_stations(
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
        start_date_time, end_date_time, station_codes: list = None
    ) -> pd.DataFrame:
        airqo_api = AirQoApi()
        if not station_codes:
            sites = airqo_api.get_sites()
            station_codes = []
            for site in sites:
                weather_stations = dict(site).get("weather_stations", [])
                station_codes.extend(x.get("code", "") for x in weather_stations)

        station_codes = list(set(station_codes))

        measurements = []
        tahmo_api = TahmoApi()

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.TAHMO,
        )

        for start, end in dates:
            range_measurements = tahmo_api.get_measurements(start, end, station_codes)
            measurements.extend(range_measurements)

        measurements = (
            pd.DataFrame(data=measurements)
            if measurements
            else pd.DataFrame([], columns=["value", "variable", "time", "station"])
        )

        return measurements

    @staticmethod
    def fetch_openweathermap_data_for_sites(sites):
        def process_batch(batch_of_coordinates):
            with concurrent.futures.ThreadPoolExecutor() as executor:
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
        for site in sites:
            coordinates_tuples.append((site.get("latitude"), site.get("longitude")))

        weather_data = []
        for i in range(
            0, len(coordinates_tuples), int(configuration.OPENWEATHER_DATA_BATCH_SIZE)
        ):
            batch = coordinates_tuples[
                i : i + int(configuration.OPENWEATHER_DATA_BATCH_SIZE)
            ]
            weather_data.extend(process_batch(batch))
            if i + int(configuration.OPENWEATHER_DATA_BATCH_SIZE) < len(
                coordinates_tuples
            ):
                time.sleep(60)

        return pd.DataFrame(weather_data)
