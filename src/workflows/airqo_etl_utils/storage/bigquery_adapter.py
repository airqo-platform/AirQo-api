from typing import Optional, Dict, Any, Tuple, List, Union
import logging
import pandas as pd
from google.cloud import bigquery
from google.api_core import exceptions as google_api_exceptions

from airqo_etl_utils.constants import JobAction, ColumnDataType
from .schema_registry import (
    validate_dataframe as validate_against_schema,
    get_columns_by_type,
)
from .base import StorageAdapter

from airqo_etl_utils.utils import Result

QueryParameter = Union[bigquery.ScalarQueryParameter, bigquery.ArrayQueryParameter]

logger = logging.getLogger("airflow.task")


class BigQueryAdapter(StorageAdapter):
    """BigQuery adapter that validates schema and loads dataframes.

    It uses `schema_registry` to validate required columns and will add missing
    columns as NaN before loading to avoid hard failures.
    """

    def __init__(
        self,
        client: Optional[bigquery.Client] = None,
        schema_mapping: Optional[dict] = None,
    ):
        self.client = client or bigquery.Client()
        self.schema_mapping = schema_mapping or {}

    def validate_schema(self, table: str, df: pd.DataFrame) -> Tuple[bool, List[str]]:
        ok, missing = validate_against_schema(table, df)
        return ok, missing

    def load_dataframe(
        self,
        dataframe: pd.DataFrame,
        table: str,
        job_action: JobAction = JobAction.APPEND,
        job_config: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """Load a DataFrame into `table` after schema validation.

        If required columns are missing they will be added with NaN values and a
        warning will be logged.
        """
        if not isinstance(dataframe, pd.DataFrame):
            raise ValueError(f"Expected a pandas DataFrame, got {type(dataframe)}")

        dataframe = dataframe.reset_index(drop=True)

        _, missing = self.validate_schema(table, dataframe)
        if missing:
            logger.warning(
                f"Table {table}: missing columns {missing}. Filling with NaN before load."
            )
            for c in missing:
                dataframe[c] = pd.NA

        bq_job_config = bigquery.LoadJobConfig(
            write_disposition=job_action.get_name(),
        )
        try:
            job = self.client.load_table_from_dataframe(
                dataframe, table, job_config=bq_job_config
            )
            job.result()
        except google_api_exceptions.GoogleAPIError as e:
            logger.exception(f"BigQuery load job failed for {table}: {e}")
            raise

        destination_table = self.client.get_table(table)
        rows_loaded = len(dataframe)
        logger.info(
            f"Loaded {rows_loaded} rows to {table} (total: {destination_table.num_rows})"
        )
        return {
            "rows_loaded": rows_loaded,
            "total_rows": destination_table.num_rows,
            "job_id": getattr(job, "job_id", None),
        }

    def get_columns(
        self,
        table: str,
        column_type: Optional[List[ColumnDataType]] = None,
    ) -> List[str]:
        """Return column names from a table's BigQuery schema, optionally filtered by type.

        Delegates to :func:`schema_registry.get_columns_by_type`, which caches
        results in the module-level TTLCache so that repeated calls within
        the same Airflow task incur only a single round of disk I/O regardless
        of how many times this method is called with the same arguments.

        Type-filtering rules:

        - ``ColumnDataType.RECORD`` — NULLABLE RECORD fields only.
        - ``ColumnDataType.REPEATED`` — REPEATED RECORD fields only.
        - ``ColumnDataType.NONE`` (default) — all fields.
        - Any other type — fields whose BigQuery type matches (e.g. FLOAT, INTEGER, TIMESTAMP).

        Args:
            table: A BigQuery table identifier as it appears in
                ``configuration.SCHEMA_FILE_MAPPING``, or ``"all"`` to query
                across all registered schemas.
            column_type: List of :class:`ColumnDataType` filters. Defaults to
                ``[ColumnDataType.NONE]`` (returns all column names).

        Returns:
            Deduplicated list of column names matching the requested criteria.
            Returns an empty list when the table has no registered schema.
        """
        return get_columns_by_type(table, column_type)

    def validate_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
        raise_exception: bool = True,
        date_time_columns: Optional[List[str]] = None,
        float_columns: Optional[List[str]] = None,
        integer_columns: Optional[List[str]] = None,
        record_columns: Optional[List[str]] = None,
        repeated_columns: Optional[List[str]] = None,
    ) -> pd.DataFrame:
        """Validate a DataFrame against a table's schema and format its column types.

        Performs three operations in sequence:

        1. **Column presence check** — verifies the DataFrame contains all columns
           defined in the table's schema. Missing columns are logged as warnings;
           if ``raise_exception`` is ``True`` an exception is raised immediately.
        2. **Type formatting** — converts columns to their declared BigQuery types
           (timestamps, floats, integers, records, repeated records) using
           :meth:`DataValidationUtils.format_data_types`. Schema-derived column
           lists are used when the caller does not supply explicit overrides.
        3. **Deduplication** — removes exact duplicate rows, keeping the first
           occurrence.

        Column type lists are resolved via :meth:`get_columns` (which is cached)
        when not explicitly provided, so calling this method multiple times in
        the same task does not re-read schema files from disk.

        Args:
            dataframe: The ``pd.DataFrame`` to validate and format. Mutated in place
                for type conversions; the returned reference is the same object.
            table: BigQuery table identifier used to look up schema column types.
            raise_exception: When ``True`` (default), raises ``Exception`` if any
                required columns are absent. When ``False``, logs a warning and
                proceeds with the available columns.
            date_time_columns: Explicit list of columns to format as ``datetime``.
                When ``None``, inferred from the table schema.
            float_columns: Explicit list of columns to format as ``float``.
                When ``None``, inferred from the table schema.
            integer_columns: Explicit list of columns to format as ``int``.
                When ``None``, inferred from the table schema.
            record_columns: Explicit list of columns to format as RECORD (dict).
                When ``None``, inferred from the table schema.
            repeated_columns: Explicit list of columns to format as REPEATED RECORD
                (list of dicts). When ``None``, inferred from the table schema.

        Returns:
            The validated and type-formatted ``pd.DataFrame`` with duplicate rows
            removed.

        Raises:
            Exception: If required schema columns are absent and
                ``raise_exception`` is ``True``.
        """
        valid_cols = self.get_columns(table)
        dataframe_cols = dataframe.columns.to_list()

        if set(valid_cols).issubset(set(dataframe_cols)):
            dataframe = dataframe[valid_cols]
        else:
            missing_cols = list(set(valid_cols) - set(dataframe_cols))
            logger.warning(f"Required columns: {valid_cols}")
            logger.warning(f"DataFrame columns: {dataframe_cols}")
            logger.warning(f"Missing columns: {missing_cols}")
            if raise_exception:
                raise Exception(f"Invalid columns {missing_cols}")

        date_time_columns = date_time_columns or self.get_columns(
            table, [ColumnDataType.TIMESTAMP]
        )
        float_columns = float_columns or self.get_columns(table, [ColumnDataType.FLOAT])
        integer_columns = integer_columns or self.get_columns(
            table, [ColumnDataType.INTEGER]
        )
        record_columns = record_columns or self.get_columns(
            table, [ColumnDataType.RECORD]
        )
        repeated_columns = repeated_columns or self.get_columns(
            table, [ColumnDataType.REPEATED]
        )

        # Local import to avoid circular dependency:
        # bigquery_api → storage → bigquery_adapter → data_validator → bigquery_api
        from airqo_etl_utils.data_validator import DataValidationUtils

        dataframe = DataValidationUtils.format_data_types(
            data=dataframe,
            floats=float_columns,
            integers=integer_columns,
            timestamps=date_time_columns,
            records=record_columns,
            repeated=repeated_columns,
        )

        try:
            dataframe.drop_duplicates(keep="first", inplace=True)
        except Exception as e:
            logger.exception(f"Error deduplicating dataframe for {table}: {e}")

        return dataframe

    def download_query(self, query: str) -> pd.DataFrame:
        result = self.client.query(query).result()
        return result.to_dataframe()

    def execute_query(
        self,
        query: str,
        query_parameters: Optional[List[QueryParameter]] = None,
        use_cache: bool = True,
    ) -> Result[pd.DataFrame]:
        """Execute a SQL query and return the result wrapped in a Result object.

        Supports both ScalarQueryParameter and ArrayQueryParameter via the
        optional `query_parameters` argument.

        Args:
            query: The SQL query string to execute.
            query_parameters: Optional list of BigQuery query parameters
                (ScalarQueryParameter or ArrayQueryParameter).
            use_cache: Whether to use BigQuery query cache. Defaults to True.

        Returns:
            Result[pd.DataFrame] with `data` set on success, or `error` set on failure.
        """
        try:
            job_config = bigquery.QueryJobConfig(use_query_cache=use_cache)
            if query_parameters:
                job_config.query_parameters = query_parameters
            df = self.client.query(query, job_config=job_config).result().to_dataframe()
            return Result(data=df)
        except google_api_exceptions.GoogleAPIError as e:
            logger.exception(f"BigQuery query execution failed: {e}")
            return Result(error=str(e))
        except Exception as e:
            logger.exception(f"Unexpected error executing BigQuery query: {e}")
            return Result(error=str(e))


__all__ = ["BigQueryAdapter"]
