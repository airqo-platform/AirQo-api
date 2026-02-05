from typing import Optional, Dict, Any, Tuple, List
import logging
import pandas as pd
from google.cloud import bigquery
from google.api_core import exceptions as google_api_exceptions

from airqo_etl_utils.constants import JobAction
from airqo_etl_utils.utils import Utils
from .schema_registry import validate_dataframe as validate_against_schema
from .base import StorageAdapter

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
        except google_api_exceptions.GoogleCloudError as e:
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


__all__ = ["BigQueryAdapter"]
