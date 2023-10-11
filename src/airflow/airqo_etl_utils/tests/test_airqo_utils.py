import unittest
from datetime import datetime

import pandas as pd
import pytest

from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.tests.conftest import FaultDetectionFixtures


class TestAirQoDataUtils(unittest.TestCase):
    def test_map_site_ids_to_historical_data(self):
        logs = pd.DataFrame(
            [
                {
                    "site_id": "02",
                    "device_number": 1,
                    "start_date_time": "2022-01-01T00:00:00Z",
                    "end_date_time": "2022-01-02T00:00:00Z",
                }
            ]
        )

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 1, "timestamp": "2022-01-01T10:00:00Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "02")
        self.assertEqual(data.iloc[0]["device_number"], 1)
        self.assertEqual(date_to_str(data.iloc[0]["timestamp"]), "2022-01-01T10:00:00Z")

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 1, "timestamp": "2022-01-02T10:00:01Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "01")
        self.assertEqual(data.iloc[0]["device_number"], 1)
        self.assertEqual(date_to_str(data.iloc[0]["timestamp"]), "2022-01-02T10:00:01Z")

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 2, "timestamp": "2022-01-01T10:00:00Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "01")
        self.assertEqual(data.iloc[0]["device_number"], 2)
        self.assertEqual(date_to_str(data.iloc[0]["timestamp"]), "2022-01-01T10:00:00Z")


def test_map_site_ids_to_historical_data():
    logs = pd.DataFrame(
        [
            {
                "site_id": "02",
                "device_number": 1,
                "start_date_time": "2022-01-01T00:00:00Z",
                "end_date_time": "2022-01-02T00:00:00Z",
            }
        ]
    )

    data = pd.DataFrame(
        [{"site_id": "01", "device_number": 1, "timestamp": "2022-01-01T10:00:00Z"}]
    )
    data = AirQoDataUtils.map_site_ids_to_historical_data(
        data=data, deployment_logs=logs
    )
    assert data.iloc[0]["site_id"] == "02"
    assert data.iloc[0]["device_number"] == 1
    assert date_to_str(data.iloc[0]["timestamp"]) == "2022-01-01T10:00:00Z"

    data = pd.DataFrame(
        [{"site_id": "01", "device_number": 1, "timestamp": "2022-01-02T10:00:01Z"}]
    )
    data = AirQoDataUtils.map_site_ids_to_historical_data(
        data=data, deployment_logs=logs
    )
    assert data.iloc[0]["site_id"] == "01"
    assert data.iloc[0]["device_number"] == 1
    assert date_to_str(data.iloc[0]["timestamp"]) == "2022-01-02T10:00:01Z"

    data = pd.DataFrame(
        [{"site_id": "01", "device_number": 2, "timestamp": "2022-01-01T10:00:00Z"}]
    )
    data = AirQoDataUtils.map_site_ids_to_historical_data(
        data=data, deployment_logs=logs
    )
    assert data.iloc[0]["site_id"] == "01"
    assert data.iloc[0]["device_number"] == 2
    assert date_to_str(data.iloc[0]["timestamp"]) == "2022-01-01T10:00:00Z"


class TestFaultDetector(FaultDetectionFixtures):
    def test_input_output_type(self, df_valid):
        assert isinstance(df_valid, pd.DataFrame)
        assert isinstance(AirQoDataUtils.flag_faults(df_valid), pd.DataFrame)

    @pytest.mark.xfail
    def test_output_columns(self, df_valid):
        output = AirQoDataUtils.flag_faults(df_valid)
        expected_columns = [
            "device_name",
            "correlation_fault",
            "missing_data_fault",
            "created_at",
        ]
        assert list(output.columns) == expected_columns
        assert output["device_name"].dtype == object
        assert output["correlation_fault"].dtype == int
        assert output["missing_data_fault"].dtype == int
        assert output["created_at"].dtype == "datetime64[ns]"

    @pytest.mark.xfail
    def test_output_values(self, df_valid, expected_output):
        output = AirQoDataUtils.flag_faults(df_valid)
        # assert len(output) == 1
        assert output.iloc[0]["device_name"] == "B"
        assert output.iloc[0]["correlation_fault"] == 1
        assert output.iloc[0]["missing_data_fault"] == 0

    def test_output_flags(self, df_invalid_corr, df_invalid_nan):
        output_invalid_corr = AirQoDataUtils.flag_faults(df_invalid_corr)
        output_invalid_nan = AirQoDataUtils.flag_faults(df_invalid_nan)
        assert output_invalid_corr.iloc[0]["correlation_fault"] == 1
        assert output_invalid_nan.iloc[0]["missing_data_fault"] == 1

    @pytest.mark.xfail
    def test_output_timestamp(self, df_valid):
        output = AirQoDataUtils.flag_faults(df_valid)
        assert output.iloc[0]["created_at"] == datetime.now().isoformat(
            timespec="seconds"
        )

    def test_input_errors(self, df_invalid_type, df_invalid_columns, df_invalid_empty):
        with pytest.raises(ValueError):
            AirQoDataUtils.flag_faults(df_invalid_type)
            AirQoDataUtils.flag_faults(df_invalid_columns)
            AirQoDataUtils.flag_faults(df_invalid_empty)
