import statistics
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from google.cloud import bigquery

from config.constants import Config
from helpers.convert_dates import date_to_str

from app import cache


class MetaData:
    def __init__(
        self,
        airqlouds: list,
        sites: list,
        tenant: str,
    ):
        self.airqlouds = airqlouds
        self.sites = sites
        self.tenant = tenant
        self.__devices_table = f"`{Config.BIGQUERY_DEVICES}`"
        self.__airqlouds_sites_table = f"`{Config.BIGQUERY_AIRQLOUDS_SITES}`"
        self.__client = bigquery.Client()

    def get_devices(self):
        if self.sites:
            query = (
                f" SELECT device_id, "
                f" FROM {self.__devices_table} "
                f" WHERE {self.__devices_table}.site_id IN UNNEST({self.sites}) "
                f" AND {self.__devices_table}.tenant = '{self.tenant}' "
            )

            dataframe = self.__client.query(query=query).result().to_dataframe()

        elif self.airqlouds:
            sites = (
                f" SELECT {self.__airqlouds_sites_table}.site_id "
                f" FROM {self.__airqlouds_sites_table} "
                f" WHERE {self.__airqlouds_sites_table}.airqloud_id IN UNNEST({self.airqlouds}) "
            )

            query = (
                f" SELECT device_id "
                f" FROM {self.__devices_table} "
                f" RIGHT JOIN ({sites}) sites ON sites.site_id = {self.__devices_table}.site_id "
                f" AND {self.__devices_table}.tenant = '{self.tenant}' "
            )

            dataframe = self.__client.query(query=query).result().to_dataframe()

        else:
            return []

        if dataframe.empty:
            return []
        dataframe.dropna(inplace=True)
        return dataframe["device_id"].to_list()


