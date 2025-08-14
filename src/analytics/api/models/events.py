from datetime import datetime

import pandas as pd
import pytz
from google.cloud import bigquery

from api.models.base.base_model import BasePyMongoModel
from api.utils.dates import date_to_str
from api.utils.utils import Utils
from config import BaseConfig as Config
from api.utils.pollutants.pm_25 import (
    BQ_FREQUENCY_MAPPER,
)
from main import cache, CONFIGURATIONS


class EventsModel(BasePyMongoModel):
    """
    This class manages data retrieval and query construction for events data, integrating device, site,
    and airqloud information for specified pollutants and weather fields.
    """

    def __init__(self, network):
        """
        Initializes the EventsModel with default settings and mappings for limit thresholds,
        and specifies collections and BigQuery table references.

        Args:
            network (str): The network identifier for managing database collections.
        """
        self.limit_mapper = {"pm2_5": 500.5, "pm10": 604.5, "no2": 2049}
        self.raw_data_table = Utils.table_name(Config.BIGQUERY_RAW_DATA)
        self.daily_data_table = Utils.table_name(Config.BIGQUERY_DAILY_DATA)
        self.hourly_data_table = Utils.table_name(Config.BIGQUERY_HOURLY_DATA)
        self.sites_table = Utils.table_name(Config.BIGQUERY_SITES_SITES)
        self.airqlouds_sites_table = Utils.table_name(Config.BIGQUERY_AIRQLOUDS_SITES)
        self.devices_table = Utils.table_name(Config.BIGQUERY_DEVICES_DEVICES)
        self.airqlouds_table = Utils.table_name(Config.BIGQUERY_AIRQLOUDS)
        self.bam_data_table = Utils.table_name(Config.BIGQUERY_BAM_HOURLY_DATA)
        self.bigquery_events = Utils.table_name(Config.BIGQUERY_HOURLY_DATA)
        self.grids_table = Utils.table_name(Config.BIGQUERY_GRIDS)
        self.grids_sites_table = Utils.table_name(Config.BIGQUERY_GRIDS_SITES)
        self.cohorts_table = Utils.table_name(Config.BIGQUERY_COHORTS)
        self.cohorts_devices_table = Utils.table_name(Config.BIGQUERY_COHORTS_DEVICES)
        self.export_decimal_places = Config.DATA_EXPORT_DECIMAL_PLACES
        super().__init__(network, collection_name="events")

    def data_export_query(
        self,
        devices,
        sites,
        airqlouds,
        start_date,
        end_date,
        frequency,
        pollutants,
    ) -> str:
        decimal_places = self.export_decimal_places

        if frequency.value == "raw":
            data_table = self.raw_data_table
        elif frequency.value == "daily":
            data_table = self.daily_data_table
        elif frequency.value == "hourly":
            data_table = self.hourly_data_table
        else:
            raise Exception("Invalid frequency")

        pollutant_columns = []
        bam_pollutant_columns = []
        for pollutant in pollutants:
            pollutant_mapping = BQ_FREQUENCY_MAPPER.get(frequency.value).get(
                pollutant, []
            )
            pollutant_columns.extend(
                [
                    f"ROUND({data_table}.{mapping}, {decimal_places}) AS {mapping}"
                    for mapping in pollutant_mapping
                ]
            )

            if pollutant == "pm2_5":
                bam_pollutant_columns.extend(
                    ["pm2_5 as pm2_5_raw_value", "pm2_5 as pm2_5_calibrated_value"]
                )
            elif pollutant == "pm10":
                bam_pollutant_columns.extend(
                    ["pm10 as pm10_raw_value", "pm10 as pm10_calibrated_value"]
                )
            elif pollutant == "no2":
                bam_pollutant_columns.extend(
                    ["no2 as no2_raw_value", "no2 as no2_calibrated_value"]
                )

        pollutants_query = (
            f" SELECT {', '.join(map(str, set(pollutant_columns)))} ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {data_table}.timestamp) AS datetime "
        )
        bam_pollutants_query = (
            f" SELECT {', '.join(map(str, set(bam_pollutant_columns)))} ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {self.bam_data_table}.timestamp) AS datetime "
        )

        if len(devices) != 0:
            # Adding device information, start and end times
            query = (
                f" {pollutants_query} , "
                f" {self.devices_table}.device_id AS device_name , "
                f" {self.devices_table}.site_id AS site_id , "
                f" {self.devices_table}.tenant AS tenant , "
                f" {self.devices_table}.approximate_latitude AS device_latitude , "
                f" {self.devices_table}.approximate_longitude  AS device_longitude , "
                f" FROM {data_table} "
                f" JOIN {self.devices_table} ON {self.devices_table}.device_id = {data_table}.device_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
                f" AND {self.devices_table}.device_id IN UNNEST({devices}) "
            )

            bam_query = (
                f" {bam_pollutants_query} , "
                f" {self.devices_table}.device_id AS device_name , "
                f" {self.devices_table}.site_id AS site_id , "
                f" {self.devices_table}.tenant AS tenant , "
                f" {self.devices_table}.approximate_latitude AS device_latitude , "
                f" {self.devices_table}.approximate_longitude  AS device_longitude , "
                f" FROM {self.bam_data_table} "
                f" JOIN {self.devices_table} ON {self.devices_table}.device_id = {self.bam_data_table}.device_id "
                f" WHERE {self.bam_data_table}.timestamp >= '{start_date}' "
                f" AND {self.bam_data_table}.timestamp <= '{end_date}' "
                f" AND {self.devices_table}.device_id IN UNNEST({devices}) "
            )

            # Adding site information
            query = (
                f" SELECT "
                f" {self.sites_table}.name AS site_name , "
                f" {self.sites_table}.approximate_latitude AS site_latitude , "
                f" {self.sites_table}.approximate_longitude  AS site_longitude , "
                f" data.* "
                f" FROM {self.sites_table} "
                f" RIGHT JOIN ({query}) data ON data.site_id = {self.sites_table}.id "
            )

            bam_query = (
                f" SELECT "
                f" {self.sites_table}.name AS site_name , "
                f" {self.sites_table}.approximate_latitude AS site_latitude , "
                f" {self.sites_table}.approximate_longitude  AS site_longitude , "
                f" data.* "
                f" FROM {self.sites_table} "
                f" RIGHT JOIN ({bam_query}) data ON data.site_id = {self.sites_table}.id "
            )

            if frequency == "hourly":
                query = f"{query} UNION ALL {bam_query}"

        elif len(sites) != 0:
            # Adding site information, start and end times
            query = (
                f" {pollutants_query} , "
                f" {self.sites_table}.tenant AS tenant , "
                f" {self.sites_table}.id AS site_id , "
                f" {self.sites_table}.name AS site_name , "
                f" {self.sites_table}.approximate_latitude AS site_latitude , "
                f" {self.sites_table}.approximate_longitude  AS site_longitude , "
                f" {data_table}.device_id AS device_name , "
                f" FROM {data_table} "
                f" JOIN {self.sites_table} ON {self.sites_table}.id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
                f" AND {self.sites_table}.id IN UNNEST({sites}) "
            )

            # Adding device information
            query = (
                f" SELECT "
                f" {self.devices_table}.approximate_latitude AS device_latitude , "
                f" {self.devices_table}.approximate_longitude  AS device_longitude , "
                f" {self.devices_table}.device_id AS device_name , "
                f" data.* "
                f" FROM {self.devices_table} "
                f" RIGHT JOIN ({query}) data ON data.device_name = {self.devices_table}.device_id "
            )
        else:
            meta_data_query = (
                f" SELECT {self.airqlouds_sites_table}.tenant , "
                f" {self.airqlouds_sites_table}.airqloud_id , "
                f" {self.airqlouds_sites_table}.site_id , "
                f" FROM {self.airqlouds_sites_table} "
                f" WHERE {self.airqlouds_sites_table}.airqloud_id IN UNNEST({airqlouds}) "
            )

            # Adding airqloud information
            meta_data_query = (
                f" SELECT "
                f" {self.airqlouds_table}.name  AS airqloud_name , "
                f" meta_data.* "
                f" FROM {self.airqlouds_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.airqloud_id = {self.airqlouds_table}.id "
            )

            # Adding site information
            meta_data_query = (
                f" SELECT "
                f" {self.sites_table}.approximate_latitude AS site_latitude , "
                f" {self.sites_table}.approximate_longitude  AS site_longitude , "
                f" {self.sites_table}.name  AS site_name , "
                f" meta_data.* "
                f" FROM {self.sites_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {self.sites_table}.id "
            )

            # Adding device information
            meta_data_query = (
                f" SELECT "
                f" {self.devices_table}.approximate_latitude AS device_latitude , "
                f" {self.devices_table}.approximate_longitude  AS device_longitude , "
                f" {self.devices_table}.device_id AS device_name , "
                f" meta_data.* "
                f" FROM {self.devices_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {self.devices_table}.site_id "
            )

            # Adding start and end times
            query = (
                f" {pollutants_query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {data_table}.site_id "
                f" WHERE {data_table}.timestamp >= '{start_date}' "
                f" AND {data_table}.timestamp <= '{end_date}' "
                f" ORDER BY {data_table}.timestamp "
            )

        return f"select distinct * from ({query})"

    @classmethod
    def get_devices_hourly_data(
        cls,
        day: datetime,
    ) -> pd.DataFrame:
        hourly_data_table = Utils.table_name(Config.BIGQUERY_HOURLY_DATA)

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

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = (
            bigquery.Client()
            .query(f"select distinct * from ({query})", job_config)
            .result()
            .to_dataframe()
        )

        return dataframe

    @classmethod
    def save_devices_summary_data(
        cls,
        data: pd.DataFrame,
    ):
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
        job = bigquery.Client().load_table_from_dataframe(
            dataframe=data,
            destination=Utils.table_name(Config.DEVICES_SUMMARY_TABLE),
            job_config=job_config,
        )
        job.result()

    @cache.memoize()
    def get_devices_summary(
        self, airqloud, start_date_time, end_date_time, grid: str, cohort: str
    ) -> list:
        data_table = Utils.table_name(Config.DEVICES_SUMMARY_TABLE)

        # Data sources
        sites_table = self.sites_table
        airqlouds_sites_table = self.airqlouds_sites_table
        airqlouds_table = self.airqlouds_table
        grids_table = self.grids_table
        grids_sites_table = self.grids_sites_table
        cohorts_devices_table = self.cohorts_devices_table
        cohorts_table = self.cohorts_table
        devices_table = self.devices_table

        data_query = (
            f" SELECT {data_table}.device ,  "
            f" SUM({data_table}.uncalibrated_records) as uncalibrated_records , "
            f" SUM({data_table}.calibrated_records) as calibrated_records , "
            f" SUM({data_table}.hourly_records) as hourly_records , "
            f" (SUM({data_table}.calibrated_records) / SUM({data_table}.hourly_records)) * 100 as calibrated_percentage , "
            f" (SUM({data_table}.uncalibrated_records) / SUM({data_table}.hourly_records)) * 100 as uncalibrated_percentage "
        )

        if airqloud.strip() != "":
            meta_data_query = (
                f" SELECT {airqlouds_sites_table}.airqloud_id , "
                f" {airqlouds_sites_table}.site_id , "
                f" FROM {airqlouds_sites_table} "
                f" WHERE {airqlouds_sites_table}.airqloud_id = '{airqloud}' "
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
                f" WHERE {data_table}.timestamp >= '{start_date_time}' "
                f" AND {data_table}.timestamp <= '{end_date_time}' "
                f" GROUP BY {data_table}.device, "
                f" meta_data.site_id, meta_data.airqloud_id, meta_data.site_name, meta_data.airqloud"
            )

        elif grid.strip() != "":
            meta_data_query = (
                f" SELECT {grids_sites_table}.grid_id , "
                f" {grids_sites_table}.site_id , "
                f" FROM {grids_sites_table} "
                f" WHERE {grids_sites_table}.grid_id = '{grid}' "
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
                f" WHERE {data_table}.timestamp >= '{start_date_time}' "
                f" AND {data_table}.timestamp <= '{end_date_time}' "
                f" GROUP BY {data_table}.device, "
                f" meta_data.site_id, meta_data.grid_id, meta_data.site_name, meta_data.grid"
            )

        elif cohort.strip() != "":
            meta_data_query = (
                f" SELECT {cohorts_devices_table}.cohort_id , "
                f" {cohorts_devices_table}.device_id , "
                f" FROM {cohorts_devices_table} "
                f" WHERE {cohorts_devices_table}.cohort_id = '{cohort}' "
            )

            meta_data_query = (
                f" SELECT "
                f" {cohorts_table}.name AS cohort, "
                f" meta_data.* "
                f" FROM {cohorts_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.cohort_id = {cohorts_table}.id "
            )

            meta_data_query = (
                f" SELECT "
                f" {devices_table}.name  AS device_name , "
                f" meta_data.* "
                f" FROM {devices_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.device_id = {devices_table}.device_id "
            )

            query = (
                f" {data_query} , "
                f" meta_data.* "
                f" FROM {data_table} "
                f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.device_id = {data_table}.device"
                f" WHERE {data_table}.timestamp >= '{start_date_time}' "
                f" AND {data_table}.timestamp <= '{end_date_time}' "
                f" GROUP BY {data_table}.device, "
                f" meta_data.device_id, meta_data.cohort_id, meta_data.device_name, meta_data.cohort"
            )

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = (
            bigquery.Client()
            .query(f"select distinct * from ({query})", job_config)
            .result()
            .to_dataframe()
        )

        return dataframe.to_dict("records")

    def remove_outliers(self, pollutant):
        return self.add_stages(
            [
                {
                    "$match": {
                        f"{pollutant}.value": {
                            "$gte": 0,
                            "$lte": self.limit_mapper[pollutant],
                        }
                    }
                }
            ]
        )

    @staticmethod
    def _format_pollutants(pollutants):
        range_format = {}
        group_format = {}

        for pollutant in pollutants:
            range_format[f"values.{pollutant}.value"] = 1
            group_format[pollutant] = {"$avg": f"${pollutant}"}

        return range_format, group_format

    @staticmethod
    def _project_pollutant_filter(pollutants):
        filtered = {}

        for pollutant in pollutants:
            filtered[pollutant] = {"$round": [f"${pollutant}", 2]}

        return filtered

    @cache.memoize()
    def get_downloadable_events(
        self, sites, start_date, end_date, frequency, pollutants
    ):
        time_format_mapper = {
            "raw": "%Y-%m-%dT%H:%M:%S%z",
            "hourly": "%Y-%m-%d %H:00",
            "daily": "%Y-%m-%d",
            "monthly": "%Y-%m-01",
        }
        range_format, group_format = self._format_pollutants(pollutants)

        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
            .project(
                **{"values.site_id": 1, "values.time": 1, "values.frequency": 1},
                **range_format,
            )
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .project(
                _id=0,
                time={
                    "$dateToString": {
                        "format": time_format_mapper.get(frequency)
                        or time_format_mapper.get("hourly"),
                        "date": "$time",
                        "timezone": "Africa/Kampala",
                    }
                },
                pm2_5="$pm2_5.value",
                pm10="$pm10.value",
                no2="$no2.value",
                frequency=1,
                site_id={"$toString": "$site_id"},
            )
            .match_in(site_id=sites)
            .group(
                _id={"site_id": "$site_id", "time": "$time"},
                time={"$first": "$time"},
                **group_format,
                site_id={"$first": "$site_id"},
            )
            .project(
                site_id={"$toObjectId": "$site_id"}, time=1, pm2_5=1, pm10=1, no2=1
            )
            .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
            .unwind("site")
            .sort(time=self.ASCENDING)
            .project(
                _id=0,
                time=1,
                **self._project_pollutant_filter(pollutants),
                frequency={"$literal": frequency},
                site_id={"$toString": "$site_id"},
                site_name="$site.name",
                site_description="$site.description",
                latitude="$site.latitude",
                longitude="$site.longitude",
            )
            .exec()
        )

    @cache.memoize()
    def get_averages_by_pollutant(self, start_date, end_date, pollutant):
        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .project(
                _id=0,
                **{f"{pollutant}": 1},
                site_id={"$toString": "$site_id"},
            )
            .remove_outliers(pollutant)
            .group(
                _id="$site_id",
                site_id={"$first": "$site_id"},
                value={"$avg": f"${pollutant}.value"},
            )
            .project(_id=0, site_id=1, value={"$round": "$value"})
            .exec()
        )

    @cache.memoize()
    def get_averages_by_pollutant_from_bigquery(self, start_date, end_date, pollutant):
        if pollutant not in ["pm2_5", "pm10", "no2", "pm1"]:
            raise Exception("Invalid pollutant")

        query = f"""
            SELECT AVG({pollutant}) as value, site_id
            FROM {self.bigquery_events}
            WHERE  {self.bigquery_events}.timestamp >= '{start_date}'
            AND {self.bigquery_events}.timestamp <= '{end_date}' GROUP BY site_id
        """

        client = bigquery.Client()
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = client.query(query, job_config).result().to_dataframe()
        dataframe["value"] = dataframe["value"].apply(lambda x: round(x, 2))
        return dataframe.to_dict("records")

    @cache.memoize()
    def get_device_averages_from_bigquery(
        self, start_date, end_date, pollutant, devices
    ):
        if pollutant not in ["pm2_5", "pm10", "no2", "pm1"]:
            raise Exception("Invalid pollutant")

        query = f"""
            SELECT AVG({pollutant}) as value, device_id
            FROM {self.bigquery_events}
            WHERE  {self.bigquery_events}.timestamp >= '{start_date}'
            AND {self.bigquery_events}.timestamp <= '{end_date}'
            AND {self.bigquery_events}.device_id IN UNNEST({devices}) GROUP BY device_id
        """

        client = bigquery.Client()
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = client.query(query, job_config).result().to_dataframe()
        dataframe["value"] = dataframe["value"].apply(lambda x: round(x, 2))
        return dataframe.to_dict("records")

    @cache.memoize()
    def get_device_readings_from_bigquery(
        self, start_date, end_date, pollutant, devices
    ):
        if pollutant not in ["pm2_5", "pm10", "no2", "pm1"]:
            raise Exception("Invalid pollutant")

        query = f"""
        SELECT
    AVG({pollutant}) as {pollutant},
    device_id,
    TIMESTAMP(DATE(timestamp), "UTC") as timestamp
    FROM {self.bigquery_events}
    WHERE {self.bigquery_events}.timestamp >= '{start_date}'
    AND {self.bigquery_events}.timestamp <= '{end_date}'
    AND {self.bigquery_events}.device_id IN UNNEST({devices})
    GROUP BY device_id, timestamp
    ORDER BY device_id, timestamp;
        """
        client = bigquery.Client()
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = client.query(query, job_config).result().to_dataframe()
        dataframe[f"{pollutant}"] = dataframe[f"{pollutant}"].apply(
            lambda x: round(x, 2)
        )

        return dataframe

    @cache.memoize()
    def get_chart_events(self, sites, start_date, end_date, pollutant, frequency):
        time_format_mapper = {
            "raw": "%Y-%m-%dT%H:%M:%S%z",
            "hourly": "%Y-%m-%d %H:00",
            "daily": "%Y-%m-%d",
            "monthly": "%Y-%m-01",
        }

        return (
            self.project(
                **{"values.time": 1, "values.site_id": 1, f"values.{pollutant}": 1}
            )
            .date_range("values.time", start_date=start_date, end_date=end_date)
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .project(
                _id=0,
                time={
                    "$dateToString": {
                        "format": time_format_mapper.get(frequency)
                        or time_format_mapper.get("hourly"),
                        "date": "$time",
                        "timezone": "Africa/Kampala",
                    }
                },
                **{f"{pollutant}.value": 1},
                site_id={"$toString": "$site_id"},
            )
            .remove_outliers(pollutant)
            .match_in(site_id=sites)
            .group(
                _id={"site_id": "$site_id", "time": "$time"},
                time={"$first": "$time"},
                value={"$avg": f"${pollutant}.value"},
            )
            .group(
                _id="$_id.site_id",
                values={
                    "$push": {
                        "time": "$time",
                        "value": {"$round": ["$value", 2]},
                    }
                },
            )
            .project(site_id={"$toObjectId": "$_id"}, values=1)
            .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
            .project(
                _id=1,
                site_id={"$toString": "$_id"},
                values=1,
                site={"name": 1, "description": 1, "generated_name": 1},
            )
            .unwind("site")
            .exec()
        )

    def get_events(self, sites, start_date, end_date, frequency):
        """
        Retrieves and aggregates air quality event data for the specified sites and date range,
        grouped by site and time, based on the provided frequency.

        The method performs the following operations:
            - Filters documents within a given date range
            - Filters by frequency (defaults to "raw")
            - Unwinds nested `values` field
            - Looks up related site data
            - Formats the timestamp based on frequency
            - Projects selected pollutant fields and site metadata
            - Groups data by site and formatted timestamp
            - Averages pollutant values
            - Sorts by time

        Args:
            sites(list): List of site IDs to filter results by.
            start_date(str): The start date (inclusive) in ISO format.
            end_date(str): The end date (inclusive) in ISO format.
            frequency(str): The frequency of data aggregation (e.g., "raw", "hourly", "daily", "monthly").

        Returns:
            list: A list of dictionaries containing grouped and averaged pollutant data per site and time window.

        Example Return Structure:
            [
                {
                    "_id": {"site_id": "123", "time": "2024-01-01"},
                    "frequency": "daily",
                    "pm2_5": 13.4,
                    "pm10": 22.1,
                    "no2": 7.8,
                    "sites": {
                        "name": "Site A",
                        "description": "Near market",
                        "generated_name": "site_a_01"
                    }
                },
                ...
            ]
        """
        time_format_mapper = {
            "raw": "%Y-%m-%dT%H:%M:%S%z",
            "hourly": "%Y-%m-%d %H:00",
            "daily": "%Y-%m-%d",
            "monthly": "%Y-%m-01",
        }

        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
            .filter_by(**{"values.frequency": "raw"})
            .unwind("values")
            .replace_root("values")
            .lookup("sites", local_field="site_id", foreign_field="_id", col_as="sites")
            .project(
                _id=0,
                time={
                    "$dateToString": {
                        "format": time_format_mapper.get(frequency)
                        or time_format_mapper.get("hourly"),
                        "date": "$time",
                        "timezone": "Africa/Kampala",
                    }
                },
                **{"pm2_5.value": 1},
                **{"pm10.value": 1},
                **{"no2.value": 1},
                frequency=1,
                site_id={"$toString": "$site_id"},
                sites={"name": 1, "description": 1, "generated_name": 1},
            )
            .match_in(site_id=sites)
            .group(
                _id={"site_id": "$site_id", "time": "$time"},
                frequency={"$first": "$frequency"},
                pm2_5={"$avg": "$pm2_5.value"},
                pm10={"$avg": "$pm10.value"},
                no2={"$avg": "$no2.value"},
                sites={"$first": "$sites"},
            )
            .sort(**{"_id.time": 1})
            .exec()
        )
