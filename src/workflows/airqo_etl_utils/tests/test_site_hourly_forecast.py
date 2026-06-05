from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from airqo_etl_utils.tests._test_dependency_stubs import apply_ml_utils_import_stubs

apply_ml_utils_import_stubs()

import airqo_etl_utils.ml_utils as ml_utils_module
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import SITE_DAILY_FORECAST_MET_COLUMNS
from airqo_etl_utils.ml_utils import ForecastModelTrainer
from airqo_etl_utils.weather_data_utils import WeatherDataUtils


class DummyHourlyForecastModel:
    def __init__(self, offset: float):
        self.offset = offset

    def predict(self, frame: pd.DataFrame):
        base = (
            frame["lag_pm25_hourly_1h"].fillna(frame["roll_pm25_6h_mean"]).fillna(0.0)
        )
        return (base + self.offset).to_numpy()


def _hourly_features():
    return ForecastModelTrainer._site_hourly_forecast_features()


def _hourly_artifacts():
    features = _hourly_features()
    return {
        "mean": {"model": DummyHourlyForecastModel(0.5), "features": features},
        "q10": {"model": DummyHourlyForecastModel(-1.0), "features": features},
        "q90": {"model": DummyHourlyForecastModel(2.0), "features": features},
    }


def _hourly_history() -> pd.DataFrame:
    rows = []
    timestamps = pd.date_range("2026-03-01T00:00:00Z", periods=80, freq="h")
    for idx, timestamp in enumerate(timestamps):
        rows.append(
            {
                "timestamp": timestamp,
                "site_id": "site-full",
                "site_name": "Full Site",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm25_mean": 12.0 + (idx * 0.1),
            }
        )

    sparse_timestamps = pd.date_range("2026-03-04T06:00:00Z", periods=1, freq="h")
    for idx, timestamp in enumerate(sparse_timestamps):
        rows.append(
            {
                "timestamp": timestamp,
                "site_id": "site-sparse",
                "site_name": "Sparse Site",
                "site_latitude": 0.4123456,
                "site_longitude": 32.6123456,
                "pm25_mean": 20.0 + idx,
            }
        )

    return pd.DataFrame(rows)


