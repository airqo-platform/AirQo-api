import pandas as pd
from google.cloud import bigquery
from airqo_etl_utils.config import configuration


class BigQueryApi:
    def __init__(self):
        self.client = bigquery.Client()
        self.hourly_measurements_table = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        self.hourly_weather_table = configuration.BIGQUERY_HOURLY_WEATHER_TABLE
        self.analytics_table = configuration.BIGQUERY_ANALYTICS_TABLE

        self.analytics_numeric_columns = [
            "device_number",
            "device_latitude",
            "device_longitude",
            "site_latitude",
            "site_longitude",
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
            "site_altitude",
            "temperature",
            "humidity",
            "wind_speed",
            "atmospheric_pressure",
            "radiation",
            "vapor_pressure",
            "wind_gusts",
            "precipitation",
            "wind_direction",
            "distance_to_nearest_primary_road",
            "distance_to_nearest_road",
            "distance_to_nearest_residential_road",
            "distance_to_nearest_secondary_road",
            "distance_to_nearest_unclassified_road",
            "distance_to_nearest_tertiary_road",
            "distance_to_kampala_center",
            "landform_270",
            "aspect",
            "bearing_to_kampala_center",
            "landform_90",
        ]
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
        self.hourly_weather_numeric_columns = [
            "temperature",
            "humidity",
            "wind_speed",
            "atmospheric_pressure",
            "radiation",
            "vapor_pressure",
            "wind_gusts",
            "precipitation",
            "wind_direction",
        ]

        self.hourly_measurements_columns = [
            "time",
            "tenant",
            "site_id",
            "device",
        ] + self.hourly_measurements_numeric_columns
        self.hourly_weather_columns = [
            "time",
            "tenant",
            "site_id",
        ] + self.hourly_weather_numeric_columns
        self.analytics_columns = [
            "time",
            "tenant",
            "site_id",
            "site_name",
            "device_name",
            "site_description",
            "country",
            "region",
            "parish",
            "sub_county",
            "county",
            "region",
            "country",
            "district",
            "city",
        ] + self.analytics_numeric_columns

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

    def save_data(self, data: list, destination_table: str) -> None:
        if destination_table == "hourly_measurements":
            columns = self.hourly_measurements_columns
            numeric_columns = self.hourly_measurements_numeric_columns
            table = self.hourly_measurements_table
        elif destination_table == "weather_measurements":
            columns = self.hourly_weather_columns
            numeric_columns = self.hourly_weather_numeric_columns
            table = self.hourly_weather_table
        elif destination_table == "analytics":
            columns = self.analytics_columns
            numeric_columns = self.analytics_numeric_columns
            table = self.analytics_table
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
        self, start_date_time: str, end_date_time: str, columns: list, source: str
    ) -> pd.DataFrame:

        if source == "weather_measurements":
            table = self.hourly_weather_table
        elif source == "hourly_measurements":
            table = self.hourly_measurements_table
        else:
            raise Exception("Invalid source table")

        query = f"""
            SELECT {', '.join(map(str, columns))}
            FROM `{table}`
            WHERE time >= '{start_date_time}' and time <= '{end_date_time}'
        """

        dataframe = self.client.query(query=query).result().to_dataframe()

        return dataframe

    def save_raw_measurements(self, measurements: list) -> None:
        pass
