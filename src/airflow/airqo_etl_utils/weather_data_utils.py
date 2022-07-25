from datetime import timedelta

import numpy as np
import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.commons import (
    get_frequency,
    remove_invalid_dates,
    add_missing_columns,
)
from airqo_etl_utils.data_validator import DataValidationUtils
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.tahmo_api import TahmoApi


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
        if station_codes is None:
            station_codes = []
            for site in sites:
                try:
                    if "nearest_tahmo_station" in dict(site).keys():
                        station_codes.append(site["nearest_tahmo_station"]["code"])
                except Exception as ex:
                    print(ex)

        measurements = []
        tahmo_api = TahmoApi()

        frequency = get_frequency(start_time=start_date_time, end_time=end_date_time)
        dates = pd.date_range(start_date_time, end_date_time, freq=frequency)
        last_date_time = dates.values[len(dates.values) - 1]

        for date in dates:

            start = date_to_str(date)
            new_end_date_time = date + timedelta(hours=dates.freq.n)

            if np.datetime64(new_end_date_time) > last_date_time:
                end = end_date_time
            else:
                end = date_to_str(new_end_date_time)

            range_measurements = tahmo_api.get_measurements(start, end, station_codes)
            measurements.extend(range_measurements)

        measurements_df = pd.DataFrame(data=measurements)

        if measurements_df.empty:
            return pd.DataFrame([], columns=["value", "variable", "time", "station"])

        return remove_invalid_dates(
            dataframe=measurements_df,
            start_time=start_date_time,
            end_time=end_date_time,
        )

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

        weather_data = add_missing_columns(data=weather_data, cols=cols)

        return DataValidationUtils.get_validate_values(weather_data)

    @staticmethod
    def aggregate_data(data: pd.DataFrame) -> pd.DataFrame:

        data = data.dropna(subset=["timestamp"])
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)

        station_groups = data.groupby("station_code")
        averaged_measurements = pd.DataFrame()

        for _, station_group in station_groups:
            station_code = station_group.iloc[0]["station_code"]
            data = station_group.sort_index(axis=0)
            averages = pd.DataFrame(data.resample("1H", on="timestamp").mean())
            averages["timestamp"] = averages.index
            averages["station_code"] = station_code
            averaged_measurements = averaged_measurements.append(
                averages, ignore_index=True
            )

        return averaged_measurements

    @staticmethod
    def __add_site_information(data: pd.DataFrame) -> pd.DataFrame:
        airqo_api = AirQoApi()
        sites_weather_data = pd.DataFrame()

        sites = airqo_api.get_sites()
        for site in sites:
            try:
                site_weather_data = data.loc[
                    data["station_code"] == site["nearest_tahmo_station"]["code"]
                ]
                site_weather_data["site_id"] = site["_id"]
                site_weather_data["tenant"] = site["tenant"]
                sites_weather_data = sites_weather_data.append(
                    site_weather_data, ignore_index=True
                )
            except KeyError:
                continue

        return sites_weather_data

    @staticmethod
    def transform_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        bigquery = BigQueryApi()
        cols = bigquery.get_columns(table=bigquery.hourly_weather_table)

        return add_missing_columns(data=data, cols=cols)
