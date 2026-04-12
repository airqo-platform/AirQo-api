"""Pytest coverage for synthetic 7-day site forecasts."""

from __future__ import annotations

from typing import Dict, Optional

import numpy as np
import pandas as pd
import pytest

from airqo_etl_utils.tests._test_dependency_stubs import apply_ml_utils_import_stubs

apply_ml_utils_import_stubs()

from airqo_etl_utils.constants import SITE_DAILY_FORECAST_MET_COLUMNS
from airqo_etl_utils.ml_utils import ForecastModelTrainer
from airqo_etl_utils.weather_data_utils import WeatherDataUtils


def build_synthetic_site_forecast_history(
    *,
    num_sites: int = 4,
    num_days: int = 60,
    seed: int = 42,
    start_date: Optional[str] = None,
) -> pd.DataFrame:
    """Create deterministic site-level daily PM2.5 history for forecast tests."""
    if num_sites < 1:
        raise ValueError("num_sites must be at least 1")
    if num_days < 30:
        raise ValueError("num_days must be at least 30 to support lag features")

    rng = np.random.default_rng(seed)
    start = pd.Timestamp(start_date or pd.Timestamp.today()).normalize()
    dates = pd.date_range(start=start, periods=num_days, freq="D")

    rows = []
    for site_idx in range(num_sites):
        site_id = f"site_{site_idx + 1:02d}"
        site_name = f"Synthetic Site {site_idx + 1}"
        site_latitude = 0.3123456 + (site_idx * 0.1010101)
        site_longitude = 32.5123456 + (site_idx * 0.2020202)
        base_level = 18 + (site_idx * 4)
        amplitude = 5 + site_idx
        trend = np.linspace(0, 2.5, num_days)
        seasonal = amplitude * np.sin(np.linspace(0, 3 * np.pi, num_days))
        noise = rng.normal(loc=0.0, scale=1.2, size=num_days)

        mean_values = np.clip(
            base_level + trend + seasonal + noise,
            a_min=2.0,
            a_max=None,
        )
        min_values = np.clip(
            mean_values - rng.uniform(1.5, 4.0, size=num_days),
            a_min=0.0,
            a_max=None,
        )
        max_values = np.maximum(
            mean_values + rng.uniform(1.5, 5.0, size=num_days),
            min_values,
        )
        n_hours = rng.integers(low=20, high=25, size=num_days)

        for day, mean_val, min_val, max_val, hours in zip(
            dates,
            mean_values,
            min_values,
            max_values,
            n_hours,
        ):
            rows.append(
                {
                    "day": day,
                    "site_id": site_id,
                    "site_name": site_name,
                    "site_latitude": round(float(site_latitude), 7),
                    "site_longitude": round(float(site_longitude), 7),
                    "pm25_mean": round(float(mean_val), 3),
                    "pm25_min": round(float(min_val), 3),
                    "pm25_max": round(float(max_val), 3),
                    "n_hours": int(hours),
                }
            )

    return pd.DataFrame(rows).sort_values(["site_id", "day"]).reset_index(drop=True)


class DummyForecastModel:
    """Deterministic model used to verify forecast generation end-to-end."""

    def __init__(self, offset: float):
        self.offset = offset

    def predict(self, frame: pd.DataFrame):
        base = frame["pm25_mean_lag_1"].fillna(frame["roll7_mean"]).fillna(0.0)
        return (base + self.offset).to_numpy()


def build_synthetic_site_forecast_artifacts(
    history: pd.DataFrame,
) -> Dict[str, Dict[str, object]]:
    """Build dummy model artifacts compatible with ForecastModelTrainer."""
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
        for idx, site_id in enumerate(sorted(history["site_id"].astype(str).unique()))
    }

    return {
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


def _build_met_no_weather_response(sites: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, site in (
        sites[["site_id", "site_latitude", "site_longitude"]]
        .drop_duplicates()
        .iterrows()
    ):
        for forecast_date in pd.date_range(
            start=sites["date"].min(),
            periods=7,
            freq="D",
        ):
            rows.append(
                {
                    "date": forecast_date.date(),
                    "met_no_query_latitude": round(site["site_latitude"], 2),
                    "met_no_query_longitude": round(site["site_longitude"], 2),
                    "air_pressure_at_sea_level": 1009.2,
                    "air_temperature": 26.8,
                    "cloud_area_fraction": 100.0,
                    "precipitation_amount": 0.1,
                    "relative_humidity": 84.0,
                    "wind_from_direction": 210.4,
                    "wind_speed": 4.9,
                }
            )

    return pd.DataFrame(rows)


@pytest.fixture
def synthetic_history() -> pd.DataFrame:
    return build_synthetic_site_forecast_history(
        num_sites=3,
        num_days=45,
        seed=7,
    )


@pytest.fixture
def patched_forecast_dependencies(monkeypatch, synthetic_history: pd.DataFrame):
    monkeypatch.setattr(
        ForecastModelTrainer,
        "_load_site_forecast_artifacts",
        staticmethod(lambda: build_synthetic_site_forecast_artifacts(synthetic_history)),
    )
    monkeypatch.setattr(
        WeatherDataUtils,
        "fetch_met_no_daily_data_for_sites",
        staticmethod(_build_met_no_weather_response),
    )


def test_build_synthetic_site_forecast_history_validates_inputs():
    with pytest.raises(ValueError, match="num_sites must be at least 1"):
        build_synthetic_site_forecast_history(num_sites=0)

    with pytest.raises(ValueError, match="num_days must be at least 30"):
        build_synthetic_site_forecast_history(num_days=29)


def test_generate_site_daily_forecasts_with_synthetic_history(
    synthetic_history: pd.DataFrame,
    patched_forecast_dependencies,
):
    forecasts = ForecastModelTrainer.generate_site_daily_forecasts(
        synthetic_history,
        horizon=7,
    )

#    print(f"Synthetic history rows: {len(synthetic_history)}")
#    print(f"Forecast rows: {len(forecasts)}")
#    print(f"Sites forecasted: {forecasts['site_id'].nunique()}")
#    print("Forecast sample:")
#    print(forecasts.head().to_string(index=False))

    assert len(synthetic_history) == 135
    assert len(forecasts) == 21
    assert forecasts["site_id"].nunique() == 3
    assert forecasts.groupby("site_id")["date"].nunique().eq(7).all()

    expected_columns = {
        "site_id",
        "site_name",
        "site_latitude",
        "site_longitude",
        "date",
        "pm2_5_mean",
        "pm2_5_min",
        "pm2_5_max",
        "pm2_5_low",
        "pm2_5_high",
        "forecast_confidence",
        *SITE_DAILY_FORECAST_MET_COLUMNS,
    }
    assert expected_columns.issubset(forecasts.columns)
    assert (forecasts["pm2_5_min"] <= forecasts["pm2_5_mean"]).all()
    assert (forecasts["pm2_5_mean"] <= forecasts["pm2_5_max"]).all()
    assert (forecasts["pm2_5_low"] <= forecasts["pm2_5_high"]).all()
    assert forecasts["forecast_confidence"].between(0, 100).all()