def _met_no_hourly_response(sites: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, site in (
        sites[["site_latitude", "site_longitude"]].drop_duplicates().iterrows()
    ):
        for timestamp in pd.date_range("2026-03-04T08:00:00Z", periods=3, freq="h"):
            rows.append(
                {
                    "timestamp": timestamp,
                    "date": timestamp.date(),
                    "met_no_query_latitude": round(site["site_latitude"], 2),
                    "met_no_query_longitude": round(site["site_longitude"], 2),
                    "air_pressure_at_sea_level": 1008.1,
                    "air_temperature": 27.7,
                    "cloud_area_fraction": 100.0,
                    "precipitation_amount": 0.0,
                    "relative_humidity": 80.9,
                    "wind_from_direction": 213.1,
                    "wind_speed": 4.6,
                }
            )
    return pd.DataFrame(rows)


def test_generate_site_hourly_forecasts_includes_sparse_sites(monkeypatch):
    monkeypatch.setattr(
        ForecastModelTrainer,
        "_load_site_hourly_forecast_artifacts",
        staticmethod(_hourly_artifacts),
    )

    forecasts = ForecastModelTrainer.generate_site_hourly_forecasts(
        _hourly_history(),
        horizon_hours=3,
        run_timestamp=pd.Timestamp("2026-03-04T08:00:00Z"),
        include_met_no_weather=False,
    )

    assert len(forecasts) == 6
    assert forecasts["site_id"].nunique() == 2
    assert "site-sparse" in forecasts["site_id"].unique()
    assert (
        forecasts.loc[forecasts["site_id"] == "site-sparse", "timestamp"].nunique()
        == 3
    )
    assert forecasts.groupby("site_id")["timestamp"].nunique().eq(3).all()
    assert forecasts["pm2_5_q10"].le(forecasts["pm2_5_mean"]).all()
    assert forecasts["pm2_5_mean"].le(forecasts["pm2_5_q90"]).all()
    assert forecasts["forecast_confidence"].between(0, 100).all()


def test_generate_site_hourly_forecasts_can_start_from_current_run_hour(monkeypatch):
    monkeypatch.setattr(
        ForecastModelTrainer,
        "_load_site_hourly_forecast_artifacts",
        staticmethod(_hourly_artifacts),
    )

    forecasts = ForecastModelTrainer.generate_site_hourly_forecasts(
        _hourly_history(),
        horizon_hours=3,
        forecast_start_timestamp=pd.Timestamp("2026-03-06T03:00:00Z"),
        run_timestamp=pd.Timestamp("2026-03-06T03:15:00Z"),
        include_met_no_weather=False,
    )

    assert forecasts["timestamp"].min() == pd.Timestamp("2026-03-06T03:00:00Z")
    assert forecasts["timestamp"].max() == pd.Timestamp("2026-03-06T05:00:00Z")
    assert forecasts.groupby("site_id")["timestamp"].nunique().eq(3).all()


def test_generate_site_hourly_forecasts_rejects_none_input():
    with pytest.raises(
        ValueError, match="fetch_site_prediction_data task returned None"
    ):
        ForecastModelTrainer.generate_site_hourly_forecasts(None)


def test_fetch_site_hourly_prediction_data_rejects_none_fetch(monkeypatch):
    class DummyBigQueryApi:
        def fetch_hourly_site_data_for_forecast_jobs(self, **kwargs):
            return None

    import airqo_etl_utils.bigquery_api as bigquery_api_module

    monkeypatch.setattr(bigquery_api_module, "BigQueryApi", DummyBigQueryApi)

    with pytest.raises(RuntimeError, match="returned no dataframe"):
        ForecastModelTrainer.fetch_site_hourly_prediction_data(
            execution_date=datetime(2026, 5, 9, 3, tzinfo=timezone.utc),
            lookback_days=1,
        )


def test_enrich_site_hourly_forecasts_with_met_no_weather(monkeypatch):
    forecasts = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-04T08:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.1,
                "pm2_5_q10": 10.2,
                "pm2_5_q90": 14.8,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            }
        ]
    )
    monkeypatch.setattr(
        WeatherDataUtils,
        "fetch_met_no_hourly_data_for_sites",
        staticmethod(_met_no_hourly_response),
    )

    enriched = ForecastModelTrainer._enrich_site_hourly_forecasts_with_met_no_weather(
        forecasts
    )

    assert set(SITE_DAILY_FORECAST_MET_COLUMNS).issubset(enriched.columns)
    assert enriched.loc[0, "air_temperature"] == 27.7
    assert "met_no_query_latitude" not in enriched.columns
    assert "date" not in enriched.columns


def test_enrich_site_hourly_forecasts_fills_sparse_met_by_nearest_time(monkeypatch):
    forecasts = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-06T08:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.1,
                "pm2_5_q10": 10.2,
                "pm2_5_q90": 14.8,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            },
            {
                "timestamp": pd.Timestamp("2026-03-06T09:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.2,
                "pm2_5_q10": 10.3,
                "pm2_5_q90": 14.9,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            },
            {
                "timestamp": pd.Timestamp("2026-03-06T12:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.3,
                "pm2_5_q10": 10.4,
                "pm2_5_q90": 15.0,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            },
        ]
    )

    def _sparse_met_no_hourly_response(_: pd.DataFrame) -> pd.DataFrame:
        return pd.DataFrame(
            [
                {
                    "timestamp": pd.Timestamp("2026-03-06T08:00:00Z"),
                    "date": pd.Timestamp("2026-03-06").date(),
                    "met_no_query_latitude": 0.31,
                    "met_no_query_longitude": 32.51,
                    "air_pressure_at_sea_level": 1008.1,
                    "air_temperature": 24.0,
                    "cloud_area_fraction": 70.0,
                    "precipitation_amount": 0.0,
                    "relative_humidity": 80.0,
                    "wind_from_direction": 210.0,
                    "wind_speed": 4.0,
                },
                {
                    "timestamp": pd.Timestamp("2026-03-06T14:00:00Z"),
                    "date": pd.Timestamp("2026-03-06").date(),
                    "met_no_query_latitude": 0.31,
                    "met_no_query_longitude": 32.51,
                    "air_pressure_at_sea_level": 1009.1,
                    "air_temperature": 30.0,
                    "cloud_area_fraction": 50.0,
                    "precipitation_amount": 0.2,
                    "relative_humidity": 65.0,
                    "wind_from_direction": 250.0,
                    "wind_speed": 5.0,
                },
            ]
        )

    monkeypatch.setattr(
        WeatherDataUtils,
        "fetch_met_no_hourly_data_for_sites",
        staticmethod(_sparse_met_no_hourly_response),
    )

    enriched = ForecastModelTrainer._enrich_site_hourly_forecasts_with_met_no_weather(
        forecasts
    )

    assert enriched["air_temperature"].tolist() == [24.0, 24.0, 30.0]
    assert enriched["wind_speed"].tolist() == [4.0, 4.0, 5.0]


