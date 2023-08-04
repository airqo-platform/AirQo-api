# test_fault_detector.py
from datetime import datetime

import pandas as pd
import pytest

from airqo_etl_utils.airqo_utils import AirQoDataUtils
from conftest import FaultDetectionFixtures


class TestFaultDetector(FaultDetectionFixtures):
    def test_input_output_type(self, df_valid):
        assert isinstance(df_valid, pd.DataFrame)
        assert isinstance(AirQoDataUtils.flag_faults(df_valid), pd.DataFrame)

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

    def test_output_values(self,  df_valid, expected_output):
        output = AirQoDataUtils.flag_faults(df_valid)
        assert len(output) == 1
        assert output.iloc[0]["device_name"] == "B"
        assert output.iloc[0]["correlation_fault"] == 1
        assert output.iloc[0]["missing_data_fault"] == 0

    def test_output_flags(self, df_invalid_corr, df_invalid_nan):
        output_invalid_corr = AirQoDataUtils.flag_faults(df_invalid_corr)
        output_invalid_nan = AirQoDataUtils.flag_faults(df_invalid_nan)
        assert output_invalid_corr.iloc[0]["correlation_fault"] == 1
        assert output_invalid_nan.iloc[0]["missing_data_fault"] == 1

    def test_output_timestamp(self, df_valid):
        output = AirQoDataUtils.flag_faults(df_valid)
        assert output.iloc[0]["created_at"] == datetime.now().isoformat(timespec="seconds")

    def test_input_errors(self,  df_invalid_type, df_invalid_columns, df_invalid_empty):
        with pytest.raises(ValueError):
            AirQoDataUtils.flag_faults(df_invalid_type)
            AirQoDataUtils.flag_faults(df_invalid_columns)
            AirQoDataUtils.flag_faults(df_invalid_empty)

            


