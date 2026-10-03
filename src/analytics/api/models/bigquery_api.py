import hashlib
import base64
from typing import List, Dict, Any, Optional, Union, Tuple, Set
from constants import (
    QueryType,
    DeviceNetwork,
    ColumnDataType,
    Frequency,
    DataType,
    DeviceCategory,
)
from api.utils.utils import Utils
import pandas as pd
from google.cloud import bigquery
from api.utils.bigquery_jobs import (
    translate_incomplete_queries,
    query_job_config,
    shared_bigquery_client,
)
from config import settings as Config
from api.utils.pollutants.pm_25 import COMMON_POLLUTANT_MAPPING_v2

from api.utils.cursor_utils import CursorUtils, StoredResultCursor
from api.utils.exceptions import CursorRejected
from google.api_core.exceptions import NotFound

import logging

logger = logging.getLogger(__name__)


class BigQueryApi:
    def __init__(self):
        self.client = shared_bigquery_client()
        self.schema_mapping = Config.SCHEMA_FILE_MAPPING
        self.sites_table = Utils.table_name(Config.bigquery_sites_sites)
        self.devices_table = Utils.table_name(Config.bigquery_devices_devices)
        self.grids_sites_table = Utils.table_name(Config.bigquery_grids_sites)
        self.cohorts_table = Utils.table_name(Config.bigquery_cohorts)
        self.cohorts_devices_table = Utils.table_name(Config.bigquery_cohorts_devices)
        self.satellite_forecast_table = Utils.table_name(
            Config.bigquery_satellite_data_table
        )
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
    def device_info_query_network(self):
        """Generates a device information query specifically for network, excluding the site_id."""
        return f"{self.devices_table}.network AS network "

    @property
    def site_info_query(self):
        """Generates a site information query to retrieve site name and approximate location details."""
        return f"{self.sites_table}.name AS site_name "

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
        filter_type: str = "device_ids",
    ):
        """
        Constructs a SQL query to extract device measurements, including standard and BAM measurements when applicable.

        Handles three filter shapes against the same measurement-extraction
        query, since all three ultimately just narrow down which devices'
        measurements to return:
        - "devices"/"device_ids"/"device_names" (default): filter_value is a
          literal list of device IDs -> WHERE device_id IN UNNEST(@filter_value).
        - "grid_ids": filter_value is a list of grid IDs -> WHERE device_id's site
          is in one of those grids, resolved via a grids_sites subquery.
          devices_table.site_id is reused directly here (no need to re-join
          devices_devices/sites_sites — it's already the same site ID space
          add_site_join joins against below).
        - "cohort_ids": filter_value is a list of cohort IDs -> WHERE the device
          belongs to one of those cohorts, resolved via a cohorts_devices
          subquery.  Note the join column: cohorts_devices.device_id holds the
          device's `id`, so this matches devices_table.id — not .device_id as
          every other devices_devices join in this module does.

        Args:
            table (str): Name of the table containing the primary device measurements.
            filter_value (list): List of device IDs, or (when filter_type is
            "grid_ids"/"cohort_ids") grid or cohort IDs.
            pollutants_query (str): SQL fragment for selecting standard pollutants.
            time_grouping (str): SQL expression for time-based grouping (e.g., by hour, day).
            start_date (str): Start timestamp (inclusive) for filtering data.
            end_date (str): End timestamp (inclusive) for filtering data.
            frequency (Any): Frequency of aggregation (e.g., 'raw', 'hourly', 'daily').
            filter_type (str): "device_ids" (default) or "grid_ids" or "cohort_ids" — selects
            which WHERE condition below to apply.

        Returns:
            str: The fully constructed SQL query
        """
        table_name = Utils.table_name(table)

        if filter_type == "grid_ids":
            filter_condition = (
                f"{self.devices_table}.site_id IN ("
                f"SELECT site_id FROM {self.grids_sites_table} "
                f"WHERE grid_id IN UNNEST(@filter_value)"
                f") "
            )
        elif filter_type == "cohort_ids":
            filter_condition = (
                f"{self.devices_table}.id IN ("
                f"SELECT device_id FROM {self.cohorts_devices_table} "
                f"WHERE cohort_id IN UNNEST(@filter_value)"
                f") "
            )
        else:
            filter_condition = (
                f"{self.devices_table}.device_id IN UNNEST(@filter_value) "
            )

        query = (
            f"{pollutants_query}, {time_grouping}, {self.device_info_query}, {self.devices_table}.device_id "
            f"FROM {table_name} "
            f"JOIN {self.devices_table} ON {self.devices_table}.device_id = {table_name}.device_id "
            f"WHERE {table_name}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {filter_condition}"
        )

        if frequency.value in self.extra_time_grouping:
            query += " GROUP BY ALL"

        return self.add_site_join(query)

    def get_location_query(
        self,
        table: str,
        filter_type: str,
        filter_value: Union[str, List],
        pollutants_query: str,
        time_grouping: str,
        start_date: str,
        end_date: str,
        frequency: Frequency,
    ):
        """
        Constructs a SQL query to retrieve satellite/forecast data filtered by location.

        Args:
            table(str): Name of the table containing the measurements.
            filter_type(str): Location column to filter on — "country" or "city" only.
            filter_value(str | list): Location value(s), bound via @filter_value parameter.
            pollutants_query(str): SQL fragment for selecting pollutants.
            time_grouping(str): SQL expression for time-based grouping.
            start_date(str): Start timestamp (inclusive).
            end_date(str): End timestamp (inclusive).
            frequency(Frequency): Frequency of aggregation.

        Returns:
            str: The fully constructed SQL query.
        """
        if filter_type not in {"country", "city"}:
            raise ValueError(f"Invalid location filter: {filter_type}")

        table_name = Utils.table_name(table)
        query = (
            f"{pollutants_query}, {time_grouping}, {self.location_info_query} "
            f"FROM {table_name} "
            f"WHERE {table_name}.timestamp BETWEEN '{start_date}' AND '{end_date}' "
            f"AND {table_name}.{filter_type} = @filter_value "
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

    @staticmethod
    def _build_filter_parameter(
        filter_value: Union[str, int, List],
    ) -> Union[bigquery.ArrayQueryParameter, bigquery.ScalarQueryParameter]:
        """
        Bind ``filter_value`` as the correct BigQuery query parameter type.

        The parameter type must match how ``@filter_value`` is used in the SQL:

        - List filters (sites, devices) use ``IN UNNEST(@filter_value)`` and
          require an ``ArrayQueryParameter``.
        - Scalar filters (country, city) use ``= @filter_value`` and require a
          ``ScalarQueryParameter``.

        Passing a scalar string to an ``ArrayQueryParameter`` would iterate the
        string into individual characters and break the comparison, so the two
        cases must be distinguished by the runtime type of ``filter_value``.

        Args:
            filter_value: The filter value(s) to bind — a list for
                site/device filters, a scalar for location filters.

        Returns:
            The matching BigQuery query parameter for ``@filter_value``.
        """
        if isinstance(filter_value, (list, tuple)):
            return bigquery.ArrayQueryParameter(
                "filter_value", "STRING", list(filter_value)
            )
        return bigquery.ScalarQueryParameter("filter_value", "STRING", filter_value)

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
        *,
        cursor_binding: str,
        whole_result: bool = False,
    ) -> Tuple[pd.DataFrame, Dict]:
        """
        Queries one page of data from a specified BigQuery table, or every row of it.

        A request without a cursor runs the query once, in the order that
        ``_get_pagination_order_clause`` builds, and returns the first
        ``DATA_EXPORT_LIMIT`` rows.  BigQuery writes the whole result to a
        temporary table and keeps it for up to 24 hours.  A request with a
        cursor reads the next ``DATA_EXPORT_LIMIT`` rows of that stored result
        by row offset.  A request with ``whole_result`` runs the query and
        returns every row in one frame.

        Args:
            table (str): The name of the table from which to retrieve the data.
            start_date_time (str): The start datetime for the data query in ISO format.
            end_date_time (str): The end datetime for the data query in ISO format.
            device_category (DeviceCategory): The category of the devices to query.
            frequency (Frequency): The frequency of the data, such as raw, hourly or daily.
            network (DeviceNetwork, optional): The network that owns the sites.
            data_type (DataType, optional): The type of the data, such as raw or calibrated.
            columns (List[str], optional): The pollutant columns to include in the query.
            where_fields (Dict[str, List[str]], optional): One filter type with its
                values, such as {"devices": ["dev1", "dev2"]}, {"sites": ["site1"]},
                {"grid_ids": ["grid1"]} or {"cohort_ids": ["cohort1"]}.
            dynamic_query (bool, optional): True builds the query with the averaging
                columns of the frequency, and False builds the raw-data query.
                Defaults to False.
            use_cache (bool, optional): True lets BigQuery serve the query from its
                cache. Defaults to True.
            cursor_token (str, optional): The token from ``metadata.next`` of the previous page.
            cursor_binding (str): The hash of the request body and the operation name.
                The service accepts a cursor only when it carries the same hash.
            whole_result (bool): True returns every row of the result in one frame,
                with ``has_more`` false.

        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: The rows of the page and the
            pagination metadata.  ``total_count`` is the number of rows in the
            page, and the service layer replaces it with the number of records
            that it returns after cleaning.  ``has_more`` is true while rows
            remain after the page.  ``next`` is the cursor of the following
            page, or None on the last page.

        Raises:
            CursorRejected: The cursor is malformed, unsigned, changed, expired
                or issued for another request, BigQuery holds no stored result
                for the job that it names, or a cursor arrived with
                ``whole_result``.
        """
        limit = int(Config.data_export_limit)

        if cursor_token:
            if whole_result:
                raise CursorRejected("a whole-result read carries no cursor")
            cursor = CursorUtils.read_cursor(cursor_token, cursor_binding)
            page, total_rows = self._read_stored_page(cursor, limit, table)
            return page, self._page_metadata(
                page,
                cursor.offset,
                total_rows,
                limit,
                cursor.job_id,
                cursor.location,
                cursor_binding,
            )

        query, job_config = self._result_query(
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=device_category,
            frequency=frequency,
            network=network,
            data_type=data_type,
            columns=columns,
            where_fields=where_fields,
            dynamic_query=dynamic_query,
            use_cache=use_cache,
        )

        if whole_result:
            frame = self._run_whole_result(query, job_config, table)
            return frame, {"total_count": len(frame), "has_more": False, "next": None}

        page, total_rows, job_id, location = self._run_first_page(
            query, job_config, limit, table
        )
        return page, self._page_metadata(
            page, 0, total_rows, limit, job_id, location, cursor_binding
        )

    def _result_query(
        self,
        table: str,
        start_date_time: str,
        end_date_time: str,
        device_category: DeviceCategory,
        frequency: Frequency,
        network: Optional[DeviceNetwork],
        data_type: Optional[str],
        columns: Optional[List],
        where_fields: Dict[str, Any],
        dynamic_query: bool,
        use_cache: bool,
    ) -> Tuple[str, bigquery.QueryJobConfig]:
        """
        Build the ordered result query and its job configuration.

        The query carries the ORDER BY of ``_get_pagination_order_clause``,
        and BigQuery writes the whole result to a temporary table.  The job
        configuration binds the filter values and carries the byte limit and
        the job timeout of ``query_job_config``.

        Returns:
            Tuple[str, bigquery.QueryJobConfig]: The query text and its configuration.
        """
        filter_type, filter_value = next(iter(where_fields.items()))
        cursor_field = Config.cursor_field.get(frequency.value, "timestamp")
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
        order_by_clause = self._get_pagination_order_clause(
            cursor_field, filter_type, table
        )
        job_config = query_job_config()
        job_config.query_parameters = [self._build_filter_parameter(filter_value)]
        job_config.use_query_cache = use_cache
        return (
            f"select distinct * from ({query}) order by {order_by_clause}",
            job_config,
        )

    def _run_first_page(
        self, query: str, job_config: bigquery.QueryJobConfig, limit: int, table: str
    ) -> Tuple[pd.DataFrame, Optional[int], str, str]:
        """
        Run the query and read the first ``limit`` rows of its result.

        ``max_results`` keeps the read on the REST path of the client, and the
        rows of the first page arrive in the ``getQueryResults`` response that
        ``result`` requests.  The code reads the job id and the location after
        ``result`` returns, because the job retry of the client can replace the
        job while it waits.  A job that reports no location gets
        ``settings.bigquery_location``.

        Returns:
            Tuple[pd.DataFrame, Optional[int], str, str]: The page, the row count
            of the whole result, the job id and the job location.
        """
        with translate_incomplete_queries(f"query_data table={table}"):
            job = self.client.query(query=query, job_config=job_config)
            rows = job.result(max_results=limit)
            page = rows.to_dataframe()
        location = job.location or Config.bigquery_location
        return page, rows.total_rows, job.job_id, location

    def _run_whole_result(
        self, query: str, job_config: bigquery.QueryJobConfig, table: str
    ) -> pd.DataFrame:
        """Run the query and read every row of its result over the REST path."""
        with translate_incomplete_queries(f"query_data table={table}"):
            job = self.client.query(query=query, job_config=job_config)
            return job.result().to_dataframe(create_bqstorage_client=False)

    def _read_stored_page(
        self, cursor: StoredResultCursor, limit: int, table: str
    ) -> Tuple[pd.DataFrame, Optional[int]]:
        """
        Read the ``limit`` rows at ``cursor.offset`` of a stored result.

        The read fetches the job that the cursor names and reads a slice of
        its result with ``start_index``.  ``page_size`` travels with
        ``start_index``, because the client sends the first request with the
        page size and continues with the page token.  A 403 or a rate refusal
        on the read gets the translation of ``translate_incomplete_queries``.

        Returns:
            Tuple[pd.DataFrame, Optional[int]]: The page and the row count of
            the whole result.

        Raises:
            CursorRejected: BigQuery holds no job or no stored result for the
                cursor, or the job is not a query job.
        """
        try:
            with translate_incomplete_queries(f"query_data page table={table}"):
                job = self.client.get_job(cursor.job_id, location=cursor.location)
                if getattr(job, "job_type", None) != "query":
                    raise CursorRejected("the token names a job that is not a query")
                rows = job.result(
                    start_index=cursor.offset, max_results=limit, page_size=limit
                )
                page = rows.to_dataframe()
        except NotFound as exc:
            logger.warning(
                "bigquery stored result not found (job_id=%s location=%s): %s",
                cursor.job_id,
                cursor.location,
                exc.message,
            )
            raise CursorRejected(
                "BigQuery holds no stored result for the token"
            ) from exc
        return page, rows.total_rows

    @staticmethod
    def _page_metadata(
        page: pd.DataFrame,
        offset: int,
        total_rows: Optional[int],
        limit: int,
        job_id: str,
        location: str,
        cursor_binding: str,
    ) -> Dict[str, Any]:
        """
        Build the pagination metadata of one page.

        ``has_more`` is true while rows remain after this page in the stored
        result.  When the client reports no row count, ``has_more`` is true
        for a full page.  ``next`` is the cursor for the row after this page.
        """
        count = len(page)
        next_offset = offset + count
        if total_rows is None:
            has_more = count >= limit
        else:
            has_more = count > 0 and next_offset < int(total_rows)
        next_token = (
            CursorUtils.create_cursor(job_id, location, next_offset, cursor_binding)
            if has_more
            else None
        )
        return {"total_count": count, "has_more": has_more, "next": next_token}

    def _get_pagination_order_clause(
        self, cursor_field: str, filter_type: str, table: str
    ) -> str:
        """
        Generates the ORDER BY clause of the result query.

        The result query carries this clause, and each page reads the stored
        result of that query by row offset.

        Args:
            cursor_field (str): The time column of the result (timestamp, week, month or year).
            filter_type (str): The type of the filter.
            table (str): The table being queried.

        Returns:
            str: The SQL ORDER BY clause.
        """
        filter_type = self.field_mappings.get(filter_type, None)
        order_by_clause = f"{cursor_field}, {filter_type}"

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
            filter_type(str): Type of filter (e.g., devices, sites, grid_ids, cohort_ids).
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

        if filter_type in {
            "devices",
            "device_ids",
            "device_names",
            "grid_ids",
            "cohort_ids",
        }:
            return self.get_device_query(
                table,
                filter_value,
                pollutants_query,
                time_grouping,
                start_date,
                end_date,
                frequency,
                filter_type=filter_type,
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
        elif filter_type in {"country", "city"}:
            return self.get_location_query(
                table,
                filter_type,
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
            filter_type (str): Type of filter to apply (e.g., 'devices', 'sites', 'grid_ids', 'cohort_ids').
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
        decimal_places = Config.data_export_decimal_places
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
