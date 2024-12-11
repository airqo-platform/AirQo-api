import logging
import os
from datetime import datetime
from typing import List

import pandas as pd
from google.cloud import bigquery
from google.oauth2 import service_account

from .config import configuration
from .constants import JobAction, ColumnDataType, Tenant, QueryType
from .date import date_to_str
from .utils import Utils

logger = logging.getLogger(__name__)


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.schema_mapping = configuration.SCHEMA_FILE_MAPPING
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        # TODO: Remove later
        self.hourly_measurements_table_prod = (
            configuration.BIGQUERY_HOURLY_EVENTS_TABLE_PROD
        )
        self.daily_measurements_table = configuration.BIGQUERY_DAILY_EVENTS_TABLE
        self.hourly_forecasts_table = (
            configuration.BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE
        )
        self.raw_measurements_table = configuration.BIGQUERY_RAW_EVENTS_TABLE
        self.latest_measurements_table = configuration.BIGQUERY_LATEST_EVENTS_TABLE
        self.bam_measurements_table = configuration.BIGQUERY_BAM_EVENTS_TABLE
        self.raw_bam_measurements_table = configuration.BIGQUERY_RAW_BAM_DATA_TABLE
        self.sensor_positions_table = configuration.SENSOR_POSITIONS_TABLE
        self.unclean_mobile_raw_measurements_table = (
            configuration.BIGQUERY_UNCLEAN_RAW_MOBILE_EVENTS_TABLE
        )
        self.clean_mobile_raw_measurements_table = (
            configuration.BIGQUERY_CLEAN_RAW_MOBILE_EVENTS_TABLE
        )
        self.airqo_mobile_measurements_table = (
            configuration.BIGQUERY_AIRQO_MOBILE_EVENTS_TABLE
        )
        self.hourly_weather_table = configuration.BIGQUERY_HOURLY_WEATHER_TABLE
        self.raw_weather_table = configuration.BIGQUERY_RAW_WEATHER_TABLE
        self.consolidated_data_table = configuration.BIGQUERY_ANALYTICS_TABLE
        self.sites_table = configuration.BIGQUERY_SITES_TABLE
        self.airqlouds_table = configuration.BIGQUERY_AIRQLOUDS_TABLE
        self.airqlouds_sites_table = configuration.BIGQUERY_AIRQLOUDS_SITES_TABLE
        self.grids_table = configuration.BIGQUERY_GRIDS_TABLE
        self.cohorts_table = configuration.BIGQUERY_COHORTS_TABLE
        self.grids_sites_table = configuration.BIGQUERY_GRIDS_SITES_TABLE
        self.cohorts_devices_table = configuration.BIGQUERY_COHORTS_DEVICES_TABLE
        self.sites_meta_data_table = configuration.BIGQUERY_SITES_META_DATA_TABLE
        self.devices_table = configuration.BIGQUERY_DEVICES_TABLE
        self.devices_summary_table = configuration.BIGQUERY_DEVICES_SUMMARY_TABLE
        self.openweathermap_table = configuration.BIGQUERY_OPENWEATHERMAP_TABLE
        self.satellite_data_table = configuration.BIGQUERY_SATELLITE_DATA_TABLE
        self.package_directory, _ = os.path.split(__file__)

    def get_devices_hourly_data(
        self,
        day: datetime,
    ) -> pd.DataFrame:
        query = (
            f" SELECT `{self.hourly_measurements_table}`.pm2_5_calibrated_value , "
            f" `{self.hourly_measurements_table}`.pm2_5_raw_value ,"
            f" `{self.hourly_measurements_table}`.site_id ,"
            f" `{self.hourly_measurements_table}`.device_id AS device ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', `{self.hourly_measurements_table}`.timestamp) AS timestamp "
            f" FROM `{self.hourly_measurements_table}` "
            f" WHERE DATE(`{self.hourly_measurements_table}`.timestamp) >= '{day.strftime('%Y-%m-%d')}' "
            f" AND `{self.hourly_measurements_table}`.pm2_5_raw_value IS NOT NULL "
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

    def save_devices_summary_data(
        self,
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

        job_config = self.client.LoadJobConfig(schema=schema)
        job = bigquery.Client().load_table_from_dataframe(
            dataframe=data,
            destination=self.devices_summary_table,
            job_config=job_config,
        )
        job.result()

    def validate_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
        raise_exception=True,
        date_time_columns=None,
        float_columns=None,
        integer_columns=None,
    ) -> pd.DataFrame:
        valid_cols = self.get_columns(table=table)
        dataframe_cols = dataframe.columns.to_list()

        if set(valid_cols).issubset(set(dataframe_cols)):
            dataframe = dataframe[valid_cols]
        else:
            print(f"Required columns {valid_cols}")
            print(f"Dataframe columns {dataframe_cols}")
            print(
                f"Difference between required and received {list(set(valid_cols) - set(dataframe_cols))}"
            )
            if raise_exception:
                raise Exception("Invalid columns")

        date_time_columns = (
            date_time_columns
            if date_time_columns
            else self.get_columns(table=table, column_type=[ColumnDataType.TIMESTAMP])
        )

        float_columns = (
            float_columns
            if float_columns
            else self.get_columns(table=table, column_type=[ColumnDataType.FLOAT])
        )

        integer_columns = (
            integer_columns
            if integer_columns
            else self.get_columns(table=table, column_type=[ColumnDataType.INTEGER])
        )

        from .data_validator import DataValidationUtils

        dataframe = DataValidationUtils.format_data_types(
            data=dataframe,
            floats=float_columns,
            integers=integer_columns,
            timestamps=date_time_columns,
        )

        return dataframe.drop_duplicates(keep="first")

    def get_columns(
        self,
        table: str = "all",
        column_type: List[ColumnDataType] = [ColumnDataType.NONE],
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

        if schema_file is None and table != "all":
            raise Exception("Invalid table")

        if schema_file:
            schema = Utils.load_schema(file_name=schema_file)
        else:
            schema = []
            for file in [
                "measurements",
                "raw_measurements",
                "weather_data",
                "latest_measurements",
                "data_warehouse",
                "sites",
                "sensor_positions",
                "devices",
                "mobile_measurements",
                "airqo_mobile_measurements",
                "bam_measurements",
                "bam_raw_measurements",
            ]:
                file_schema = Utils.load_schema(file_name=f"{file}.json")
                schema.extend(file_schema)

        # Convert column_type list to strings for comparison
        column_type_strings = [str(ct) for ct in column_type]

        # Retrieve columns that match any of the specified types or match ColumnDataType.NONE
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

    def load_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
        job_action: JobAction = JobAction.APPEND,
    ) -> None:
        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(dataframe=dataframe, table=table)

        job_config = bigquery.LoadJobConfig(
            write_disposition=job_action.get_name(),
        )

        job = self.client.load_table_from_dataframe(
            dataframe, table, job_config=job_config
        )
        job.result()

        destination_table = self.client.get_table(table)
        print(f"Loaded {len(dataframe)} rows to {table}")
        print(f"Total rows after load :  {destination_table.num_rows}")

    @staticmethod
    def add_unique_id(dataframe: pd.DataFrame, id_column="unique_id") -> pd.DataFrame:
        dataframe[id_column] = dataframe.apply(
            lambda row: BigQueryApi.device_unique_col(
                tenant=row["tenant"],
                device_number=row["device_number"],
                device_id=row["device_id"],
            ),
            axis=1,
        )
        return dataframe

    @staticmethod
    def device_unique_col(tenant: str, device_id: str, device_number: int):
        return str(f"{tenant}:{device_id}:{device_number}").lower()

    def update_airqlouds(self, dataframe: pd.DataFrame, table=None) -> None:
        if table is None:
            table = self.airqlouds_table
        unique_cols = ["id", "tenant"]

        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(
            dataframe=dataframe,
            table=table,
        )

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        up_to_date_data = pd.concat([available_data, dataframe], ignore_index=True)
        up_to_date_data.drop_duplicates(subset=unique_cols, inplace=True, keep="first")

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_grids(self, dataframe: pd.DataFrame, table=None) -> None:
        if table is None:
            table = self.grids_table
        unique_cols = ["id", "tenant"]

        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(
            dataframe=dataframe,
            table=table,
        )

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        up_to_date_data = pd.concat([available_data, dataframe], ignore_index=True)
        up_to_date_data.drop_duplicates(subset=unique_cols, inplace=True, keep="first")

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_cohorts(self, dataframe: pd.DataFrame, table=None) -> None:
        if table is None:
            table = self.cohorts_table
        unique_cols = ["id", "tenant"]

        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(
            dataframe=dataframe,
            table=table,
        )

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        up_to_date_data = pd.concat([available_data, dataframe], ignore_index=True)
        up_to_date_data.drop_duplicates(subset=unique_cols, inplace=True, keep="first")

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_airqlouds_sites_table(self, dataframe: pd.DataFrame, table=None) -> None:
        if table is None:
            table = self.airqlouds_sites_table

        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(
            dataframe=dataframe,
            table=table,
        )

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        up_to_date_data = pd.concat([available_data, dataframe], ignore_index=True)
        up_to_date_data.drop_duplicates(inplace=True, keep="first")

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_grids_sites_table(self, dataframe: pd.DataFrame, table=None) -> None:
        if table is None:
            table = self.grids_sites_table

        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(
            dataframe=dataframe,
            table=table,
        )

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        up_to_date_data = pd.concat([available_data, dataframe], ignore_index=True)
        up_to_date_data.drop_duplicates(inplace=True, keep="first")

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_cohorts_devices_table(self, dataframe: pd.DataFrame, table=None) -> None:
        if table is None:
            table = self.cohorts_devices_table

        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(
            dataframe=dataframe,
            table=table,
        )

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        up_to_date_data = pd.concat([available_data, dataframe], ignore_index=True)
        up_to_date_data.drop_duplicates(inplace=True, keep="first")

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_sites_and_devices(
        self,
        dataframe: pd.DataFrame,
        table: str,
        component: str,
    ) -> None:
        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(dataframe=dataframe, table=table)

        if component == "sites":
            unique_id = "id"

        elif component == "devices":
            unique_id = "unique_id"
            dataframe = self.add_unique_id(dataframe)

        else:
            raise Exception("Invalid component. Valid values are sites and devices.")

        dataframe.drop_duplicates(subset=[unique_id], inplace=True, keep="first")

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        if available_data.empty:
            up_to_date_data = dataframe
        else:
            if component == "devices":
                available_data = self.add_unique_id(available_data)

            available_data.drop_duplicates(
                subset=[unique_id], inplace=True, keep="first"
            )
            data_not_for_updating = available_data.loc[
                ~available_data[unique_id].isin(dataframe[unique_id].to_list())
            ]
            up_to_date_data = pd.concat(
                [data_not_for_updating, dataframe], ignore_index=True
            )

        if component == "devices":
            del up_to_date_data[unique_id]

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_sites_meta_data(self, dataframe: pd.DataFrame) -> None:
        dataframe.reset_index(drop=True, inplace=True)
        table = self.sites_meta_data_table
        dataframe = self.validate_data(dataframe=dataframe, table=table)

        unique_id = "site_id"

        dataframe.drop_duplicates(subset=[unique_id], inplace=True, keep="first")

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        if available_data.empty:
            up_to_date_data = dataframe
        else:
            available_data.drop_duplicates(
                subset=[unique_id], inplace=True, keep="first"
            )
            data_not_for_updating = available_data.loc[
                ~available_data[unique_id].isin(dataframe[unique_id].to_list())
            ]
            up_to_date_data = pd.concat(
                [data_not_for_updating, dataframe], ignore_index=True
            )

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def update_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
    ) -> None:
        dataframe.reset_index(drop=True, inplace=True)
        dataframe = self.validate_data(dataframe=dataframe, table=table)
        dataframe = self.add_unique_id(dataframe=dataframe)
        dataframe.drop_duplicates(subset=["unique_id"], inplace=True, keep="first")

        available_data = (
            self.client.query(query=f"SELECT * FROM `{table}`").result().to_dataframe()
        )

        if available_data.empty:
            up_to_date_data = dataframe
        else:
            available_data["timestamp"] = available_data["timestamp"].apply(
                pd.to_datetime
            )
            available_data = self.add_unique_id(dataframe=available_data)

            available_data.drop_duplicates(
                subset=["unique_id"], inplace=True, keep="first"
            )
            data_not_for_updating = available_data.loc[
                ~available_data["unique_id"].isin(dataframe["unique_id"].to_list())
            ]
            up_to_date_data = pd.concat(
                [data_not_for_updating, dataframe], ignore_index=True
            )

        up_to_date_data["timestamp"] = up_to_date_data["timestamp"].apply(date_to_str)
        del up_to_date_data["unique_id"]

        self.load_data(
            dataframe=up_to_date_data, table=table, job_action=JobAction.OVERWRITE
        )

    def compose_query(
        self,
        query_type: QueryType,
        table: str,
        start_date_time: str,
        end_date_time: str,
        network: str = "all",
        where_fields: dict = None,
        null_cols: list = None,
        columns: list = None,
    ) -> str:
        """
        Composes a SQL query for BigQuery based on the query type (GET or DELETE),
        and optionally includes a dynamic selection and aggregation of numeric columns.

        Args:
            query_type (QueryType): The type of query (GET or DELETE).
            table (str): The BigQuery table to query.
            start_date_time (str): The start datetime for filtering records.
            end_date_time (str): The end datetime for filtering records.
            network (str): The network or ownership information (e.g., to filter data).
            where_fields (dict): Optional dictionary of fields to filter on.
            null_cols (list): Optional list of columns to check for null values.
            columns (list): Optional list of columns to select. If None, selects all.
            exclude_columns (list): List of columns to exclude from aggregation if dynamically selecting numeric columns.

        Returns:
            str: The composed SQL query as a string.

        Raises:
            Exception: If an invalid column is provided in `where_fields` or `null_cols`,
                      or if the `query_type` is not supported.
        """

        null_cols = [] if null_cols is None else null_cols
        where_fields = {} if where_fields is None else where_fields

        columns = ", ".join(map(str, columns)) if columns else " * "
        where_clause = f" timestamp between '{start_date_time}' and '{end_date_time}' "

        if network:
            where_clause += f"AND network = '{network}' "

        valid_cols = self.get_columns(table=table)

        for key, value in where_fields.items():
            if key not in valid_cols:
                raise Exception(
                    f"Invalid table column. {key} is not among the columns for {table}"
                )
            where_clause = where_clause + f" and {key} = '{value}' "

        for field in null_cols:
            if field not in valid_cols:
                raise Exception(
                    f"Invalid table column. {field} is not among the columns for {table}"
                )
            where_clause = where_clause + f" and {field} is null "

        if query_type == QueryType.DELETE:
            query = f"""
                DELETE FROM `{table}`
                WHERE {where_clause}
            """
        elif query_type == QueryType.GET:
            query = f"""
                SELECT {columns} FROM `{table}`
                WHERE {where_clause}
            """
        else:
            raise Exception(f"Invalid Query Type {str(query_type)}")
        return query

    def reload_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
        tenant: Tenant = Tenant.ALL,
        start_date_time: str = None,
        end_date_time: str = None,
        where_fields: dict = None,
        null_cols: list = None,
    ) -> None:
        if start_date_time is None or end_date_time is None:
            data = dataframe.copy()
            data["timestamp"] = pd.to_datetime(data["timestamp"])
            start_date_time = date_to_str(data["timestamp"].min())
            end_date_time = date_to_str(data["timestamp"].max())

        query = self.compose_query(
            QueryType.DELETE,
            table=table,
            tenant=tenant,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            where_fields=where_fields,
            null_cols=null_cols,
        )

        self.client.query(query=query).result()

        self.load_data(dataframe=dataframe, table=table)

    def query_data(
        self,
        start_date_time: str,
        end_date_time: str,
        table: str,
        network: str = None,
        dynamic_query: bool = False,
        columns: list = None,
        where_fields: dict = None,
        null_cols: list = None,
        time_granularity: str = "HOUR",
    ) -> pd.DataFrame:
        """
        Queries data from a specified BigQuery table based on the provided parameters.

        Args:
            start_date_time (str): The start datetime for the data query in ISO format.
            end_date_time (str): The end datetime for the data query in ISO format.
            table (str): The name of the table from which to retrieve the data.
            network(str): An Enum representing the site ownership. Defaults to `ALL` if not supplied, representing all networks.
            dynamic_query (bool): A boolean value to signal bypassing the automatic query composition to a more dynamic averaging approach.
            columns (list, optional): A list of column names to include in the query. If None, all columns are included. Defaults to None.
            where_fields (dict, optional): A dictionary of additional WHERE clause filters where the key is the field name and the value is the filter value. Defaults to None.
            null_cols (list, optional): A list of columns to filter out null values for. Defaults to None.

        Returns:
            pd.DataFrame: A pandas DataFrame containing the queried data, with duplicates removed and timestamps converted to `datetime` format. If no data is retrieved, an empty DataFrame is returned.
        """
        if not dynamic_query:
            query = self.compose_query(
                QueryType.GET,
                table=table,
                network=network,
                start_date_time=start_date_time,
                end_date_time=end_date_time,
                where_fields=where_fields,
                null_cols=null_cols,
                columns=columns,
            )
        else:
            query = self.dynamic_averaging_query(
                table,
                start_date_time,
                end_date_time,
                network=network,
                time_granularity=time_granularity,
            )

        dataframe = self.client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            return pd.DataFrame()

        dataframe.rename(columns={time_granularity.lower(): "timestamp"}, inplace=True)
        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)

        return dataframe.drop_duplicates(keep="first")

    def dynamic_averaging_query(
        self,
        table: str,
        start_date_time: str,
        end_date_time: str,
        exclude_columns: list = None,
        group_by: list = None,
        network: str = "all",
        time_granularity: str = "HOUR",
    ) -> str:
        """
        Constructs a dynamic SQL query to select and average numeric columns, allowing exclusions,
        custom groupings, and ordering by a specified time granularity (hour, day, week, month).

        Args:
            table (str): The BigQuery table to query.
            start_date_time (str): The start datetime for filtering records.
            end_date_time (str): The end datetime for filtering records.
            exclude_columns (list): List of columns to exclude from selection and aggregation.
                                    Defaults to excluding `device_number`, `device_id`, `site_id`, `timestamp`.
            group_by (list): List of columns to group by in the query. Defaults to
                            `["device_number", "device_id", "site_id", <time_granularity>]`.
            time_granularity (str): Time truncation granularity for ordering, must be one of `HOUR`,
                                    `DAY`, `WEEK`, or `MONTH`. Defaults to `HOUR`.

        Returns:
            str: A dynamic SQL query string that averages numeric columns and groups data based on
                the provided granularity and group-by fields.

                Example:
                    query = dynamic_averaging_query(
                        table="project.dataset.table",
                        start_date_time="2024-01-01T00:00:00",
                        end_date_time="2024-01-04T00:00:00",
                        exclude_columns=["device_number", "device_id", "site_id", "timestamp"],
                        group_by=["device_number", "site_id"],
                        time_granularity="HOUR"
                    )
        """
        valid_granularities = ["HOUR", "DAY", "WEEK", "MONTH"]
        if time_granularity.upper() not in valid_granularities:
            logger.exception(
                f"Invalid time granularity: {time_granularity}. Must be one of {valid_granularities}."
            )

        # Default for exclude_columns and group_by
        exclude_columns = exclude_columns or [
            "device_number",
            "device_id",
            "site_id",
            "timestamp",
        ]
        group_by = group_by or ["device_number", "device_id", "site_id", "network"]

        numeric_columns = self.get_columns(
            table, [ColumnDataType.FLOAT, ColumnDataType.INTEGER]
        )

        # Construct dynamic AVG statements for numeric columns
        avg_columns = ",\n    ".join(
            [
                f"AVG({col}) AS {col}"
                for col in numeric_columns
                if col not in exclude_columns
            ]
        )

        where_clause: str = (
            f"timestamp BETWEEN '{start_date_time}' AND '{end_date_time}' "
        )

        if network:
            where_clause += f"AND network = '{network}' "

        # Include time granularity in both SELECT and GROUP BY
        timestamp_trunc = f"TIMESTAMP_TRUNC(timestamp, {time_granularity.upper()}) AS {time_granularity.lower()}"
        group_by_clause = ", ".join(group_by + [time_granularity.lower()])

        query = f"""SELECT {", ".join(group_by)}, {timestamp_trunc}, {avg_columns} FROM `{table}` WHERE {where_clause} GROUP BY {group_by_clause} ORDER BY {time_granularity.lower()};"""

        return query

    def query_devices(self, tenant: Tenant) -> pd.DataFrame:
        if tenant == Tenant.ALL:
            query = f"""
              SELECT * FROM `{self.devices_table}`
          """
        else:
            query = f"""
                SELECT * FROM `{self.devices_table}` WHERE tenant = '{str(tenant)}'
            """

        dataframe = self.client.query(query=query).result().to_dataframe()
        return dataframe.drop_duplicates(keep="first")

    def query_sites(self, tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
        if tenant == Tenant.ALL:
            query = f"""
              SELECT * FROM `{self.sites_table}`
          """
        else:
            query = f"""
                SELECT * FROM `{self.sites_table}` WHERE tenant = '{str(tenant)}'
            """

        dataframe = self.client.query(query=query).result().to_dataframe()
        return dataframe.drop_duplicates(keep="first")

    def fetch_raw_readings(self) -> pd.DataFrame:
        """
        TODO: Document
        """
        query = f"""
        SELECT DISTINCT 
        raw_device_data_table.timestamp AS timestamp,
         raw_device_data_table.device_id AS device_id, 
         raw_device_data_table.latitude AS latitude,
         raw_device_data_table.longitude AS longitude,
-- review model performance with and without location
         raw_device_data_table.s1_pm2_5 AS s1_pm2_5, 
         raw_device_data_table.s2_pm2_5 AS s2_pm2_5,
         raw_device_data_table.pm2_5 AS pm2_5,
         raw_device_data_table.battery AS battery
           FROM
           `{self.raw_measurements_table}` AS raw_device_data_table
           WHERE
           DATE(timestamp) >= DATE_SUB(
               CURRENT_DATE(), INTERVAL 21 DAY) 
            ORDER BY device_id, timestamp
           """
        # TODO: May need to review frequency
        try:
            job_config = bigquery.QueryJobConfig()
            job_config.use_query_cache = True
            results = self.client.query(f"{query}", job_config).result().to_dataframe()
        except Exception as e:
            print(f"Error when fetching data from bigquery, {e}")
        else:
            if results.empty:
                raise Exception("No data found from bigquery")
            else:
                results["timestamp"] = pd.to_datetime(results["timestamp"], utc=True)
                num_cols = results.select_dtypes(include="number").columns
                results = (
                    results.groupby("device_id")
                    .resample("H", on="timestamp")[num_cols]
                    .mean()
                )
                results.reset_index(inplace=True)

        return results

    #
    def fetch_device_data_for_forecast_job(
        self,
        start_date_time: str,
        job_type: str,
    ) -> pd.DataFrame:
        try:
            pd.to_datetime(start_date_time)
        except ValueError:
            raise ValueError(f"Invalid start date time: {start_date_time}")

        query = f"""
        SELECT DISTINCT 
            t1.device_id, 
            t1.timestamp,  
            t1.pm2_5_calibrated_value as pm2_5, 
            t2.latitude, 
            t2.longitude,"""

        if job_type != "train":
            query += """
            t1.site_id,
            """

        query += f"""
        FROM `{self.hourly_measurements_table_prod}` t1 
        JOIN `{self.sites_table}` t2 on t1.site_id = t2.id """

        query += f"""
        WHERE date(t1.timestamp) >= '{start_date_time}' and t1.device_id IS NOT NULL 
        ORDER BY device_id, timestamp"""

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True
        try:
            df = self.client.query(query, job_config).result().to_dataframe()
            return df
        except Exception as e:
            print("Error fetching data from bigquery", {e})

    def fetch_device_data_for_satellite_job(
        self,
        start_date_time: str,
        job_type: str,
    ) -> pd.DataFrame:
        try:
            pd.to_datetime(start_date_time)
        except ValueError as e:
            raise ValueError(f"Invalid start date time: {start_date_time}") from e

        query = f"""
SELECT DISTINCT 
    TIMESTAMP_TRUNC(t1.timestamp, DAY) as timestamp,
    t2.city,
    t1.device_id,
    t2.latitude,
    t2.longitude,
    AVG(t1.pm2_5_calibrated_value) as pm2_5
FROM {self.hourly_measurements_table_prod} as t1 
INNER JOIN {self.sites_table} as t2 
    ON t1.site_id = t2.id 
WHERE 
    t1.timestamp > '{start_date_time}' 
    AND t2.city IN ('Kampala', 'Nairobi', 'Kisumu', 'Lagos', 'Accra', 'Bujumbura', 'Yaounde')
    AND t1.device_id IS NOT NULL
GROUP BY 
    timestamp,
    t1.device_id,
    t2.city,
    t2.latitude,
    t2.longitude
ORDER BY 
    t1.device_id,
    timestamp;
        """

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True
        try:
            df = self.client.query(query, job_config).result().to_dataframe()
            return df
        except Exception as e:
            print("Error fetching data from bigquery", {e})

    def fetch_satellite_readings(
        self,
        job_type: str,
        start_date_time: str = " ",
    ) -> pd.DataFrame:
        try:
            pd.to_datetime(start_date_time)
        except ValueError as e:
            raise ValueError(f"Invalid start date time: {start_date_time}") from e

        query = f"""
        SELECT DISTINCT * FROM `{self.satellite_data_table}`
        """

        if job_type == "train":
            query += f"""
            WHERE date(timestamp) >= '{start_date_time}' 
            """

        query += "ORDER BY timestamp" ""

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True
        try:
            df = self.client.query(query, job_config).result().to_dataframe()
            return df
        except Exception as e:
            print("Error fetching data from bigquery", {e})

    @staticmethod
    def save_data_to_bigquery(data: pd.DataFrame, table: str):
        """saves the dataframes to the bigquery tables"""
        credentials = service_account.Credentials.from_service_account_file(
            configuration.GOOGLE_APPLICATION_CREDENTIALS
        )
        data.to_gbq(
            destination_table=f"{table}",
            project_id=configuration.GOOGLE_CLOUD_PROJECT_ID,
            if_exists="append",
            credentials=credentials,
        )
        print(" data saved to bigquery")
