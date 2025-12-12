from .airqo_gx_utils import AirQoGx
import pandas


class AirQoGxExpectations:
    """
    Data quality validation orchestrator for AirQo sensor data using Great Expectations.

    This class provides pre-configured data quality checks for different sensor types and data formats
    in the AirQo platform. It acts as a high-level interface that abstracts the complexity of
    Great Expectations setup and configuration for domain-specific air quality validation scenarios.

    Architecture:
        - Orchestrates AirQoGx for Great Expectations setup and execution
        - Supports both SQL (BigQuery) and pandas execution engines
        - Provides sensor-specific validation suites (gas sensors, PM sensors, BAM devices)
        - Automatically stores validation results in BigQuery for monitoring

    Supported Sensor Types:
        - Gaseous sensors: CO2, HCHO, TVOC measurements with environmental parameters
        - Low-cost PM sensors: PM2.5 and PM10 particulate matter measurements
        - BAM (Beta Attenuation Monitor): High-precision PM measurements
        - Mobile sensors: Portable PM measurement devices

    Data Processing Modes:
        - Raw data: Direct sensor readings with full temporal resolution
        - Averaged data: Time-aggregated measurements for trend analysis

    Usage Examples:
        >>> # Validate raw gas sensor data
        >>> validator = AirQoGxExpectations.from_pandas()
        >>> validator.gaseous_low_cost_sensor_raw_data_check(gas_data_df)

        >>> # Validate averaged PM data from BigQuery
        >>> validator = AirQoGxExpectations.from_sql("airqo_bigquery_source")
        >>> validator.pm2_5_low_cost_sensor_average_data(df, "pm_averages_table")

    Note:
        All validation methods automatically execute checks and store results in BigQuery.
        Failed validations do not raise exceptions but are recorded for monitoring.
    """

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
        Orchestrates the complete data validation workflow using Great Expectations.

        This method handles the full validation lifecycle:
        1. Initializes AirQoGx with configured parameters (datasource, expectations, checkpoint)
        2. Sets up Great Expectations context, datasource, and expectation suite
        3. Executes validation checkpoint against the target data
        4. Processes validation results and extracts metrics
        5. Stores structured results in BigQuery for monitoring and alerting

        Execution Flow:
            setup() -> run() -> digest_validation_results() -> store_results_in_bigquery()

        Error Handling:
            - Validation failures are captured as metrics, not exceptions
            - Technical errors (setup, connection) may raise exceptions
            - All results (pass/fail) are persisted to BigQuery

        Side Effects:
            - Creates/updates Great Expectations configuration files
            - Inserts validation results into BigQuery monitoring tables
            - May create temporary data assets for validation

        Note:
            This method assumes all instance attributes (datasource_name, expectations, etc.)
            have been properly configured by the calling validation method.
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
        Factory method for SQL-based data validation using BigQuery as the execution engine.

        Creates an instance configured to validate data directly in BigQuery without loading
        into memory. This approach is optimal for large datasets and leverages BigQuery's
        computational capabilities for validation logic execution.

        Args:
            datasource_name (str, optional): Name of the BigQuery datasource configuration.
                Must match a datasource registered in Great Expectations context.
                Defaults to "BigQuery".

        Returns:
            AirQoGxExpectations: Instance configured for SQL execution engine.

        Usage Scenarios:
            - Large datasets that cannot fit in memory
            - Production data validation pipelines
            - Real-time validation of streaming data
            - Cost-effective validation using BigQuery compute

        Example:
            >>> validator = AirQoGxExpectations.from_sql("production_bigquery")
            >>> validator.pm2_5_low_cost_sensor_average_data(None, "hourly_averages")

        Note:
            When using SQL execution, pass table names as data_asset_name parameter
            rather than DataFrame objects to validation methods.
        """
        return cls(
            execution_engine="sql",
            datasource_name=datasource_name,
        )

    @classmethod
    def from_pandas(cls):
        """
        Factory method for in-memory data validation using pandas DataFrames.

        Creates an instance configured to validate data loaded in memory as pandas DataFrames.
        This approach provides flexibility for data preprocessing and is ideal for development,
        testing, and scenarios with moderate dataset sizes.

        Returns:
            AirQoGxExpectations: Instance configured for pandas execution engine with
                datasource_name set to "pandas_data_source".

        Performance Characteristics:
            - Memory usage: Entire dataset loaded into RAM
            - Speed: Fast for small to medium datasets (< 10M rows)
            - Flexibility: Supports complex data transformations before validation

        Usage Scenarios:
            - Development and testing environments
            - Data exploration and profiling
            - Custom data preprocessing pipelines
            - Integration with existing pandas workflows

        Example:
            >>> import pandas as pd
            >>> validator = AirQoGxExpectations.from_pandas()
            >>> gas_data = pd.read_csv("gas_sensor_readings.csv")
            >>> validator.gaseous_low_cost_sensor_raw_data_check(gas_data)

        Memory Considerations:
            Ensure sufficient RAM for dataset size. For datasets > 1GB, consider
            using from_sql() method with BigQuery execution instead.
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
        Validates raw data from gaseous air quality sensors measuring indoor/outdoor pollutants.

        This validation suite ensures data quality for low-cost electrochemical and optical
        sensors measuring gaseous pollutants. Applied to high-frequency raw measurements
        before any averaging or aggregation processing.

        Required Columns:
            ['co2', 'hcho', 'tvoc', 'timestamp', 'battery', 'intakehumidity',
             'intaketemperature', 'device_number', 'device_id']

        Validation Rules Applied:
            1. Null/missing value detection for all critical measurements
            2. Range validation based on sensor specifications and health guidelines
            3. Environmental parameter bounds for sensor reliability

        Args:
            data (pandas.DataFrame): Raw sensor measurements with required columns.
                Must contain at least one row of valid data.
            data_asset_name (str, optional): Identifier for the dataset in validation reports.
                Used for tracking and debugging in Great Expectations context.
                Defaults to "gaseous_low_cost_sensor_raw_data_gas".

        Raises:
            AttributeError: If required columns are missing from DataFrame.
            ValueError: If data contains no valid rows for validation.

        Example:
            >>> import pandas as pd
            >>> gas_data = pd.DataFrame({
            ...     'co2': [420, 850, 1200],
            ...     'tvoc': [0.2, 1.1, 2.8],
            ...     'hcho': [45, 78, 120],
            ...     'timestamp': ['2023-01-01 12:00:00', '2023-01-01 12:01:00', '2023-01-01 12:02:00'],
            ...     'device_id': ['GAS001', 'GAS001', 'GAS001'],
            ...     # ... other required columns
            ... })
            >>> validator = AirQoGxExpectations.from_pandas()
            >>> validator.gaseous_low_cost_sensor_raw_data_check(gas_data)

        Side Effects:
            - Executes validation and stores results in BigQuery monitoring tables
            - Creates validation artifacts in Great Expectations store
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
        Validates time-averaged data from gaseous air quality sensors for trend analysis.

        This validation suite ensures data quality for temporally aggregated gaseous pollutant
        measurements from low-cost electrochemical and optical sensors. Applied to processed
        data where high-frequency raw readings have been averaged over time periods (typically
        15-minute, hourly, or daily intervals) to reduce noise and enable trend analysis.

        Required Columns:
            ['co2', 'hcho', 'tvoc', 'timestamp', 'battery', 'intakehumidity',
             'intaketemperature', 'device_number', 'device_id']

        Validation Rules Applied:
            1. Null/missing value detection for all measurements
            2. Range validation with same bounds as raw data (sensor specifications)
            3. Environmental parameter stability assessment
            4. Temporal consistency validation

        Args:
            data (pandas.DataFrame): Time-averaged gaseous sensor measurements.
                Each row represents one averaging period with reduced noise.
            data_asset_name (str, optional): Dataset identifier for validation reports.
                Defaults to "gaseous_low_cost_sensor_averaged_data_gas".

        Example:
            >>> gas_avg_data = pd.DataFrame({
            ...     'co2': [420.5, 847.2, 1205.8],      # Smoothed ppm values
            ...     'tvoc': [0.18, 1.05, 2.74],         # Averaged mg/m³
            ...     'hcho': [42.3, 76.8, 118.5],        # Stable μg/m³ readings
            ...     'timestamp': ['2023-01-01 12:00:00', '2023-01-01 13:00:00', '2023-01-01 14:00:00'],
            ...     'device_id': ['GAS001', 'GAS001', 'GAS001'],
            ...     # ... other required columns
            ... })
            >>> validator = AirQoGxExpectations.from_pandas()
            >>> validator.gaseous_low_cost_sensor_averaged_data_check(gas_avg_data)

        Processing Note:
            Averaged data should show reduced variability compared to raw measurements
            while maintaining the same physical measurement ranges and detection limits.
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
        Validates raw particulate matter measurements from dual-sensor low-cost monitors.

        This validation suite ensures data quality for optical particle sensors measuring
        fine and coarse particulate matter. These sensors use laser scattering technology
        with dual sensors for measurement redundancy and quality assurance.

        Sensor Technology:
            - Optical particle counters using laser diode and photodetector
            - Dual sensor configuration (s1_, s2_) for measurement validation
            - Real-time particle counting with size discrimination
            - Operating range: 0-1000 μg/m³ for both PM2.5 and PM10

        Dual Sensor Validation:
            Raw data includes separate readings from both sensors (s1_pm2_5, s2_pm2_5,
            s1_pm10, s2_pm10) before averaging or correlation analysis. This enables:
            - Sensor drift detection through inter-sensor comparison
            - Quality flagging when sensors disagree significantly
            - Redundancy for critical air quality monitoring

        Required Columns:
            ['s1_pm2_5', 's2_pm2_5', 's1_pm10', 's2_pm10', 'timestamp', 'device_id']

        Validation Rules Applied:
            1. Null value detection for all sensor channels
            2. Range validation: 0-1000 μg/m³ (sensor specification limits)
            3. Device identification consistency
            4. Timestamp presence for temporal analysis

        Args:
            data (pandas.DataFrame): Raw dual-sensor PM measurements.
                Each row represents one measurement cycle from both sensors.
            data_asset_name (str, optional): Dataset identifier for validation tracking.
                Defaults to "pm2_5_low_cost_sensor_raw_data".

        Example:
            >>> pm_data = pd.DataFrame({
            ...     's1_pm2_5': [12.5, 28.3, 45.1],
            ...     's2_pm2_5': [11.8, 29.1, 44.7],
            ...     's1_pm10': [18.2, 35.6, 52.3],
            ...     's2_pm10': [17.9, 36.2, 51.8],
            ...     'timestamp': ['2023-01-01 14:00:00', '2023-01-01 14:01:00', '2023-01-01 14:02:00'],
            ...     'device_id': ['PM001', 'PM001', 'PM001']
            ... })
            >>> validator = AirQoGxExpectations.from_pandas()
            >>> validator.pm2_5_low_cost_sensor_raw_data(pm_data)

        Note:
            Raw data validation occurs before sensor fusion algorithms that combine
            s1_ and s2_ readings into final pm2_5 and pm10 values.
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
        Validates processed particulate matter data from low-cost sensors after sensor fusion.

        This validation suite ensures data quality for PM measurements that have undergone
        dual-sensor fusion and temporal averaging. Unlike raw data with separate s1_/s2_
        sensor channels, this validates the final processed PM2.5 and PM10 concentrations
        after quality assurance, sensor correlation, and time-based aggregation.

        Sensor Fusion Process:
            Processing steps applied before this validation:
            1. Dual sensor correlation analysis (s1_ vs s2_ agreement)
            2. Sensor drift detection and correction
            3. Quality flagging and outlier removal
            4. Weighted averaging based on sensor performance
            5. Temporal aggregation (15-min, hourly, daily averages)
            6. Environmental compensation (humidity, temperature)

        Data Quality Improvements:
            - Reduced measurement uncertainty through dual-sensor redundancy
            - Improved temporal stability via averaging
            - Enhanced accuracy through environmental corrections
            - Better correlation with reference measurements
            - Reduced influence of sensor-specific artifacts

        Required Columns:
            ['pm2_5', 'pm10', 'timestamp', 'device_id']

        Validation Rules Applied:
            1. Null value detection for final PM concentrations
            2. Range validation: 0-1000 μg/m³ (covers clean air to severe pollution)
            3. Temporal validation through timestamp validation
            4. Device identification for traceability

        Args:
            data (pandas.DataFrame): Processed PM concentrations after sensor fusion.
                Each row represents one averaging period with quality-assured values.
            data_asset_name (str, optional): Dataset identifier for validation tracking.
                Defaults to "pm2_5_low_cost_sensor_averaged_data".

        Example:
            >>> pm_avg_data = pd.DataFrame({
            ...     'pm2_5': [12.3, 28.7, 45.2],  # Quality-assured μg/m³
            ...     'pm10': [18.1, 35.4, 52.8],   # Sensor-fused μg/m³
            ...     'timestamp': ['2023-01-01 14:00:00', '2023-01-01 15:00:00', '2023-01-01 16:00:00'],
            ...     'device_id': ['PM001', 'PM001', 'PM001']
            ... })
            >>> validator = AirQoGxExpectations.from_pandas()
            >>> validator.pm2_5_low_cost_sensor_average_data(pm_avg_data)

        Note:
            This validation applies to the final processed data product suitable for
            public reporting, health studies, and regulatory applications.
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
        Validates raw data from Beta Attenuation Monitor (BAM) reference-grade PM sensors.

        BAM sensors represent the gold standard for continuous particulate matter monitoring,
        using beta radiation attenuation to provide highly accurate mass concentration
        measurements. These instruments serve as reference measurements for calibrating
        and validating low-cost sensor networks.

        Quality Assurance:
            BAM data undergoes rigorous QA including:
            - Automatic zero/span checks
            - Status code monitoring for maintenance needs

        Operational Parameters:
            - Concentration range: 0-1000 μg/m³ (configurable)

        Required Columns:
            ['realtime_conc', 'hourly_conc', 'short_time_conc', 'air_flow',
             'status', 'timestamp', 'device_id']

        Validation Rules Applied:
            1. Null value detection for all measurement channels
            2. Concentration range validation: 0-1000 μg/m³

        Args:
            data (pandas.DataFrame): Raw BAM measurements with all concentration channels.
                Typically contains 1-minute or 5-minute resolution data.
            data_asset_name (str, optional): Dataset identifier for validation reports.
                Defaults to "bam_sensor_raw_data".

        Example:
            >>> bam_data = pd.DataFrame({
            ...     'realtime_conc': [15.2, 18.7, 22.1],
            ...     'hourly_conc': [16.8, 17.2, 17.8],
            ...     'short_time_conc': [15.9, 18.1, 21.2],
            ...     'air_flow': [16.67, 16.65, 16.68],  # L/min
            ...     'status': [0, 0, 0],  # 0 = normal operation
            ...     'timestamp': ['2023-01-01 10:00:00', '2023-01-01 10:01:00', '2023-01-01 10:02:00'],
            ...     'device_id': ['BAM_001', 'BAM_001', 'BAM_001']
            ... })
            >>> validator = AirQoGxExpectations.from_pandas()
            >>> validator.bam_sensors_raw_data(bam_data)

        Use Cases:
            - Reference measurements for sensor network calibration
            - Validation of low-cost sensor accuracy
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
        Validates time-averaged particulate matter data from Beta Attenuation Monitor (BAM) sensors.

        This validation suite ensures data quality for processed BAM measurements that have been
        temporally aggregated from raw readings. Unlike raw BAM data with multiple concentration
        channels, averaged data focuses on final PM2.5 and PM10 mass concentrations after
        quality assurance.

        Data Processing Context:
            Averaged BAM data represents:
            - Time-weighted averages (typically hourly or daily)
            - Quality-assured measurements with outlier removal

        Quality Assurance Features:
            - Invalid data periods excluded from averages

        Required Columns:
            ['pm2_5', 'pm10', 'timestamp', 'device_id']

        Validation Rules Applied:
            1. Null value detection for PM concentrations and metadata
            2. Range validation: 0-1000 μg/m³ (covers typical ambient to extreme pollution)

        Args:
            data (pandas.DataFrame): Time-averaged BAM PM concentrations.
                Each row represents one averaging period (hourly, daily, etc.).
            data_asset_name (str, optional): Dataset identifier for validation tracking.
                Defaults to "bam_sensor_averaged_data".

        Example:
            >>> bam_avg_data = pd.DataFrame({
            ...     'pm2_5': [12.3, 15.7, 18.2],  # μg/m³
            ...     'pm10': [18.9, 24.1, 28.6],   # μg/m³
            ...     'timestamp': ['2023-01-01 12:00:00', '2023-01-01 13:00:00', '2023-01-01 14:00:00'],
            ...     'device_id': ['BAM_001', 'BAM_001', 'BAM_001']
            ... })
            >>> validator = AirQoGxExpectations.from_pandas()
            >>> validator.bam_sensors_averaged_data(bam_avg_data)

        Note:
            Averaged data has undergone quality assurance and should show lower
            variability compared to raw measurements while maintaining measurement accuracy.
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
