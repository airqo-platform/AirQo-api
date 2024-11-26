from datetime import datetime

import numpy as np
import pandas as pd
import pytz
from google.cloud import bigquery

from api.models.base.base_model import BasePyMongoModel
from api.utils.dates import date_to_str
from api.utils.pollutants.pm_25 import (
    BIGQUERY_FREQUENCY_MAPPER,
    WEATHER_FIELDS_MAPPER,
)
from main import cache, CONFIGURATIONS


class EventsModel(BasePyMongoModel):
    """
    This class manages data retrieval and query construction for events data, integrating device, site,
    and airqloud information for specified pollutants and weather fields.
    """

    BIGQUERY_AIRQLOUDS_SITES = f"`{CONFIGURATIONS.BIGQUERY_AIRQLOUDS_SITES}`"
    BIGQUERY_AIRQLOUDS = f"`{CONFIGURATIONS.BIGQUERY_AIRQLOUDS}`"
    BIGQUERY_GRIDS = f"`{CONFIGURATIONS.BIGQUERY_GRIDS}`"
    BIGQUERY_GRIDS_SITES = f"`{CONFIGURATIONS.BIGQUERY_GRIDS_SITES}`"
    BIGQUERY_COHORTS = f"`{CONFIGURATIONS.BIGQUERY_COHORTS}`"
    BIGQUERY_COHORTS_DEVICES = f"`{CONFIGURATIONS.BIGQUERY_COHORTS_DEVICES}`"
    BIGQUERY_SITES = f"`{CONFIGURATIONS.BIGQUERY_SITES}`"
    BIGQUERY_DEVICES = f"`{CONFIGURATIONS.BIGQUERY_DEVICES}`"
    DATA_EXPORT_DECIMAL_PLACES = CONFIGURATIONS.DATA_EXPORT_DECIMAL_PLACES

    BIGQUERY_EVENTS = CONFIGURATIONS.BIGQUERY_EVENTS
    DATA_EXPORT_LIMIT = CONFIGURATIONS.DATA_EXPORT_LIMIT
    BIGQUERY_MOBILE_EVENTS = CONFIGURATIONS.BIGQUERY_MOBILE_EVENTS

    BIGQUERY_RAW_DATA = f"`{CONFIGURATIONS.BIGQUERY_RAW_DATA}`"
    BIGQUERY_HOURLY_DATA = f"`{CONFIGURATIONS.BIGQUERY_HOURLY_DATA}`"
    BIGQUERY_BAM_DATA = f"`{CONFIGURATIONS.BIGQUERY_BAM_DATA}`"
    BIGQUERY_DAILY_DATA = f"`{CONFIGURATIONS.BIGQUERY_DAILY_DATA}`"

    DEVICES_SUMMARY_TABLE = CONFIGURATIONS.DEVICES_SUMMARY_TABLE

    def __init__(self, tenant):
        """
        Initializes the EventsModel with default settings and mappings for limit thresholds,
        and specifies collections and BigQuery table references.

        Args:
            tenant (str): The tenant identifier for managing database collections.
        """
        self.limit_mapper = {"pm2_5": 500.5, "pm10": 604.5, "no2": 2049}
        self.sites_table = self.BIGQUERY_SITES
        self.airqlouds_sites_table = self.BIGQUERY_AIRQLOUDS_SITES
        self.devices_table = self.BIGQUERY_DEVICES
        self.airqlouds_table = self.BIGQUERY_AIRQLOUDS
        super().__init__(tenant, collection_name="events")

    @property
    def device_info_query(self):
        """Generates a device information query including site_id, tenant, and approximate location details."""
        return (
            f"{self.devices_table}.site_id AS site_id, "
            f"{self.devices_table}.tenant AS tenant "
        )

    @property
    def device_info_query_airqloud(self):
        """Generates a device information query specifically for airqlouds, excluding the site_id."""
        return f"{self.devices_table}.tenant AS tenant "

    @property
    def site_info_query(self):
        """Generates a site information query to retrieve site name and approximate location details."""
        return f"{self.sites_table}.name AS site_name "

    @property
    def airqloud_info_query(self):
        """Generates an Airqloud information query to retrieve the airqloud name."""
        return f"{self.airqlouds_table}.name AS airqloud_name"

    def add_device_join(self, data_query, filter_clause=""):
        """
        Joins device information with a given data query based on device_name.

        Args:
            data_query (str): The data query to join with device information.
            filter_clause (str): Optional SQL filter clause.

        Returns:
            str: Modified query with device join.
        """
        return (
            f"SELECT {self.device_info_query}, data.* "
            f"FROM {self.devices_table} "
            f"RIGHT JOIN ({data_query}) data ON data.device_name = {self.devices_table}.device_id "
            f"{filter_clause}"
        )

    def add_device_join_to_airqlouds(self, data_query, filter_clause=""):
        """
        Joins device information with airqloud data based on site_id.

        Args:
            data_query (str): The data query to join with airqloud device information.
            filter_clause (str): Optional SQL filter clause.

        Returns:
            str: Modified query with device-airqloud join.
        """
        return (
            f"SELECT {self.device_info_query_airqloud}, data.* "
            f"FROM {self.devices_table} "
            f"RIGHT JOIN ({data_query}) data ON data.site_id = {self.devices_table}.site_id "
            f"{filter_clause}"
        )

    def add_site_join(self, data_query):
        """
        Joins site information with the given data query based on site_id.

        Args:
            data_query (str): The data query to join with site information.

        Returns:
            str: Modified query with site join.
        """
        return (
            f"SELECT {self.site_info_query}, data.* "
            f"FROM {self.sites_table} "
            f"RIGHT JOIN ({data_query}) data ON data.site_id = {self.sites_table}.id "
        )

    def add_airqloud_join(self, data_query):
        """
        Joins Airqloud information with the provided data query based on airqloud_id.

        Args:
            data_query (str): The data query to join with Airqloud information.

        Returns:
            str: Modified query with Airqloud join.
        """
        return (
            f"SELECT {self.airqloud_info_query}, data.* "
            f"FROM {self.airqlouds_table} "
            f"RIGHT JOIN ({data_query}) data ON data.airqloud_id = {self.airqlouds_table}.id "
        )

    def get_time_grouping(self, frequency):
        """
        Determines the appropriate time grouping fields based on the frequency.

        Args:
            frequency (str): Frequency like 'raw', 'daily', 'hourly', 'weekly', etc.

        Returns:
            str: The time grouping clause for the SQL query.
        """
        grouping_map = {
            "weekly": "TIMESTAMP_TRUNC(timestamp, WEEK(MONDAY)) AS week",
            "monthly": "TIMESTAMP_TRUNC(timestamp, MONTH) AS month",
            "yearly": "EXTRACT(YEAR FROM timestamp) AS year",
        }

        return grouping_map.get(frequency, "timestamp")

    def get_device_query(
        self,
        data_table,
        filter_value,
        pollutants_query,
        bam_pollutants_query,
        time_grouping,
        start_date,
        end_date,
        frequency,
    ):
        """
        Constructs a SQL query to retrieve data for specific devices.

        Args:
            data_table (str): The name of the data table containing measurements.
            filter_value (str): The list of device IDs to filter by.
            pollutants_query (str): The SQL query for standard pollutants.
            bam_pollutants_query (str): The SQL query for BAM pollutants.
            time_grouping (str): The time grouping clause based on frequency.
            start_date (str): The start date for the query range.
            end_date (str): The end date for the query range.
            frequency (str): The frequency of the data (e.g., 'raw', 'daily', 'weekly').

        Returns:
            str: The SQL query string to retrieve device-specific data,
                including BAM data if applicable.
        """
        query = (
            f"{pollutants_query}, {time_grouping}, {self.device_info_query}, {self.devices_table}.name AS device_name "
            f"FROM {data_table} "
            f"JOIN {self.devices_table} ON {self.devices_table}.device_id = {data_table}.device_id "
            f"WHERE {data_table}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {self.devices_table}.device_id IN UNNEST(@filter_value) "
        )
        if frequency in ["weekly", "monthly", "yearly"]:
            query += " GROUP BY ALL"

        query = self.add_site_join(query)
        if frequency in ["hourly", "weekly", "monthly", "yearly"]:
            bam_query = (
                f"{bam_pollutants_query}, {time_grouping}, {self.device_info_query}, {self.devices_table}.name AS device_name "
                f"FROM {self.BIGQUERY_BAM_DATA} "
                f"JOIN {self.devices_table} ON {self.devices_table}.device_id = {self.BIGQUERY_BAM_DATA}.device_id "
                f"WHERE {self.BIGQUERY_BAM_DATA}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
                f"AND {self.devices_table}.device_id IN UNNEST(@filter_value) "
            )
            if frequency in ["weekly", "monthly", "yearly"]:
                bam_query += " GROUP BY ALL"
            bam_query = self.add_site_join(bam_query)
            query = f"{query} UNION ALL {bam_query}"

        return query

    def get_site_query(
        self,
        data_table,
        filter_value,
        pollutants_query,
        time_grouping,
        start_date,
        end_date,
        frequency,
    ):
        """
        Constructs a SQL query to retrieve data for specific sites.

        Args:
            data_table (str): The name of the data table containing measurements.
            filter_value (str): The list of site IDs to filter by.
            pollutants_query (str): The SQL query for pollutants.
            time_grouping (str): The time grouping clause based on frequency.
            start_date (str): The start date for the query range.
            end_date (str): The end date for the query range.
            frequency (str): The frequency of the data (e.g., 'raw', 'daily', 'weekly').

        Returns:
            str: The SQL query string to retrieve site-specific data.
        """
        query = (
            f"{pollutants_query}, {time_grouping}, {self.site_info_query}, {data_table}.device_id AS device_name "
            f"FROM {data_table} "
            f"JOIN {self.sites_table} ON {self.sites_table}.id = {data_table}.site_id "
            f"WHERE {data_table}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {self.sites_table}.id IN UNNEST(@filter_value) "
        )
        if frequency in ["weekly", "monthly", "yearly"]:
            query += " GROUP BY ALL"
        return self.add_device_join(query)

    def get_airqloud_query(
        self,
        data_table,
        filter_value,
        pollutants_query,
        time_grouping,
        start_date,
        end_date,
        frequency,
    ):
        """
        Constructs a SQL query to retrieve data for specific AirQlouds.

        Args:
            data_table (str): The name of the data table containing measurements.
            filter_value (str): The list of AirQloud IDs to filter by.
            pollutants_query (str): The SQL query for pollutants.
            time_grouping (str): The time grouping clause based on frequency.
            start_date (str): The start date for the query range.
            end_date (str): The end date for the query range.
            frequency (str): The frequency of the data (e.g., 'raw', 'daily', 'weekly').

        Returns:
            str: The SQL query string to retrieve AirQloud-specific data.
        """
        meta_data_query = (
            f"SELECT {self.airqlouds_sites_table}.airqloud_id, "
            f"{self.airqlouds_sites_table}.site_id AS site_id "
            f"FROM {self.airqlouds_sites_table} "
            f"WHERE {self.airqlouds_sites_table}.airqloud_id IN UNNEST(@filter_value) "
        )
        meta_data_query = self.add_airqloud_join(meta_data_query)
        meta_data_query = self.add_site_join(meta_data_query)
        meta_data_query = self.add_device_join_to_airqlouds(meta_data_query)

        query = (
            f"{pollutants_query}, {time_grouping}, {data_table}.device_id AS device_name, meta_data.* "
            f"FROM {data_table} "
            f"RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
            f"WHERE {data_table}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
        )
        order_by_clause = (
            f"ORDER BY {data_table}.timestamp"
            if frequency not in ["weekly", "monthly", "yearly"]
            else "GROUP BY ALL"
        )

        return query + order_by_clause

    def build_query(
        self,
        data_table,
        filter_type,
        filter_value,
        pollutants_query,
        bam_pollutants_query,
        start_date,
        end_date,
        frequency=None,
    ):
        """
        Builds a SQL query to retrieve pollutant and weather data with associated device or site information.

        Args:
            data_table (str): The table name containing the main data records.
            filter_type (str): Type of filter (e.g., devices, sites, airqlouds).
            filter_value (list): Filter values corresponding to the filter type.
            pollutants_query (str): Query for pollutant data.
            bam_pollutants_query (str): Query for BAM pollutant data.
            start_date (str): Start date for data retrieval.
            end_date (str): End date for data retrieval.
            frequency (str): Optional frequency filter.

        Returns:
            str: Final constructed SQL query.
        """
        time_grouping = self.get_time_grouping(frequency)

        # TODO Find a better way to do this.
        if frequency in ["weekly", "monthly", "yearly"]:
            # Drop datetime alias
            pollutants_query = pollutants_query.replace(
                f", FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {data_table}.timestamp) AS datetime",
                "",
            )
            bam_pollutants_query = bam_pollutants_query.replace(
                f", FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {self.BIGQUERY_BAM_DATA}.timestamp) AS datetime",
                "",
            )

        if filter_type in ["devices", "device_ids", "device_names"]:
            return self.get_device_query(
                data_table,
                filter_value,
                pollutants_query,
                bam_pollutants_query,
                time_grouping,
                start_date,
                end_date,
                frequency,
            )
        elif filter_type in ["sites", "site_names", "site_ids"]:
            return self.get_site_query(
                data_table,
                filter_value,
                pollutants_query,
                time_grouping,
                start_date,
                end_date,
                frequency,
            )
        elif filter_type == "airqlouds":
            return self.get_airqloud_query(
                data_table,
                filter_value,
                pollutants_query,
                time_grouping,
                start_date,
                end_date,
                frequency,
            )
        else:
            raise ValueError("Invalid filter type")

    def get_columns(cls, mapping, frequency, data_type, decimal_places, data_table):
        if frequency in ["weekly", "monthly", "yearly"]:
            return [
                f"ROUND(AVG({data_table}.{col}), {decimal_places}) AS {col}"
                for col in mapping
            ]
        return [
            f"ROUND({data_table}.{col}, {decimal_places}) AS {col}" for col in mapping
        ]

    @classmethod
    @cache.memoize()
    def download_from_bigquery(
        cls,
        filter_type,  # Either 'devices', 'sites', or 'airqlouds'
        filter_value,  # The actual list of values for the filter type
        start_date,
        end_date,
        frequency,
        pollutants,
        data_type,
        weather_fields,
    ) -> pd.DataFrame:
        """
        Retrieves data from BigQuery with specified filters, frequency, pollutants, and weather fields.

        Args:
            filter_type (str): Type of filter to apply (e.g., 'devices', 'sites', 'airqlouds').
            filter_value (list): Filter values (IDs or names) for the selected filter type.
            start_date (str): Start date for the data query.
            end_date (str): End date for the data query.
            frequency (str): Data frequency (e.g., 'raw', 'daily', 'hourly').
            pollutants (list): List of pollutants to include in the data.
            data_type (str): Type of data ('raw' or 'aggregated').
            weather_fields (list): List of weather fields to retrieve.

        Returns:
            pd.DataFrame: Retrieved data in DataFrame format, with duplicates removed and sorted by timestamp.
        """
        decimal_places = cls.DATA_EXPORT_DECIMAL_PLACES

        sorting_cols = ["site_id", "device_name"]

        data_table = {
            "raw": cls.BIGQUERY_RAW_DATA,
            "daily": cls.BIGQUERY_DAILY_DATA,
            "hourly": cls.BIGQUERY_HOURLY_DATA,
        }.get(
            frequency, cls.BIGQUERY_HOURLY_DATA
        )  # Return hourly if the frequency is weekly, monthly yearly. Validation of frequency is done in data.py

        if not data_table:
            raise ValueError("Invalid frequency")

        pollutant_columns = []
        bam_pollutant_columns = []
        weather_columns = []
        for pollutant in pollutants:

            if pollutant == "raw":
                key = pollutant
            else:
                key = f"{pollutant}_{data_type}"

            pollutant_mapping = BIGQUERY_FREQUENCY_MAPPER.get(frequency, {}).get(
                key, []
            )
            pollutant_columns.extend(
                cls.get_columns(
                    cls,
                    pollutant_mapping,
                    frequency,
                    data_type,
                    decimal_places,
                    data_table,
                )
            )

            # TODO Clean up by use using `get_columns` helper method
            if pollutant in {"pm2_5", "pm10", "no2"}:
                if frequency in ["weekly", "monthly", "yearly"]:
                    bam_pollutant_columns.extend(
                        [f"ROUND(AVG({pollutant}), {decimal_places}) AS {key}_value"]
                    )
                else:
                    bam_pollutant_columns.extend(
                        [f"ROUND({pollutant}, {decimal_places}) AS {key}_value"]
                    )
        # TODO Fix query when weather data is included. Currently failing
        if weather_fields:
            for field in weather_fields:
                weather_mapping = WEATHER_FIELDS_MAPPER.get(field)
                if weather_mapping:
                    weather_columns.extend(
                        cls.get_columns(
                            cls,
                            weather_mapping,
                            frequency,
                            data_type,
                            decimal_places,
                            data_table,
                        )
                    )

        selected_columns = set(pollutant_columns + weather_columns)
        pollutants_query = (
            "SELECT "
            + (", ".join(selected_columns) + ", " if selected_columns else "")
            + f"FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {data_table}.timestamp) AS datetime "
        )

        bam_selected_columns = set(bam_pollutant_columns)
        bam_pollutants_query = (
            "SELECT "
            + (", ".join(bam_selected_columns) + ", " if bam_selected_columns else "")
            + f"FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {cls.BIGQUERY_BAM_DATA}.timestamp) AS datetime "
        )

        instance = cls("build_query")
        query = instance.build_query(
            data_table,
            filter_type,
            filter_value,
            pollutants_query,
            bam_pollutants_query,
            start_date,
            end_date,
            frequency=frequency,
        )

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ArrayQueryParameter("filter_value", "STRING", filter_value),
            ]
        )
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

        drop_columns = ["device_name"]
        if frequency in ["weekly", "monthly", "yearly"]:
            drop_columns.append(frequency[:-2])
            sorting_cols.append(frequency[:-2])
        else:
            drop_columns.append("datetime")
            sorting_cols.append("datetime")

        dataframe.drop_duplicates(subset=drop_columns, inplace=True, keep="first")
        dataframe.sort_values(sorting_cols, ascending=True, inplace=True)
        dataframe["frequency"] = frequency
        dataframe = dataframe.replace(np.nan, None)
        return dataframe

    @classmethod
    def data_export_query(
        cls,
        devices,
        sites,
        airqlouds,
        start_date,
        end_date,
        frequency,
        pollutants,
    ) -> str:
        decimal_places = cls.DATA_EXPORT_DECIMAL_PLACES

        # Data sources
        sites_table = cls.BIGQUERY_SITES
        airqlouds_sites_table = cls.BIGQUERY_AIRQLOUDS_SITES
        devices_table = cls.BIGQUERY_DEVICES
        airqlouds_table = cls.BIGQUERY_AIRQLOUDS

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
                f" ORDER BY {data_table}.timestamp "
            )

        return f"select distinct * from ({query})"

    @classmethod
    def get_devices_hourly_data(
        cls,
        day: datetime,
    ) -> pd.DataFrame:
        hourly_data_table = cls.BIGQUERY_HOURLY_DATA

        query = (
            f" SELECT {hourly_data_table}.pm2_5_calibrated_value , "
            f" {hourly_data_table}.pm2_5_raw_value ,"
            f" {hourly_data_table}.site_id ,"
            f" {hourly_data_table}.device_id AS device ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {hourly_data_table}.timestamp) AS timestamp ,"
            f" FROM {hourly_data_table} "
            f" WHERE DATE({hourly_data_table}.timestamp) = '{day.strftime('%Y-%m-%d')}' "
            f" AND {hourly_data_table}.pm2_5_raw_value is not null "
        )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = (
            bigquery.Client()
            .query(f"select distinct * from ({query})", job_config)
            .result()
            .to_dataframe()
        )

        return dataframe

    @classmethod
    def save_devices_summary_data(
        cls,
        data: pd.DataFrame,
    ):
        schema = [
            bigquery.SchemaField("device", "STRING"),
            bigquery.SchemaField("site_id", "STRING"),
            bigquery.SchemaField("timestamp", "TIMESTAMP"),
            bigquery.SchemaField("uncalibrated_records", "INTEGER"),
            bigquery.SchemaField("calibrated_records", "INTEGER"),
            bigquery.SchemaField("hourly_records", "INTEGER"),
            bigquery.SchemaField("calibrated_percentage", "FLOAT"),
            bigquery.SchemaField("uncalibrated_percentage", "FLOAT"),
        ]

        job_config = bigquery.LoadJobConfig(schema=schema)
        job = bigquery.Client().load_table_from_dataframe(
            dataframe=data,
            destination=cls.DEVICES_SUMMARY_TABLE,
            job_config=job_config,
        )
        job.result()

    @classmethod
    @cache.memoize()
    def get_devices_summary(
        cls, airqloud, start_date_time, end_date_time, grid: str, cohort: str
    ) -> list:
        data_table = f"`{cls.DEVICES_SUMMARY_TABLE}`"

        # Data sources
        sites_table = cls.BIGQUERY_SITES
        airqlouds_sites_table = cls.BIGQUERY_AIRQLOUDS_SITES
        airqlouds_table = cls.BIGQUERY_AIRQLOUDS
        grids_table = cls.BIGQUERY_GRIDS
        grids_sites_table = cls.BIGQUERY_GRIDS_SITES
        cohorts_devices_table = cls.BIGQUERY_COHORTS_DEVICES
        cohorts_table = cls.BIGQUERY_COHORTS
        devices_table = cls.BIGQUERY_DEVICES

        data_query = (
            f" SELECT {data_table}.device ,  "
            f" SUM({data_table}.uncalibrated_records) as uncalibrated_records , "
            f" SUM({data_table}.calibrated_records) as calibrated_records , "
            f" SUM({data_table}.hourly_records) as hourly_records , "
            f" (SUM({data_table}.calibrated_records) / SUM({data_table}.hourly_records)) * 100 as calibrated_percentage , "
            f" (SUM({data_table}.uncalibrated_records) / SUM({data_table}.hourly_records)) * 100 as uncalibrated_percentage "
        )

        if airqloud.strip() != "":
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
                f" {sites_table}.name AS site_name , "
                f" meta_data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
            )

            query = (
                f" {data_query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date_time}' "
                f" AND {data_table}.timestamp <= '{end_date_time}' "
                f" GROUP BY {data_table}.device, "
                f" meta_data.site_id, meta_data.airqloud_id, meta_data.site_name, meta_data.airqloud"
            )

        elif grid.strip() != "":
            meta_data_query = (
                f" SELECT {grids_sites_table}.grid_id , "
                f" {grids_sites_table}.site_id , "
                f" FROM {grids_sites_table} "
                f" WHERE {grids_sites_table}.grid_id = '{grid}' "
            )

            meta_data_query = (
                f" SELECT "
                f" {grids_table}.name AS grid, "
                f" meta_data.* "
                f" FROM {grids_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.grid_id = {grids_table}.id "
            )

            meta_data_query = (
                f" SELECT "
                f" {sites_table}.name  AS site_name , "
                f" meta_data.* "
                f" FROM {sites_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
            )

            query = (
                f" {data_query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date_time}' "
                f" AND {data_table}.timestamp <= '{end_date_time}' "
                f" GROUP BY {data_table}.device, "
                f" meta_data.site_id, meta_data.grid_id, meta_data.site_name, meta_data.grid"
            )

        elif cohort.strip() != "":
            meta_data_query = (
                f" SELECT {cohorts_devices_table}.cohort_id , "
                f" {cohorts_devices_table}.device_id , "
                f" FROM {cohorts_devices_table} "
                f" WHERE {cohorts_devices_table}.cohort_id = '{cohort}' "
            )

            meta_data_query = (
                f" SELECT "
                f" {cohorts_table}.name AS cohort, "
                f" meta_data.* "
                f" FROM {cohorts_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.cohort_id = {cohorts_table}.id "
            )

            meta_data_query = (
                f" SELECT "
                f" {devices_table}.name  AS device_name , "
                f" meta_data.* "
                f" FROM {devices_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.device_id = {devices_table}.device_id "
            )

            query = (
                f" {data_query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.device_id = {data_table}.device"
                f" WHERE {data_table}.timestamp >= '{start_date_time}' "
                f" AND {data_table}.timestamp <= '{end_date_time}' "
                f" GROUP BY {data_table}.device, "
                f" meta_data.device_id, meta_data.cohort_id, meta_data.device_name, meta_data.cohort"
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
    def get_device_averages_from_bigquery(
        self, start_date, end_date, pollutant, devices
    ):
        if pollutant not in ["pm2_5", "pm10", "no2", "pm1"]:
            raise Exception("Invalid pollutant")

        query = f"""
            SELECT AVG({pollutant}) as value, device_id 
            FROM {self.BIGQUERY_EVENTS}
            WHERE  {self.BIGQUERY_EVENTS}.timestamp >= '{start_date}'
            AND {self.BIGQUERY_EVENTS}.timestamp <= '{end_date}'
            AND {self.BIGQUERY_EVENTS}.device_id IN UNNEST({devices}) GROUP BY device_id
        """

        client = bigquery.Client()
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = client.query(query, job_config).result().to_dataframe()
        dataframe["value"] = dataframe["value"].apply(lambda x: round(x, 2))
        return dataframe.to_dict("records")

    @cache.memoize()
    def get_device_readings_from_bigquery(
        self, start_date, end_date, pollutant, devices
    ):
        if pollutant not in ["pm2_5", "pm10", "no2", "pm1"]:
            raise Exception("Invalid pollutant")

        query = f"""
        SELECT 
    AVG({pollutant}) as {pollutant},
    device_id,
    TIMESTAMP(DATE(timestamp), "UTC") as timestamp
    FROM {self.BIGQUERY_EVENTS}
    WHERE {self.BIGQUERY_EVENTS}.timestamp >= '{start_date}'
    AND {self.BIGQUERY_EVENTS}.timestamp <= '{end_date}'
    AND {self.BIGQUERY_EVENTS}.device_id IN UNNEST({devices})
    GROUP BY device_id, timestamp
    ORDER BY device_id, timestamp;
        """
        client = bigquery.Client()
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = client.query(query, job_config).result().to_dataframe()
        dataframe[f"{pollutant}"] = dataframe[f"{pollutant}"].apply(
            lambda x: round(x, 2)
        )

        return dataframe

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
