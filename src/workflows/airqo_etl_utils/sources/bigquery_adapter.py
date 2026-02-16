from typing import Optional, Dict, Any
import logging
import pandas as pd
from google.cloud import bigquery
from google.api_core import exceptions as google_api_exceptions

from airqo_etl_utils.constants import JobAction, ColumnDataType
from airqo_etl_utils.utils import Utils

logger = logging.getLogger("airflow.task")


class BigQueryAdapter:
    """Adapter that encapsulates BigQuery load/download logic.

    This wraps `bigquery.Client` and provides a compact interface used by
    `BigQueryApi` to load DataFrames and download query results.
    """

    def __init__(
        self,
        client: Optional[bigquery.Client] = None,
        schema_mapping: Optional[dict] = None,
    ):
        self.client = client or bigquery.Client()
        self.schema_mapping = schema_mapping or {}

    def load_dataframe(
        self,
        dataframe: pd.DataFrame,
        table: str,
        job_action: JobAction = JobAction.APPEND,
        job_config: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """Load a DataFrame into `table`. Returns info dict with rows_loaded and job_id.

        This keeps the previous validation behavior but centralizes load behavior and logging.
        """
        dataframe = dataframe.reset_index(drop=True)
        # Basic validation placeholder: keep existing validation in callers
        # Build job config
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
        """Run `query` and return a pandas DataFrame."""
        result = self.client.query(query).result()
        return result.to_dataframe()