def test_save_site_hourly_forecasts_to_mongo_replaces_existing_site_rows(monkeypatch):
    forecasts = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-04T08:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.1,
                "pm2_5_q10": 10.2,
                "pm2_5_q90": 14.8,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            },
            {
                "timestamp": pd.Timestamp("2026-03-04T09:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.6,
                "pm2_5_q10": 10.7,
                "pm2_5_q90": 15.1,
                "forecast_confidence": 81.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            },
        ]
    )

    mock_collection = MagicMock()
    mock_collection.delete_many.return_value.deleted_count = 0

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
        "MONGO_SITE_HOURLY_FORECAST_COLLECTION",
        "site_hourly_forecasts",
    )
    monkeypatch.setattr(
        ml_utils_module.configuration,
        "SITE_HOURLY_FORECAST_RETENTION_CUT_OFF_DAY",
        "2",
    )
    monkeypatch.setattr(
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    insert_result = MagicMock()
    insert_result.inserted_ids = [1, 2]
    mock_collection.insert_many.return_value = insert_result

    result = ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    mock_collection.bulk_write.assert_not_called()
    mock_collection.delete_many.assert_any_call({"site_id": {"$in": ["site-1"]}})
    mock_collection.insert_many.assert_called_once()
    assert mock_collection.insert_many.call_args.kwargs["ordered"] is False
    inserted_documents = mock_collection.insert_many.call_args.args[0]
    assert len(inserted_documents) == 2
    assert inserted_documents[0]["site_id"] == "site-1"
    assert inserted_documents[0]["timestamp"] == pd.Timestamp(
        "2026-03-04T08:00:00Z"
    ).to_pydatetime()
    assert inserted_documents[0]["pm2_5_mean"] == 12.1
    assert inserted_documents[0]["site_name"] == "Makerere"
    assert inserted_documents[0]["created_at"] == pd.Timestamp(
        "2026-03-04T08:00:00Z"
    ).to_pydatetime()
    assert mock_collection.delete_many.call_count == 2
    delete_filter = mock_collection.delete_many.call_args_list[1].args[0]
    assert set(delete_filter.keys()) == {"timestamp"}
    assert set(delete_filter["timestamp"].keys()) == {"$lt"}
    mock_collection.create_index.assert_called_once_with(
        [("site_id", 1), ("timestamp", 1)],
        background=True,
    )
    assert result == {
        "rows": 2,
        "collection": "site_hourly_forecasts",
        "deleted_rows": 0,
        "inserted_rows": 2,
        "insert_batches": 1,
        "bulk_batch_size": 5000,
    }


def test_save_site_hourly_forecasts_to_mongo_preserves_existing_met_fields(
    monkeypatch,
):
    forecasts = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-04T08:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.1,
                "pm2_5_q10": 10.2,
                "pm2_5_q90": 14.8,
                "forecast_confidence": 80.0,
                "air_temperature": np.nan,
                "relative_humidity": None,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            }
        ]
    )

    mock_collection = MagicMock()
    mock_collection.delete_many.return_value.deleted_count = 0

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
        "MONGO_SITE_HOURLY_FORECAST_COLLECTION",
        "site_hourly_forecasts",
    )
    monkeypatch.setattr(
        ml_utils_module.configuration,
        "SITE_HOURLY_FORECAST_RETENTION_CUT_OFF_DAY",
        "2",
    )
    monkeypatch.setattr(
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    insert_result = MagicMock()
    insert_result.inserted_ids = [1]
    mock_collection.insert_many.return_value = insert_result

    ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    inserted_documents = mock_collection.insert_many.call_args.args[0]
    assert "air_temperature" not in inserted_documents[0]
    assert "relative_humidity" not in inserted_documents[0]
    assert inserted_documents[0]["site_name"] == "Makerere"
    assert inserted_documents[0]["created_at"] == pd.Timestamp(
        "2026-03-04T08:00:00Z"
    ).to_pydatetime()
    assert inserted_documents[0]["pm2_5_mean"] == 12.1


def test_save_site_hourly_forecasts_to_mongo_prunes_old_rows(monkeypatch):
    forecasts = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-04T10:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.1,
                "pm2_5_q10": 10.2,
                "pm2_5_q90": 14.8,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            }
        ]
    )
    mock_collection = MagicMock()
    stale_delete_result = MagicMock()
    stale_delete_result.deleted_count = 3
    expired_delete_result = MagicMock()
    expired_delete_result.deleted_count = 0
    mock_collection.delete_many.side_effect = [
        stale_delete_result,
        expired_delete_result,
    ]
    insert_result = MagicMock()
    insert_result.inserted_ids = [1]
    mock_collection.insert_many.return_value = insert_result

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
        "MONGO_SITE_HOURLY_FORECAST_COLLECTION",
        "site_hourly_forecasts",
    )
    monkeypatch.setattr(
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    expected_cutoff = (
        pd.Timestamp.now(tz="UTC").normalize() - pd.Timedelta(days=2)
    ).to_pydatetime()
    result = ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    mock_collection.bulk_write.assert_not_called()
    assert mock_collection.delete_many.call_args_list[0].args[0] == {
        "site_id": {"$in": ["site-1"]}
    }
    timestamp_delete_filter = mock_collection.delete_many.call_args_list[1].args[0]
    assert set(timestamp_delete_filter.keys()) == {"timestamp"}
    assert set(timestamp_delete_filter["timestamp"].keys()) == {"$lt"}
    assert timestamp_delete_filter["timestamp"]["$lt"] == expected_cutoff
    assert result == {
        "rows": 1,
        "collection": "site_hourly_forecasts",
        "deleted_rows": 3,
        "inserted_rows": 1,
        "insert_batches": 1,
        "bulk_batch_size": 5000,
    }


def test_save_site_hourly_forecasts_to_mongo_prunes_expired_rows_for_absent_sites(
    monkeypatch,
):
    forecasts = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-04T10:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.1,
                "pm2_5_q10": 10.2,
                "pm2_5_q90": 14.8,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            }
        ]
    )

    mock_collection = MagicMock()
    mock_collection.delete_many.return_value.deleted_count = 4
    insert_result = MagicMock()
    insert_result.inserted_ids = [1]
    mock_collection.insert_many.return_value = insert_result

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
        "MONGO_SITE_HOURLY_FORECAST_COLLECTION",
        "site_hourly_forecasts",
    )
    monkeypatch.setattr(
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    expected_cutoff = (
        pd.Timestamp.now(tz="UTC").normalize() - pd.Timedelta(days=2)
    ).to_pydatetime()
    result = ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    assert mock_collection.delete_many.call_count == 2
    site_delete_filter = mock_collection.delete_many.call_args_list[0].args[0]
    assert site_delete_filter == {
        "site_id": {"$in": ["site-1"]}
    }
    delete_filter = mock_collection.delete_many.call_args_list[1].args[0]
    assert set(delete_filter.keys()) == {"timestamp"}
    assert set(delete_filter["timestamp"].keys()) == {"$lt"}
    assert delete_filter["timestamp"]["$lt"] == expected_cutoff
    assert result == {
        "rows": 1,
        "collection": "site_hourly_forecasts",
        "deleted_rows": 8,
        "inserted_rows": 1,
        "insert_batches": 1,
        "bulk_batch_size": 5000,
    }


def test_met_no_hourly_payload_parser_includes_timestamp():
    payload = [
        {
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
                            "next_1_hours": {"details": {"precipitation_amount": 0.0}},
                        },
                    }
                ]
            }
        }
    ]

    hourly = WeatherDataUtils._parse_met_no_hourly_payload(payload, 6.62, 3.36)

    assert len(hourly) == 1
    assert hourly.loc[0, "timestamp"] == pd.Timestamp("2026-03-23T18:00:00Z")
    assert hourly.loc[0, "date"].isoformat() == "2026-03-23"


