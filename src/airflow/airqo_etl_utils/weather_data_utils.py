import traceback
from datetime import timedelta
from functools import reduce

import numpy as np
import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.commons import get_frequency, remove_invalid_dates, resample_data
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.tahmo import TahmoApi


def transform_weather_data_for_bigquery(data: list) -> list:
    data_df = pd.DataFrame(data)
    data_df.rename(columns={"time": "timestamp"}, inplace=True)
    return data_df.to_dict(orient="records")


def resample_weather_data(data: list, frequency: str = None):
    weather_raw_data = pd.DataFrame(data)
    if weather_raw_data.empty:
        return weather_raw_data.to_dict(orient="records")

    columns = ["value", "variable", "time", "station_code"]
    weather_raw_data = weather_raw_data[columns]
    weather_raw_data["value"] = pd.to_numeric(
        weather_raw_data["value"], errors="coerce", downcast="float"
    )
    data_station_gps = weather_raw_data.groupby("station_code")
    weather_data = []

    for _, station_group in data_station_gps:

        station = station_group.iloc[0]["station_code"]

        def unit_dataframe(station_data: pd.DataFrame, unit: str) -> pd.DataFrame:
            unit_mappings = {
                "temperature": "te",
                "humidity": "rh",
                "wind_speed": "ws",
                "atmospheric_pressure": "ap",
                "radiation": "ra",
                "vapor_pressure": "vp",
                "wind_gusts": "wg",
                "precipitation": "pr",
                "wind_direction": "wd",
            }
            unit_df = station_data.loc[
                station_data["variable"] == unit_mappings[unit], ["value", "time"]
            ]
            if unit_df.empty:
                unit_df.columns = [unit, "time"]
                return unit_df

            df = resample_data(unit_df, frequency) if frequency else unit_df
            df.columns = [unit, "time"]
            return df

        try:
            # resampling station values
            temperature = unit_dataframe(station_data=station_group, unit="temperature")
            humidity = unit_dataframe(station_data=station_group, unit="humidity")
            wind_speed = unit_dataframe(station_data=station_group, unit="wind_speed")
            atmospheric_pressure = unit_dataframe(
                station_data=station_group, unit="atmospheric_pressure"
            )
            radiation = unit_dataframe(station_data=station_group, unit="radiation")
            vapor_pressure = unit_dataframe(
                station_data=station_group, unit="vapor_pressure"
            )
            wind_gusts = unit_dataframe(station_data=station_group, unit="wind_gusts")
            precipitation = unit_dataframe(
                station_data=station_group, unit="precipitation"
            )
            wind_direction = unit_dataframe(
                station_data=station_group, unit="wind_direction"
            )

            data_frames = [
                temperature,
                humidity,
                wind_speed,
                atmospheric_pressure,
                radiation,
                vapor_pressure,
                wind_gusts,
                precipitation,
                wind_direction,
            ]

            station_df = reduce(
                lambda left, right: pd.merge(left, right, on=["time"], how="outer"),
                data_frames,
            )

            station_df["station_code"] = station
            station_df["humidity"] = station_df["humidity"].apply(lambda x: x * 100)

            weather_data.extend(station_df.to_dict(orient="records"))

        except Exception as ex:
            print(ex)
            traceback.print_exc()
            continue

    return weather_data


def add_site_info_to_weather_data(data: list) -> list:
    weather_data = pd.DataFrame(data)
    if weather_data.empty:
        return weather_data.to_dict(orient="records")
    airqo_api = AirQoApi()
    sites_weather_data = []

    def add_site_tenant_info(tenant_sites: list, sites_tenant: str):
        for site in tenant_sites:

            try:
                site_weather_data = weather_data.loc[
                    weather_data["station_code"]
                    == site["nearest_tahmo_station"]["code"]
                ]
                site_weather_data["site_id"] = site["_id"]
                site_weather_data["tenant"] = sites_tenant
                sites_weather_data.extend(site_weather_data.to_dict(orient="records"))
            except KeyError:
                continue

    for tenant in ["airqo", "kcca"]:
        sites = airqo_api.get_sites(tenant=tenant)
        add_site_tenant_info(tenant_sites=sites, sites_tenant=tenant)

    return sites_weather_data


def query_weather_data_from_tahmo(start_date_time, end_date_time, tenant=None) -> list:
    airqo_api = AirQoApi()
    sites = airqo_api.get_sites(tenant=tenant)
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

        print(f"{start} + ' : ' + {end}")

        range_measurements = tahmo_api.get_measurements(start, end, station_codes)
        measurements.extend(range_measurements)

    if measurements:
        measurements_df = pd.DataFrame(data=measurements)
        measurements_df.rename(columns={"station": "station_code"}, inplace=True)

    else:
        measurements_df = pd.DataFrame(
            [], columns=["value", "variable", "time", "station_code"]
        )
        return measurements_df.to_dict(orient="records")

    clean_measurements_df = remove_invalid_dates(
        dataframe=measurements_df, start_time=start_date_time, end_time=end_date_time
    )
    return clean_measurements_df.to_dict(orient="records")


def extract_weather_data_from_tahmo(
    start_date_time: str, end_date_time: str, frequency="hourly", tenant=None
) -> list:
    raw_weather_data = query_weather_data_from_tahmo(
        start_date_time=start_date_time, end_date_time=end_date_time, tenant=tenant
    )
    resampled_weather_data = resample_weather_data(
        data=raw_weather_data,
        frequency=frequency,
    )
    sites_weather_data = add_site_info_to_weather_data(data=resampled_weather_data)

    return sites_weather_data
