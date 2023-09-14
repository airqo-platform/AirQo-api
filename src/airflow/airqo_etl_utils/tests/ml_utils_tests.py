import pytest

from airqo_etl_utils.ml_utils import ForecastUtils as FUtils
from airqo_etl_utils.tests.conftest import ForecastFixtures


class TestsForecasts(ForecastFixtures):
    def test_preprocess_data_typical_case(self, example_data):
        result = FUtils.preprocess_data(example_data, "daily")
        assert "pm2_5" in result.columns

    def test_preprocess_data_invalid_input(self, example_data):
        df = example_data.drop(columns=["device_id"])
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, "daily")

    def test_preprocess_data_invalid_timestamp(self, example_data):
        # Invalid timestamp
        df = example_data.copy()
        df["timestamp"] = "invalid"
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, "daily")