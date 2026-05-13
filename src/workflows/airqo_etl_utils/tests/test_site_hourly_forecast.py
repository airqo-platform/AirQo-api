from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from airqo_etl_utils.tests._test_dependency_stubs import apply_ml_utils_import_stubs

apply_ml_utils_import_stubs()

import airqo_etl_utils.ml_utils as ml_utils_module
from airqo_etl_utils.constants import SITE_DAILY_FORECAST_MET_COLUMNS
from airqo_etl_utils.ml_utils import ForecastModelTrainer
from airqo_etl_utils.sql import query_manager
from airqo_etl_utils.weather_data_utils import WeatherDataUtils


class DummyHourlyForecastModel:
    def __init__(self, offset: float):
        self.offset = offset

    def predict(self, frame: pd.DataFrame):
        base = frame["lag_pm25_hourly_1h"].fillna(frame["roll_pm25_6h_mean"]).fillna(0.0)
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

    sparse_timestamps = pd.date_range("2026-03-04T06:00:00Z", periods=2, freq="h")
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
    assert forecasts.groupby("site_id")["timestamp"].nunique().eq(3).all()
    assert forecasts["pm2_5_q10"].le(forecasts["pm2_5_mean"]).all()
    assert forecasts["pm2_5_mean"].le(forecasts["pm2_5_q90"]).all()
    assert forecasts["forecast_confidence"].between(0, 100).all()


def test_generate_site_hourly_forecasts_rejects_none_input():
    with pytest.raises(ValueError, match="fetch_site_prediction_data task returned None"):
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
    mock_collection.find.return_value = []
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
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    result = ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    mock_collection.bulk_write.assert_called_once()
    assert mock_collection.bulk_write.call_args.kwargs["ordered"] is False
    bulk_operations = mock_collection.bulk_write.call_args.args[0]
    assert len(bulk_operations) == 2
    assert all(operation._upsert for operation in bulk_operations)
    assert bulk_operations[0]._filter == {
        "site_id": "site-1",
        "timestamp": pd.Timestamp("2026-03-04T08:00:00Z").to_pydatetime(),
    }
    assert bulk_operations[0]._doc["$set"]["pm2_5_mean"] == 12.1
    assert bulk_operations[0]._doc["$setOnInsert"] == {
        "site_name": "Makerere",
        "site_id": "site-1",
        "timestamp": pd.Timestamp("2026-03-04T08:00:00Z").to_pydatetime(),
        "created_at": pd.Timestamp("2026-03-04T08:00:00Z").to_pydatetime(),
    }
    mock_collection.delete_many.assert_called_once()
    delete_filter = mock_collection.delete_many.call_args.args[0]
    assert set(delete_filter.keys()) == {"timestamp"}
    assert set(delete_filter["timestamp"].keys()) == {"$lt"}
    mock_collection.insert_many.assert_not_called()
    mock_collection.create_index.assert_not_called()
    assert result == {
        "rows": 2,
        "collection": "site_hourly_forecasts",
        "deleted_rows": 0,
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
    mock_collection.find.return_value = []
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
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    bulk_operations = mock_collection.bulk_write.call_args.args[0]
    update_doc = bulk_operations[0]._doc
    assert "air_temperature" not in update_doc["$set"]
    assert "relative_humidity" not in update_doc["$set"]
    assert "site_name" not in update_doc["$set"]
    assert "created_at" not in update_doc["$set"]
    assert update_doc["$set"]["pm2_5_mean"] == 12.1
    assert update_doc["$setOnInsert"]["site_name"] == "Makerere"


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
    existing_docs = [
        {
            "_id": 1,
            "site_id": "site-1",
            "timestamp": pd.Timestamp("2026-03-04T08:00:00Z").to_pydatetime(),
        },
        {
            "_id": 2,
            "site_id": "site-1",
            "timestamp": pd.Timestamp("2026-03-04T09:00:00Z").to_pydatetime(),
        },
        {
            "_id": 3,
            "site_id": "site-1",
            "timestamp": pd.Timestamp("2026-03-04T10:00:00Z").to_pydatetime(),
        },
    ]

    mock_collection = MagicMock()
    mock_collection.find.return_value = existing_docs
    stale_delete_result = MagicMock()
    stale_delete_result.deleted_count = 1
    expired_delete_result = MagicMock()
    expired_delete_result.deleted_count = 0
    mock_collection.delete_many.side_effect = [
        stale_delete_result,
        expired_delete_result,
    ]

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
        ml_utils_module.configuration, "SITE_HOURLY_FORECAST_HORIZON_HOURS", "2"
    )
    monkeypatch.setattr(
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    result = ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    mock_collection.bulk_write.assert_called_once()
    assert mock_collection.delete_many.call_args_list[0].args[0] == {
        "_id": {"$in": [1]}
    }
    timestamp_delete_filter = mock_collection.delete_many.call_args_list[1].args[0]
    assert set(timestamp_delete_filter.keys()) == {"timestamp"}
    assert set(timestamp_delete_filter["timestamp"].keys()) == {"$lt"}
    assert result == {
        "rows": 1,
        "collection": "site_hourly_forecasts",
        "deleted_rows": 1,
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
    mock_collection.find.return_value = []
    mock_collection.delete_many.return_value.deleted_count = 4

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
        ml_utils_module.configuration, "SITE_HOURLY_FORECAST_HORIZON_HOURS", "2"
    )
    monkeypatch.setattr(
        ml_utils_module.pm,
        "MongoClient",
        lambda *args, **kwargs: mock_client_manager,
    )

    result = ForecastModelTrainer.save_site_hourly_forecasts_to_mongo(forecasts)

    mock_collection.delete_many.assert_called_once()
    delete_filter = mock_collection.delete_many.call_args.args[0]
    assert set(delete_filter.keys()) == {"timestamp"}
    assert set(delete_filter["timestamp"].keys()) == {"$lt"}
    assert result == {
        "rows": 1,
        "collection": "site_hourly_forecasts",
        "deleted_rows": 4,
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
                            "next_1_hours": {
                                "details": {"precipitation_amount": 0.0}
                            },
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


def test_site_hourly_forecast_query_is_registered():
    query = query_manager.get_query("site_hourly_measurements_for_forecast_jobs")

    assert {
        "consolidated_table",
        "sites_table",
        "start_timestamp",
        "end_timestamp",
        "min_hours",
    }.issubset(query.placeholders)
    assert "HAVING COUNT(DISTINCT timestamp) >= {min_hours}" in query.sql
