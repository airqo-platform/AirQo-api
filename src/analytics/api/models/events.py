from datetime import datetime

import numpy as np
import pandas as pd
import pytz
from google.cloud import bigquery

from api.models.base.base_model import BasePyMongoModel
from api.utils.data_formatters import tenant_to_str, device_category_to_str
from api.utils.dates import date_to_str
from api.utils.pollutants.pm_25 import (
    POLLUTANT_BIGQUERY_MAPPER,
    BIGQUERY_FREQUENCY_MAPPER,
)
from main import cache, CONFIGURATIONS


class EventsModel(BasePyMongoModel):
    BIGQUERY_AIRQLOUDS_SITES = f"`{CONFIGURATIONS.BIGQUERY_AIRQLOUDS_SITES}`"
    BIGQUERY_AIRQLOUDS = f"`{CONFIGURATIONS.BIGQUERY_AIRQLOUDS}`"
    BIGQUERY_SITES = f"`{CONFIGURATIONS.BIGQUERY_SITES}`"
    BIGQUERY_DEVICES = f"`{CONFIGURATIONS.BIGQUERY_DEVICES}`"
    DATA_EXPORT_DECIMAL_PLACES = CONFIGURATIONS.DATA_EXPORT_DECIMAL_PLACES

    BIGQUERY_EVENTS = CONFIGURATIONS.BIGQUERY_EVENTS
    DATA_EXPORT_LIMIT = CONFIGURATIONS.DATA_EXPORT_LIMIT
    BIGQUERY_MOBILE_EVENTS = CONFIGURATIONS.BIGQUERY_MOBILE_EVENTS
    BIGQUERY_LATEST_EVENTS = CONFIGURATIONS.BIGQUERY_LATEST_EVENTS

    BIGQUERY_RAW_DATA = f"`{CONFIGURATIONS.BIGQUERY_RAW_DATA}`"
    BIGQUERY_HOURLY_DATA = f"`{CONFIGURATIONS.BIGQUERY_HOURLY_DATA}`"
    BIGQUERY_BAM_DATA = f"`{CONFIGURATIONS.BIGQUERY_BAM_DATA}`"
    BIGQUERY_DAILY_DATA = f"`{CONFIGURATIONS.BIGQUERY_DAILY_DATA}`"

    def __init__(self, tenant):
        self.limit_mapper = {"pm2_5": 500.5, "pm10": 604.5, "no2": 2049}
        super().__init__(tenant, collection_name="events")

    @classmethod
    @cache.memoize()
    def download_from_bigquery(
        cls,
        devices,
        sites,
        airqlouds,
        start_date,
        end_date,
        frequency,
        pollutants,
    ) -> pd.DataFrame:
        decimal_places = cls.DATA_EXPORT_DECIMAL_PLACES

        # Data sources
        sites_table = cls.BIGQUERY_SITES
        airqlouds_sites_table = cls.BIGQUERY_AIRQLOUDS_SITES
        devices_table = cls.BIGQUERY_DEVICES
        airqlouds_table = cls.BIGQUERY_AIRQLOUDS

        sorting_cols = ["site_id", "datetime", "device_name"]

        if frequency == "raw":
            data_table = cls.BIGQUERY_RAW_DATA
        elif frequency == "daily":
            data_table = cls.BIGQUERY_DAILY_DATA
        elif frequency == "hourly":
            data_table = cls.BIGQUERY_HOURLY_DATA
        else:
            raise Exception("Invalid frequency")

        pollutant_columns = []
        bam_pollutant_columns = []
        for pollutant in pollutants:
            pollutant_mapping = BIGQUERY_FREQUENCY_MAPPER.get(frequency).get(
                pollutant, []
            )
            pollutant_columns.extend(
                [
                    f"ROUND({data_table}.{mapping}, {decimal_places}) AS {mapping}"
                    for mapping in pollutant_mapping
                ]
            )

            if pollutant == "pm2_5":
                bam_pollutant_columns.extend(
                    ["pm2_5 as pm2_5_raw_value", "pm2_5 as pm2_5_calibrated_value"]
                )
            elif pollutant == "pm10":
                bam_pollutant_columns.extend(
                    ["pm10 as pm10_raw_value", "pm10 as pm10_calibrated_value"]
                )
            elif pollutant == "no2":
                bam_pollutant_columns.extend(
                    ["no2 as no2_raw_value", "no2 as no2_calibrated_value"]
                )

        pollutants_query = (
            f" SELECT {', '.join(map(str, set(pollutant_columns)))} ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {data_table}.timestamp) AS datetime "
        )
        bam_pollutants_query = (
            f" SELECT {', '.join(map(str, set(bam_pollutant_columns)))} ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {cls.BIGQUERY_BAM_DATA}.timestamp) AS datetime "
        )

        if len(devices) != 0:
            # Adding device information, start and end times
            query = (
                f" {pollutants_query} , "
                f" {devices_table}.device_id AS device_name , "
                f" {devices_table}.site_id AS site_id , "
                f" {devices_table}.tenant AS tenant , "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" FROM {data_table} "
                f" JOIN {devices_table} ON {devices_table}.device_id = {data_table}.device_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
                f" AND {devices_table}.device_id IN UNNEST({devices}) "
            )

            bam_query = (
                f" {bam_pollutants_query} , "
                f" {devices_table}.device_id AS device_name , "
                f" {devices_table}.site_id AS site_id , "
                f" {devices_table}.tenant AS tenant , "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" FROM {cls.BIGQUERY_BAM_DATA} "
                f" JOIN {devices_table} ON {devices_table}.device_id = {cls.BIGQUERY_BAM_DATA}.device_id "
                f" WHERE {cls.BIGQUERY_BAM_DATA}.timestamp >= '{start_date}' "
                f" AND {cls.BIGQUERY_BAM_DATA}.timestamp <= '{end_date}' "
                f" AND {devices_table}.device_id IN UNNEST({devices}) "
            )

            # Adding site information
            query = (
                f" SELECT "
                f" {sites_table}.name AS site_name , "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({query}) data ON data.site_id = {sites_table}.id "
            )

            bam_query = (
                f" SELECT "
                f" {sites_table}.name AS site_name , "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({bam_query}) data ON data.site_id = {sites_table}.id "
            )

            if frequency == "hourly":
                query = f"{query} UNION ALL {bam_query}"

        elif len(sites) != 0:
            # Adding site information, start and end times
            query = (
                f" {pollutants_query} , "
                f" {sites_table}.tenant AS tenant , "
                f" {sites_table}.id AS site_id , "
                f" {sites_table}.name AS site_name , "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" {data_table}.device_id AS device_name , "
                f" FROM {data_table} "
                f" JOIN {sites_table} ON {sites_table}.id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
                f" AND {sites_table}.id IN UNNEST({sites}) "
            )

            # Adding device information
            query = (
                f" SELECT "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" {devices_table}.device_id AS device_name , "
                f" data.* "
                f" FROM {devices_table} "
                f" RIGHT JOIN ({query}) data ON data.device_name = {devices_table}.device_id "
            )
        else:
            sorting_cols = ["airqloud_id", "site_id", "datetime", "device_name"]

            meta_data_query = (
                f" SELECT {airqlouds_sites_table}.tenant , "
                f" {airqlouds_sites_table}.airqloud_id , "
                f" {airqlouds_sites_table}.site_id , "
                f" FROM {airqlouds_sites_table} "
                f" WHERE {airqlouds_sites_table}.airqloud_id IN UNNEST({airqlouds}) "
            )

            # Adding airqloud information
            meta_data_query = (
                f" SELECT "
                f" {airqlouds_table}.name  AS airqloud_name , "
                f" meta_data.* "
                f" FROM {airqlouds_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.airqloud_id = {airqlouds_table}.id "
            )

            # Adding site information
            meta_data_query = (
                f" SELECT "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" {sites_table}.name  AS site_name , "
                f" meta_data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
            )

            # Adding device information
            meta_data_query = (
                f" SELECT "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" {devices_table}.device_id AS device_name , "
                f" meta_data.* "
                f" FROM {devices_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {devices_table}.site_id "
            )

            # Adding start and end times
            query = (
                f" {pollutants_query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
            )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = (
            bigquery.Client()
            .query(
                f"select distinct * from ({query}) limit {cls.DATA_EXPORT_LIMIT}",
                job_config,
            )
            .result()
            .to_dataframe()
        )

        if len(dataframe) == 0:
            return dataframe

        dataframe.drop_duplicates(
            subset=["datetime", "device_name"], inplace=True, keep="first"
        )
        dataframe.sort_values(sorting_cols, ascending=True, inplace=True)
        dataframe["frequency"] = frequency
        dataframe = dataframe.replace(np.nan, None)
        return dataframe

    @classmethod
    def query_data_from_bigquery(
        cls,
        devices,
        sites,
        airqlouds,
        start_date,
        end_date,
        frequency,
        pollutants,
    ) -> pd.DataFrame:
        decimal_places = cls.DATA_EXPORT_DECIMAL_PLACES

        # Data sources
        sites_table = cls.BIGQUERY_SITES
        airqlouds_sites_table = cls.BIGQUERY_AIRQLOUDS_SITES
        devices_table = cls.BIGQUERY_DEVICES
        airqlouds_table = cls.BIGQUERY_AIRQLOUDS

        sorting_cols = ["site_id", "datetime", "device_name"]

        if frequency == "raw":
            data_table = cls.BIGQUERY_RAW_DATA
        elif frequency == "daily":
            data_table = cls.BIGQUERY_DAILY_DATA
        elif frequency == "hourly":
            data_table = cls.BIGQUERY_HOURLY_DATA
        else:
            raise Exception("Invalid frequency")

        pollutant_columns = []
        bam_pollutant_columns = []
        for pollutant in pollutants:
            pollutant_mapping = BIGQUERY_FREQUENCY_MAPPER.get(frequency).get(
                pollutant, []
            )
            pollutant_columns.extend(
                [
                    f"ROUND({data_table}.{mapping}, {decimal_places}) AS {mapping}"
                    for mapping in pollutant_mapping
                ]
            )

            if pollutant == "pm2_5":
                bam_pollutant_columns.extend(
                    ["pm2_5 as pm2_5_raw_value", "pm2_5 as pm2_5_calibrated_value"]
                )
            elif pollutant == "pm10":
                bam_pollutant_columns.extend(
                    ["pm10 as pm10_raw_value", "pm10 as pm10_calibrated_value"]
                )
            elif pollutant == "no2":
                bam_pollutant_columns.extend(
                    ["no2 as no2_raw_value", "no2 as no2_calibrated_value"]
                )

        pollutants_query = (
            f" SELECT {', '.join(map(str, set(pollutant_columns)))} ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {data_table}.timestamp) AS datetime "
        )
        bam_pollutants_query = (
            f" SELECT {', '.join(map(str, set(bam_pollutant_columns)))} ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {cls.BIGQUERY_BAM_DATA}.timestamp) AS datetime "
        )

        if len(devices) != 0:
            # Adding device information, start and end times
            query = (
                f" {pollutants_query} , "
                f" {devices_table}.device_id AS device_name , "
                f" {devices_table}.site_id AS site_id , "
                f" {devices_table}.tenant AS tenant , "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" FROM {data_table} "
                f" JOIN {devices_table} ON {devices_table}.device_id = {data_table}.device_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
                f" AND {devices_table}.device_id IN UNNEST({devices}) "
            )

            bam_query = (
                f" {bam_pollutants_query} , "
                f" {devices_table}.device_id AS device_name , "
                f" {devices_table}.site_id AS site_id , "
                f" {devices_table}.tenant AS tenant , "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" FROM {cls.BIGQUERY_BAM_DATA} "
                f" JOIN {devices_table} ON {devices_table}.device_id = {cls.BIGQUERY_BAM_DATA}.device_id "
                f" WHERE {cls.BIGQUERY_BAM_DATA}.timestamp >= '{start_date}' "
                f" AND {cls.BIGQUERY_BAM_DATA}.timestamp <= '{end_date}' "
                f" AND {devices_table}.device_id IN UNNEST({devices}) "
            )

            # Adding site information
            query = (
                f" SELECT "
                f" {sites_table}.name AS site_name , "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({query}) data ON data.site_id = {sites_table}.id "
            )

            bam_query = (
                f" SELECT "
                f" {sites_table}.name AS site_name , "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({bam_query}) data ON data.site_id = {sites_table}.id "
            )

            if frequency == "hourly":
                query = f"{query} UNION ALL {bam_query}"

        elif len(sites) != 0:
            # Adding site information, start and end times
            query = (
                f" {pollutants_query} , "
                f" {sites_table}.tenant AS tenant , "
                f" {sites_table}.id AS site_id , "
                f" {sites_table}.name AS site_name , "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" {data_table}.device_id AS device_name , "
                f" FROM {data_table} "
                f" JOIN {sites_table} ON {sites_table}.id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
                f" AND {sites_table}.id IN UNNEST({sites}) "
            )

            # Adding device information
            query = (
                f" SELECT "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" {devices_table}.device_id AS device_name , "
                f" data.* "
                f" FROM {devices_table} "
                f" RIGHT JOIN ({query}) data ON data.device_name = {devices_table}.device_id "
            )
        else:
            sorting_cols = ["airqloud_id", "site_id", "datetime", "device_name"]

            meta_data_query = (
                f" SELECT {airqlouds_sites_table}.tenant , "
                f" {airqlouds_sites_table}.airqloud_id , "
                f" {airqlouds_sites_table}.site_id , "
                f" FROM {airqlouds_sites_table} "
                f" WHERE {airqlouds_sites_table}.airqloud_id IN UNNEST({airqlouds}) "
            )

            # Adding airqloud information
            meta_data_query = (
                f" SELECT "
                f" {airqlouds_table}.name  AS airqloud_name , "
                f" meta_data.* "
                f" FROM {airqlouds_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.airqloud_id = {airqlouds_table}.id "
            )

            # Adding site information
            meta_data_query = (
                f" SELECT "
                f" {sites_table}.approximate_latitude AS site_latitude , "
                f" {sites_table}.approximate_longitude  AS site_longitude , "
                f" {sites_table}.name  AS site_name , "
                f" meta_data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
            )

            # Adding device information
            meta_data_query = (
                f" SELECT "
                f" {devices_table}.approximate_latitude AS device_latitude , "
                f" {devices_table}.approximate_longitude  AS device_longitude , "
                f" {devices_table}.device_id AS device_name , "
                f" meta_data.* "
                f" FROM {devices_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {devices_table}.site_id "
            )

            # Adding start and end times
            query = (
                f" {pollutants_query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
            )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = (
            bigquery.Client()
            .query(
                f"select distinct * from ({query})",
                job_config,
            )
            .result()
            .to_dataframe()
        )

        if len(dataframe) == 0:
            return dataframe

        dataframe.drop_duplicates(
            subset=["datetime", "device_name"], inplace=True, keep="first"
        )
        dataframe.sort_values(sorting_cols, ascending=True, inplace=True)
        dataframe["frequency"] = frequency
        dataframe = dataframe.replace(np.nan, None)
        return dataframe

    @classmethod
    @cache.memoize()
    def get_data_for_summary(
        cls,
        airqloud,
        start_date_time,
        end_date_time,
    ) -> list:
        data_table = cls.BIGQUERY_HOURLY_DATA

        # Data sources
        sites_table = cls.BIGQUERY_SITES
        airqlouds_sites_table = cls.BIGQUERY_AIRQLOUDS_SITES
        airqlouds_table = cls.BIGQUERY_AIRQLOUDS
        devices_table = cls.BIGQUERY_DEVICES

        data_query = (
            f" SELECT {data_table}.pm2_5_calibrated_value , {data_table}.pm2_5_raw_value , "
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {data_table}.timestamp) AS datetime "
        )

        meta_data_query = (
            f" SELECT {airqlouds_sites_table}.airqloud_id , "
            f" {airqlouds_sites_table}.site_id , "
            f" FROM {airqlouds_sites_table} "
            f" WHERE {airqlouds_sites_table}.airqloud_id = '{airqloud}' "
        )

        # Adding airqloud information
        meta_data_query = (
            f" SELECT "
            f" {airqlouds_table}.name AS airqloud , "
            f" meta_data.* "
            f" FROM {airqlouds_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.airqloud_id = {airqlouds_table}.id "
        )

        # Adding site information
        meta_data_query = (
            f" SELECT "
            f" {sites_table}.name AS site , "
            f" meta_data.* "
            f" FROM {sites_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
        )

        # Adding device information
        meta_data_query = (
            f" SELECT "
            f" {devices_table}.device_id AS device , "
            f" meta_data.* "
            f" FROM {devices_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {devices_table}.site_id "
        )

        # Adding start and end times
        query = (
            f" {data_query} , "
            f" meta_data.* "
            f" FROM {data_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
            f" WHERE {data_table}.timestamp >= '{start_date_time}' "
            f" AND {data_table}.timestamp <= '{end_date_time}' "
            f" AND {data_table}.pm2_5_raw_value is not null "
        )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = bigquery.Client().query(query, job_config).result().to_dataframe()

        if len(dataframe.index) == 0:
            return []

        dataframe.drop_duplicates(
            subset=["datetime", "device"], inplace=True, keep="first"
        )

        return dataframe.to_dict(orient="records")

    @classmethod
    @cache.memoize()
    def from_bigquery(
        cls,
        tenant,
        sites,
        start_date,
        end_date,
        frequency,
        pollutants,
        additional_columns=None,
        output_format=None,
    ):
        if additional_columns is None:
            additional_columns = []

        decimal_places = 2

        columns = [
            f"{cls.BIGQUERY_EVENTS}.device_id AS device",
            f"{cls.BIGQUERY_SITES}.name AS site",
            "FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', timestamp) AS datetime",
            f"{cls.BIGQUERY_SITES}.approximate_latitude AS latitude",
            f"{cls.BIGQUERY_SITES}.approximate_longitude  AS longitude",
        ]
        columns.extend(additional_columns)

        if output_format is not None and output_format == "aqcsv":
            columns.extend(["site_id"])

        for pollutant in pollutants:
            pollutant_mapping = POLLUTANT_BIGQUERY_MAPPER.get(pollutant, [])
            columns.extend(
                [
                    f"ROUND({mapping}, {decimal_places}) AS {mapping}"
                    for mapping in pollutant_mapping
                ]
            )

        QUERY = (
            f"SELECT {', '.join(map(str, set(columns)))} "
            f"FROM {cls.BIGQUERY_EVENTS} "
            f"JOIN {cls.BIGQUERY_SITES} ON {cls.BIGQUERY_SITES}.id = {cls.BIGQUERY_EVENTS}.site_id "
            f"WHERE {cls.BIGQUERY_EVENTS}.tenant = '{tenant}' "
            f"AND {cls.BIGQUERY_EVENTS}.timestamp >= '{start_date}' "
            f"AND {cls.BIGQUERY_EVENTS}.timestamp <= '{end_date}' "
            f"AND site_id IN UNNEST({sites})"
        )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = bigquery.Client().query(QUERY, job_config).result().to_dataframe()
        dataframe.sort_values(
            ["site", "datetime", "device"], ascending=True, inplace=True
        )

        dataframe.drop_duplicates(
            subset=["datetime", "device"], inplace=True, keep="first"
        )
        return dataframe.to_dict(orient="records")

    @classmethod
    @cache.memoize(timeout=1800)
    def bigquery_latest_measurements(cls, tenant, not_null_values=None):
        decimal_places = 2
        columns = (
            "tenant, timestamp, device_id as device_name, device_longitude as longitude, "
            "device_category, site_name, site_latitude, site_longitude, "
            "device_latitude as latitude, "
            f"ROUND(pm2_5_raw_value, {decimal_places}) as pm2_5_raw_value, "
            f"ROUND(pm2_5_calibrated_value, {decimal_places}) as pm2_5_calibrated_value, "
            f"ROUND(pm10_raw_value, {decimal_places}) as pm10_raw_value, "
            f"ROUND(pm10_calibrated_value, {decimal_places}) as pm10_calibrated_value, "
            f"ROUND(no2_raw_value, {decimal_places}) as no2_raw_value, "
            f"ROUND(no2_calibrated_value, {decimal_places}) as no2_calibrated_value, "
        )
        query = f"SELECT {columns} FROM {cls.BIGQUERY_LATEST_EVENTS} "

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = bigquery.Client().query(query, job_config).result().to_dataframe()
        dataframe.loc[:, "timestamp"] = dataframe["timestamp"].apply(date_to_str)
        dataframe.loc[:, "tenant"] = dataframe["tenant"].apply(tenant_to_str)
        dataframe.loc[:, "device_category"] = dataframe["device_category"].apply(
            device_category_to_str
        )
        dataframe.loc[:, "device_name"] = dataframe["device_name"].apply(
            lambda x: str(x).upper()
        )
        dataframe["latitude"] = dataframe["latitude"].fillna(dataframe["site_latitude"])
        dataframe["longitude"] = dataframe["longitude"].fillna(
            dataframe["site_longitude"]
        )

        del dataframe["site_latitude"]
        del dataframe["site_longitude"]

        dataframe = dataframe.replace({np.nan: None})

        if not_null_values:
            dataframe.dropna(subset=not_null_values, inplace=True)

        return dataframe.to_dict(orient="records")

    @classmethod
    @cache.memoize()
    def bigquery_mobile_device_measurements(
        cls, tenant, device_numbers: list, start_date_time, end_date_time
    ):
        query = (
            f"SELECT * "
            f"FROM {cls.BIGQUERY_MOBILE_EVENTS} "
            f"WHERE {cls.BIGQUERY_MOBILE_EVENTS}.tenant = '{tenant}' "
            f"AND {cls.BIGQUERY_MOBILE_EVENTS}.timestamp >= '{start_date_time}' "
            f"AND {cls.BIGQUERY_MOBILE_EVENTS}.timestamp <= '{end_date_time}' "
            f"AND {cls.BIGQUERY_MOBILE_EVENTS}.device_number IN UNNEST({device_numbers})"
        )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = bigquery.Client().query(query, job_config).result().to_dataframe()
        dataframe.sort_values(["timestamp"], ascending=True, inplace=True)
        print(len(dataframe))
        return dataframe.to_dict(orient="records")

    def remove_outliers(self, pollutant):
        return self.add_stages(
            [
                {
                    "$match": {
                        f"{pollutant}.value": {
                            "$gte": 0,
                            "$lte": self.limit_mapper[pollutant],
                        }
                    }
                }
            ]
        )

    @staticmethod
    def _format_pollutants(pollutants):
        range_format = {}
        group_format = {}

        for pollutant in pollutants:
            range_format[f"values.{pollutant}.value"] = 1
            group_format[pollutant] = {"$avg": f"${pollutant}"}

        return range_format, group_format

    @staticmethod
    def _project_pollutant_filter(pollutants):
        filtered = {}

        for pollutant in pollutants:
            filtered[pollutant] = {"$round": [f"${pollutant}", 2]}

        return filtered

    @cache.memoize()
    def get_downloadable_events(
        self, sites, start_date, end_date, frequency, pollutants
    ):
        time_format_mapper = {
            "raw": "%Y-%m-%dT%H:%M:%S%z",
            "hourly": "%Y-%m-%d %H:00",
            "daily": "%Y-%m-%d",
            "monthly": "%Y-%m-01",
        }
        range_format, group_format = self._format_pollutants(pollutants)

        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
            .project(
                **{"values.site_id": 1, "values.time": 1, "values.frequency": 1},
                **range_format,
            )
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .project(
                _id=0,
                time={
                    "$dateToString": {
                        "format": time_format_mapper.get(frequency)
                        or time_format_mapper.get("hourly"),
                        "date": "$time",
                        "timezone": "Africa/Kampala",
                    }
                },
                pm2_5="$pm2_5.value",
                pm10="$pm10.value",
                no2="$no2.value",
                frequency=1,
                site_id={"$toString": "$site_id"},
            )
            .match_in(site_id=sites)
            .group(
                _id={"site_id": "$site_id", "time": "$time"},
                time={"$first": "$time"},
                **group_format,
                site_id={"$first": "$site_id"},
            )
            .project(
                site_id={"$toObjectId": "$site_id"}, time=1, pm2_5=1, pm10=1, no2=1
            )
            .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
            .unwind("site")
            .sort(time=self.ASCENDING)
            .project(
                _id=0,
                time=1,
                **self._project_pollutant_filter(pollutants),
                frequency={"$literal": frequency},
                site_id={"$toString": "$site_id"},
                site_name="$site.name",
                site_description="$site.description",
                latitude="$site.latitude",
                longitude="$site.longitude",
            )
            .exec()
        )

    @cache.memoize()
    def get_averages_by_pollutant(self, start_date, end_date, pollutant):
        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .project(
                _id=0,
                **{f"{pollutant}": 1},
                site_id={"$toString": "$site_id"},
            )
            .remove_outliers(pollutant)
            .group(
                _id="$site_id",
                site_id={"$first": "$site_id"},
                value={"$avg": f"${pollutant}.value"},
            )
            .project(_id=0, site_id=1, value={"$round": "$value"})
            .exec()
        )

    @cache.memoize()
    def get_averages_by_pollutant_from_bigquery(self, start_date, end_date, pollutant):
        if pollutant not in ["pm2_5", "pm10", "no2", "pm1"]:
            raise Exception("Invalid pollutant")

        query = f"""
            SELECT AVG({pollutant}) as value, site_id 
            FROM {self.BIGQUERY_EVENTS}
            WHERE  {self.BIGQUERY_EVENTS}.timestamp >= '{start_date}'
            AND {self.BIGQUERY_EVENTS}.timestamp <= '{end_date}' GROUP BY site_id
        """

        client = bigquery.Client()
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = client.query(query, job_config).result().to_dataframe()
        dataframe["value"] = dataframe["value"].apply(lambda x: round(x, 2))
        return dataframe.to_dict("records")

    @cache.memoize()
    def get_chart_events(self, sites, start_date, end_date, pollutant, frequency):
        time_format_mapper = {
            "raw": "%Y-%m-%dT%H:%M:%S%z",
            "hourly": "%Y-%m-%d %H:00",
            "daily": "%Y-%m-%d",
            "monthly": "%Y-%m-01",
        }

        return (
            self.project(
                **{"values.time": 1, "values.site_id": 1, f"values.{pollutant}": 1}
            )
            .date_range("values.time", start_date=start_date, end_date=end_date)
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .project(
                _id=0,
                time={
                    "$dateToString": {
                        "format": time_format_mapper.get(frequency)
                        or time_format_mapper.get("hourly"),
                        "date": "$time",
                        "timezone": "Africa/Kampala",
                    }
                },
                **{f"{pollutant}.value": 1},
                site_id={"$toString": "$site_id"},
            )
            .remove_outliers(pollutant)
            .match_in(site_id=sites)
            .group(
                _id={"site_id": "$site_id", "time": "$time"},
                time={"$first": "$time"},
                value={"$avg": f"${pollutant}.value"},
            )
            .group(
                _id="$_id.site_id",
                values={
                    "$push": {
                        "time": "$time",
                        "value": {"$round": ["$value", 2]},
                    }
                },
            )
            .project(site_id={"$toObjectId": "$_id"}, values=1)
            .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
            .project(
                _id=1,
                site_id={"$toString": "$_id"},
                values=1,
                site={"name": 1, "description": 1, "generated_name": 1},
            )
            .unwind("site")
            .exec()
        )

    @cache.memoize()
    def get_d3_chart_events(self, sites, start_date, end_date, pollutant, frequency):
        diurnal_end_date = datetime.strptime(end_date, "%Y-%m-%dT%H:%M:%S.%fZ").replace(
            tzinfo=pytz.utc
        )
        now = datetime.now(pytz.utc)
        diurnal_end_date = diurnal_end_date if diurnal_end_date < now else now

        time_format_mapper = {
            "raw": "%Y-%m-%dT%H:%M:%S%z",
            "hourly": "%Y-%m-%dT%H:00:00%z",
            "daily": "%Y-%m-%dT00:00:00%z",
            "monthly": "%Y-%m-01T00:00:00%z",
            "diurnal": f'{diurnal_end_date.strftime("%Y-%m-%d")}T%H:00:00%z',
        }

        return (
            self.project(
                **{"values.time": 1, "values.site_id": 1, f"values.{pollutant}": 1}
            )
            .date_range("values.time", start_date=start_date, end_date=end_date)
            .match_in(**{"values.site_id": self.to_object_ids(sites)})
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .project(
                _id=0,
                time={
                    "$dateToString": {
                        "format": time_format_mapper.get(frequency)
                        or time_format_mapper.get("hourly"),
                        "date": "$time",
                        "timezone": "Africa/Kampala",
                    }
                },
                **{f"{pollutant}.value": 1},
                site_id={"$toString": "$site_id"},
            )
            .remove_outliers(pollutant)
            .group(
                _id={"site_id": "$site_id", "time": "$time"},
                time={"$first": "$time"},
                site_id={"$first": "$site_id"},
                value={"$avg": f"${pollutant}.value"},
            )
            .sort(time=self.ASCENDING)
            .project(_id=0, site_id={"$toObjectId": "$site_id"}, time=1, value=1)
            .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
            .project(
                _id=0,
                time=1,
                value={"$round": ["$value", 2]},
                site_id={"$toString": "$site_id"},
                name="$site.name",
                generated_name="$site.generated_name",
            )
            .unwind("name")
            .unwind("generated_name")
            .exec()
        )

    @cache.memoize()
    def get_d3_chart_events_v2(
        self, sites, start_date, end_date, pollutant, frequency, tenant
    ):
        if pollutant not in ["pm2_5", "pm10", "no2", "pm1"]:
            raise Exception("Invalid pollutant")

        columns = [
            "site_id",
            "name",
            "timestamp as time",
            "description as generated_name",
            f"{pollutant} as value",
        ]

        query = f"""
          SELECT {', '.join(map(str, columns))} 
          FROM {self.BIGQUERY_EVENTS}
          JOIN {self.BIGQUERY_SITES} ON {self.BIGQUERY_SITES}.id = {self.BIGQUERY_EVENTS}.site_id 
          WHERE  {self.BIGQUERY_EVENTS}.timestamp >= '{start_date}'
          AND {self.BIGQUERY_EVENTS}.timestamp <= '{end_date}'
          AND {self.BIGQUERY_EVENTS}.tenant = '{tenant}'
          AND `airqo-250220.metadata.sites`.id in UNNEST({sites})
        """

        client = bigquery.Client()
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = client.query(query, job_config).result().to_dataframe()
        dataframe["value"] = dataframe["value"].apply(lambda x: round(x, 2))
        site_groups = dataframe.groupby("site_id")

        data = []
        if frequency.lower() == "daily":
            resample_value = "24H"
        elif frequency.lower() == "monthly":
            resample_value = "720H"
        elif frequency.lower() == "hourly":
            resample_value = "1H"
        else:
            resample_value = "1H"

        for _, site_group in site_groups:
            values = site_group[["value", "time"]]
            ave_values = pd.DataFrame(values.resample(resample_value, on="time").mean())
            ave_values["time"] = ave_values.index
            ave_values["time"] = ave_values["time"].apply(date_to_str)
            ave_values = ave_values.reset_index(drop=True)

            ave_values["site_id"] = site_group.iloc[0]["site_id"]
            ave_values["generated_name"] = site_group.iloc[0]["generated_name"]
            ave_values["name"] = site_group.iloc[0]["name"]
            ave_values = ave_values.fillna(0)

            data.extend(ave_values.to_dict(orient="records"))

        return data

    def get_events(self, sites, start_date, end_date, frequency):
        time_format_mapper = {
            "raw": "%Y-%m-%dT%H:%M:%S%z",
            "hourly": "%Y-%m-%d %H:00",
            "daily": "%Y-%m-%d",
            "monthly": "%Y-%m-01",
        }

        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .lookup("sites", local_field="site_id", foreign_field="_id", col_as="sites")
            .project(
                _id=0,
                time={
                    "$dateToString": {
                        "format": time_format_mapper.get(frequency)
                        or time_format_mapper.get("hourly"),
                        "date": "$time",
                        "timezone": "Africa/Kampala",
                    }
                },
                **{"pm2_5.value": 1},
                **{"pm10.value": 1},
                **{"no2.value": 1},
                frequency=1,
                site_id={"$toString": "$site_id"},
                sites={"name": 1, "description": 1, "generated_name": 1},
            )
            .match_in(site_id=sites)
            .group(
                _id={"site_id": "$site_id", "time": "$time"},
                frequency={"$first": "$frequency"},
                pm2_5={"$avg": "$pm2_5.value"},
                pm10={"$avg": "$pm10.value"},
                no2={"$avg": "$no2.value"},
                sites={"$first": "$sites"},
            )
            .sort(**{"_id.time": 1})
            .exec()
        )
