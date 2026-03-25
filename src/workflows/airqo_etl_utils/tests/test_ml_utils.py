import pandas as pd
import pytest
import requests
from unittest.mock import MagicMock

import airqo_etl_utils.ml_utils as ml_utils_module
from airqo_etl_utils.ml_utils import BaseMlUtils as FUtils, ForecastModelTrainer
from airqo_etl_utils.tests.conftest import ForecastFixtures
from airqo_etl_utils.constants import ForecastConstants, Frequency


class TestsForecasts(ForecastFixtures):
    # Preprocess data tests
    def test_preprocess_data_typical_case(self, preprocessing_sample_df):
        result = FUtils.preprocess_data(
            preprocessing_sample_df, Frequency.DAILY, "train"
        )
        assert "pm2_5" in result.columns

    def test_preprocess_data_invalid_input(self, preprocessing_sample_df):
        df = preprocessing_sample_df.drop(columns=["device_id"])
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, Frequency.DAILY, "train")

    def test_preprocess_data_invalid_timestamp(self, preprocessing_sample_df):
        df = preprocessing_sample_df.copy()
        df["timestamp"] = "invalid"
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, Frequency.DAILY, "train")

    # Feature engineering tests
    # get_lag_and_rolling_features tests

    def test_empty_df(self):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_lag_and_roll_features(pd.DataFrame(), "pm2_5", Frequency.DAILY)

    def test_missing_columns(self, feat_eng_sample_df_daily):
        del feat_eng_sample_df_daily[
            "device_id"
        ]  # Test for case where 'device_id' is missing
        with pytest.raises(ValueError, match="Required columns missing"):
            FUtils.get_lag_and_roll_features(
                feat_eng_sample_df_daily, "pm2_5", Frequency.DAILY
            )

    def test_invalid_frequency(self, feat_eng_sample_df_daily):
        # Create a mock frequency object with an invalid value
        mock_freq = MagicMock()
        mock_freq.str = (
            "annually"  # This value doesn't exist in the function's if/elif conditions
        )
        with pytest.raises(ValueError, match="Invalid frequency"):
            FUtils.get_lag_and_roll_features(
                feat_eng_sample_df_daily, "pm2_5", mock_freq
            )

    def test_hourly_freq(self, feat_eng_sample_df_hourly):
        hourly_df = FUtils.get_lag_and_roll_features(
            feat_eng_sample_df_hourly, "pm2_5", Frequency.HOURLY
        )
        for s in [1, 2, 6, 12]:
            assert f"pm2_5_last_{s}_hour" in hourly_df.columns
        for s in [3, 6, 12, 24]:
            for f in ["mean", "std", "median", "skew"]:
                assert f"pm2_5_{f}_{s}_hour" in hourly_df.columns

    def test_daily_freq(self, feat_eng_sample_df_daily):
        daily_df = FUtils.get_lag_and_roll_features(
            feat_eng_sample_df_daily, "pm2_5", Frequency.DAILY
        )
        # Based on the actual implementation, we expect these lag values
        for s in [1, 2, 3, 7]:
            assert f"pm2_5_last_{s}_day" in daily_df.columns
        # Based on the actual implementation, we expect these rolling statistics
        for s in [2, 3, 7]:
            for f in ["mean", "std", "max", "min"]:
                assert f"pm2_5_{f}_{s}_day" in daily_df.columns

    def test_empty_df_for_cyclic_features(self):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_cyclic_features(pd.DataFrame(), Frequency.DAILY)

    def test_missing_columns_for_cyclic_features(self, feat_eng_sample_df_daily):
        # First create a dataframe without timestamp
        df_without_timestamp = feat_eng_sample_df_daily.drop(columns=["timestamp"])
        with pytest.raises(ValueError, match="Required columns missing"):
            FUtils.get_cyclic_features(df_without_timestamp, Frequency.DAILY)

    def test_invalid_frequency_for_cyclic_features(self, feat_eng_sample_df_daily):
        # Create a mock frequency object with an invalid value
        mock_freq = MagicMock()
        mock_freq.str = (
            "annually"  # This value doesn't exist in the function's if/elif conditions
        )
        with pytest.raises(ValueError, match="Invalid frequency"):
            FUtils.get_cyclic_features(feat_eng_sample_df_daily, mock_freq)

    # For 'daily' frequency
    def test_daily_freq_for_cyclic_features(self, feat_eng_sample_df_daily):
        daily_df = FUtils.get_cyclic_features(feat_eng_sample_df_daily, Frequency.DAILY)
        for a in ["year", "month", "day", "dayofweek", "week"]:
            for t in ["_sin", "_cos"]:
                assert f"{a}{t}" in daily_df.columns

    # For 'hourly' frequency
    def test_hourly_freq_for_cyclic_features(self, feat_eng_sample_df_hourly):
        hourly_df = FUtils.get_cyclic_features(
            feat_eng_sample_df_hourly, Frequency.HOURLY
        )
        for a in ["year", "month", "day", "dayofweek", "hour", "week"]:
            for t in ["_sin", "_cos"]:
                assert f"{a}{t}" in hourly_df.columns

    def test_empty_df_for_location_features(
        self, sample_dataframe_for_location_features
    ):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_location_features(pd.DataFrame())

    def test_missing_timestamp_for_location_features(
        self,
        sample_dataframe_for_location_features,
    ):
        del sample_dataframe_for_location_features["timestamp"]
        with pytest.raises(ValueError, match="timestamp column is missing"):
            FUtils.get_location_features(sample_dataframe_for_location_features)

    # For missing 'latitude' column
    def test_missing_latitude_for_location_features(
        self, sample_dataframe_for_location_features
    ):
        del sample_dataframe_for_location_features[
            "latitude"
        ]  # Test for missing 'latitude'
        with pytest.raises(ValueError, match="latitude column is missing"):
            FUtils.get_location_features(sample_dataframe_for_location_features)

    def test_missing_longitude_for_location_features(
        self, sample_dataframe_for_location_features
    ):
        del sample_dataframe_for_location_features[
            "longitude"
        ]  # Test for missing 'longitude'
        with pytest.raises(ValueError, match="longitude column is missing"):
            FUtils.get_location_features(sample_dataframe_for_location_features)

    # Test the normal procedure
    def test_get_location_features(self, sample_dataframe_for_location_features):
        df = FUtils.get_location_features(sample_dataframe_for_location_features)
        for cord in ["x_cord", "y_cord", "z_cord"]:
            assert cord in df.columns

    @pytest.mark.xfail
    @pytest.mark.parametrize(
        "frequency,collection_name",
        [
            ("hourly", "hourly_forecasts"),
            ("daily", "daily_forecasts"),
            # ("invalid", None),
        ],
    )
    def test_save_forecasts_to_mongo_frequency(
        self, mock_db, frequency, collection_name, sample_dataframe_db
    ):
        if frequency == "invalid":
            # Expect a ValueError for an invalid frequency
            with pytest.raises(ValueError) as e:
                FUtils.save_forecasts_to_mongo(sample_dataframe_db, frequency)
            assert str(e.value) == f"Invalid frequency argument: {frequency}"
        else:
            # Expect no exception for a valid frequency
            FUtils.save_forecasts_to_mongo(sample_dataframe_db, frequency)
            mock_collection = getattr(mock_db, collection_name)
            assert mock_collection.update_one.call_count == 0


