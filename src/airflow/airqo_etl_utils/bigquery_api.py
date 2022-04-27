import json
import os

import pandas as pd
from google.cloud import bigquery

from airqo_etl_utils.config import configuration
from airqo_etl_utils.constants import JobAction
from airqo_etl_utils.date import date_to_str


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        self.raw_measurements_table = configuration.BIGQUERY_RAW_EVENTS_TABLE
        self.hourly_weather_table = configuration.BIGQUERY_HOURLY_WEATHER_TABLE
        self.raw_weather_table = configuration.BIGQUERY_RAW_WEATHER_TABLE
        self.analytics_table = configuration.BIGQUERY_ANALYTICS_TABLE
        self.sites_table = configuration.BIGQUERY_SITES_TABLE
        self.devices_table = configuration.BIGQUERY_DEVICES_TABLE
        self.package_directory, _ = os.path.split(__file__)

    def validate_data(self, dataframe: pd.DataFrame, table: str) -> pd.DataFrame:

        # time is depreciated. It will be replaced with timestamp
        if (
            table == self.hourly_measurements_table
            or table == self.raw_measurements_table
        ):
            dataframe["time"] = dataframe["timestamp"]

        columns = self.__get_columns(table=table)

        if sorted(list(dataframe.columns)) != sorted(columns):
            print(f"Required columns {columns}")
            print(f"Dataframe columns {list(dataframe.columns)}")
            print(
                f"Difference between required and received {list(set(columns) - set(dataframe.columns))}"
            )
            raise Exception("Invalid columns")

        # validating timestamp
        date_time_columns = self.__get_columns(table=table, data_type="TIMESTAMP")
        dataframe[date_time_columns] = dataframe[date_time_columns].apply(
            pd.to_datetime, errors="coerce"
        )

        # validating floats
        numeric_columns = self.__get_columns(table=table, data_type="FLOAT")
        dataframe[numeric_columns] = dataframe[numeric_columns].apply(
            pd.to_numeric, errors="coerce"
        )

        return dataframe

    def __get_columns(self, table: str, data_type="") -> list:
        if (
            table == self.hourly_measurements_table
            or table == self.raw_measurements_table
        ):
            schema_path = "schema/measurements.json"
            schema = "measurements.json"
        elif table == self.hourly_weather_table or table == self.raw_weather_table:
            schema_path = "schema/weather_data.json"
            schema = "weather_data.json"
        elif table == self.analytics_table:
            schema_path = "schema/data_warehouse.json"
            schema = "data_warehouse.json"
        elif table == self.sites_table:
            schema_path = "schema/sites.json"
            schema = "sites.json"
        elif table == self.devices_table:
            schema_path = "schema/devices.json"
            schema = "devices.json"
        else:
            raise Exception("Invalid table")

        try:
            schema_file = open(os.path.join(self.package_directory, schema_path))
        except FileNotFoundError:
            schema_file = open(os.path.join(self.package_directory, schema))

        schema = json.load(schema_file)
        columns = []
        if data_type:
            for column in schema:
                if column["type"] == data_type:
                    columns.append(column["name"])
        else:
            columns = [column["name"] for column in schema]
        return columns

    def save_data(
        self, dataframe: pd.DataFrame, table: str, job_action: JobAction = JobAction.APPEND
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
        print("Table for loading {} ".format(table))
        print(
            "Loaded {} rows and {} columns to {}".format(
                destination_table.num_rows,
                len(destination_table.schema),
                destination_table.friendly_name,
            )
        )

    def get_hourly_data(
        self, start_date_time: str, end_date_time: str, columns: list, table: str
    ) -> pd.DataFrame:

        try:
            query = f"""
                SELECT {', '.join(map(str, columns))}
                FROM `{table}`
                WHERE timestamp >= '{start_date_time}' and timestamp <= '{end_date_time}'
            """
            dataframe = self.client.query(query=query).result().to_dataframe()
        except Exception as ex:
            print(ex)
            query = f"""
                SELECT {', '.join(map(str, columns))}
                FROM `{table}`
                WHERE time >= '{start_date_time}' and time <= '{end_date_time}'
            """

            dataframe = self.client.query(query=query).result().to_dataframe()

        dataframe["timestamp"] = dataframe["timestamp"].apply(lambda x: date_to_str(x))
        if "time" in list(dataframe.columns):
            dataframe["time"] = dataframe["time"].apply(lambda x: date_to_str(x))

        return dataframe
