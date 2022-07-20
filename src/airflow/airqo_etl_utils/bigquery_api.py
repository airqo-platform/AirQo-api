import os

import pandas as pd
from google.cloud import bigquery

from airqo_etl_utils.config import configuration
from airqo_etl_utils.constants import JobAction, DataType
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.utils import get_file_content


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        self.raw_measurements_table = configuration.BIGQUERY_RAW_EVENTS_TABLE
        self.bam_measurements_table = configuration.BIGQUERY_BAM_EVENTS_TABLE
        self.bam_hourly_measurements_table = (
            configuration.BIGQUERY_BAM_HOURLY_EVENTS_TABLE
        )
        self.raw_mobile_measurements_table = (
            configuration.BIGQUERY_RAW_MOBILE_EVENTS_TABLE
        )
        self.hourly_weather_table = configuration.BIGQUERY_HOURLY_WEATHER_TABLE
        self.raw_weather_table = configuration.BIGQUERY_RAW_WEATHER_TABLE
        self.analytics_table = configuration.BIGQUERY_ANALYTICS_TABLE
        self.sites_table = configuration.BIGQUERY_SITES_TABLE
        self.devices_table = configuration.BIGQUERY_DEVICES_TABLE
        self.calibrated_hourly_measurements_table = (
            configuration.BIGQUERY_CALIBRATED_HOURLY_EVENTS_TABLE
        )
        self.package_directory, _ = os.path.split(__file__)

    def validate_data(
        self,
        dataframe: pd.DataFrame,
        table: str,
        raise_column_exception=True,
        date_time_columns=None,
        numeric_columns=None,
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

        # validating timestamp
        date_time_columns = (
            date_time_columns
            if date_time_columns
            else self.get_columns(table=table, data_type=DataType.TIMESTAMP)
        )
        dataframe[date_time_columns] = dataframe[date_time_columns].apply(
            pd.to_datetime, errors="coerce"
        )

        # validating floats
        numeric_columns = (
            numeric_columns
            if numeric_columns
            else self.get_columns(table=table, data_type=DataType.FLOAT)
        )
        dataframe[numeric_columns] = dataframe[numeric_columns].apply(
            pd.to_numeric, errors="coerce"
        )

        return dataframe

    def get_columns(self, table: str, data_type: DataType = DataType.NONE) -> list:

        if (
            table == self.hourly_measurements_table
            or table == self.raw_measurements_table
        ):
            schema_file = "measurements.json"
        elif table == self.hourly_weather_table or table == self.raw_weather_table:
            schema_file = "weather_data.json"
        elif table == self.calibrated_hourly_measurements_table:
            schema_file = "calibrated_measurements.json"
        elif table == self.analytics_table:
            schema_file = "data_warehouse.json"
        elif table == self.sites_table:
            schema_file = "sites.json"
        elif table == self.devices_table:
            schema_file = "devices.json"
        elif table == self.raw_mobile_measurements_table:
            schema_file = "mobile_measurements.json"
        elif (
            table == self.bam_measurements_table
            or table == self.bam_hourly_measurements_table
        ):
            schema_file = "bam_measurements.json"
        else:
            raise Exception("Invalid table")

        schema = get_file_content(file_name=schema_file)

        columns = []
        if data_type != DataType.NONE:
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
        tenant: str,
    ) -> None:

        query = f"""
            DELETE FROM `{table}`
            WHERE timestamp >= '{start_date_time}' and timestamp <= '{end_date_time}' and tenant = '{tenant}'
        """
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

        dataframe["timestamp"] = dataframe["timestamp"].apply(date_to_str)

        return dataframe
