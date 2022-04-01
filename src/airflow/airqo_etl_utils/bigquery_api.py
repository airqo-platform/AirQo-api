import pandas as pd
from google.cloud import bigquery

from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.utils import get_file_content


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        self.hourly_weather_table = configuration.BIGQUERY_HOURLY_WEATHER_TABLE
        self.analytics_table = configuration.BIGQUERY_ANALYTICS_TABLE

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

    def validate_data(
        self, dataframe: pd.DataFrame, columns: list, numeric_columns: list, table: str
    ) -> pd.DataFrame:

        # time id depreciated. It will be replaced with timestamp
        if table == self.hourly_measurements_table:
            dataframe["time"] = dataframe["timestamp"]

        if sorted(list(dataframe.columns)) != sorted(columns):
            print(f"Required columns {columns}")
            print(f"Dataframe columns {list(dataframe.columns)}")
            print(
                f"Difference between required and received {list(set(columns) - set(dataframe.columns))}"
            )
            raise Exception("Invalid columns")

        dataframe["timestamp"] = pd.to_datetime(dataframe["timestamp"])
        dataframe[numeric_columns] = dataframe[numeric_columns].apply(
            pd.to_numeric, errors="coerce"
        )

        return dataframe

    def get_column_names(self, table: str, data_type="") -> list:
        if table == self.hourly_measurements_table:
            schema_file = configuration.BIGQUERY_HOURLY_EVENTS_TABLE_SCHEMA
        elif table == self.hourly_weather_table:
            schema_file = configuration.BIGQUERY_HOURLY_WEATHER_TABLE_SCHEMA
        elif table == self.analytics_table:
            schema_file = configuration.BIGQUERY_ANALYTICS_TABLE_SCHEMA
        else:
            raise Exception("Invalid table")

        schema = get_file_content(file_name=schema_file)

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
            dataframe=dataframe,
            columns=columns,
            numeric_columns=numeric_columns,
            table=table,
        )

        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
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

    def save_raw_measurements(self, measurements: list) -> None:
        pass
