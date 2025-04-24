from typing import List, Dict, Any, Optional, Union, Tuple
from constants import QueryType, DeviceNetwork, ColumnDataType, Frequency, DataType
from api.utils.utils import Utils
import pandas as pd
from google.cloud import bigquery
from config import BaseConfig as Config
from api.utils.pollutants.pm_25 import (
    BQ_FREQUENCY_MAPPER,
)

from main import cache

import logging

logger = logging.getLogger(__name__)


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.schema_mapping = Config.SCHEMA_FILE_MAPPING
        self.sites_table = Utils.table_name(Config.BIGQUERY_SITES_SITES)
        self.airqlouds_sites_table = Utils.table_name(Config.BIGQUERY_AIRQLOUDS_SITES)
        self.devices_table = Utils.table_name(Config.BIGQUERY_DEVICES_DEVICES)
        self.airqlouds_table = Utils.table_name(Config.BIGQUERY_AIRQLOUDS)
        self.all_time_grouping = {"hourly", "daily", "weekly", "monthly", "yearly"}
        self.extra_time_grouping = {"weekly", "monthly", "yearly"}

    @property
    def device_info_query(self):
        """Generates a device information query including site_id, network, and approximate location details."""
        return (
            f"{self.devices_table}.site_id AS site_id, "
            f"{self.devices_table}.network AS network "
        )

    @property
    def device_info_query_airqloud(self):
        """Generates a device information query specifically for airqlouds, excluding the site_id."""
        return f"{self.devices_table}.network AS network "

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
            data_query(str): The data query to join with device information.
            filter_clause(str): Optional SQL filter clause.

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
            data_query(str): The data query to join with airqloud device information.
            filter_clause(str): Optional SQL filter clause.

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
            data_query(str): The data query to join with site information.

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
            data_query(str): The data query to join with Airqloud information.

        Returns:
            str: Modified query with Airqloud join.
        """
        return (
            f"SELECT {self.airqloud_info_query}, data.* "
            f"FROM {self.airqlouds_table} "
            f"RIGHT JOIN ({data_query}) data ON data.airqloud_id = {self.airqlouds_table}.id "
        )

    def get_time_grouping(self, frequency: str):
        """
        Determines the appropriate time grouping fields based on the frequency.

        Args:
            frequency(str): Frequency like 'raw', 'daily', 'hourly', 'weekly', etc.

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
        table: str,
        filter_value: List,
        pollutants_query: str,
        bam_pollutants_query: str,
        time_grouping: str,
        start_date: str,
        end_date: str,
        frequency: Frequency,
    ):
        """
        Constructs a SQL query to retrieve pollutant data for specific devices,
        including standard and BAM measurements when applicable.

        Args:
            table (str): Name of the table containing the primary device measurements.
            filter_value (str): List of device IDs to filter the query (used in UNNEST).
            pollutants_query (str): SQL fragment for selecting standard pollutants.
            bam_pollutants_query (str): SQL fragment for selecting BAM pollutants.
            time_grouping (str): SQL expression for time-based grouping (e.g., by hour, day).
            start_date (str): Start timestamp (inclusive) for filtering data.
            end_date (str): End timestamp (inclusive) for filtering data.
            frequency (Any): Frequency of aggregation (e.g., 'raw', 'hourly', 'daily').

        Returns:
            str: The fully constructed SQL query, combining standard and BAM data if required.
        """
        table_name = Utils.table_name(table)
        query = (
            f"{pollutants_query}, {time_grouping}, {self.device_info_query}, {self.devices_table}.name AS device_name "
            f"FROM {table_name} "
            f"JOIN {self.devices_table} ON {self.devices_table}.device_id = {table_name}.device_id "
            f"WHERE {table_name}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {self.devices_table}.device_id IN UNNEST(@filter_value) "
        )
        if frequency.value in self.extra_time_grouping:
            query += " GROUP BY ALL"

        query = self.add_site_join(query)

        # This query skips BAM sensor daily measurements since there is no daily measurements table for bam.
        # TODO Add/update query to consider bam measurements.
        if frequency.value in self.extra_time_grouping | {"hourly"}:
            bam_table_name = Utils.table_name(Config.BIGQUERY_BAM_DATA)
            bam_query = (
                f"{bam_pollutants_query}, {time_grouping}, {self.device_info_query}, {self.devices_table}.name AS device_name "
                f"FROM {bam_table_name} "
                f"JOIN {self.devices_table} ON {self.devices_table}.device_id = {bam_table_name}.device_id "
                f"WHERE {bam_table_name}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
                f"AND {self.devices_table}.device_id IN UNNEST(@filter_value) "
            )
            if frequency.value in self.extra_time_grouping:
                bam_query += " GROUP BY ALL"
            bam_query = self.add_site_join(bam_query)
            query = f"{query} UNION ALL {bam_query}"
        return query

    def get_site_query(
        self,
        table: str,
        filter_value: List,
        pollutants_query: str,
        time_grouping: str,
        start_date: str,
        end_date: str,
        frequency: Frequency,
    ):
        """
        Constructs a SQL query to retrieve data for specific sites.

        Args:
            table(str): The name of the data table containing measurements.
            filter_value(str): The list of site IDs to filter by.
            pollutants_query(str): The SQL query for pollutants.
            time_grouping(str): The time grouping clause based on frequency.
            start_date(str): The start date for the query range.
            end_date(str): The end date for the query range.
            frequency(Frequency): The frequency of the data (e.g., Frequency.RAW, Frequency.HOURLY).

        Returns:
            str: The SQL query string to retrieve site-specific data.
        """
        table = Utils.table_name(table)
        query = (
            f"{pollutants_query}, {time_grouping}, {self.site_info_query}, {table}.device_id AS device_name "
            f"FROM {table} "
            f"JOIN {self.sites_table} ON {self.sites_table}.id = {table}.site_id "
            f"WHERE {table}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {self.sites_table}.id IN UNNEST(@filter_value) "
        )
        if frequency.value in self.extra_time_grouping:
            query += " GROUP BY ALL"
        return self.add_device_join(query)

    def get_airqloud_query(
        self,
        table: str,
        filter_value: List,
        pollutants_query: str,
        time_grouping: str,
        start_date: str,
        end_date: str,
        frequency: Frequency,
    ):
        """
        Constructs a SQL query to retrieve data for specific AirQlouds.

        Args:
            table (str): The name of the data table containing measurements.
            filter_value(list): The list of AirQloud IDs to filter by.
            pollutants_query(str): The SQL query for pollutants.
            time_grouping(str): The time grouping clause based on frequency.
            start_date(str): The start date for the query range.
            end_date(str): The end date for the query range.
            frequency(Frequency): The frequency of the data (e.g., 'raw', 'daily', 'weekly').

        Returns:
            str: The SQL query string to retrieve AirQloud-specific data.
        """
        table = Utils.table_name(table)
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
            f"{pollutants_query}, {time_grouping}, {table}.device_id AS device_name, meta_data.* "
            f"FROM {table} "
            f"RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {table}.site_id "
            f"WHERE {table}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
        )
        order_by_clause = (
            f"ORDER BY {table}.timestamp"
            if frequency.value not in self.extra_time_grouping
            else "GROUP BY ALL"
        )

        return query + order_by_clause

    def compose_query(
        self,
        query_type: QueryType,
        table: str,
        start_date_time: str,
        end_date_time: str,
        network: Optional[DeviceNetwork] = None,
        where_fields: Optional[Dict[str, Union[str, int, Tuple]]] = None,
        columns: Optional[List] = None,
        exclude_columns: Optional[List] = None,
    ) -> str:
        """
        Composes a SQL query for BigQuery based on the query type (GET or DELETE),
        and optionally includes a dynamic selection and aggregation of numeric columns.

        Args:
            query_type (QueryType): The type of query (GET or DELETE).
            table (str): The BigQuery table to query.
            start_date_time (str): The start datetime for filtering records.
            end_date_time (str): The end datetime for filtering records.
            network (DeviceNetwork, optional): The network or ownership information (e.g., to filter data).
            where_fields (dict, optional):  Dictionary of fields to filter on i.e {"device_id":("aq_001", "aq_002")}.
            columns (list, optional):  List of columns to select. If None, selects all.
            exclude_columns (list, optional): List of columns to exclude from aggregation if dynamically selecting numeric columns.

        Returns:
            str: The composed SQL query as a string.

        Raises:
            Exception: If an invalid column is provided in `where_fields` or `null_cols`,
                      or if the `query_type` is not supported.
        """
        exclude_columns: List = []

        where_fields = {} if where_fields is None else where_fields

        columns = ", ".join(map(str, columns)) if columns else " * "
        where_clause = f" timestamp between '{start_date_time}' and '{end_date_time}' "

        if network:
            where_clause += f"AND network = '{network.value}' "

        valid_cols = self.get_columns(table=table)
        for key, value in where_fields.items():

            if key not in valid_cols:
                raise Exception(
                    f"Invalid table column. {key} is not among the columns for {table}"
                )

            if key in exclude_columns:
                continue

            if isinstance(value, (str, int)):
                where_clause += f" AND {key} = '{value}' "

            elif isinstance(value, list):
                where_clause += f" AND {key} in UNNEST({value}) "

        if query_type == QueryType.GET:
            query = f""" SELECT {columns} FROM `{table}` WHERE {where_clause} """
        else:
            raise Exception(f"Invalid Query Type {str(query_type)}")

        return query

    def query_data(
        self,
        table: str,
        start_date_time: str,
        end_date_time: str,
        network: Optional[DeviceNetwork] = None,
        frequency: Optional[Frequency] = None,
        data_type: Optional[str] = None,
        columns: Optional[List] = None,
        where_fields: Optional[Dict[str, Any]] = None,
        dynamic_query: Optional[bool] = False,
        use_cache: Optional[bool] = True,
    ) -> pd.DataFrame:
        """
        Queries data from a specified BigQuery table based on the provided parameters.
        Args:
            table(str): The name of the table from which to retrieve the data.
            start_date_time(str): The start datetime for the data query in ISO format.
            end_date_time(str): The end datetime for the data query in ISO format.
            network(DeviceNetwork, optional): An Enum representing the site ownership. Defaults to `ALL` if not supplied, representing all networks.
            data_type(str, optional):
            columns(list, optional): A list of column names to include in the query. If None, all columns are included. Defaults to None.
            where_fields(dict, optional): A dictionary of additional WHERE clause filters where the key is the field name and the value is the filter value. Defaults to None.
            time_granularity(str, optional):
            dynamic_query(bool, optional): A boolean value to signal bypassing the automatic query composition to a more dynamic averaging approach.
            use_cache(bool, optional):

        Returns:
            pd.DataFrame: A pandas DataFrame containing the queried data, with duplicates removed and timestamps converted to `datetime` format. If no data is retrieved, an empty DataFrame is returned.
        """
        job_config = bigquery.QueryJobConfig()
        query_parameters = []
        _, filter_value = next(iter(where_fields.items()))
        if not dynamic_query:
            # Raw data
            query = self.compose_query(
                QueryType.GET,
                table=table,
                start_date_time=start_date_time,
                end_date_time=end_date_time,
                network=network,
                where_fields=where_fields,
                columns=columns,
            )
        else:
            # Device, sites specific data
            query = self.compose_dynamic_query(
                table,
                start_date_time,
                end_date_time,
                pollutants=columns,
                data_filter=where_fields,
                data_type=data_type,
                frequency=frequency,
                # time_granularity=time_granularity,
            )

            query_parameters = [
                bigquery.ArrayQueryParameter("filter_value", "STRING", filter_value),
            ]

        job_config.query_parameters = query_parameters
        job_config.use_query_cache = use_cache
        measurements = (
            self.client.query(
                query=f"select distinct * from ({query}) limit {Config.DATA_EXPORT_LIMIT}",
                job_config=job_config,
            )
            .result()
            .to_dataframe()
        )
        return measurements

    def dynamic_averaging_query(
        self,
        table: str,
        start_date_time: str,
        end_date_time: str,
        exclude_columns: Optional[List] = None,
        group_by: Optional[List] = None,
        network: Optional[DeviceNetwork] = None,
        time_granularity: Optional[str] = "HOUR",
    ) -> str:
        """
        Constructs a dynamic SQL query to select and average numeric columns, allowing exclusions,
        custom groupings, and ordering by a specified time granularity (hour, day, week, month).

        Args:
            table (str): The BigQuery table to query.
            start_date_time (str): The start datetime for filtering records.
            end_date_time (str): The end datetime for filtering records.
            exclude_columns (list): List of columns to exclude from selection and aggregation.
                                    Defaults to excluding `device_number`, `device_id`, `site_id`, `timestamp`.
            group_by (list): List of columns to group by in the query. Defaults to
                            `["device_number", "device_id", "site_id", <time_granularity>]`.
            time_granularity (str): Time truncation granularity for ordering, must be one of `HOUR`,
                                    `DAY`, `WEEK`, or `MONTH`. Defaults to `HOUR`.

        Returns:
            str: A dynamic SQL query string that averages numeric columns and groups data based on
                the provided granularity and group-by fields.

                Example:
                    query = dynamic_averaging_query(
                        table="project.dataset.table",
                        start_date_time="2024-01-01T00:00:00",
                        end_date_time="2024-01-04T00:00:00",
                        exclude_columns=["device_number", "device_id", "site_id", "timestamp"],
                        group_by=["device_number", "site_id"],
                        time_granularity="HOUR"
                    )
        """
        valid_granularities = ["HOUR", "DAY", "WEEK", "MONTH"]
        if time_granularity.upper() not in valid_granularities:
            logger.exception(
                f"Invalid time granularity: {time_granularity}. Must be one of {valid_granularities}."
            )

        # Default for exclude_columns and group_by
        exclude_columns = exclude_columns or [
            "device_number",
            "device_id",
            "site_id",
            "timestamp",
        ]
        group_by = group_by or ["device_number", "device_id", "site_id", "network"]

        numeric_columns = self.get_columns(
            table, [ColumnDataType.FLOAT, ColumnDataType.INTEGER]
        )

        # Construct dynamic AVG statements for numeric columns
        avg_columns = ",\n    ".join(
            [
                f"ROUND(AVG({col}), {Config.DATA_EXPORT_DECIMAL_PLACES}) AS {col}"
                for col in numeric_columns
                if col not in exclude_columns
            ]
        )

        where_clause: str = (
            f"timestamp BETWEEN '{start_date_time}' AND '{end_date_time}' "
        )

        if network:
            where_clause += f"AND network = '{network.value}' "

        # Include time granularity in both SELECT and GROUP BY
        timestamp_trunc = f"TIMESTAMP_TRUNC(timestamp, {time_granularity.upper()}) AS {time_granularity.lower()}"
        group_by_clause = ", ".join(group_by + [time_granularity.lower()])
        query = f"""SELECT {", ".join(group_by)}, {timestamp_trunc}, {avg_columns} FROM `{table}` WHERE {where_clause} GROUP BY {group_by_clause} ORDER BY {time_granularity.lower()};"""

        return query

    def get_columns(
        self,
        table: Optional[str] = "all",
        column_type: Optional[List[ColumnDataType]] = [ColumnDataType.NONE],
    ) -> List[str]:
        """
        Retrieves a list of columns that match a schema of a given table and or match data type as well. The schemas should match the tables in bigquery.

        Args:
            table (str): The data asset name as it appears in BigQuery, in the format 'project.dataset.table'.
            column_type (List[ColumnDataType]): A list of predetermined ColumnDataType Enums to filter by. Defaults to [ColumnDataType.NONE].

        Returns:
            List[str]: A list of column names that match the passed specifications.
        """
        schema_file = self.schema_mapping.get(table, None)

        if schema_file is None:
            raise Exception("Invalid table")

        if schema_file:
            schema = Utils.load_schema(file_name=schema_file)

        # Convert column_type list to strings for comparison
        column_type_strings = [ct.value.upper() for ct in column_type]

        # Retrieve columns that match any of the specified types
        columns: List[str] = list(
            set(
                [
                    column["name"]
                    for column in schema
                    if ColumnDataType.NONE in column_type
                    or column["type"] in column_type_strings
                ]
            )
        )
        return columns

    def build_filter_query(
        self,
        table: str,
        filter_type: str,
        filter_value: List,
        pollutants_query: str,
        bam_pollutants_query: str,
        start_date: str,
        end_date: str,
        frequency: Frequency,
    ):
        """
        Builds a SQL query to retrieve pollutant and weather data with associated device or site information.

        Args:
            data_table(str): The table name containing the main data records.
            filter_type(str): Type of filter (e.g., devices, sites, airqlouds).
            filter_value(list): Filter values corresponding to the filter type.
            pollutants_query(str): Query for pollutant data.
            bam_pollutants_query(str): Query for BAM pollutant data.
            start_date(str): Start date for data retrieval.
            end_date(str): End date for data retrieval.
            frequency(Frequency): Frequency filter.

        Returns:
            str: Final constructed SQL query.
        """
        time_grouping = self.get_time_grouping(frequency.value)
        table_name = Utils.table_name(table)

        # TODO Find a better way to do this.
        if frequency.value in self.extra_time_grouping:
            # Drop datetime alias
            pollutants_query = pollutants_query.replace(
                f", FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {table_name}.timestamp) AS datetime",
                "",
            )
            bam_pollutants_query = bam_pollutants_query.replace(
                f", FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {Utils.table_name(Config.BIGQUERY_BAM_DATA)}.timestamp) AS datetime",
                "",
            )
        if filter_type in {"devices", "device_ids", "device_names"}:
            return self.get_device_query(
                table,
                filter_value,
                pollutants_query,
                bam_pollutants_query,
                time_grouping,
                start_date,
                end_date,
                frequency,
            )
        elif filter_type in {"sites", "site_names", "site_ids"}:
            return self.get_site_query(
                table,
                filter_value,
                pollutants_query,
                time_grouping,
                start_date,
                end_date,
                frequency,
            )
        elif filter_type == "airqlouds":
            return self.get_airqloud_query(
                table,
                filter_value,
                pollutants_query,
                time_grouping,
                start_date,
                end_date,
                frequency,
            )
        else:
            logger.exception(f"Invalid filter type: {filter_type}")
            raise ValueError("Invalid filter type")

    def get_averaging_columns(
        self,
        mapping: List,
        frequency: Frequency,
        decimal_places: float,
        table_name: str,
    ):
        """
        Constructs a list of SQL expressions to apply rounding and optional averaging to columns for BigQuery queries.

        Depending on the frequency, this method determines whether to directly round values or apply an AVG aggregation before rounding (for grouped time intervals like weekly, monthly, or yearly).

        Args:
            mapping(list): List of column names to apply rounding/aggregation to.
            frequency(Frequency): The data frequency (e.g. Frequency.HOURLY, Frequency.DAILY).
            decimal_places(int): Number of decimal places to round the values to.
            table(str): Fully-qualified BigQuery table name (e.g., 'project.dataset.table').

        Returns:
            list: A list of SQL-safe strings representing the columns with rounding and optional averaging applied.
        """
        if frequency.value in self.extra_time_grouping:
            return [
                f"ROUND(AVG({table_name}.{col}), {decimal_places}) AS {col}"
                for col in mapping
            ]
        return [
            f"ROUND({table_name}.{col}, {decimal_places}) AS {col}" for col in mapping
        ]

    @cache.memoize()
    def compose_dynamic_query(
        self,
        table: str,
        start_date: str,
        end_date: str,
        pollutants: List,
        data_filter: Dict[str, Any],  # Either 'devices', 'sites'
        data_type: DataType,
        frequency: Frequency,
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
            filter_columns(list)

        Returns:
            pd.DataFrame: Retrieved data in DataFrame format, with duplicates removed and sorted by timestamp.
        """
        decimal_places = Config.DATA_EXPORT_DECIMAL_PLACES
        table_name = Utils.table_name(table)
        bam_table_name = Utils.table_name(Config.BIGQUERY_BAM_DATA)
        pollutant_columns = []
        bam_pollutant_columns = []

        for pollutant in pollutants:

            lc_key = f"{pollutant}_{data_type.value}"
            bam_key = pollutant

            # The frequency mapper determins which columns are returned
            LC_pollutant_mapping = BQ_FREQUENCY_MAPPER.get(frequency.value, {}).get(
                lc_key, []
            )
            BM_pollutant_mapping = BQ_FREQUENCY_MAPPER.get(frequency.value, {}).get(
                bam_key, []
            )

            pollutant_columns.extend(
                self.get_averaging_columns(
                    LC_pollutant_mapping,
                    frequency,
                    decimal_places,
                    table_name,
                )
            )
            bam_pollutant_columns.extend(
                self.get_averaging_columns(
                    BM_pollutant_mapping,
                    frequency,
                    decimal_places,
                    bam_table_name,
                )
            )

            # TODO Clean up by use using `get_columns` helper method
            if pollutant in {"pm2_5", "pm10", "no2"} and data_type.value == "raw":
                # Add dummy column to fix union column number missmatch.
                bam_pollutant_columns.append("-1 as pm2_5")

        selected_columns = set(pollutant_columns)
        bam_selected_columns = set(bam_pollutant_columns)

        pollutants_query = (
            "SELECT "
            + (", ".join(selected_columns) + ", " if selected_columns else "")
            + f"FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {table_name}.timestamp) AS datetime "
        )
        bam_pollutants_query = (
            "SELECT "
            + (", ".join(bam_selected_columns) + ", " if bam_selected_columns else "")
            + f"FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {bam_table_name}.timestamp) AS datetime "
        )

        filter_type, filter_value = next(iter(data_filter.items()))

        query = self.build_filter_query(
            table,
            filter_type,
            filter_value,
            pollutants_query,
            bam_pollutants_query,
            start_date,
            end_date,
            frequency=frequency,
        )
        return query
