import os
from datetime import datetime

import pandas as pd
from google.cloud import bigquery
from google.oauth2 import service_account

from .config import configuration
from .constants import JobAction, ColumnDataType, Tenant, QueryType
from .date import date_to_str
from .utils import Utils


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
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

        self.package_directory, _ = os.path.split(__file__)

    def get_devices_hourly_data(
        self,
        day: datetime,
    ) -> pd.DataFrame:
        query = (
            f" SELECT {self.hourly_measurements_table}.pm2_5_calibrated_value , "
            f" {self.hourly_measurements_table}.pm2_5_raw_value ,"
            f" {self.hourly_measurements_table}.site_id ,"
            f" {self.hourly_measurements_table}.device_id AS device ,"
            f" FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {self.hourly_measurements_table}.timestamp) AS timestamp ,"
            f" FROM {self.hourly_measurements_table} "
            f" WHERE DATE({self.hourly_measurements_table}.timestamp) >= '{day.strftime('%Y-%m-%d')}' "
            f" AND {self.hourly_measurements_table}.pm2_5_raw_value is not null "
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
            else self.get_columns(table=table, column_type=ColumnDataType.TIMESTAMP)
        )

        float_columns = (
            float_columns
            if float_columns
            else self.get_columns(table=table, column_type=ColumnDataType.FLOAT)
        )

        integer_columns = (
            integer_columns
            if integer_columns
            else self.get_columns(table=table, column_type=ColumnDataType.INTEGER)
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
        self, table: str, column_type: ColumnDataType = ColumnDataType.NONE
    ) -> list:
        if (
            table == self.hourly_measurements_table
            or table == self.daily_measurements_table
        ):
            schema_file = "measurements.json"
        elif table == self.raw_measurements_table:
            schema_file = "raw_measurements.json"
        elif table == self.hourly_weather_table or table == self.raw_weather_table:
            schema_file = "weather_data.json"
        elif table == self.latest_measurements_table:
            schema_file = "latest_measurements.json"
        elif table == self.consolidated_data_table:
            schema_file = "data_warehouse.json"
        elif table == self.airqlouds_table:
            schema_file = "airqlouds.json"
        elif table == self.airqlouds_sites_table:
            schema_file = "airqlouds_sites.json"
        elif table == self.grids_table:
            schema_file = "grids.json"
        elif table == self.cohorts_table:
            schema_file = "cohorts.json"
        elif table == self.grids_sites_table:
            schema_file = "grids_sites.json"
        elif table == self.cohorts_devices_table:
            schema_file = "cohorts_devices.json"
        elif table == self.sites_table:
            schema_file = "sites.json"
        elif table == self.sites_meta_data_table:
            schema_file = "sites_meta_data.json"

        elif table == self.sensor_positions_table:
            schema_file = "sensor_positions.json"
        elif table == self.devices_table:
            schema_file = "devices.json"
        elif (
            table == self.clean_mobile_raw_measurements_table
            or table == self.unclean_mobile_raw_measurements_table
        ):
            schema_file = "mobile_measurements.json"
        elif table == self.airqo_mobile_measurements_table:
            schema_file = "airqo_mobile_measurements.json"
        elif table == self.bam_measurements_table:
            schema_file = "bam_measurements.json"
        elif table == self.raw_bam_measurements_table:
            schema_file = "bam_raw_measurements.json"
        elif table == "all":
            schema_file = None
        else:
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

            # with os.scandir(os.path.join("path", "schema")) as iterator:
            #     for entry in iterator:
            #         if entry.name.endswith(".json") and entry.is_file():
            #
            #             file_schema = Utils.load_schema(file_path=entry.path)
            #             schema.extend(file_schema)

        columns = []
        if column_type != ColumnDataType.NONE:
            for column in schema:
                if column["type"] == str(column_type):
                    columns.append(column["name"])
        else:
            columns = [column["name"] for column in schema]
        return list(set(columns))

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
        tenant: Tenant,
        where_fields: dict = None,
        null_cols: list = None,
        columns: list = None,
    ) -> str:
        null_cols = [] if null_cols is None else null_cols
        where_fields = {} if where_fields is None else where_fields

        columns = ", ".join(map(str, columns)) if columns else " * "
        where_clause = (
            f" timestamp >= '{start_date_time}' and timestamp <= '{end_date_time}' "
        )
        if tenant != Tenant.ALL:
            where_clause = f" {where_clause} and tenant = '{str(tenant)}' "

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
        tenant: Tenant,
        columns: list = None,
        where_fields: dict = None,
        null_cols: list = None,
    ) -> pd.DataFrame:
        query = self.compose_query(
            QueryType.GET,
            table=table,
            tenant=tenant,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            where_fields=where_fields,
            null_cols=null_cols,
            columns=columns,
        )

        dataframe = self.client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            return pd.DataFrame()

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)

        return dataframe.drop_duplicates(keep="first")

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
        query = f"""
        SELECT DISTINCT raw_device_data_table.timestamp
           AS
           timestamp, raw_device_data_table.device_id AS device_name, raw_device_data_table.s1_pm2_5 AS s1_pm2_5, raw_device_data_table.s2_pm2_5 AS s2_pm2_5
           FROM
           `{self.raw_measurements_table}` AS raw_device_data_table
           WHERE
           DATE(timestamp) >= DATE_SUB(
               CURRENT_DATE(), INTERVAL 7 DAY) 
            ORDER BY device_id, timestamp
           """

        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True

        dataframe = self.client.query(f"{query}", job_config).result().to_dataframe()
        try:
            if dataframe.empty:
                raise Exception("No data found from bigquery")
            dataframe["timestamp"] = pd.to_datetime(dataframe["timestamp"], utc=True)
            dataframe = (
                dataframe.groupby("device_name").resample("H", on="timestamp").mean()
            )
            dataframe.reset_index(inplace=True)
            return dataframe
        except Exception as e:
            print(f"Error when fetching data from bigquery, {e}")

    #
    def fetch_data(
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

    @staticmethod
    def save_forecasts_to_bigquery(df, table):
        """saves the dataframes to the bigquery tables"""
        credentials = service_account.Credentials.from_service_account_file(
            configuration.GOOGLE_APPLICATION_CREDENTIALS
        )
        df.to_gbq(
            destination_table=f"{table}",
            project_id=configuration.GOOGLE_CLOUD_PROJECT_ID,
            if_exists="append",
            credentials=credentials,
        )
        print("Hourly data saved to bigquery")