def test_enrich_site_daily_forecasts_with_met_data_uses_rounded_unique_coordinates(
    monkeypatch,
):
    site_data = pd.DataFrame(
        [
            {
                "site_id": "site_01",
                "site_name": "Synthetic Site 1",
                "site_latitude": 0.1231,
                "site_longitude": 32.5671,
            },
            {
                "site_id": "site_02",
                "site_name": "Synthetic Site 2",
                "site_latitude": 0.1249,
                "site_longitude": 32.5651,
            },
        ]
    )
    forecast_data = pd.DataFrame(
        [
            {
                "site_id": "site_01",
                "site_name": "Synthetic Site 1",
                "site_latitude": 0.1231,
                "site_longitude": 32.5671,
                "date": pd.Timestamp("2026-03-24"),
                "pm2_5_mean": 20.0,
                "pm2_5_min": 18.0,
                "pm2_5_max": 24.0,
                "pm2_5_low": 19.0,
                "pm2_5_high": 22.0,
                "created_at": pd.Timestamp("2026-03-23T00:00:00Z"),
            },
            {
                "site_id": "site_02",
                "site_name": "Synthetic Site 2",
                "site_latitude": 0.1249,
                "site_longitude": 32.5651,
                "date": pd.Timestamp("2026-03-24"),
                "pm2_5_mean": 22.0,
                "pm2_5_min": 20.0,
                "pm2_5_max": 25.0,
                "pm2_5_low": 21.0,
                "pm2_5_high": 23.0,
                "created_at": pd.Timestamp("2026-03-23T00:00:00Z"),
            },
        ]
    )
    met_payload = {
        "properties": {
            "timeseries": [
                {
                    "time": "2026-03-24T00:00:00Z",
                    "data": {
                        "instant": {
                            "details": {
                                "air_pressure_at_sea_level": 1010,
                                "air_temperature": 20,
                                "cloud_area_fraction": 40,
                                "relative_humidity": 60,
                                "wind_from_direction": 90,
                                "wind_speed": 3,
                            }
                        },
                        "next_1_hours": {"details": {"precipitation_amount": 1}},
                    },
                },
                {
                    "time": "2026-03-24T12:00:00Z",
                    "data": {
                        "instant": {
                            "details": {
                                "air_pressure_at_sea_level": 1014,
                                "air_temperature": 24,
                                "cloud_area_fraction": 60,
                                "relative_humidity": 80,
                                "wind_from_direction": 110,
                                "wind_speed": 5,
                            }
                        },
                        "next_1_hours": {"details": {"precipitation_amount": 3}},
                    },
                },
            ]
        }
    }
    calls = []

    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return met_payload

    def fake_get(url, params=None, headers=None, timeout=None):
        calls.append((url, params, headers, timeout))
        return DummyResponse()

    monkeypatch.setattr(ml_utils_module.requests, "get", fake_get)

    enriched = ForecastModelTrainer.enrich_site_daily_forecasts_with_met_data(
        site_data,
        forecast_data,
    )

    assert len(calls) == 1
    assert calls[0][1] == {"lat": "0.12", "lon": "32.57"}
    assert enriched["met_latitude"].eq(pytest.approx(0.12)).all()
    assert enriched["met_longitude"].eq(pytest.approx(32.57)).all()
    assert enriched["met_air_temperature"].eq(pytest.approx(22.0)).all()
    assert enriched["met_precipitation_amount"].eq(pytest.approx(2.0)).all()


