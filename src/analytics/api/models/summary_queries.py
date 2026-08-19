"""
Query builder for the /data/summary data-completeness report.

Port of the Flask EventsModel.get_devices_summary (recovered from the outer
tree): sums hourly/calibrated/uncalibrated record counts per device from the
devices-summary table, RIGHT-JOINed through the airqloud / grid / cohort
metadata chain for the requested entity.

Changes from the original: table names come from config.settings,
and the entity ID plus both dates are bound as query parameters (the
original interpolated them into the SQL text).  Identifiers remain
config-fixed, so the query structure is unchanged.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Tuple

from google.cloud import bigquery

from api.utils.utils import Utils
from config import settings

SUMMARY_FILTER_KINDS = ("airqloud", "grid", "cohort")


def devices_summary_query(
    filter_kind: str,
    filter_id: str,
    start_date_time: datetime,
    end_date_time: datetime,
) -> Tuple[str, List[bigquery.ScalarQueryParameter]]:
    """
    Build the (sql, query_parameters) pair for one summary request.

    filter_kind must be one of SUMMARY_FILTER_KINDS; filter_id is the
    airqloud/grid/cohort ID (bound as @filter_id).
    """
    if filter_kind not in SUMMARY_FILTER_KINDS:
        raise ValueError(f"Unsupported summary filter kind: {filter_kind}")

    data_table = Utils.table_name(settings.devices_summary_table)
    sites_table = Utils.table_name(settings.bigquery_sites_sites)
    airqlouds_sites_table = Utils.table_name(settings.bigquery_airqlouds_sites)
    airqlouds_table = Utils.table_name(settings.bigquery_airqlouds)
    grids_table = Utils.table_name(settings.bigquery_grids)
    grids_sites_table = Utils.table_name(settings.bigquery_grids_sites)
    cohorts_table = Utils.table_name(settings.bigquery_cohorts)
    cohorts_devices_table = Utils.table_name(settings.bigquery_cohorts_devices)
    devices_table = Utils.table_name(settings.bigquery_devices_devices)

    data_query = (
        f" SELECT {data_table}.device ,  "
        f" SUM({data_table}.uncalibrated_records) as uncalibrated_records , "
        f" SUM({data_table}.calibrated_records) as calibrated_records , "
        f" SUM({data_table}.hourly_records) as hourly_records , "
        f" (SUM({data_table}.calibrated_records) / SUM({data_table}.hourly_records)) * 100 as calibrated_percentage , "
        f" (SUM({data_table}.uncalibrated_records) / SUM({data_table}.hourly_records)) * 100 as uncalibrated_percentage "
    )

    if filter_kind == "airqloud":
        meta_data_query = (
            f" SELECT {airqlouds_sites_table}.airqloud_id , "
            f" {airqlouds_sites_table}.site_id , "
            f" FROM {airqlouds_sites_table} "
            f" WHERE {airqlouds_sites_table}.airqloud_id = @filter_id "
        )

        # Adding airqloud information
        meta_data_query = (
            f" SELECT "
            f" {airqlouds_table}.name AS airqloud , "
            f" meta_data.* "
            f" FROM {airqlouds_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.airqloud_id = {airqlouds_table}.id "
        )

        # Adding site information
        meta_data_query = (
            f" SELECT "
            f" {sites_table}.name AS site_name , "
            f" meta_data.* "
            f" FROM {sites_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
        )

        query = (
            f" {data_query} , "
            f" meta_data.* "
            f" FROM {data_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
            f" WHERE {data_table}.timestamp >= @start_date "
            f" AND {data_table}.timestamp <= @end_date "
            f" GROUP BY {data_table}.device, "
            f" meta_data.site_id, meta_data.airqloud_id, meta_data.site_name, meta_data.airqloud"
        )

    elif filter_kind == "grid":
        meta_data_query = (
            f" SELECT {grids_sites_table}.grid_id , "
            f" {grids_sites_table}.site_id , "
            f" FROM {grids_sites_table} "
            f" WHERE {grids_sites_table}.grid_id = @filter_id "
        )

        meta_data_query = (
            f" SELECT "
            f" {grids_table}.name AS grid, "
            f" meta_data.* "
            f" FROM {grids_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.grid_id = {grids_table}.id "
        )

        meta_data_query = (
            f" SELECT "
            f" {sites_table}.name  AS site_name , "
            f" meta_data.* "
            f" FROM {sites_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
        )

        query = (
            f" {data_query} , "
            f" meta_data.* "
            f" FROM {data_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
            f" WHERE {data_table}.timestamp >= @start_date "
            f" AND {data_table}.timestamp <= @end_date "
            f" GROUP BY {data_table}.device, "
            f" meta_data.site_id, meta_data.grid_id, meta_data.site_name, meta_data.grid"
        )

    else:  # cohort
        meta_data_query = (
            f" SELECT {cohorts_devices_table}.cohort_id , "
            f" {cohorts_devices_table}.device_id , "
            f" FROM {cohorts_devices_table} "
            f" WHERE {cohorts_devices_table}.cohort_id = @filter_id "
        )

        meta_data_query = (
            f" SELECT "
            f" {cohorts_table}.name AS cohort, "
            f" meta_data.* "
            f" FROM {cohorts_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.cohort_id = {cohorts_table}.id "
        )

        # Divergence from the Flask original: also carry the device's
        # site_id + site_name — compute_airqloud_summary's cohort branch
        # groups by them, so the original's chain (which lacked them)
        # made every cohort request 500 with a KeyError.
        meta_data_query = (
            f" SELECT "
            f" {devices_table}.name  AS device_name , "
            f" {devices_table}.site_id  AS site_id , "
            f" meta_data.* "
            f" FROM {devices_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.device_id = {devices_table}.device_id "
        )

        meta_data_query = (
            f" SELECT "
            f" {sites_table}.name  AS site_name , "
            f" meta_data.* "
            f" FROM {sites_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
        )

        query = (
            f" {data_query} , "
            f" meta_data.* "
            f" FROM {data_table} "
            f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.device_id = {data_table}.device"
            f" WHERE {data_table}.timestamp >= @start_date "
            f" AND {data_table}.timestamp <= @end_date "
            f" GROUP BY {data_table}.device, "
            f" meta_data.device_id, meta_data.cohort_id, meta_data.device_name, meta_data.cohort, "
            f" meta_data.site_id, meta_data.site_name"
        )

    params = [
        bigquery.ScalarQueryParameter("filter_id", "STRING", filter_id),
        bigquery.ScalarQueryParameter("start_date", "TIMESTAMP", start_date_time),
        bigquery.ScalarQueryParameter("end_date", "TIMESTAMP", end_date_time),
    ]
    return f"select distinct * from ({query})", params
