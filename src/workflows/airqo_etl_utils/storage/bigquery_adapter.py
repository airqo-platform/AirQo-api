from typing import Optional, Dict, Any, Tuple, List, Union
import logging
import pandas as pd
from google.cloud import bigquery
from google.api_core import exceptions as google_api_exceptions

from airqo_etl_utils.constants import JobAction
from .schema_registry import validate_dataframe as validate_against_schema
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
        print(type(dataframe))
        if not isinstance(dataframe, pd.DataFrame):
            raise ValueError(f"Expected a pandas DataFrame, got {type(dataframe)}")

        dataframe = dataframe.reset_index(drop=True)

        ok, missing = self.validate_schema(table, dataframe)
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
        except google_api_exceptions.GoogleAPICallError as e:
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