def test_enrich_site_daily_forecasts_with_met_data_skips_failed_met_requests(
    monkeypatch,
):
    site_data = pd.DataFrame(
        [
            {
                "site_id": "site_01",
                "site_name": "Synthetic Site 1",
                "site_latitude": 0.1231,
                "site_longitude": 32.5671,
            }
        ]
    )
    forecast_data = pd.DataFrame(
        [
            {
                "site_id": "site_01",
                "site_name": "Synthetic Site 1",
                "site_latitude": 0.1231,
                "site_longitude": 32.5671,
                "date": pd.Timestamp("2026-03-24"),
                "pm2_5_mean": 20.0,
                "pm2_5_min": 18.0,
                "pm2_5_max": 24.0,
                "pm2_5_low": 19.0,
                "pm2_5_high": 22.0,
                "created_at": pd.Timestamp("2026-03-23T00:00:00Z"),
            }
        ]
    )

    def fail_get(*args, **kwargs):
        raise requests.exceptions.ConnectionError("dns failure")

    monkeypatch.setattr(ml_utils_module.requests, "get", fail_get)

    enriched = ForecastModelTrainer.enrich_site_daily_forecasts_with_met_data(
        site_data,
        forecast_data,
    )

    for column in ForecastConstants.MET_NO_FORECAST_COLUMNS:
        assert column in enriched.columns
        assert enriched[column].isna().all()


def test_normalize_site_daily_forecasts_keeps_latest_10_rows_per_site():
    rows = []

    for day in pd.date_range("2026-03-01", periods=16, freq="D"):
        rows.append(
            {
                "site_id": "site_01",
                "site_name": "Synthetic Site 1",
                "site_latitude": 0.1231,
                "site_longitude": 32.5671,
                "date": day,
                "pm2_5_mean": 20.0,
                "pm2_5_min": 18.0,
                "pm2_5_max": 24.0,
                "pm2_5_low": 19.0,
                "pm2_5_high": 22.0,
                "created_at": day + pd.Timedelta(hours=6),
            }
        )

    for day in pd.date_range("2026-03-10", periods=3, freq="D"):
        rows.append(
            {
                "site_id": "site_02",
                "site_name": "Synthetic Site 2",
                "site_latitude": 0.2231,
                "site_longitude": 32.6671,
                "date": day,
                "pm2_5_mean": 30.0,
                "pm2_5_min": 28.0,
                "pm2_5_max": 34.0,
                "pm2_5_low": 29.0,
                "pm2_5_high": 32.0,
                "created_at": day + pd.Timedelta(hours=6),
            }
        )

    normalized = ForecastModelTrainer._normalize_site_daily_forecasts(
        pd.DataFrame(rows)
    )

    site_01 = normalized[normalized["site_id"] == "site_01"].copy()
    site_02 = normalized[normalized["site_id"] == "site_02"].copy()

    assert len(site_01) == 10
    assert site_01["date"].min() == pd.Timestamp("2026-03-07")
    assert site_01["date"].max() == pd.Timestamp("2026-03-16")

    assert len(site_02) == 3
    assert site_02["date"].min() == pd.Timestamp("2026-03-10")
    assert site_02["date"].max() == pd.Timestamp("2026-03-12")


def test_normalize_site_daily_forecasts_rounds_pm_and_coordinates():
    normalized = ForecastModelTrainer._normalize_site_daily_forecasts(
        pd.DataFrame(
            [
                {
                    "site_id": "site_01",
                    "site_name": "Synthetic Site 1",
                    "site_latitude": 0.123456789,
                    "site_longitude": 32.567891234,
                    "date": pd.Timestamp("2026-03-25"),
                    "pm2_5_mean": 20.149,
                    "pm2_5_min": 18.151,
                    "pm2_5_max": 24.159,
                    "pm2_5_low": 19.149,
                    "pm2_5_high": 22.151,
                    "created_at": pd.Timestamp("2026-03-24T06:00:00"),
                }
            ]
        )
    )

    row = normalized.iloc[0]

    assert row["pm2_5_mean"] == pytest.approx(20.1)
    assert row["pm2_5_min"] == pytest.approx(18.2)
    assert row["pm2_5_max"] == pytest.approx(24.2)
    assert row["pm2_5_low"] == pytest.approx(19.1)
    assert row["pm2_5_high"] == pytest.approx(22.2)
    assert row["site_latitude"] == pytest.approx(0.123457)
    assert row["site_longitude"] == pytest.approx(32.567891)
