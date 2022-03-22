import os

import pandas as pd
from google.cloud import bigquery
from airqo_etl_utils.config import configuration
import json


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        self.hourly_weather_table = configuration.BIGQUERY_HOURLY_WEATHER_TABLE
        self.analytics_table = configuration.BIGQUERY_ANALYTICS_TABLE
        self.package_directory, _ = os.path.split(__file__)

        self.analytics_numeric_columns = self.get_column_names(
            table=self.analytics_table, data_type="FLOAT"
        )
        self.hourly_measurements_numeric_columns = self.get_column_names(
            table=self.hourly_measurements_table, data_type="FLOAT"
        )
        self.hourly_weather_numeric_columns = self.get_column_names(
            table=self.hourly_weather_table, data_type="FLOAT"
        )

        self.hourly_measurements_columns = self.get_column_names(
            table=self.hourly_measurements_table
        )
        self.hourly_weather_columns = self.get_column_names(
            table=self.hourly_weather_table
        )
        self.analytics_columns = self.get_column_names(table=self.analytics_table)

    @staticmethod
    def validate_data(
        dataframe: pd.DataFrame, columns: list, numeric_columns: list
    ) -> pd.DataFrame:

        if sorted(list(dataframe.columns)) != sorted(columns):
            print(f"Required columns {columns}")
            print(f"Dataframe columns {list(dataframe.columns)}")
            raise Exception("Invalid columns")

        dataframe["time"] = pd.to_datetime(dataframe["time"])
        dataframe[numeric_columns] = dataframe[numeric_columns].apply(
            pd.to_numeric, errors="coerce"
        )

        return dataframe

    def get_column_names(self, table: str, data_type="") -> list:
        if table == self.hourly_measurements_table:
            schema_path = "schema/measurements.json"
            schema = "measurements.json"
        elif table == self.hourly_weather_table:
            schema_path = "schema/weather_data.json"
            schema = "weather_data.json"
        elif table == self.analytics_table:
            schema_path = "schema/data_warehouse.json"
            schema = "data_warehouse.json"
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

    def save_data(self, data: list, table: str) -> None:
        if table == self.hourly_measurements_table:
            columns = self.hourly_measurements_columns
            numeric_columns = self.hourly_measurements_numeric_columns
        elif table == self.hourly_weather_table:
            columns = self.hourly_weather_columns
            numeric_columns = self.hourly_weather_numeric_columns
        elif table == self.analytics_table:
            columns = self.analytics_columns
            numeric_columns = self.analytics_numeric_columns
        else:
            raise Exception("Invalid destination table")

        dataframe = pd.DataFrame(data)

        dataframe = self.validate_data(
            dataframe=dataframe, columns=columns, numeric_columns=numeric_columns
        )

        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
        )

        job = self.client.load_table_from_dataframe(
            dataframe, table, job_config=job_config
        )
        job.result()

        table = self.client.get_table(table)
        print(
            "Loaded {} rows and {} columns to {}".format(
                table.num_rows, len(table.schema), table.friendly_name
            )
        )

    def save_hourly_measurements(self, measurements: list) -> None:

        dataframe = pd.DataFrame(measurements)

        dataframe = self.validate_data(
            dataframe=dataframe,
            columns=self.hourly_measurements_columns,
            numeric_columns=self.hourly_measurements_numeric_columns,
        )

        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
        )

        job = self.client.load_table_from_dataframe(
            dataframe, self.hourly_measurements_table, job_config=job_config
        )
        job.result()

        table = self.client.get_table(self.hourly_measurements_table)
        print(
            "Loaded {} rows and {} columns to {}".format(
                table.num_rows, len(table.schema), table.friendly_name
            )
        )

    def get_hourly_data(
        self, start_date_time: str, end_date_time: str, columns: list, table: str
    ) -> pd.DataFrame:

        query = f"""
            SELECT {', '.join(map(str, columns))}
            FROM `{table}`
            WHERE time >= '{start_date_time}' and time <= '{end_date_time}'
        """

        dataframe = self.client.query(query=query).result().to_dataframe()

        return dataframe

    def save_raw_measurements(self, measurements: list) -> None:
        pass
