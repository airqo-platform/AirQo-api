import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .commons import remove_invalid_dates
from .constants import DataSource
from .data_validator import DataValidationUtils
from .tahmo_api import TahmoApi
from .utils import Utils


class WeatherDataUtils:
    @staticmethod
    def extract_hourly_weather_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        cols = ["station_code", "timestamp", "temperature", "humidity"]
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=cols,
            table=bigquery_api.hourly_weather_table,
        )
        return pd.DataFrame([], columns=cols) if measurements.empty else measurements

    @staticmethod
    def get_nearest_weather_stations(records: list) -> list:
        data = []
        airqo_api = AirQoApi()

        for record in records:
            weather_stations = airqo_api.get_nearest_weather_stations(
                latitude=record.get("latitude"),
                longitude=record.get("longitude"),
            )
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

        return DataValidationUtils.remove_outliers(weather_data)

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
