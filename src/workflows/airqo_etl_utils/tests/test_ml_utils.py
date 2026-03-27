import pandas as pd
import pytest
from unittest.mock import MagicMock

import airqo_etl_utils.ml_utils as ml_utils_module
from airqo_etl_utils.ml_utils import BaseMlUtils as FUtils, ForecastModelTrainer
from airqo_etl_utils.weather_data_utils import WeatherDataUtils
from airqo_etl_utils.tests.conftest import ForecastFixtures
from airqo_etl_utils.tests.test_7days_forecast import (
    build_synthetic_site_forecast_history,
)
from airqo_etl_utils.constants import Frequency, SITE_DAILY_FORECAST_MET_COLUMNS


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

    def test_calculate_forecast_confidence_prefers_narrower_spreads(self):
        narrow_confidence = FUtils.calculate_forecast_confidence(
            [20.0], [18.0], [22.0]
        )[0]
        wide_confidence = FUtils.calculate_forecast_confidence(
            [20.0], [10.0], [30.0]
        )[0]

        assert 0.0 <= wide_confidence <= 100.0
        assert 0.0 <= narrow_confidence <= 100.0
        assert narrow_confidence > wide_confidence

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


class DummyForecastModel:
    def __init__(self, offset: float):
        self.offset = offset

    def predict(self, frame):
        base = frame["pm25_mean_lag_1"].fillna(frame["roll7_mean"]).fillna(0.0)
        return (base + self.offset).to_numpy()


