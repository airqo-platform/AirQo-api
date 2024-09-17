from typing import Dict, Any
from .airqo_gx_utils import AirQoGx
import pandas


class AirQoGxExpectations:
    def __init__(self, execution_engine: str, datasource_name: str = None):
        self.datasource_name = datasource_name
        self.data_asset_name = None
        self.expectation_suite_name = None
        self.checkpoint_name = None
        self.expectations = None
        self.data_connector_name = None
        self.execution_engine = execution_engine
        self.dataframe = None
        self.cloud_mode = False

    def run_checks(self):
        """
        Sets up and executes the data validation checks using the AirQoGx class. The validation results are stored in bigquery.
        """
        gx_checks = AirQoGx(
            self.datasource_name,
            self.data_asset_name,
            self.expectation_suite_name,
            self.checkpoint_name,
            self.expectations,
            data_connector_name=self.data_connector_name,
            execution_engine=self.execution_engine,
            dataframe=self.dataframe,
            cloud_mode=self.cloud_mode,
        )

        gx_checks.setup()
        results = gx_checks.run()
        validator_id = list(results.run_results.keys())[0]
        gx_checks.store_results_in_bigquery(
            gx_checks.digest_validation_results(
                results.run_results.get(validator_id, {})
            )
        )

    @classmethod
    def from_sql(cls, datasource_name: str = "BigQuery"):
        """
        Creates a class contructor for the sql execution engine.
        """
        return cls(
            execution_engine="sql",
            datasource_name=datasource_name,
        )

    @classmethod
    def from_pandas(cls):
        """
        Creates a class contructor for the pandas execution engine.
        """
        return cls(
            datasource_name="pandas_data_source",
            execution_engine="pandas",
        )

    def gaseous_low_cost_sensor_raw_data_check(self, data: pandas.DataFrame) -> None:
        """
        Sets up expectations for the gaseous low cost sensors.
        """
        expectations = {
            "expect_column_values_to_not_be_null": [
                "co2",
                "hcho",
                "tvoc",
                "timestamp",
                "battery",
                "intakehumidity",
                "intaketemperature",
                "device_number",
                "device_id",
            ],
            "expect_column_values_to_be_between": [
                {"co2": {"min_value": 400, "max_value": 3000}},
                {"tvoc": {"min_value": 0, "max_value": 10}},
                {"hcho": {"min_value": 0, "max_value": 1500}},
                {"intakehumidity": {"min_value": 0, "max_value": 99}},
                {"intaketemperature": {"min_value": 0, "max_value": 45}},
            ],
        }
        self.expectations = expectations
        self.expectation_suite_name = "gaseous_low_cost_sensor_raw_data"
        self.data_asset_name = "gaseous_low_cost_sensor_raw_data"
        self.checkpoint_name = "low_cost_raw_data"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()

    def pm2_5_low_cost_sensor_raw_data(self, data: pandas.DataFrame) -> None:
        """
        Sets up expectations for the pm2.5 low cost sensors.
        """
        expectations = {
            "expect_column_values_to_not_be_null": [
                "pm2_5",
                "pm10",
                "temperature",
                "timestamp",
                "pressure",
                "humidity",
                "device_number",
                "device_id",
            ],
            "expect_column_values_to_be_between": [
                {"pm2_5": {"min_value": 1, "max_value": 1000}},
                {"pm10": {"min_value": 1, "max_value": 1000}},
                {"temperature": {"min_value": 0, "max_value": 45}},
                {"pressure": {"min_value": 30, "max_value": 110}},
                {"humidity": {"min_value": 0, "max_value": 99}},
            ],
        }
        self.expectations = expectations
        self.expectation_suite_name = "pm2_5_low_cost_sensor_raw_data"
        self.data_asset_name = "pm2_5_low_cost_sensor_raw_data"
        self.checkpoint_name = "low_cost_raw_data"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()