def _blank_to_none(value):
    if value is None or pd.isna(value):
        return None
    value = str(value).strip()
    return value or None


def _first_non_null(*values):
    for value in values:
        if value is not None and not pd.isna(value):
            return value
    return None


def _site_metadata() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "id": "site-1",
                "display_name": "  ",
                "name": "Fallback Site",
                "latitude": np.nan,
                "approximate_latitude": 0.3476,
                "longitude": 32.5825,
                "approximate_longitude": 32.58,
            },
            {
                "id": "site-sparse",
                "display_name": "Sparse Site",
                "name": "Ignored Sparse",
                "latitude": 0.5,
                "approximate_latitude": 0.51,
                "longitude": 31.5,
                "approximate_longitude": 31.51,
            },
        ]
    )


def _site_measurements() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-01T00:15:00Z"),
                "site_id": "site-1",
                "pm2_5_calibrated_value": 10.0,
                "pm2_5": 99.0,
            },
            {
                "timestamp": pd.Timestamp("2026-03-01T00:45:00Z"),
                "site_id": "site-1",
                "pm2_5_calibrated_value": np.nan,
                "pm2_5": 14.0,
            },
            {
                "timestamp": pd.Timestamp("2026-03-01T01:05:00Z"),
                "site_id": "site-1",
                "pm2_5_calibrated_value": np.nan,
                "pm2_5": 18.0,
            },
            {
                "timestamp": pd.Timestamp("2026-03-01T02:00:00Z"),
                "site_id": "site-1",
                "pm2_5_calibrated_value": np.nan,
                "pm2_5": np.nan,
            },
            {
                "timestamp": pd.Timestamp("2026-03-01T00:00:00Z"),
                "site_id": "site-sparse",
                "pm2_5_calibrated_value": np.nan,
                "pm2_5": 30.0,
            },
        ]
    )


