"""
Framework-free query builder for the scheduled-export Celery worker.

Ported from the Flask-coupled EventsModel.data_export_query.  Changes from
the original:
  - reads table names from config.settings (not legacy config.py);
  - takes ``frequency`` as a Frequency enum (or plain string) and resolves
    ``.value`` exactly once — the old worker passed a string into a method
    that called ``.value`` on it, so every export crashed with
    AttributeError;
  - takes the (filter_type, filter_value) pair the export documents store
    and maps it onto the sites/devices branches;
  - the hourly BAM union actually fires (the original compared the enum
    against the string "hourly", always False) AND is now valid SQL: the
    BAM leg emits the same column aliases in the same order as the main
    leg, where the original emitted a mismatched raw/calibrated pair per
    pollutant that BigQuery would have rejected.

The SQL text of the device/site branches is unchanged.  Values
are interpolated (not bound)
exactly as before — acceptable only because this builder never sees raw
request input: filter values come from Mongo documents created by the
validated /data-export API.
"""

from __future__ import annotations

from typing import List, Union

from api.utils.pollutants.pm_25 import BQ_FREQUENCY_MAPPER
from api.utils.utils import Utils
from config import settings
from constants import Frequency


def data_export_query(
    filter_type: str,
    filter_value: List[str],
    start_date,
    end_date,
    frequency: Union[Frequency, str],
    pollutants: List[str],
) -> str:
    """Build the SELECT for one scheduled export request."""
    freq = frequency.value if isinstance(frequency, Frequency) else str(frequency)

    devices: List[str] = []
    sites: List[str] = []
    if filter_type in ("devices", "device_ids", "device_names"):
        devices = list(filter_value)
    elif filter_type == "sites":
        sites = list(filter_value)
    else:
        raise ValueError(f"Unsupported export filter type: {filter_type}")

    decimal_places = settings.data_export_decimal_places
    raw_data_table = Utils.table_name(settings.bigquery_raw_data)
    daily_data_table = Utils.table_name(settings.bigquery_daily_data)
    hourly_data_table = Utils.table_name(settings.bigquery_hourly_data)
    sites_table = Utils.table_name(settings.bigquery_sites_sites)
    devices_table = Utils.table_name(settings.bigquery_devices_devices)
    bam_data_table = Utils.table_name(settings.bigquery_bam_hourly_data)

    if freq == "raw":
        data_table = raw_data_table
    elif freq == "daily":
        data_table = daily_data_table
    elif freq == "hourly":
        data_table = hourly_data_table
    else:
        raise ValueError(f"Invalid frequency: {freq}")

    # The BAM leg is UNION ALL'd with the main leg for hourly device
    # exports; UNION ALL aligns columns positionally, so both legs are
    # built from the SAME mapping in the SAME order with the SAME aliases.
    # (The original emitted two raw/calibrated columns per pollutant on the
    # BAM side — a column-count mismatch that made the union invalid SQL.
    # It never surfaced because the old worker crashed before reaching it.)
    pollutant_columns = []
    bam_pollutant_columns = []
    for pollutant in pollutants:
        pollutant_mapping = BQ_FREQUENCY_MAPPER.get(freq, {}).get(pollutant, [])
        pollutant_columns.extend(
            [
                f"ROUND({data_table}.{mapping}, {decimal_places}) AS {mapping}"
                for mapping in pollutant_mapping
            ]
        )
        # BAM tables carry one reading per pollutant — alias it to the same
        # output column(s) the main leg produces.
        bam_pollutant_columns.extend(
            [
                f"ROUND({bam_data_table}.{pollutant}, {decimal_places}) AS {mapping}"
                for mapping in pollutant_mapping
            ]
        )

    # Order-preserving dedup: set() would randomise column order per process
    # (hash randomisation) and break the positional UNION alignment.
    pollutant_columns = list(dict.fromkeys(pollutant_columns))
    bam_pollutant_columns = list(dict.fromkeys(bam_pollutant_columns))

    pollutants_query = (
        f" SELECT {', '.join(pollutant_columns)} ,"
        f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {data_table}.timestamp) AS datetime "
    )
    bam_pollutants_query = (
        f" SELECT {', '.join(bam_pollutant_columns)} ,"
        f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {bam_data_table}.timestamp) AS datetime "
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
            f" FROM {bam_data_table} "
            f" JOIN {devices_table} ON {devices_table}.device_id = {bam_data_table}.device_id "
            f" WHERE {bam_data_table}.timestamp >= '{start_date}' "
            f" AND {bam_data_table}.timestamp <= '{end_date}' "
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

        if freq == "hourly":
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

    return f"select distinct * from ({query})"
