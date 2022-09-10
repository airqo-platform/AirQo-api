import os

import pandas as pd
from google.cloud import bigquery

from .config import configuration
from .constants import JobAction, ColumnDataType, Tenant
from .data_validator import DataValidationUtils
from .utils import Utils


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        self.raw_measurements_table = configuration.BIGQUERY_RAW_EVENTS_TABLE
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
        self.analytics_table = configuration.BIGQUERY_ANALYTICS_TABLE
        self.consolidated_data_table = configuration.BIGQUERY_ANALYTICS_TABLE
        self.sites_table = configuration.BIGQUERY_SITES_TABLE
        self.devices_table = configuration.BIGQUERY_DEVICES_TABLE
        self.devices_data_table = configuration.BIGQUERY_DEVICES_DATA_TABLE

        self.package_directory, _ = os.path.split(__file__)

    def validate_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
        raise_column_exception=True,
        date_time_columns=None,
        float_columns=None,
        integer_columns=None,
    ) -> pd.DataFrame:
        columns = self.get_columns(table=table)

        if set(columns).issubset(set(list(dataframe.columns))):
            dataframe = dataframe[columns]
        else:
            print(f"Required columns {columns}")
            print(f"Dataframe columns {list(dataframe.columns)}")
            print(
                f"Difference between required and received {list(set(columns) - set(dataframe.columns))}"
            )
            if raise_column_exception:
                raise Exception("Invalid columns")

        date_time_columns = (
            date_time_columns
            if date_time_columns
            else self.get_columns(table=table, data_type=ColumnDataType.TIMESTAMP)
        )

        float_columns = (
            float_columns
            if float_columns
            else self.get_columns(table=table, data_type=ColumnDataType.FLOAT)
        )

        integer_columns = (
            integer_columns
            if integer_columns
            else self.get_columns(table=table, data_type=ColumnDataType.INTEGER)
        )

        col_data_types = {
            "float": float_columns,
            "integer": integer_columns,
            "timestamp": date_time_columns,
        }

        dataframe = DataValidationUtils.format_data_types(
            data=dataframe, col_data_types=col_data_types
        )

        return dataframe.drop_duplicates(keep="first")

    def get_columns(
        self, table: str, data_type: ColumnDataType = ColumnDataType.NONE
    ) -> list:

        if table == self.hourly_measurements_table:
            schema_file = "measurements.json"
        elif table == self.raw_measurements_table:
            schema_file = "raw_measurements.json"
        elif table == self.hourly_weather_table or table == self.raw_weather_table:
            schema_file = "weather_data.json"
        elif table == self.analytics_table or table == self.consolidated_data_table:
            schema_file = "data_warehouse.json"
        elif table == self.sites_table:
            schema_file = "sites.json"
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
        else:
            raise Exception("Invalid table")

        schema = Utils.load_schema(file_name=schema_file)

        columns = []
        if data_type != ColumnDataType.NONE:
            for column in schema:
                if column["type"] == data_type.to_string():
                    columns.append(column["name"])
        else:
            columns = [column["name"] for column in schema]
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

    def reload_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
        start_date_time: str,
        end_date_time: str,
        tenant: Tenant = Tenant.NONE,
    ) -> None:

        query = f"""
            DELETE FROM `{table}`
            WHERE timestamp >= '{start_date_time}' and timestamp <= '{end_date_time}'
        """

        if tenant != Tenant.NONE:
            query = f" {query} and tenant = '{str(tenant)}' "

        self.client.query(query=query).result()

        self.load_data(dataframe=dataframe, table=table, job_action=JobAction.APPEND)

    def query_data(
        self,
        start_date_time: str,
        end_date_time: str,
        table: str,
        columns: list = None,
        where_fields=None,
    ) -> pd.DataFrame:

        if where_fields is None:
            where_fields = {}

        columns = ", ".join(map(str, columns)) if columns else " * "

        where_clause = ""
        for key in where_fields.keys():
            where_clause = where_clause + f" and {key} = '{where_fields[key]}'"

        query = f"""
            SELECT {columns}
            FROM `{table}`
            WHERE timestamp >= '{start_date_time}' and timestamp <= '{end_date_time}' {where_clause}
        """
        dataframe = self.client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            return pd.DataFrame()

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)

        return dataframe.drop_duplicates(keep="first")

    def query_devices(self, tenant: Tenant) -> pd.DataFrame:
        query = f"""
            SELECT * FROM `{self.devices_data_table}` WHERE tenant = '{tenant}'
        """
        dataframe = self.client.query(query=query).result().to_dataframe()
        return dataframe.drop_duplicates(keep="first")
