from datetime import timedelta

import numpy as np
import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .commons import get_frequency, remove_invalid_dates
from .utils import Utils
from .data_validator import DataValidationUtils

from .date import date_to_str
from .tahmo_api import TahmoApi


class WeatherDataUtils:
    @staticmethod
    def get_nearest_tahmo_stations(coordinates_list: list) -> pd.DataFrame:
        stations = []
        tahmo_api = TahmoApi()
        all_stations = tahmo_api.get_stations()
        for coordinates in coordinates_list:
            latitude = coordinates.get("latitude")
            longitude = coordinates.get("longitude")
            closest_station = tahmo_api.get_closest_station(
                latitude=latitude, longitude=longitude, all_stations=all_stations
            )
            stations.append(
                {
                    "station_code": closest_station.get("code"),
                    "latitude": latitude,
                    "longitude": longitude,
                }
            )
        return pd.DataFrame(stations)

    @staticmethod
    def extract_raw_data_from_bigquery(start_date_time, end_date_time) -> pd.DataFrame:

        bigquery_api = BigQueryApi()
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=bigquery_api.raw_weather_table,
        )

        return measurements

    @staticmethod
    def query_raw_data_from_tahmo(
        start_date_time, end_date_time, station_codes: list = None
    ) -> pd.DataFrame:
        airqo_api = AirQoApi()
        sites = airqo_api.get_sites()
        station_codes = station_codes if station_codes else []
        for site in sites:
            weather_stations = dict(site).get("weather_stations", [])
            station_codes.extend(x["code"] for x in weather_stations)

        station_codes = list(set(station_codes))

        measurements = []
        tahmo_api = TahmoApi()

        frequency = get_frequency(start_time=start_date_time, end_time=end_date_time)
        dates = pd.date_range(start_date_time, end_date_time, freq=frequency)
        last_date_time = dates.values[len(dates.values) - 1]

        for date in dates:

            start = date_to_str(date)
            end = date + timedelta(hours=dates.freq.n)

            if np.datetime64(end) > last_date_time:
                timestring = pd.to_datetime(str(last_date_time))
                end = date_to_str(timestring)
            else:
                end = date_to_str(end)

            if start == end:
                end = date_to_str(date, str_format="%Y-%m-%dT%H:59:59Z")

            range_measurements = tahmo_api.get_measurements(start, end, station_codes)
            measurements.extend(range_measurements)

        measurements = (
            pd.DataFrame(data=measurements)
            if measurements
            else pd.DataFrame([], columns=["value", "variable", "time", "station"])
        )

        return remove_invalid_dates(
            dataframe=measurements,
            start_time=start_date_time,
            end_time=end_date_time,
        )

    @staticmethod
    def extract_hourly_data(start_date_time, end_date_time) -> pd.DataFrame:
        raw_data = WeatherDataUtils.query_raw_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )
        cleaned_data = WeatherDataUtils.transform_raw_data(raw_data)
        return WeatherDataUtils.aggregate_data(cleaned_data)

    @staticmethod
    def transform_raw_data(data: pd.DataFrame) -> pd.DataFrame:

        data["value"] = pd.to_numeric(data["value"], errors="coerce", downcast="float")
        data["time"] = pd.to_datetime(data["time"], errors="coerce")
        parameter_mappings = {
            "te": "temperature",
            "rh": "humidity",
            "ws": "wind_speed",
            "ap": "atmospheric_pressure",
            "ra": "radiation",
            "vp": "vapor_pressure",
            "wg": "wind_gusts",
            "pr": "precipitation",
            "wd": "wind_direction",
        }
        weather_data = []
        station_groups = data.groupby("station")
        for _, station_group in station_groups:
            station = station_group.iloc[0]["station"]
            time_groups = station_group.groupby("time")

            for _, time_group in time_groups:
                timestamp = time_group.iloc[0]["time"]
                timestamp_data = {"timestamp": timestamp, "station_code": station}

                for _, row in time_group.iterrows():
                    if row["variable"] in parameter_mappings.keys():
                        parameter = parameter_mappings[row["variable"]]
                        value = row["value"]
                        if parameter == "humidity":
                            value = value * 100

                        timestamp_data[parameter] = value

                weather_data.append(timestamp_data)

        weather_data = pd.DataFrame(weather_data)

        cols = [value for value in parameter_mappings.values()]

        weather_data = Utils.populate_missing_columns(data=weather_data, cols=cols)

        return DataValidationUtils.get_valid_values(weather_data)

    @staticmethod
    def aggregate_data(data: pd.DataFrame) -> pd.DataFrame:

        data = data.dropna(subset=["timestamp"])
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        aggregated_data = pd.DataFrame()

        station_groups = data.groupby("station_code")

        for _, station_group in station_groups:
            station_group.index = station_group["timestamp"]
            station_group = station_group.sort_index(axis=0)

            averaging_data = station_group.copy()
            del averaging_data["precipitation"]
            averages = pd.DataFrame(averaging_data.resample("H").mean())
            averages["timestamp"] = averages.index
            averages.reset_index(drop=True, inplace=True)

            summing_data = station_group.copy()[["timestamp", "precipitation"]]
            sums = pd.DataFrame(summing_data.resample("H").sum())
            sums["timestamp"] = sums.index
            sums.reset_index(drop=True, inplace=True)

            merged_data = pd.merge(left=averages, right=sums, on="timestamp")
            merged_data["station_code"] = station_group.iloc[0]["station_code"]

            aggregated_data = aggregated_data.append(merged_data, ignore_index=True)

        return aggregated_data

    @staticmethod
    def transform_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        bigquery = BigQueryApi()
        cols = bigquery.get_columns(table=bigquery.hourly_weather_table)

        return Utils.populate_missing_columns(data=data, cols=cols)