def _evaluate_site_hourly_measurements_query(
    measurements: pd.DataFrame,
    sites: pd.DataFrame,
    start_timestamp: str,
    end_timestamp: str,
    min_hours: int,
) -> pd.DataFrame:
    start = pd.Timestamp(start_timestamp, tz="UTC")
    end = pd.Timestamp(end_timestamp, tz="UTC")
    joined = measurements.merge(sites, left_on="site_id", right_on="id", how="left")
    joined = joined[
        joined["timestamp"].between(start, end)
        & joined["site_id"].notna()
    ].copy()
    joined["timestamp"] = joined["timestamp"].dt.floor("h")
    joined["pm25_value"] = joined.apply(
        lambda row: _first_non_null(
            row["pm2_5_calibrated_value"],
            row["pm2_5"],
        ),
        axis=1,
    )
    joined = joined[joined["pm25_value"].notna()].copy()
    joined["site_name"] = joined.apply(
        lambda row: _first_non_null(
            _blank_to_none(row["display_name"]),
            _blank_to_none(row["name"]),
        ),
        axis=1,
    )
    joined["site_latitude"] = joined.apply(
        lambda row: _first_non_null(row["latitude"], row["approximate_latitude"]),
        axis=1,
    )
    joined["site_longitude"] = joined.apply(
        lambda row: _first_non_null(row["longitude"], row["approximate_longitude"]),
        axis=1,
    )
    hourly = (
        joined.groupby(["timestamp", "site_id"], as_index=False)
        .agg(
            site_name=("site_name", "first"),
            site_latitude=("site_latitude", "first"),
            site_longitude=("site_longitude", "first"),
            pm25_mean=("pm25_value", "mean"),
        )
        .sort_values(["site_id", "timestamp"])
        .reset_index(drop=True)
    )
    hourly_counts = hourly.groupby("site_id")["timestamp"].nunique()
    eligible_site_ids = hourly_counts[hourly_counts >= min_hours].index
    return hourly[hourly["site_id"].isin(eligible_site_ids)].reset_index(drop=True)


