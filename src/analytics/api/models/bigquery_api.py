from typing import List, Dict, Any, Optional, Union, Tuple, Set
from constants import (
    DeviceNetwork,
    ColumnDataType,
    Frequency,
    DataType,
    DeviceCategory,
)
from api.utils.utils import Utils
import pandas as pd
from google.cloud import bigquery
from config import BaseConfig as Config
from api.utils.pollutants.pm_25 import COMMON_POLLUTANT_MAPPING_v2

from main import cache
from api.utils.cursor_utils import CursorUtils

import logging

logger = logging.getLogger(__name__)


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.schema_mapping = Config.SCHEMA_FILE_MAPPING
        self.sites_table = Utils.table_name(Config.BIGQUERY_SITES_SITES)
        self.airqlouds_sites_table = Utils.table_name(Config.BIGQUERY_AIRQLOUDS_SITES)
        self.devices_table = Utils.table_name(Config.BIGQUERY_DEVICES_DEVICES)
        self.satellite_forecast_table = Utils.table_name(
            Config.BIGQUERY_SATELLITE_DATA_CLEANED_MERGED_TABLE
        )
        self.airqlouds_table = Utils.table_name(Config.BIGQUERY_AIRQLOUDS)
        self.all_time_grouping = Config.all_time_grouping
        self.extra_time_grouping = Config.extra_time_grouping
        self.field_mappings = Config.FILTER_FIELD_MAPPING

    @property
    def device_info_query(self):
        """Generates a device information query including site_id, network, and approximate location details."""
        return (
            f"{self.devices_table}.site_id AS site_id, "
            f"{self.devices_table}.network AS network "
        )

    @property
    def location_info_query(self):
        """Generates a location information query including country and city details."""
        return (
            f"{self.satellite_forecast_table}.country AS country, "
            f"{self.satellite_forecast_table}.city AS city, "
            f"{self.satellite_forecast_table}.network AS network "
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
            f"RIGHT JOIN ({data_query}) data ON data.device_id = {self.devices_table}.device_id "
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
        time_grouping: str,
        start_date: str,
        end_date: str,
        frequency: Frequency,
    ):
        """
        Constructs a SQL query to retrieve pollutant data for specific devices, including standard and BAM measurements when applicable.

        Args:
            table (str): Name of the table containing the primary device measurements.
            filter_value (str): List of device IDs to filter the query (used in UNNEST).
            pollutants_query (str): SQL fragment for selecting standard pollutants.
            time_grouping (str): SQL expression for time-based grouping (e.g., by hour, day).
            start_date (str): Start timestamp (inclusive) for filtering data.
            end_date (str): End timestamp (inclusive) for filtering data.
            frequency (Any): Frequency of aggregation (e.g., 'raw', 'hourly', 'daily').

        Returns:
            str: The fully constructed SQL query
        """
        table_name = Utils.table_name(table)
        query = (
            f"{pollutants_query}, {time_grouping}, {self.device_info_query}, {self.devices_table}.device_id "
            f"FROM {table_name} "
            f"JOIN {self.devices_table} ON {self.devices_table}.device_id = {table_name}.device_id "
            f"WHERE {table_name}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {self.devices_table}.device_id IN UNNEST(@filter_value) "
        )

        if frequency.value in self.extra_time_grouping:
            query += " GROUP BY ALL"

        return self.add_site_join(query)

    def get_location_query(
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
        Constructs a SQL query to retrieve pollutant data for specific locations.

        Args:
            table (str): Name of the table containing the primary device measurements.
            filter_value (str): List of location identifiers to filter the query (used in UNNEST).
            pollutants_query (str): SQL fragment for selecting standard pollutants.
            time_grouping (str): SQL expression for time-based grouping (e.g., by hour, day).
            start_date (str): Start timestamp (inclusive) for filtering data.
            end_date (str): End timestamp (inclusive) for filtering data.
            frequency (Any): Frequency of aggregation (e.g., 'raw', 'hourly', 'daily').

        Returns:
            str: The fully constructed SQL query
        """
        table_name = Utils.table_name(table)
        query = (
            f"{pollutants_query}, {time_grouping}, {self.location_info_query} "
            f"FROM {table_name} "
            f"WHERE {table_name}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {table_name}.country = @filter_value "
        )

        if frequency.value in self.extra_time_grouping:
            query += " GROUP BY ALL"

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
            f"{pollutants_query}, {time_grouping}, {self.site_info_query}, {table}.device_id AS device_id "
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
            f"{pollutants_query}, {time_grouping}, {table}.device_id AS device_id, meta_data.* "
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
        table: str,
        start_date_time: str,
        end_date_time: str,
        pollutants: List[str],
        data_type: DataType,
        data_filter: Dict[str, Any],
        device_category: Optional[DeviceCategory],
        network: Optional[DeviceNetwork] = None,
    ) -> str:
        """
        Composes a SQL query for BigQuery based on the query type (GET or DELETE), and optionally includes a dynamic selection and aggregation of numeric columns.

        Args:
            query_type (QueryType): The type of query (GET or DELETE).
            table (str): The BigQuery table to query.
            start_date_time (str): The start datetime for filtering records.
            end_date_time (str): The end datetime for filtering records.
            network (DeviceNetwork, optional): The network or ownership information (e.g., to filter data).
            where_fields (dict, optional):  Dictionary of fields to filter on i.e {"device_id":("aq_001", "aq_002")}.
            columns (list, optional):  List of columns to select. If None, selects all.

        Returns:
            str: The composed SQL query as a string.

        Raises:
            Exception: If an invalid column is provided in `where_fields` or `null_cols`, or if the `query_type` is not supported.
        """
        table_name = Utils.table_name(table)

        pollutant_columns = self._query_columns_builder(
            pollutants,
            data_type,
            DataType.RAW,
            device_category,
            table_name=table_name,
        )
        selected_columns = set(pollutant_columns)

        pollutants_query = (
            "SELECT "
            + (", ".join(selected_columns) + ", " if selected_columns else "")
            + f"FORMAT_DATETIME('%Y-%m-%d %H:%M:%SZ', {table_name}.timestamp) AS datetime "
        )

        filter_type, filter_value = next(iter(data_filter.items()))

        query = self.build_filter_query(
            table,
            filter_type,
            filter_value,
            pollutants_query,
            start_date_time,
            end_date_time,
            frequency=Frequency.RAW,
        )
        return query

    def _resolve_where_clause(
        self,
        where_fields: Dict[str, Union[str, int, List]],
        valid_columns: List[str],
        exclude_columns: List[str],
    ) -> List[str]:
        """
        Convert where_fields into SQL-safe WHERE clause parts.

        Returns:
            List[str]: WHERE conditions (e.g., ["device_id = '123'"]).
        """
        clauses = []

        for raw_key, value in where_fields.items():
            key = self.field_mappings.get(raw_key, None)

            if key in exclude_columns:
                continue

            if key not in valid_columns:
                raise ValueError(
                    f"Invalid table column: '{key}' not in {valid_columns}"
                )

            if isinstance(value, (str, int)):
                clauses.append(f"{key} = '{value}'")
            elif isinstance(value, list):
                formatted_list = ", ".join(f"'{v}'" for v in value)
                clauses.append(f"{key} IN ({formatted_list})")
            else:
                raise TypeError(f"Unsupported filter type for key: {key}")

        return clauses

    def query_data(
        self,
        table: str,
        start_date_time: str,
        end_date_time: str,
        device_category: DeviceCategory,
        frequency: Frequency,
        network: Optional[DeviceNetwork] = None,
        data_type: Optional[str] = None,
        columns: Optional[List] = None,
        where_fields: Optional[Dict[str, Any]] = None,
        dynamic_query: Optional[bool] = False,
        use_cache: Optional[bool] = True,
        cursor_token: Optional[str] = None,
    ) -> Tuple[pd.DataFrame, Dict]:
        """
        Queries data from a specified BigQuery table based on the provided parameters with pagination support.

        Args:
            table (str): The name of the table from which to retrieve the data.
            start_date_time (str): The start datetime for the data query in ISO format.
            end_date_time (str): The end datetime for the data query in ISO format.
            device_category (DeviceCategory): Category of device data to query.
            network (DeviceNetwork, optional): An Enum representing the site ownership.
            frequency (Frequency, optional): The frequency of the data (raw, hourly, daily, etc.).
            data_type (DataType, optional): Type of data (raw, calibrated, etc.).
            columns (List[str], optional): A list of column names (pollutants) to include in the query.
            where_fields (Dict[str, List[str]], optional): A dictionary of filter type and values, e.g., {"devices": ["dev1", "dev2"]}, {"sites": ["site1", "site2"]}, {"airqlouds": ["airqloud1"]}.
            dynamic_query (bool, optional): Whether to use dynamic query generation. Defaults to False.
            use_cache (bool, optional): Whether to use cached query results. Defaults to True.
            cursor_token (str, optional): Token for cursor-based pagination from a previous query. Defaults to None.

        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: A pandas DataFrame containing the queried data and
            a dictionary with metadata including pagination information:
            {
                "total_count": int,  # Number of rows in the current result set
                "has_more": bool,    # Whether more data is available
                "next": str or None  # Cursor token for the next page of results, or None if no more data
            }
        """
        job_config = bigquery.QueryJobConfig()
        limits = int(Config.DATA_EXPORT_LIMIT)
        query_parameters = []
        filter_type, filter_value = next(iter(where_fields.items()))
        meta_data: Dict[str, Any] = {"total_count": 0, "has_more": False, "next": None}
        cursor_field = Config.cursor_field.get(frequency.value, "timestamp")

        # Determine which query generation approach to use
        if not dynamic_query:
            # Raw data
            query = self.compose_query(
                table=table,
                start_date_time=start_date_time,
                end_date_time=end_date_time,
                pollutants=columns,
                data_type=data_type,
                data_filter=where_fields,
                device_category=device_category,
                network=network,
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
                device_category=device_category,
            )

        if isinstance(filter_value, list):
            query_parameters = [
                bigquery.ArrayQueryParameter("filter_value", "STRING", filter_value),
            ]
        else:
            query_parameters = [
                bigquery.ScalarQueryParameter("filter_value", "STRING", filter_value),
            ]

        job_config.query_parameters = query_parameters
        job_config.use_query_cache = use_cache

        if cursor_token:
            _, _, _, paginate = self.estimate_query_rows(query, table)
            if paginate:
                query = self._apply_pagination_cursor(
                    query, cursor_field, cursor_token, filter_type
                )

        order_by_clause = self._get_pagination_order_clause(
            cursor_field, filter_type, table
        )

        # Adjust the limit to fetch one extra row
        adjusted_limit = limits + 1

        # Execute the query with ordering and adjusted limit

        measurements = (
            self.client.query(
                query=f"select distinct * from ({query}) order by {order_by_clause} limit {adjusted_limit}",
                job_config=job_config,
            )
            .result()
            .to_dataframe()
        )

        # Handle pagination logic
        if not measurements.empty:
            # Use only the first `Config.DATA_EXPORT_LIMIT` rows for the current page
            current_page_data = measurements.iloc[:limits]

            # Use the `(Config.DATA_EXPORT_LIMIT + 1)`th row to generate the next cursor
            if len(measurements) > limits:
                next_cursor_token = self._generate_next_cursor(
                    measurements.iloc[limits:], cursor_field, filter_type
                )
            else:
                next_cursor_token = None
        else:
            current_page_data = measurements
            next_cursor_token = None

        # Update metadata
        count = current_page_data.shape[0]
        meta_data["total_count"] = count
        meta_data["has_more"] = next_cursor_token is not None
        meta_data["next"] = next_cursor_token

        return current_page_data, meta_data

    def _apply_pagination_cursor(
        self, query: str, cursor_field: str, cursor_token: str, filter_type: str
    ) -> str:
        """
        Applies pagination cursor logic to a query string, ensuring results continue precisely
        from where the previous request left off, using appropriate operators for string fields.

        Args:
            query (str): The SQL query to modify.
            cursor_field (str): The field used for pagination (typically timestamp).
            cursor_token (str): The cursor token from Redis.
            filter_type (str): The type of filter being applied (e.g., 'site_id').

        Returns:
            str: The modified query with cursor conditions added.
        """
        filter_type = self.field_mappings.get(filter_type, None)

        # Retrieve the cursor data from Redis
        try:
            cursor_value = CursorUtils.parse_cursor(cursor_token)
        except ValueError as e:
            raise ValueError(f"Invalid pagination cursor: {str(e)}")

        if len(cursor_value) < 2:
            raise ValueError("Invalid cursor format")

        timestamp_part = cursor_value.get("timestamp")
        filter_value_part = cursor_value.get("filter_value")

        if filter_type == "site_id" and "device_id" in cursor_value:
            # Site ID case with device ID for multi-device sites
            device_id_part = cursor_value.get("device_id")
            query += f"""
                AND (
                    /* Records with later timestamps */
                    {cursor_field} > '{timestamp_part}'

                    /* OR same timestamp, same site and same device_id */
                    OR ({cursor_field} = '{timestamp_part}'
                        AND {filter_type} = '{filter_value_part}'
                        AND device_id = '{device_id_part}')
                )
            """
        else:
            # Simpler case (e.g., device_id or other filters)
            query += f"""
                AND (
                    /* Records with later timestamps */
                    {cursor_field} > '{timestamp_part}'

                    /* OR same timestamp and same filter value(device_id)*/
                    OR ({cursor_field} = '{timestamp_part}'
                        AND {filter_type} IS NOT NULL
                        AND {filter_type} = '{filter_value_part}')
                )
            """

        return query

    def _generate_next_cursor(
        self, dataframe: pd.DataFrame, cursor_field: str, filter_type: str
    ) -> Optional[str]:
        """
        Generates the next cursor value from a dataframe of results and stores it in Redis.

        Args:
            dataframe (pd.DataFrame): The result dataframe.
            cursor_field (str): Field used for pagination (typically timestamp).
            filter_type (str): Type of filter being applied (e.g., 'site_id').

        Returns:
            Optional[str]: Cursor token for retrieving the stored cursor, or None if no more data.
        """
        cursor_token = None
        filter_type = self.field_mappings.get(filter_type, None)
        if not dataframe.empty:
            last_row = dataframe.iloc[-1]
            max_timestamp = last_row[cursor_field]
            last_filter_value = last_row[filter_type]

            if filter_type == "site_id" and "device_id" in dataframe.columns:
                # For site_id filtering, include device_id in the cursor
                cursor_token = CursorUtils.create_cursor(
                    timestamp=str(max_timestamp),
                    filter_value=last_filter_value,
                    device_id=last_row["device_id"],
                )
            else:
                cursor_token = CursorUtils.create_cursor(
                    timestamp=str(max_timestamp), filter_value=last_filter_value
                )

        return cursor_token

    def _get_pagination_order_clause(
        self, cursor_field: str, filter_type: str, table: str
    ) -> str:
        """
        Generates an ORDER BY clause for consistent pagination ordering.

        Args:
            cursor_field (str): Field used for pagination (typically timestamp).
            filter_type (str): Type of filter being applied.
            table (str): The table being queried.

        Returns:
            str: SQL ORDER BY clause for consistent pagination.
        """
        filter_type = self.field_mappings.get(filter_type, None)
        order_by_clause = (
            f"{cursor_field}" if not filter_type else f"{cursor_field}, {filter_type}"
        )
        # Add device_id to ordering if we're filtering by site_id for consistent results
        if filter_type == "site_id" and "device_id" in self.get_columns(table):
            order_by_clause += ", device_id"
        return order_by_clause

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
            start_date(str): Start date for data retrieval.
            end_date(str): End date for data retrieval.
            frequency(Frequency): Frequency filter.

        Returns:
            str: Final constructed SQL query.
        """
        time_grouping = self.get_time_grouping(frequency.value)
        table_name = Utils.table_name(table)

        # TODO Find a better way to do this.
        if frequency.value in (self.extra_time_grouping - {"daily"}):
            # Drop datetime alias
            pollutants_query = pollutants_query.replace(
                f", FORMAT_DATETIME('%Y-%m-%d %H:%M:%SZ', {table_name}.timestamp) AS datetime ",
                "",
            )

        if filter_type in {"devices", "device_ids", "device_names"}:
            return self.get_device_query(
                table,
                filter_value,
                pollutants_query,
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
        elif filter_type in {"country", "city"}:
            return self.get_location_query(
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
        device_category: DeviceCategory,
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
        if frequency.value in self.extra_time_grouping or (
            device_category.value == "bam" and frequency.value == "daily"
        ):
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
        device_category: DeviceCategory,
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

        pollutant_columns = self._query_columns_builder(
            pollutants,
            data_type,
            frequency,
            device_category,
            decimal_places,
            table_name=table_name,
        )

        selected_columns = set(pollutant_columns)

        pollutants_query = (
            "SELECT "
            + (", ".join(selected_columns) + ", " if selected_columns else "")
            + f"FORMAT_DATETIME('%Y-%m-%d %H:%M:%SZ', {table_name}.timestamp) AS datetime "
        )

        filter_type, filter_value = next(iter(data_filter.items()))
        query = self.build_filter_query(
            table,
            filter_type,
            filter_value,
            pollutants_query,
            start_date,
            end_date,
            frequency=frequency,
        )
        return query

    def _query_columns_builder(
        self,
        pollutants: List[str],
        data_type: DataType,
        frequency: Frequency,
        device_category: DeviceCategory,
        decimal_places: Optional[int] = 2,
        table_name: Optional[str] = None,
    ) -> List[str]:
        """
        Builds and returns a list of pollutant averaging SQL expressions or column names for the specified device category.
        The function uses the provided frequency, pollutants list, and data type to dynamically determine which columns to extract and how to compute them.

        Args:
            pollutants(List[str]): List of pollutant names (e.g., ["pm2_5", "pm10"]).
            data_type(DataType): An enum or object with a `.value` attribute indicating the data type (e.g., "raw", "averaged").
            frequency(Frequency): An object with a `.value` attribute representing the data frequency (e.g., "hourly", "daily").
            decimal_places(int): Number of decimal places to round the averaged values.
            table_name(Optional[str]): Name of the table containing sensor data.

        Returns:
            List[str]: A list containing SQL column expressions for the selected pollutants.

        Returns:
            List[str]: The list contains SQL column expressions for the selected pollutants.
                May include dummy columns for compatibility in downstream SQL logic.
        """
        pollutant_columns_ = []

        for pollutant in pollutants:
            key = (
                "averaged"
                if data_type.value == "calibrated"
                or (device_category.value == "bam" and frequency.value != "raw")
                else "raw"
            )

            # The frequency mapper determines which columns are returned
            pollutant_mapping = (
                COMMON_POLLUTANT_MAPPING_v2.get(device_category.value, {})
                .get(key, {})
                .get(pollutant, [])
            )
            pollutant_columns_.extend(
                self.get_averaging_columns(
                    pollutant_mapping,
                    frequency,
                    decimal_places,
                    table_name,
                    device_category,
                )
            )

        pollutant_columns = self._add_extra_columns(
            device_category, pollutant_columns_, table_name=table_name
        )
        return pollutant_columns

    def _add_extra_columns(
        self,
        device_category: DeviceCategory,
        pollutant_columns: List[str],
        table_name: Optional[str] = None,
    ) -> Tuple[List[str], List[str]]:
        """
        Appends latitude and longitude columns to the given lists of pollutant columns for both low-cost sensor and BAM data sources, based on the provided table names.
        This ensures that both result sets include geospatial coordinates for downstream use (e.g., mapping, grouping, or display).

        Args:
            pollutant_columns(List[str]): List of SQL column expressions for low-cost sensor data.
            bam_pollutant_columns(List[str]): List of SQL column expressions for BAM device data.
            table_name(Optional[str]): Name of the table containing low-cost sensor data.
            bam_table_name(Optional[str]): Name of the table containing BAM data.

        Returns:
            Tuple[List[str], List[str]]:
                - Updated `pollutant_columns` with latitude and longitude (if applicable).
                - Updated `bam_pollutant_columns` with latitude and longitude (if applicable).

        Notes:
            - Columns are appended only if the corresponding list is non-empty and the respective table name is provided.
            - This function modifies the input lists in-place and also returns them.
        """
        extra_columns: Set = Config.OPTIONAL_FIELDS.get(device_category).copy()
        extra_columns.discard("site_id")
        if pollutant_columns:
            pollutant_columns.extend(
                [f"{table_name}.{field}" for field in extra_columns]
            )

        return pollutant_columns

    def estimate_query_rows(
        self, query: str, table: str, row_threshold: int = Config.DATA_EXPORT_LIMIT
    ) -> Tuple[int, int, float, bool]:
        """
        Estimate number of rows a query could return, using dry run + table metadata.

        Args:
            query(str): SQL query string.
            table(str): Fully qualified table id i.e `project.dataset.table`.
            row_threshold(int): Row count threshold to decide if pagination is needed.

        Returns:
            Tuple[estimated_rows(int), bytes_scanned(int), avg_row_size(float), paginate(bool)]
        """
        job_config = bigquery.QueryJobConfig(dry_run=True, use_query_cache=False)
        query_job = self.client.query(query, job_config=job_config)
        bytes_scanned = query_job.total_bytes_processed

        # Get table metadata (row + size stats)
        table = self.client.get_table(table)
        if table.num_rows > 0:
            avg_row_size = table.num_bytes / table.num_rows
        else:
            avg_row_size = 0

        estimated_rows = int(bytes_scanned / avg_row_size) if avg_row_size > 0 else 0

        paginate = estimated_rows > int(row_threshold)

        return estimated_rows, bytes_scanned, avg_row_size, paginate
