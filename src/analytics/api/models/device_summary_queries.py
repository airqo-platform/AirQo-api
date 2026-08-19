"""
Framework-free BigQuery helpers for the devices-summary job.

Ported from the Flask-coupled EventsModel classmethods
(get_devices_hourly_data / save_devices_summary_data), reading table names
from config.settings.  Used by devices_summary.py (the Dockerfile
``devices-summary-job`` target).
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
from google.cloud import bigquery
from api.utils.bigquery_jobs import query_job_config, shared_bigquery_client

from api.utils.utils import Utils
from config import settings


def get_devices_hourly_data(day: datetime) -> pd.DataFrame:
    hourly_data_table = Utils.table_name(settings.bigquery_hourly_data)

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

    job_config = query_job_config()
    job_config.use_query_cache = True

    return (
        shared_bigquery_client()
        .query(f"select distinct * from ({query})", job_config)
        .result()
        .to_dataframe()
    )


def save_devices_summary_data(data: pd.DataFrame) -> None:
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
    job = shared_bigquery_client().load_table_from_dataframe(
        dataframe=data,
        destination=Utils.table_name(settings.devices_summary_table),
        job_config=job_config,
    )
    job.result()
