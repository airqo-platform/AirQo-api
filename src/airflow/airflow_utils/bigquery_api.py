import pandas as pd
from google.cloud import bigquery
from airflow_utils.config import configuration


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        self.hourly_measurements_numeric_columns = [
            "device_number",
            "latitude",
            "longitude",
            "pm2_5",
            "pm2_5_raw_value",
            "pm2_5_calibrated_value",
            "pm10",
            "pm10_raw_value",
            "pm10_calibrated_value",
            "no2",
            "no2_raw_value",
            "no2_calibrated_value",
            "pm1",
            "pm1_raw_value",
            "pm1_calibrated_value",
            "external_temperature",
            "external_pressure",
            "external_humidity",
            "wind_speed",
            "altitude",
        ]
        self.hourly_measurements_columns = [
            "time",
            "tenant",
            "site_id",
            "device",
        ] + self.hourly_measurements_numeric_columns

    def save_hourly_measurements(self, measurements: list) -> None:

        dataframe = pd.DataFrame(measurements)

        if list(dataframe.columns) != self.hourly_measurements_columns:
            print(f"Required columns {self.hourly_measurements_columns}")
            print(f"Dataframe columns {list(dataframe.columns)}")
            raise Exception("Invalid columns")

        dataframe["time"] = pd.to_datetime(dataframe["time"])
        dataframe[self.hourly_measurements_numeric_columns] = dataframe[
            self.hourly_measurements_numeric_columns
        ].apply(pd.to_numeric, errors="coerce")

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

    def save_raw_measurements(self, measurements: list) -> None:
        pass
