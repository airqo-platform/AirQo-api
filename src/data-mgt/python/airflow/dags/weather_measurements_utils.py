import json
from datetime import timedelta, datetime

import pandas as pd

from config import configuration
from date import date_to_str_hours
from tahmo import TahmoApi
from utils import get_devices_or_sites, get_column_value


def get_site_ids_from_station(station, sites=None):
    if sites is None:
        sites = []
    station_sites = list(filter(lambda site: site["nearest_tahmo_station"]["code"] == station, sites))

    if not station_sites:
        return []
    site_ids = []
    for site in station_sites:
        site_ids.append(site["_id"])
    return site_ids


def transform_weather_measurements(input_file, output_file):
    weather_raw_data = pd.read_csv(input_file)

    if weather_raw_data.empty:
        print("No Data for cleaning")
        weather_raw_data.to_csv(output_file, index=False)
        return

    sites = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'airqo', sites=True)
    valid_sites = list(filter(lambda x: "nearest_tahmo_station" in dict(x).keys(), sites))

    temperature = weather_raw_data.loc[weather_raw_data["variable"] == "te", ["value", "variable", "station", "time"]]
    humidity = weather_raw_data.loc[weather_raw_data["variable"] == "rh", ["value", "variable", "station", "time"]]

    humidity["value"] = pd.to_numeric(humidity["value"])
    humidity['value'] = humidity['value'].apply(lambda x: x * 100)

    wind_speed = weather_raw_data.loc[weather_raw_data["variable"] == "ws", ["value", "variable", "station", "time"]]

    data = pd.concat([temperature, humidity, wind_speed])
    data.reset_index(inplace=True)
    weather_data = []

    data["value"] = pd.to_numeric(data["value"])

    data_station_gps = data.groupby('station')
    for _, station_group in data_station_gps:

        station_time_gps = station_group.groupby('time')
        for _, time_group in station_time_gps:

            station = time_group.iloc[0]["station"]
            station_sites = get_site_ids_from_station(station, valid_sites)

            if not station_sites:
                continue

            time_series_data = {
                "time": time_group.iloc[0]["time"],
                "humidity": None,
                "temperature": None,
                "windSpeed": None,
                "site_id": None
            }

            for _, row in time_group.iterrows():
                if row["variable"] == "rh":
                    time_series_data["humidity"] = get_column_value("value", row, ["value"],
                                                                    data_name="externalHumidity")
                elif row["variable"] == "ws":
                    time_series_data["windSpeed"] = get_column_value("value", row, ["value"],
                                                                     data_name="windSpeed")
                elif row["variable"] == "te":
                    time_series_data["temperature"] = get_column_value("value", row, ["value"],
                                                                       data_name="externalTemperature")
                else:
                    continue

            if time_series_data["time"]:

                for site in station_sites:
                    time_series_data["site_id"] = site
                    weather_data.append(time_series_data)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(weather_data, f, ensure_ascii=False, indent=4)
    return


def get_weather_measurements(output_file, start_time=None, end_time=None):
    airqo_sites = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'airqo', sites=True)
    station_codes = []
    for site in airqo_sites:
        try:
            if 'nearest_tahmo_station' in dict(site).keys():
                station_codes.append(site['nearest_tahmo_station']['code'])
        except Exception as ex:
            print(ex)

    measurements = []
    columns = []
    tahmo_api = TahmoApi()

    if start_time is None or end_time is None:
        interval = 3
        date = datetime.now()
        end_time = date_to_str_hours(date)
        start_time = date_to_str_hours(date - timedelta(hours=interval))

        print(start_time + " : " + end_time)

        cols, range_measurements = tahmo_api.get_measurements(start_time, end_time, station_codes)
        measurements.extend(range_measurements)
        if len(columns) == 0:
            columns = cols
    else:
        interval = 12

        dates = pd.date_range(start_time, end_time, freq=f'{interval}H')

        for date in dates:
            start_time = date_to_str_hours(date)
            end_time = date_to_str_hours(date + timedelta(hours=interval))
            print(start_time + " : " + end_time)

            cols, range_measurements = tahmo_api.get_measurements(start_time, end_time, station_codes)
            measurements.extend(range_measurements)
            if len(columns) == 0:
                columns = cols

    if len(measurements) != 0 and len(columns) != 0:
        measurements_df = pd.DataFrame(data=measurements, columns=columns)
    else:
        measurements_df = pd.DataFrame([])

    measurements_df.to_csv(path_or_buf=output_file, index=False)
    return


def save_weather_measurements(input_file):
    file = open(input_file)
    base_url = configuration.AIRQO_BASE_URL
    data = json.load(file)

    for i in range(0, len(data), int(configuration.POST_WEATHER_BODY_SIZE)):
        json_data = json.dumps(data[i:i + int(configuration.POST_WEATHER_BODY_SIZE)])
        try:
            headers = {'Content-Type': 'application/json'}
            url = base_url + "devices/events?tenant="
            print(json_data)
            print(url)

            # results = requests.post(url, json_data, headers=headers, verify=False)
            #
            # if results.status_code == 200:
            #     print(results.json())
            # else:
            #     print(f"Device registry failed to insert values. Status Code : {results.status_code}")
            #     print(f"Response : {results.content}")
            #     print(f"Request Url : {url}")
            #     print(f"Request body : {json_data}")
        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))