def _evaluate_site_daily_measurements_query(
    measurements: pd.DataFrame,
    sites: pd.DataFrame,
    start_date: str,
    end_date: str,
    min_hours: int,
) -> pd.DataFrame:
    joined = measurements.merge(sites, left_on="site_id", right_on="id", how="left")
    dates = joined["timestamp"].dt.date
    joined = joined[
        (dates >= pd.Timestamp(start_date).date())
        & (dates <= pd.Timestamp(end_date).date())
        & joined["site_id"].notna()
    ].copy()
    joined["pm25_value"] = joined.apply(
        lambda row: _first_non_null(
            row["pm2_5_calibrated_value"],
            row["pm2_5"],
        ),
        axis=1,
    )
    joined = joined[joined["pm25_value"].notna()].copy()
    joined["day"] = joined["timestamp"].dt.date
    joined["hour"] = joined["timestamp"].dt.floor("h")
    joined["site_name"] = joined.apply(
        lambda row: _first_non_null(
            _blank_to_none(row["display_name"]),
            _blank_to_none(row["name"]),
        ),
        axis=1,
    )
    joined["site_latitude"] = joined.apply(
        lambda row: _first_non_null(row["latitude"], row["approximate_latitude"]),
        axis=1,
    )
    joined["site_longitude"] = joined.apply(
        lambda row: _first_non_null(row["longitude"], row["approximate_longitude"]),
        axis=1,
    )
    daily = (
        joined.groupby(["day", "site_id"], as_index=False)
        .agg(
            site_name=("site_name", "first"),
            site_latitude=("site_latitude", "first"),
            site_longitude=("site_longitude", "first"),
            pm25_mean=("pm25_value", "mean"),
            pm25_min=("pm25_value", "min"),
            pm25_max=("pm25_value", "max"),
            n_hours=("hour", "nunique"),
        )
        .sort_values(["day", "site_id"])
        .reset_index(drop=True)
    )
    return daily[daily["n_hours"] >= min_hours].reset_index(drop=True)


def _fake_bigquery_api(evaluator):
    api = BigQueryApi.__new__(BigQueryApi)
    api.consolidated_data_table = "project.dataset.consolidated"
    api.sites_table = "project.dataset.sites"
    api.execute_data_query = lambda query: evaluator()
    return api


@pytest.mark.parametrize(
    "calibrated_value, raw_value, expected_pm25",
    [
        pytest.param(12.5, 80.0, 12.5, id="uses-calibrated-value"),
        pytest.param(np.nan, 21.0, 21.0, id="falls-back-to-raw-value"),
    ],
)
def test_site_hourly_measurements_query_pm25_values(
    calibrated_value,
    raw_value,
    expected_pm25,
):
    measurements = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-01T00:15:00Z"),
                "site_id": "site-1",
                "pm2_5_calibrated_value": calibrated_value,
                "pm2_5": raw_value,
            }
        ]
    )

    result = _evaluate_site_hourly_measurements_query(
        measurements,
        _site_metadata(),
        "2026-03-01 00:00:00",
        "2026-03-01 01:00:00",
        min_hours=1,
    )

    assert result.loc[0, "pm25_mean"] == expected_pm25


def test_fetch_hourly_site_data_for_forecast_jobs_returns_aggregated_values():
    api = _fake_bigquery_api(
        lambda: _evaluate_site_hourly_measurements_query(
            _site_measurements(),
            _site_metadata(),
            "2026-03-01 00:00:00",
            "2026-03-01 02:00:00",
            min_hours=2,
        )
    )

    result = api.fetch_hourly_site_data_for_forecast_jobs(
        start_date_time="2026-03-01T00:00:00Z",
        end_date_time="2026-03-01T02:00:00Z",
        min_hours=2,
    )

    assert result["site_id"].tolist() == ["site-1", "site-1"]
    assert result["site_name"].tolist() == ["Fallback Site", "Fallback Site"]
    assert result["site_latitude"].tolist() == [0.3476, 0.3476]
    assert result["site_longitude"].tolist() == [32.5825, 32.5825]
    assert result["pm25_mean"].tolist() == [12.0, 18.0]


