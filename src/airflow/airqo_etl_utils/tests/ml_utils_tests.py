# TODO: Add tests for ml_utils.py

import pandas as pd

from airqo_etl_utils.ml_utils import ForecastUtils
from conftest import ForecastFixtures


class ForecastTests(ForecastFixtures):
    def test_preprocess_hourly_training_data(self, hourly_data, hourly_output):
        assert isinstance(
            ForecastUtils.preprocess_hourly_training_data(hourly_data), pd.DataFrame
        )
        assert (
            ForecastUtils.preprocess_hourly_training_data(hourly_data).shape[0]
            == hourly_output.shape[0]
        )
        assert ForecastUtils.preprocess_hourly_training_data(hourly_data)[
            "pm2_5"
        ].equals(hourly_output["pm2_5"])

    def test_preprocess_daily_training_data(self, daily_data, daily_output):
        assert isinstance(
            ForecastUtils.preprocess_daily_training_data(daily_data), pd.DataFrame
        )
        assert (
            ForecastUtils.preprocess_daily_training_data(daily_data).shape[0]
            == daily_output.shape[0]
        )
        assert ForecastUtils.preprocess_daily_training_data(daily_data)["pm2_5"].equals(
            daily_output["pm2_5"]
        )
