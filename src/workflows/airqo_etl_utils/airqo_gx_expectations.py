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
        valid_engines = ["sql", "pandas"]
        if execution_engine not in valid_engines:
            raise ValueError("Unsupported execution engine")
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

    def gaseous_low_cost_sensor_raw_data_check(
        self,
        data: pandas.DataFrame,
        data_asset_name: str = "gaseous_low_cost_sensor_raw_data_gas",
    ) -> None:
        """
        Sets up expectations for the gaseous low cost sensors raw data.
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
        self.expectation_suite_name = "gaseous_low_cost_sensor_raw_data_gas"
        self.data_asset_name = data_asset_name
        self.checkpoint_name = "low_cost_raw_data_gas"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()

    def gaseous_low_cost_sensor_averaged_data_check(
        self,
        data: pandas.DataFrame,
        data_asset_name: str = "gaseous_low_cost_sensor_averaged_data_gas",
    ) -> None:
        """
        Sets up expectations for the gaseous low cost sensors averaged data.
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
        self.expectation_suite_name = "gaseous_low_cost_sensor_averaged_data_gas"
        self.data_asset_name = data_asset_name
        self.checkpoint_name = "low_cost_averaged_data_gas"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()

    def pm2_5_low_cost_sensor_raw_data(
        self,
        data: pandas.DataFrame,
        data_asset_name: str = "pm2_5_low_cost_sensor_raw_data",
    ) -> None:
        """
        Sets up expectations for the pm2.5 and pm10 low cost sensors raw data.
        """
        expectations = {
            "expect_column_values_to_not_be_null": [
                "s1_pm2_5",
                "s2_pm2_5",
                "s1_pm10",
                "s2_pm10",
                "timestamp",
                "device_id",
            ],
            "expect_column_values_to_be_between": [
                {"pm2_5": {"min_value": 0, "max_value": 1000}},
                {"pm10": {"min_value": 0, "max_value": 1000}},
            ],
        }
        self.expectations = expectations
        self.expectation_suite_name = "pm2_5_low_cost_sensor_raw_data"
        self.data_asset_name = data_asset_name
        self.checkpoint_name = "low_cost_raw_data"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()

    def pm2_5_low_cost_sensor_average_data(
        self,
        data: pandas.DataFrame,
        data_asset_name: str = "pm2_5_low_cost_sensor_averaged_data",
    ) -> None:
        """
        Sets up expectations for the pm2.5 and pm10 low cost sensors averaged data.
        """
        expectations = {
            "expect_column_values_to_not_be_null": [
                "pm2_5",
                "pm10",
                "timestamp",
                "device_id",
            ],
            "expect_column_values_to_be_between": [
                {"pm2_5": {"min_value": 0, "max_value": 1000}},
                {"pm10": {"min_value": 0, "max_value": 1000}},
            ],
        }
        self.expectations = expectations
        self.expectation_suite_name = "pm2_5_low_cost_sensor_averaged_data"
        self.data_asset_name = data_asset_name
        self.checkpoint_name = "low_cost_averaged_data"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()

    def bam_sensors_raw_data(
        self, data: pandas.DataFrame, data_asset_name: str = "bam_sensor_raw_data"
    ) -> None:
        """
        Sets up expectations for the pm2.5 and pm10 bam sensors raw data.
        """
        expectations = {
            "expect_column_values_to_not_be_null": [
                "realtime_conc",
                "hourly_conc",
                "short_time_conc",
                "air_flow",
                "status",
                "timestamp",
                "device_id",
            ],
            "expect_column_values_to_be_between": [
                {"realtime_conc": {"min_value": 0, "max_value": 1000}},
                {"hourly_conc": {"min_value": 0, "max_value": 1000}},
                {"short_time_conc": {"min_value": 0, "max_value": 1000}},
            ],
        }
        self.expectations = expectations
        self.expectation_suite_name = "bam_sensor_raw_data"
        self.data_asset_name = data_asset_name
        self.checkpoint_name = "bam_raw_data"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()

    def bam_sensors_averaged_data(
        self, data: pandas.DataFrame, data_asset_name: str = "bam_sensor_averaged_data"
    ) -> None:
        """
        Sets up expectations for the pm2.5 and pm10 bam sensors averaged data.
        """
        expectations = {
            "expect_column_values_to_not_be_null": [
                "pm2_5",
                "pm10",
                "timestamp",
                "device_id",
            ],
            "expect_column_values_to_be_between": [
                {"pm2_5": {"min_value": 0, "max_value": 1000}},
                {"pm10": {"min_value": 0, "max_value": 1000}},
            ],
        }
        self.expectations = expectations
        self.expectation_suite_name = "bam_sensor_averaged_data"
        self.data_asset_name = data_asset_name
        self.checkpoint_name = "bam_averaged_data"
        self.execution_engine = self.execution_engine
        self.dataframe = data
        self.run_checks()
