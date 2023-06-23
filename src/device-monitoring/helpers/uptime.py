from datetime import datetime

import pandas as pd
from google.cloud import bigquery

from app import cache
from config.constants import Config


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
        sites_table = f"`{Config.BIGQUERY_SITES}`"
        airqlouds_sites_table = f"`{Config.BIGQUERY_AIRQLOUDS_SITES}`"
        airqlouds_table = f"`{Config.BIGQUERY_AIRQLOUDS}`"

        query = (
            f" SELECT {data_table}.timestamp ,  "
            f" {data_table}.hourly_threshold , "
            f" {data_table}.data_points , "
            f" {data_table}.uptime , "
            f" {data_table}.downtime , "
            f" {data_table}.average_battery , "
            f" {data_table}.device "
        )

        if len(devices) != 0:
            query = (
                f"{query} "
                f"FROM {data_table} "
                f"WHERE {data_table}.device IN UNNEST({devices}) "
            )
        elif site.strip() != "":
            query = (
                f"{query}, {sites_table}.name as site_name, {data_table}.site_id "
                f"FROM {data_table} "
                f"RIGHT JOIN {sites_table} on {sites_table}.id = {data_table}.site_id "
                f"WHERE {data_table}.site_id = '{site}' "
            )
        elif airqloud.strip() != "":
            meta_data_query = (
                f" SELECT {airqlouds_sites_table}.airqloud_id , "
                f" {airqlouds_sites_table}.site_id , "
                f" FROM {airqlouds_sites_table} "
                f" WHERE {airqlouds_sites_table}.airqloud_id = '{airqloud}' "
            )

            meta_data_query = (
                f" SELECT "
                f" {airqlouds_table}.name AS airqloud_name , "
                f" meta_data.* "
                f" FROM {airqlouds_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.airqloud_id = {airqlouds_table}.id "
            )

            meta_data_query = (
                f" SELECT "
                f" {sites_table}.name  AS site_name , "
                f" meta_data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
            )

            query = (
                f" {query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
                f"WHERE meta_data.airqloud_id = '{airqloud}' "
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

    @staticmethod
    def compute_uptime(row) -> pd.Series:
        uptime = (row["data_points"] / row["hourly_threshold"]) * 100
        uptime = uptime if uptime <= 100 else 100
        downtime = 100 - uptime
        return pd.Series({"uptime": uptime, "downtime": downtime})

    @staticmethod
    def compute_uptime_summary(
        devices: list[str],
        start_date_time: datetime,
        end_date_time: datetime,
        site: str,
        airqloud: str,
        data: list,
        threshold: int,
    ):
        devices_uptime = pd.DataFrame(data)

        if len(devices_uptime.index) == 0:
            return devices_uptime.to_dict("records")

        if threshold:
            devices_uptime["hourly_threshold"] = int(threshold)
            devices_uptime[["uptime", "downtime"]] = devices_uptime.apply(
                Uptime.compute_uptime, axis=1
            )

        if len(devices) != 0:
            return devices_uptime.to_dict("records")
        elif site.strip() != "":
            uptime = float(devices_uptime["uptime"].mean())
            downtime = float(devices_uptime["downtime"].mean())
            data_points = int(devices_uptime["data_points"].sum())
            hourly_threshold = int(devices_uptime.iloc[0]["hourly_threshold"])
            return {
                "start_date_time": start_date_time,
                "end_date_time": end_date_time,
                "site_id": devices_uptime.iloc[0]["site_id"],
                "site_name": devices_uptime.iloc[0]["site_name"],
                "uptime": uptime,
                "downtime": downtime,
                "data_points": data_points,
                "hourly_threshold": hourly_threshold,
                "devices": devices_uptime.to_dict("records"),
            }
        elif airqloud.strip() != "":
            uptime = float(devices_uptime["uptime"].mean())
            downtime = float(devices_uptime["downtime"].mean())
            data_points = int(devices_uptime["data_points"].sum())
            hourly_threshold = int(devices_uptime.iloc[0]["hourly_threshold"])

            sites_uptime = devices_uptime.groupby(
                ["site_id", "site_name"], as_index=False
            )["uptime"].mean()
            sites_downtime = devices_uptime.groupby(
                ["site_id", "site_name"], as_index=False
            )["downtime"].mean()
            sites_data_points = devices_uptime.groupby(
                ["site_id", "site_name"], as_index=False
            )["data_points"].sum()

            sites = pd.merge(
                sites_uptime, sites_downtime, on=["site_id", "site_name"]
            ).merge(sites_data_points, on=["site_id", "site_name"])
            sites["hourly_threshold"] = hourly_threshold
            sites["start_date_time"] = start_date_time
            sites["end_date_time"] = end_date_time

            return {
                "start_date_time": start_date_time,
                "end_date_time": end_date_time,
                "airqloud_id": devices_uptime.iloc[0]["airqloud_id"],
                "airqloud_name": devices_uptime.iloc[0]["airqloud_name"],
                "uptime": uptime,
                "downtime": downtime,
                "data_points": data_points,
                "hourly_threshold": hourly_threshold,
                "sites": sites.to_dict("records"),
                "devices": devices_uptime.to_dict("records"),
            }
        return {}