def test_generate_site_daily_forecasts_with_synthetic_data(monkeypatch):
    synthetic_history = build_synthetic_site_forecast_history(
        num_sites=3,
        num_days=45,
        seed=7,
    )
    feature_columns = [
        "day_of_week",
        "day_of_year",
        "month",
        "pm25_mean_lag_1",
        "pm25_mean_lag_2",
        "pm25_mean_lag_3",
        "pm25_mean_lag_7",
        "pm25_mean_lag_14",
        "roll7_mean",
        "roll7_std",
        "roll14_mean",
        "roll14_std",
        "site_id_code",
    ]
    site_mapping = {
        site_id: idx
        for idx, site_id in enumerate(sorted(synthetic_history["site_id"].unique()))
    }

    monkeypatch.setattr(
        ForecastModelTrainer,
        "_load_site_forecast_artifacts",
        staticmethod(
            lambda: {
                "mean": {
                    "model": DummyForecastModel(0.5),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "min": {
                    "model": DummyForecastModel(-1.0),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "max": {
                    "model": DummyForecastModel(2.0),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "low": {
                    "model": DummyForecastModel(-0.5),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "high": {
                    "model": DummyForecastModel(1.5),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
            }
        ),
    )
    monkeypatch.setattr(
        WeatherDataUtils,
        "fetch_met_no_daily_data_for_sites",
        staticmethod(
            lambda sites: pd.DataFrame(
                [
                    {
                        "date": forecast_date,
                        "met_no_query_latitude": round(site_latitude, 2),
                        "met_no_query_longitude": round(site_longitude, 2),
                        "met_no_air_pressure_at_sea_level": 1009.2,
                        "met_no_air_temperature": 26.8,
                        "met_no_cloud_area_fraction": 100.0,
                        "met_no_precipitation_amount": 0.1,
                        "met_no_relative_humidity": 84.0,
                        "met_no_wind_from_direction": 210.4,
                        "met_no_wind_speed": 4.9,
                    }
                    for _, site in sites[
                        ["site_id", "site_latitude", "site_longitude"]
                    ].drop_duplicates().iterrows()
                    for forecast_date in pd.date_range(
                        start=sites["date"].min(),
                        periods=7,
                        freq="D",
                    ).date
                    for site_latitude, site_longitude in [
                        (site["site_latitude"], site["site_longitude"])
                    ]
                ]
            )
        ),
    )

    forecasts = ForecastModelTrainer.generate_site_daily_forecasts(
        synthetic_history,
        horizon=7,
    )

    assert len(forecasts) == 21
    assert forecasts["site_id"].nunique() == 3
    assert forecasts.groupby("site_id")["date"].nunique().eq(7).all()
    assert {
        "site_name",
        "site_id",
        "site_latitude",
        "site_longitude",
        "date",
        "pm2_5_mean",
        "pm2_5_min",
        "pm2_5_max",
        "pm2_5_low",
        "pm2_5_high",
        "forecast_confidence",
        "met_no_air_pressure_at_sea_level",
        "met_no_air_temperature",
        "met_no_cloud_area_fraction",
        "met_no_precipitation_amount",
        "met_no_relative_humidity",
        "met_no_wind_from_direction",
        "met_no_wind_speed",
        "created_at",
    }.issubset(forecasts.columns)
    assert forecasts["forecast_confidence"].between(0, 100).all()
    for column in ["pm2_5_mean", "pm2_5_min", "pm2_5_max", "pm2_5_low", "pm2_5_high"]:
        rounded = forecasts[column].round(1)
        assert forecasts[column].equals(rounded)
    rounded = forecasts["forecast_confidence"].round(1)
    assert forecasts["forecast_confidence"].equals(rounded)
    for column in ["site_latitude", "site_longitude"]:
        rounded = forecasts[column].round(6)
        assert forecasts[column].equals(rounded)
    for column in [
        "met_no_air_pressure_at_sea_level",
        "met_no_air_temperature",
        "met_no_cloud_area_fraction",
        "met_no_precipitation_amount",
        "met_no_relative_humidity",
        "met_no_wind_from_direction",
        "met_no_wind_speed",
    ]:
        rounded = forecasts[column].round(1)
        assert forecasts[column].equals(rounded)


def test_generate_site_daily_forecasts_can_skip_met_enrichment(monkeypatch):
    synthetic_history = build_synthetic_site_forecast_history(
        num_sites=2,
        num_days=45,
        seed=11,
    )
    feature_columns = [
        "day_of_week",
        "day_of_year",
        "month",
        "pm25_mean_lag_1",
        "pm25_mean_lag_2",
        "pm25_mean_lag_3",
        "pm25_mean_lag_7",
        "pm25_mean_lag_14",
        "roll7_mean",
        "roll7_std",
        "roll14_mean",
        "roll14_std",
        "site_id_code",
    ]
    site_mapping = {
        site_id: idx
        for idx, site_id in enumerate(sorted(synthetic_history["site_id"].unique()))
    }

    monkeypatch.setattr(
        ForecastModelTrainer,
        "_load_site_forecast_artifacts",
        staticmethod(
            lambda: {
                "mean": {
                    "model": DummyForecastModel(0.5),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "min": {
                    "model": DummyForecastModel(-1.0),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "max": {
                    "model": DummyForecastModel(2.0),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "low": {
                    "model": DummyForecastModel(-0.5),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
                "high": {
                    "model": DummyForecastModel(1.5),
                    "features": feature_columns,
                    "site_id_mapping": site_mapping,
                },
            }
        ),
    )
    monkeypatch.setattr(
        WeatherDataUtils,
        "fetch_met_no_daily_data_for_sites",
        staticmethod(
            lambda sites: (_ for _ in ()).throw(
                AssertionError("MET.no fetch should be skipped when disabled.")
            )
        ),
    )

    forecasts = ForecastModelTrainer.generate_site_daily_forecasts(
        synthetic_history,
        horizon=7,
        include_met_no_weather=False,
    )

    assert len(forecasts) == 14
    assert forecasts["site_id"].nunique() == 2
    assert forecasts.groupby("site_id")["date"].nunique().eq(7).all()
    assert "met_no_air_temperature" not in forecasts.columns
    assert "met_no_wind_speed" not in forecasts.columns


def test_enrich_site_daily_forecasts_with_met_falls_back_on_failure(monkeypatch):
    forecasts = pd.DataFrame(
        [
            {
                "site_id": "site-1",
                "site_name": "Central",
                "site_latitude": 0.3476,
                "site_longitude": 32.5825,
                "date": pd.Timestamp("2026-03-24").date(),
                "pm2_5_mean": 18.4,
                "pm2_5_min": 10.2,
                "pm2_5_max": 24.1,
                "pm2_5_low": 12.0,
                "pm2_5_high": 22.8,
                "forecast_confidence": 87.5,
                "created_at": pd.Timestamp("2026-03-24T03:00:00Z"),
            }
        ]
    )
    expected_forecast_columns = list(forecasts.columns)

    monkeypatch.setattr(
        WeatherDataUtils,
        "fetch_met_no_daily_data_for_sites",
        staticmethod(
            lambda sites: (_ for _ in ()).throw(RuntimeError("MET.no unavailable"))
        ),
    )

    enriched = ForecastModelTrainer._enrich_site_daily_forecasts_with_met_no_weather(
        forecasts
    )

    assert list(enriched[expected_forecast_columns].columns) == expected_forecast_columns
    assert enriched[expected_forecast_columns].equals(forecasts)
    for column in [
        "met_no_air_pressure_at_sea_level",
        "met_no_air_temperature",
        "met_no_cloud_area_fraction",
        "met_no_precipitation_amount",
        "met_no_relative_humidity",
        "met_no_wind_from_direction",
        "met_no_wind_speed",
    ]:
        assert column in enriched.columns
        assert enriched[column].isna().all()
    assert "met_no_query_latitude" not in enriched.columns
    assert "met_no_query_longitude" not in enriched.columns


def test_prepare_site_daily_forecasts_for_persistence_adds_missing_met_columns():
    forecasts = pd.DataFrame(
        [
            {
                "site_name": "Makerere",
                "site_id": "site-1",
                "site_latitude": 0.3333333,
                "site_longitude": 32.5555555,
                "date": pd.Timestamp("2026-03-27").date(),
                "pm2_5_mean": 12.34,
                "pm2_5_min": 10.12,
                "pm2_5_max": 15.67,
                "pm2_5_low": 9.87,
                "pm2_5_high": 16.54,
                "forecast_confidence": 87.64,
                "created_at": pd.Timestamp("2026-03-27T00:00:00Z"),
            }
        ]
    )

    prepared = ForecastModelTrainer._prepare_site_daily_forecasts_for_persistence(
        forecasts
    )

    for column in SITE_DAILY_FORECAST_MET_COLUMNS:
        assert column in prepared.columns
        assert prepared[column].isna().all()

    assert prepared.loc[0, "pm2_5_mean"] == 12.3
    assert prepared.loc[0, "forecast_confidence"] == 87.6
    assert prepared.loc[0, "site_latitude"] == 0.333333
    assert prepared.loc[0, "site_longitude"] == 32.555555


def test_retain_recent_site_forecasts_keeps_latest_per_date_and_max_14():
    rows = []
    base_date = pd.Timestamp("2026-03-01")

    for offset in range(16):
        forecast_date = (base_date + pd.Timedelta(days=offset)).date()
        rows.append(
            {
                "site_name": "Makerere",
                "site_id": "site-1",
                "site_latitude": 0.3333333,
                "site_longitude": 32.5555555,
                "date": forecast_date,
                "pm2_5_mean": 10 + offset,
                "pm2_5_min": 9 + offset,
                "pm2_5_max": 11 + offset,
                "pm2_5_low": 8 + offset,
                "pm2_5_high": 12 + offset,
                "forecast_confidence": 85.0,
                "created_at": pd.Timestamp("2026-03-20T00:00:00Z")
                + pd.Timedelta(minutes=offset),
            }
        )

    rows.append(
        {
            "site_name": "Makerere",
            "site_id": "site-1",
            "site_latitude": 0.3333333,
            "site_longitude": 32.5555555,
            "date": (base_date + pd.Timedelta(days=9)).date(),
            "pm2_5_mean": 99.9,
            "pm2_5_min": 98.9,
            "pm2_5_max": 100.9,
            "pm2_5_low": 97.9,
            "pm2_5_high": 101.9,
            "forecast_confidence": 90.0,
            "created_at": pd.Timestamp("2026-03-21T00:00:00Z"),
        }
    )

    retained = ForecastModelTrainer._retain_recent_site_forecasts(pd.DataFrame(rows))

    assert len(retained) == 14
    assert retained["site_id"].eq("site-1").all()
    assert retained["date"].nunique() == 14
    assert retained["date"].min().isoformat() == "2026-03-03"
    assert retained["date"].max().isoformat() == "2026-03-16"
    assert (
        retained.loc[retained["date"].astype(str) == "2026-03-10", "pm2_5_mean"].iloc[0]
        == 99.9
    )


def test_save_site_daily_forecasts_to_mongo_uses_bulk_write_and_cleans_old_rows(
    monkeypatch,
):
    forecasts = pd.DataFrame(
        [
            {
                "site_name": "Makerere",
                "site_id": "site-1",
                "site_latitude": 0.3333333,
                "site_longitude": 32.5555555,
                "date": pd.Timestamp("2026-03-27").date(),
                "pm2_5_mean": 12.3,
                "pm2_5_min": 10.1,
                "pm2_5_max": 15.6,
                "pm2_5_low": 9.8,
                "pm2_5_high": 16.5,
                "forecast_confidence": 87.6,
                "created_at": pd.Timestamp("2026-03-27T00:00:00Z"),
            },
            {
                "site_name": "Makerere",
                "site_id": "site-1",
                "site_latitude": 0.3333333,
                "site_longitude": 32.5555555,
                "date": pd.Timestamp("2026-03-28").date(),
                "pm2_5_mean": 13.3,
                "pm2_5_min": 11.1,
                "pm2_5_max": 16.6,
                "pm2_5_low": 10.8,
                "pm2_5_high": 17.5,
                "forecast_confidence": 88.6,
                "created_at": pd.Timestamp("2026-03-27T00:00:00Z"),
            },
        ]
    )

    existing_docs = [
        {
            "_id": index,
            "site_id": "site-1",
            "date": (pd.Timestamp("2026-03-13") + pd.Timedelta(days=index - 1)).date(),
            "created_at": pd.Timestamp("2026-03-20T00:00:00Z")
            + pd.Timedelta(minutes=index),
        }
        for index in range(1, 17)
    ]
    existing_docs.append(
        {
            "_id": 99,
            "site_id": "site-1",
            "date": pd.Timestamp("2026-03-27").date(),
            "created_at": pd.Timestamp("2026-03-26T00:00:00Z"),
        }
    )

    mock_collection = MagicMock()
    mock_collection.find.return_value = existing_docs
    mock_collection.delete_many.return_value.deleted_count = 3

    mock_db = MagicMock()
    mock_db.__getitem__.return_value = mock_collection

    mock_client = MagicMock()
    mock_client.__getitem__.return_value = mock_db

    mock_client_manager = MagicMock()
    mock_client_manager.__enter__.return_value = mock_client
    mock_client_manager.__exit__.return_value = None

    monkeypatch.setattr(ml_utils_module.configuration, "MONGO_URI", "mongodb://test")
    monkeypatch.setattr(ml_utils_module.configuration, "MONGO_DATABASE_NAME", "airqo")
    monkeypatch.setattr(
        ml_utils_module.configuration,
        "MONGO_SITE_DAILY_FORECAST_COLLECTION",
        "site_daily_forecasts",
    )
    monkeypatch.setattr(
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    result = ForecastModelTrainer._save_site_daily_forecasts_to_mongo(forecasts)

    assert mock_collection.bulk_write.call_count == 1
    assert mock_collection.bulk_write.call_args.kwargs["ordered"] is False
    bulk_operations = mock_collection.bulk_write.call_args.args[0]
    assert len(bulk_operations) == 2
    assert mock_collection.delete_many.call_count == 1
    assert result["rows"] == 2
    assert result["deleted_rows"] == 3


def test_aggregate_met_no_hourly_payload_to_daily():
    payload = [
        {
            "type": "Feature",
            "properties": {
                "timeseries": [
                    {
                        "time": "2026-03-23T18:00:00Z",
                        "data": {
                            "instant": {
                                "details": {
                                    "air_pressure_at_sea_level": 1008.1,
                                    "air_temperature": 27.7,
                                    "cloud_area_fraction": 100,
                                    "relative_humidity": 80.9,
                                    "wind_from_direction": 213.1,
                                    "wind_speed": 4.6,
                                }
                            },
                            "next_1_hours": {
                                "details": {"precipitation_amount": 0.0}
                            },
                        },
                    },
                    {
                        "time": "2026-03-23T19:00:00Z",
                        "data": {
                            "instant": {
                                "details": {
                                    "air_pressure_at_sea_level": 1008.6,
                                    "air_temperature": 27.4,
                                    "cloud_area_fraction": 100,
                                    "relative_humidity": 83.1,
                                    "wind_from_direction": 214.6,
                                    "wind_speed": 4.7,
                                }
                            },
                            "next_1_hours": {
                                "details": {"precipitation_amount": 0.0}
                            },
                        },
                    },
                ]
            },
        }
    ]

    hourly = WeatherDataUtils._parse_met_no_hourly_payload(payload, 6.62, 3.36)
    daily = WeatherDataUtils._aggregate_met_no_daily(hourly)

    assert len(hourly) == 2
    assert len(daily) == 1
    assert daily.loc[0, "date"].isoformat() == "2026-03-23"
    assert daily.loc[0, "met_no_query_latitude"] == 6.62
    assert daily.loc[0, "met_no_query_longitude"] == 3.36
    assert daily.loc[0, "met_no_air_temperature"] == 27.6
    assert daily.loc[0, "met_no_precipitation_amount"] == 0.0
