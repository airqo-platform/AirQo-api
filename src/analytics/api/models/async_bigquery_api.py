"""
Async adapter over BigQueryApi.

google-cloud-bigquery is a synchronous SDK; FastAPI handlers are async.
This module bridges the two by running the blocking BigQuery calls in a
worker thread (``asyncio.to_thread``) so queries never block the event loop.

Design contract
---------------
``BigQueryApi`` (api/models/bigquery_api.py) is the **single source of truth**
for query building — all filter types (sites, devices, airqlouds, grid,
country/city), pollutant column selection, pagination, and cursor logic live
there. This class deliberately contains no query-building logic of its own:
``query_data_async`` delegates 1:1 to ``BigQueryApi.query_data()``, so any
capability added on the sync side is automatically available here. Do not
fork query logic into this file.
"""

import asyncio
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from google.cloud import bigquery
from api.utils.bigquery_jobs import (
    log_cost_rejections,
    query_job_config,
    shared_bigquery_client,
)

from api.utils.utils import Utils
from config import settings
from constants import DeviceCategory, DeviceNetwork, Frequency

import logging

logger = logging.getLogger(__name__)


class AsyncBigQueryApi:
    """
    Thread-pool adapter exposing BigQuery operations to async callers.

    ``query_data_async`` covers the full data-query pipeline via delegation
    to ``BigQueryApi.query_data``. The remaining helpers (``get_sites_async``)
    are small self-contained metadata lookups used by MonitoringService.
    """

    def __init__(self):
        self.client = shared_bigquery_client()
        self.sites_table = Utils.table_name(settings.bigquery_sites_sites)

    async def query_data_async(
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
        Asynchronously query measurement data from BigQuery.

        Thin async wrapper: parameters are passed 1:1 to
        ``BigQueryApi.query_data`` (see its docstring for full semantics,
        including ``where_fields`` filter types and pagination metadata),
        executed in a worker thread.

        Returns:
            Tuple of (DataFrame, metadata) where metadata carries pagination
            info: {"total_count", "has_more", "next"}.
        """
        try:
            return await asyncio.to_thread(
                self._query_data_sync,
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
                cursor_token=cursor_token,
            )
        except Exception as e:
            logger.error(f"Async BigQuery query failed: {str(e)}")
            raise

    def _query_data_sync(
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
        Synchronous half of query_data_async.

        Delegates to the fully-implemented BigQueryApi.query_data() so the
        async wrapper never duplicates query-building logic.
        """
        from api.models.bigquery_api import BigQueryApi

        bq = BigQueryApi()
        return bq.query_data(
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
            cursor_token=cursor_token,
        )

    async def execute_query_async(
        self, query: str, job_config: Optional[bigquery.QueryJobConfig] = None
    ) -> pd.DataFrame:
        """
        Execute a raw BigQuery SQL query asynchronously.

        Args:
            query: The SQL query string to execute.
            job_config: Optional BigQuery job configuration (e.g. bind
                parameters for a parameterized query).

        Returns:
            DataFrame containing the query results.
        """
        try:
            return await asyncio.to_thread(self._execute_query_sync, query, job_config)
        except Exception as e:
            logger.error(f"Async query execution failed: {str(e)}")
            raise

    def _execute_query_sync(
        self, query: str, job_config: Optional[bigquery.QueryJobConfig] = None
    ) -> pd.DataFrame:
        """Synchronous half of execute_query_async."""
        with log_cost_rejections("execute_query_async"):
            query_job = self.client.query(query, job_config=job_config)
            return query_job.result().to_dataframe()

    async def get_sites_async(
        self, site_ids: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Asynchronously retrieve site metadata, optionally filtered by site IDs.

        Uses a parameterized query (UNNEST(@site_ids)) so supplied IDs can
        never alter the SQL. Used by MonitoringService for /dashboard/sites.

        Args:
            site_ids: Optional list of site IDs to filter.

        Returns:
            DataFrame containing site information.
        """
        query = f"""
        SELECT
            id,
            name,
            latitude,
            longitude,
            city,
            country,
            network
        FROM {self.sites_table}
        """

        job_config = None
        if site_ids:
            query += " WHERE id IN UNNEST(@site_ids)"
            job_config = query_job_config(
                query_parameters=[
                    bigquery.ArrayQueryParameter("site_ids", "STRING", site_ids)
                ]
            )

        return await self.execute_query_async(query, job_config)
