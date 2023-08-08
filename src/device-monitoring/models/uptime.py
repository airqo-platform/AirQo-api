from typing import Union

import numpy as np
import pandas as pd
from google.cloud import bigquery
from pymongo import DESCENDING

from app import cache
from config.constants import Config
from helpers.convert_dates import date_to_str
from models.base import BaseModel


class DeviceStatus(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, "device_status")

    @cache.memoize()
    def get_device_status(self, start_date, end_date, limit):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}

        if limit:
            return list(
                self.collection.find(db_filter).sort("created_at", DESCENDING).limit(1)
            )

        return list(self.collection.find(db_filter).sort("created_at", DESCENDING))


class NetworkUptime(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, "network_uptime")

    @cache.memoize()
    def get_network_uptime(self, start_date, end_date):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}
        return list(
            self.collection.aggregate(
                [
                    {"$match": db_filter},
                    {
                        "$project": {
                            "_id": {"$toString": "$_id"},
                            "created_at": {
                                "$dateToString": {
                                    "date": "$created_at",
                                    "format": "%Y-%m-%dT%H:%M:%S%z",
                                    "timezone": "Africa/Kampala",
                                }
                            },
                            "network_name": 1,
                            "uptime": 1,
                        }
                    },
                ]
            )
        )


class DeviceUptime(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, "device_uptime")

    @cache.memoize()
    def get_uptime_leaderboard(self, start_date, end_date):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}

        return list(
            self.collection.aggregate(
                [
                    {"$match": db_filter},
                    {
                        "$group": {
                            "_id": "$device_name",
                            "device_name": {"$first": "$device_name"},
                            "downtime": {"$avg": "$downtime"},
                            "uptime": {"$avg": "$uptime"},
                        }
                    },
                ]
            )
        )

    @cache.memoize()
    def get_device_uptime(self, start_date, end_date, device_name):
        db_filter = {"created_at": {"$gte": start_date, "$lt": end_date}}

        if device_name:
            db_filter["device_name"] = device_name

        return list(
            self.collection.aggregate(
                [
                    {"$match": db_filter},
                    {
                        "$group": {
                            "_id": "$device_name",
                            "values": {
                                "$push": {
                                    "_id": {"$toString": "$_id"},
                                    "battery_voltage": "$battery_voltage",
                                    "channel_id": "$channel_id",
                                    "created_at": {
                                        "$dateToString": {
                                            "date": "$created_at",
                                            "format": "%Y-%m-%dT%H:%M:%S%z",
                                            "timezone": "Africa/Kampala",
                                        }
                                    },
                                    "device_name": "$device_name",
                                    "downtime": "$downtime",
                                    "sensor_one_pm2_5": "$sensor_one_pm2_5",
                                    "sensor_two_pm2_5": "$sensor_two_pm2_5",
                                    "uptime": "$uptime",
                                }
                            },
                        }
                    },
                ]
            )
        )


class DeviceBattery:
    @staticmethod
    @cache.memoize(timeout=1800)
    def get_device_battery(device: str, start_date_time: str, end_date_time: str) -> []:
        client = bigquery.Client()
        cols = [
            "timestamp",
            "device_id as device_name",
            "battery as voltage",
        ]

        data_table = f"`{Config.BIGQUERY_RAW_DATA}`"

        query = (
            f" SELECT {', '.join(cols)}, "
            f" FROM {data_table} "
            f" WHERE {data_table}.timestamp >= '{str(start_date_time)}' "
            f" AND {data_table}.timestamp <= '{str(end_date_time)}' "
            f" AND {data_table}.device_id = '{device}' "
            f" AND {data_table}.battery is not null "
        )

        query = f"select distinct * from ({query})"

        dataframe = client.query(query=query).result().to_dataframe()

        return dataframe.to_dict("records")

    @staticmethod
    def format_device_battery(
        data: list, rounding: Union[int, None], minutes_average: Union[int, None]
    ):
        formatted_data = pd.DataFrame(data)
        if len(formatted_data.index) == 0:
            return data

        if minutes_average:
            data_df = pd.DataFrame(formatted_data)
            formatted_data = pd.DataFrame()

            data_df["timestamp"] = pd.to_datetime(data_df["timestamp"])
            data_df.set_index("timestamp", inplace=True)

            for device_name, group in data_df.groupby("device_name"):
                resampled = group[["voltage"]].resample(f"{minutes_average}Min").mean()
                resampled["device_name"] = device_name
                resampled["timestamp"] = resampled.index
                formatted_data = pd.concat(
                    [formatted_data, resampled], ignore_index=True
                )

        if rounding:
            formatted_data["voltage"] = formatted_data["voltage"].apply(float)
            formatted_data["voltage"] = formatted_data["voltage"].round(rounding)

        formatted_data.replace(np.nan, None, inplace=True)
        formatted_data.sort_values("timestamp", inplace=True)
        formatted_data["timestamp"] = formatted_data["timestamp"].apply(date_to_str)

        return formatted_data.to_dict("records")