def test_fetch_daily_site_data_for_forecast_jobs_returns_aggregated_values():
    api = _fake_bigquery_api(
        lambda: _evaluate_site_daily_measurements_query(
            _site_measurements(),
            _site_metadata(),
            "2026-03-01",
            "2026-03-01",
            min_hours=2,
        )
    )

    result = api.fetch_site_data_for_forecast_jobs(
        start_date_time="2026-03-01T00:00:00Z",
        end_date_time="2026-03-01T23:00:00Z",
        job_type="predict",
        min_hours=2,
    )

    assert len(result) == 1
    assert result.loc[0, "site_id"] == "site-1"
    assert result.loc[0, "site_name"] == "Fallback Site"
    assert result.loc[0, "site_latitude"] == 0.3476
    assert result.loc[0, "site_longitude"] == 32.5825
    assert result.loc[0, "pm25_mean"] == pytest.approx(14.0)
    assert result.loc[0, "pm25_min"] == 10.0
    assert result.loc[0, "pm25_max"] == 18.0
    assert result.loc[0, "n_hours"] == 2


def test_generate_site_hourly_forecasts_rejects_empty_input():
    with pytest.raises(ValueError, match="No raw site hourly forecast data provided"):
        ForecastModelTrainer.generate_site_hourly_forecasts(pd.DataFrame())


def test_resolve_site_hourly_forecasts_for_met_updates_passes_through_when_met_present():
    forecasts = pd.DataFrame(
        [
            {
                "site_id": "site-1",
                "timestamp": pd.Timestamp("2026-03-04T08:00:00Z"),
                "pm2_5_mean": 12.1,
                "air_temperature": 27.7,
            }
        ]
    )
    result = ForecastModelTrainer.resolve_site_hourly_forecasts_for_met_updates(
        forecasts
    )
    assert result is not None
    assert len(result) == 1


def test_resolve_site_hourly_forecasts_for_met_updates_returns_none_when_no_met_values():
    forecasts = pd.DataFrame(
        [
            {
                "site_id": "site-1",
                "timestamp": pd.Timestamp("2026-03-04T08:00:00Z"),
                "pm2_5_mean": 12.1,
                "air_temperature": float("nan"),
            }
        ]
    )
    result = ForecastModelTrainer.resolve_site_hourly_forecasts_for_met_updates(
        forecasts
    )
    assert result is None


def test_resolve_site_hourly_forecasts_for_met_updates_returns_none_for_none_input():
    assert (
        ForecastModelTrainer.resolve_site_hourly_forecasts_for_met_updates(None) is None
    )


def test_enrich_site_hourly_forecasts_soft_fail_on_api_error(monkeypatch):
    forecasts = pd.DataFrame(
        [
            {
                "timestamp": pd.Timestamp("2026-03-04T08:00:00Z"),
                "site_id": "site-1",
                "site_name": "Makerere",
                "site_latitude": 0.3123456,
                "site_longitude": 32.5123456,
                "pm2_5_mean": 12.1,
                "pm2_5_q10": 10.2,
                "pm2_5_q90": 14.8,
                "forecast_confidence": 80.0,
                "created_at": pd.Timestamp("2026-03-04T08:00:00Z"),
            }
        ]
    )

    def _raise_met_error(_: pd.DataFrame) -> pd.DataFrame:
        raise RuntimeError("MET API down")

    monkeypatch.setattr(
        WeatherDataUtils,
        "fetch_met_no_hourly_data_for_sites",
        staticmethod(_raise_met_error),
    )

    enriched = ForecastModelTrainer._enrich_site_hourly_forecasts_with_met_no_weather(
        forecasts,
        fail_on_error=False,
    )

    assert not enriched.empty
    assert set(SITE_DAILY_FORECAST_MET_COLUMNS).issubset(enriched.columns)
    assert enriched["air_temperature"].isna().all()


def test_fetch_site_hourly_prediction_data_rejects_empty_dataframe(monkeypatch):
    class DummyBigQueryApi:
        def fetch_hourly_site_data_for_forecast_jobs(self, **_):
            return pd.DataFrame()

    import airqo_etl_utils.bigquery_api as bigquery_api_module

    monkeypatch.setattr(bigquery_api_module, "BigQueryApi", DummyBigQueryApi)

    with pytest.raises(ValueError, match="returned no rows"):
        ForecastModelTrainer.fetch_site_hourly_prediction_data(
            execution_date=datetime(2026, 5, 9, 3, tzinfo=timezone.utc),
            lookback_days=1,
        )
