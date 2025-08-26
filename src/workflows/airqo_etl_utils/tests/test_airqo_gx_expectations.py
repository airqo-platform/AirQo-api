import pytest
import pandas as pd
from unittest.mock import MagicMock, patch
from airqo_etl_utils.airqo_gx_expectations import AirQoGxExpectations


class TestAirQoGxExpectations:
    @pytest.fixture
    def mock_airqo_gx(self):
        """Fixture to mock the AirQoGx class."""
        with patch("airqo_etl_utils.airqo_gx_expectations.AirQoGx") as mock_gx:
            # Mock the run results structure that is expected by run_checks
            mock_instance = mock_gx.return_value
            mock_run_result = MagicMock()
            mock_run_result.run_results = {
                "mock_validator_id": {
                    "validation_result": {
                        "success": True,
                        "meta": {
                            "run_id": MagicMock(
                                run_name="test_run", run_time="2023-01-01T00:00:00Z"
                            ),
                            "active_batch_definition": {
                                "datasource_name": "test_datasource",
                                "data_asset_name": "test_data_asset",
                            },
                            "checkpoint_name": "test_checkpoint",
                            "expectation_suite_name": "test_suite",
                        },
                        "results": [
                            {
                                "expectation_config": {
                                    "expectation_type": "expect_column_values_to_not_be_null",
                                    "kwargs": {"column": "test_column"},
                                },
                                "success": True,
                                "exception_info": {"raised_exception": False},
                                "result": {
                                    "element_count": 100,
                                    "unexpected_count": 0,
                                    "unexpected_percent": 0,
                                    "partial_unexpected_list": [],
                                    "missing_count": 0,
                                    "partial_unexpected_counts": [],
                                },
                            }
                        ],
                    }
                }
            }
            mock_instance.run.return_value = mock_run_result
            yield mock_gx

    @pytest.fixture
    def averaged_lc_dataframe(self):
        """Fixture to provide an averaged low-cost data DataFrame."""
        return pd.DataFrame(
            {
                "pm2_5": [10, 20, 30],
                "pm10": [15, 25, 35],
                "timestamp": [
                    "2023-01-01T00:00:00Z",
                    "2023-01-01T01:00:00Z",
                    "2023-01-01T02:00:00Z",
                ],
                "battery": [90, 85, 80],
                "intakehumidity": [50, 55, 60],
                "intaketemperature": [25, 26, 27],
                "device_number": [1, 2, 3],
                "device_id": ["device_1", "device_2", "device_3"],
                "site_id": ["site_1", "site_2", "site_3"],
            }
        )

    @pytest.fixture
    def gas_lc_dataframe(self):
        """Fixture to provide a gas low-cost data DataFrame."""
        return pd.DataFrame(
            {
                "co2": [400, 410, 420],
                "hcho": [0.5, 0.6, 0.7],
                "tvoc": [0.8, 0.9, 1.0],
                "timestamp": [
                    "2023-01-01T00:00:00Z",
                    "2023-01-01T01:00:00Z",
                    "2023-01-01T02:00:00Z",
                ],
                "battery": [4.2, 3.9, 5.0],
                "intakehumidity": [50, 55, 60],
                "intaketemperature": [25, 26, 27],
                "device_number": [1, 2, 3],
                "device_id": ["device_1", "device_2", "device_3"],
                "site_id": ["site_1", "site_2", "site_3"],
            }
        )

    @pytest.fixture
    def raw_lc_dataframe(self):
        """Fixture to provide a raw low-cost data DataFrame."""
        return pd.DataFrame(
            {
                "s1_pm2_5": [10, 20, 30],
                "s2_pm2_5": [12, 22, 32],
                "s1_pm10": [15, 25, 35],
                "s2_pm10": [17, 27, 37],
                "timestamp": [
                    "2023-01-01T00:00:00Z",
                    "2023-01-01T01:00:00Z",
                    "2023-01-01T02:00:00Z",
                ],
                "battery": [90, 85, 80],
                "intakehumidity": [50, 55, 60],
                "intaketemperature": [25, 26, 27],
                "device_number": [1, 2, 3],
                "device_id": ["device_1", "device_2", "device_3"],
                "site_id": ["site_1", "site_2", "site_3"],
            }
        )

    @pytest.fixture
    def bam_raw_dataframe(self):
        """Fixture to provide raw BAM data DataFrame."""
        return pd.DataFrame(
            {
                "realtime_conc": [10, 20, 30],
                "hourly_conc": [15, 25, 35],
                "short_time_conc": [5, 10, 15],
                "air_flow": [100, 200, 300],
                "timestamp": [
                    "2023-01-01T00:00:00Z",
                    "2023-01-01T01:00:00Z",
                    "2023-01-01T02:00:00Z",
                ],
                "device_number": [1, 2, 3],
                "device_id": ["device_1", "device_2", "device_3"],
                "site_id": ["site_1", "site_2", "site_3"],
                "status": [100, 0, 1001],
            }
        )

    @pytest.fixture
    def bam_averaged_dataframe(self):
        """Fixture to provide averaged BAM data DataFrame."""
        return pd.DataFrame(
            {
                "pm2_5": [10, 20, 30],
                "pm10": [15, 25, 35],
                "timestamp": [
                    "2023-01-01T00:00:00Z",
                    "2023-01-01T01:00:00Z",
                    "2023-01-01T02:00:00Z",
                ],
                "device_number": [1, 2, 3],
                "device_id": ["device_1", "device_2", "device_3"],
                "site_id": ["site_1", "site_2", "site_3"],
                "status": [100, 0, 1001],
            }
        )

    def test_from_sql(self):
        """Test the from_sql class method."""
        instance = AirQoGxExpectations.from_sql(datasource_name="BigQuery")
        assert instance.execution_engine == "sql"
        assert instance.datasource_name == "BigQuery"

    def test_from_pandas(self):
        """Test the from_pandas class method."""
        instance = AirQoGxExpectations.from_pandas()
        assert instance.execution_engine == "pandas"
        assert instance.datasource_name == "pandas_data_source"

    def test_gaseous_low_cost_sensor_raw_data_check(
        self, mock_airqo_gx, gas_lc_dataframe
    ):
        """Test gaseous low-cost sensor raw data checks."""
        instance = AirQoGxExpectations.from_pandas()
        instance.gaseous_low_cost_sensor_raw_data_check(data=gas_lc_dataframe)

        mock_airqo_gx.assert_called_once()
        mock_airqo_gx_instance = mock_airqo_gx.return_value
        mock_airqo_gx_instance.setup.assert_called_once()
        mock_airqo_gx_instance.run.assert_called_once()
        mock_airqo_gx_instance.store_results_in_bigquery.assert_called_once()

    def test_pm2_5_low_cost_sensor_raw_data(self, mock_airqo_gx, raw_lc_dataframe):
        """Test PM2.5 low-cost sensor raw data checks."""
        instance = AirQoGxExpectations.from_pandas()
        instance.pm2_5_low_cost_sensor_raw_data(data=raw_lc_dataframe)

        mock_airqo_gx.assert_called_once()
        mock_airqo_gx_instance = mock_airqo_gx.return_value
        mock_airqo_gx_instance.setup.assert_called_once()
        mock_airqo_gx_instance.run.assert_called_once()
        mock_airqo_gx_instance.store_results_in_bigquery.assert_called_once()

    def test_pm2_5_low_cost_sensor_average_data(
        self, mock_airqo_gx, averaged_lc_dataframe
    ):
        """Test PM2.5 low-cost sensor averaged data checks."""
        instance = AirQoGxExpectations.from_pandas()
        instance.pm2_5_low_cost_sensor_average_data(data=averaged_lc_dataframe)

        mock_airqo_gx.assert_called_once()
        mock_airqo_gx_instance = mock_airqo_gx.return_value
        mock_airqo_gx_instance.setup.assert_called_once()
        mock_airqo_gx_instance.run.assert_called_once()
        mock_airqo_gx_instance.store_results_in_bigquery.assert_called_once()

    def test_bam_sensors_raw_data(self, mock_airqo_gx, bam_raw_dataframe):
        """Test BAM sensors raw data checks."""
        instance = AirQoGxExpectations.from_pandas()
        instance.bam_sensors_raw_data(data=bam_raw_dataframe)

        mock_airqo_gx.assert_called_once()
        mock_airqo_gx_instance = mock_airqo_gx.return_value
        mock_airqo_gx_instance.setup.assert_called_once()
        mock_airqo_gx_instance.run.assert_called_once()
        mock_airqo_gx_instance.store_results_in_bigquery.assert_called_once()

    def test_bam_sensors_averaged_data(self, mock_airqo_gx, bam_averaged_dataframe):
        """Test BAM sensors averaged data checks."""
        instance = AirQoGxExpectations.from_pandas()
        instance.bam_sensors_averaged_data(data=bam_averaged_dataframe)

        mock_airqo_gx.assert_called_once()
        mock_airqo_gx_instance = mock_airqo_gx.return_value
        mock_airqo_gx_instance.setup.assert_called_once()
        mock_airqo_gx_instance.run.assert_called_once()
        mock_airqo_gx_instance.store_results_in_bigquery.assert_called_once()

    def test_invalid_execution_engine(self):
        """Test invalid execution engine."""
        with pytest.raises(ValueError, match="Unsupported execution engine"):
            AirQoGxExpectations(execution_engine="invalid_engine")