class Uptime:
    @staticmethod
    @cache.memoize(timeout=1800)
    def get_uptime(
        devices: list[str],
        start_date_time: datetime,
        end_date_time: datetime,
        site: str,
        airqloud: str,
    ) -> list:
        data_table = f"`{Config.BIGQUERY_DEVICE_UPTIME_TABLE}`"

        query = (
            f" SELECT {data_table}.timestamp ,  "
            f" {data_table}.hourly_threshold , "
            f" {data_table}.data_points , "
            f" {data_table}.uptime , "
            f" {data_table}.downtime , "
            f" {data_table}.average_battery , "
            f" {data_table}.device , "
            f" {data_table}.downtime , "
        )

        if len(devices) != 0:
            query = (
                f"{query} "
                f"FROM {data_table} "
                f"WHERE {data_table}.device IN UNNEST({devices})"
            )
        elif site.strip() != "":
            query = (
                f"{query}, {data_table}.site_id "
                f"FROM {data_table} "
                f"WHERE {data_table}.site_id = {site}"
            )
        elif airqloud.strip() != "":
            query = (
                f"{query} "
                f"FROM {data_table} "
                f"WHERE {data_table}.airqloud = {airqloud}"
            )
        query = (
            f"{query} "
            f"AND {data_table}.timestamp >= '{start_date_time}' "
            f"AND {data_table}.timestamp <= '{end_date_time}' "
        )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = (
            bigquery.Client()
            .query(f"select distinct * from ({query})", job_config)
            .result()
            .to_dataframe()
        )

        return dataframe.to_dict("records")

    def __init__(
        self,
        start_date_time: datetime,
        end_date_time: datetime,
        data_points_per_30_minutes: int,
        devices: list,
    ):
        self.__client = bigquery.Client()
        self.__raw_data_table = f"`{Config.BIGQUERY_RAW_DATA}`"
        self.__devices = devices

        self.__data_points_threshold = data_points_per_30_minutes
        self.__start_date_time = self.__format_timestamp(start_date_time)
        self.__end_date_time = self.__format_timestamp(end_date_time)

        self.__data = pd.DataFrame()

        self.__devices_uptime = pd.DataFrame()
        self.__overall_uptime = 0
        self.__overall_downtime = 0
        self.__results = {}
        self.__date_format = "%Y-%m-%dT%H:%M:%SZ"

    def results(self):
        return self.__results

    def compute(self):
        if self.__data.empty:
            self.__load_devices_data()

        if self.__data.empty:
            self.__results = {
                "errors": f"No data for devices {self.__devices}",
            }
            return self.__results

        self.__aggregate_data()

        self.__results = {
            "overall_uptime": self.__overall_uptime,
            "overall_downtime": self.__overall_downtime,
            "start_date_time": date_to_str(self.__start_date_time),
            "end_date_time": date_to_str(self.__end_date_time),
            "devices": self.__devices,
            "uptime": self.__devices_uptime.sort_values(
                by=["timestamp", "device", "data_points"]
            ).to_dict("records"),
        }

        return self.__results

    def __format_timestamp(self, timestamp: datetime):
        if 0 <= timestamp.minute <= 30:
            timestamp_format = "%Y-%m-%dT%H:00:00Z"
            timestamp_str = date_to_str(timestamp, str_format=timestamp_format)
        elif timestamp.minute > 30:
            timestamp_format = "%Y-%m-%dT%H:30:00Z"
            timestamp_str = date_to_str(timestamp, str_format=timestamp_format)
        else:
            timestamp_format = self.__date_format
            timestamp_str = date_to_str(timestamp, str_format=timestamp_format)

        return datetime.strptime(timestamp_str, timestamp_format)

    @staticmethod
    def dates_array(start_date_time, end_date_time, frequency="30min"):
        dates = pd.date_range(start_date_time, end_date_time, freq=frequency)
        freq = dates.freq

        if dates.values.size == 1:
            dates = dates.append(pd.Index([pd.to_datetime(end_date_time)]))

        dates = [pd.to_datetime(str(date)) for date in dates.values]
        return_dates = []

        array_last_date_time = dates.pop()
        for date in dates:
            end = date + timedelta(hours=freq.n)
            if end > array_last_date_time:
                end = array_last_date_time
            return_dates.append(
                (
                    date,
                    end,
                )
            )

        return return_dates

    def __create_data(self) -> pd.DataFrame:
        dates = self.dates_array(self.__start_date_time, self.__end_date_time)
        data = []
        for start, end in dates:
            for device in self.__devices:
                data.extend(
                    [
                        {"timestamp": start, "device": device},
                        {"timestamp": end, "device": device},
                    ]
                )

        data = pd.DataFrame(data)
        data.drop_duplicates(inplace=True)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        return data

    def __aggregate_data(self) -> pd.DataFrame:
        uptime_data = self.__create_data()
        data = self.__data.copy()
        data["timestamp"] = data["timestamp"].apply(self.__format_timestamp)
        devices_data = []
        for _, device_group in data.groupby("device"):
            device_id = device_group.iloc[0]["device"]
            device_data = []

            for _, timestamp_group in device_group.groupby("timestamp"):
                timestamp = timestamp_group.iloc[0]["timestamp"]
                device_data.append(
                    {
                        "device": device_id,
                        "timestamp": timestamp,
                        "data_points": len(timestamp_group.index),
                        "average_battery": statistics.mean(
                            timestamp_group["battery"].to_list()
                        ),
                    }
                )
            devices_data.extend(device_data)

        devices_data = pd.DataFrame(devices_data)

        devices_data.timestamp.astype("datetime64[ns]")
        uptime_data.timestamp.astype("datetime64[ns]")

        uptime_data = pd.merge(
            left=uptime_data,
            right=devices_data,
            on=["device", "timestamp"],
            how="left",
        )

        uptime_data.drop_duplicates(subset=["device", "timestamp"], inplace=True)
        uptime_data.fillna(0, inplace=True)

        uptime_data["timestamp"] = pd.to_datetime(uptime_data["timestamp"])
        uptime_data[["uptime", "downtime"]] = uptime_data["data_points"].apply(
            lambda x: self.__calculate_uptime(x)
        )
        uptime_data["data_points_threshold"] = self.__data_points_threshold
        uptime_data[["data_points_threshold", "data_points"]] = uptime_data[
            ["data_points_threshold", "data_points"]
        ].apply(np.int64)

        self.__overall_uptime = statistics.mean(uptime_data["uptime"].to_list())
        self.__overall_downtime = statistics.mean(uptime_data["downtime"].to_list())
        self.__devices_uptime = uptime_data

        return uptime_data

    def __calculate_uptime(self, data_points):
        series = pd.Series(dtype=float)

        series["uptime"] = 100
        series["downtime"] = 0

        if data_points < self.__data_points_threshold:
            series["uptime"] = (data_points / self.__data_points_threshold) * 100
            series["downtime"] = 100 - series["uptime"]

        return series

    def __load_devices_data(self):
        query = (
            f" SELECT timestamp, device_id as device, battery "
            f" FROM {self.__raw_data_table} "
            f" WHERE {self.__raw_data_table}.timestamp >= '{date_to_str(self.__start_date_time, str_format=self.__date_format)}' "
            f" AND {self.__raw_data_table}.timestamp <= '{date_to_str(self.__end_date_time, str_format=self.__date_format)}' "
            f" AND ( {self.__raw_data_table}.s1_pm2_5 is not null  "
            f" OR {self.__raw_data_table}.s2_pm2_5 is not null ) "
            f" AND device_id IN UNNEST({self.__devices})"
        )

        dataframe = self.__client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            dataframe = pd.DataFrame([], columns=["timestamp", "device", "battery"])

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        dataframe.drop_duplicates(
            subset=["timestamp", "device"], keep="first", inplace=True
        )

        self.__data = dataframe
        return dataframe
