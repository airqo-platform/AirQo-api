"""Synthetic datasets for local 7-day site forecast testing.

Run locally:
    python src/workflows/airqo_etl_utils/tests/test_7days_forecast.py --output synthetic_site_forecast_history.csv
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from pathlib import Path
import sys
from typing import Dict, Optional

import numpy as np
import pandas as pd

# Allow running this script directly from the tests directory.
WORKFLOWS_ROOT = Path(__file__).resolve().parents[2]
if str(WORKFLOWS_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKFLOWS_ROOT))

from airqo_etl_utils.ml_utils import ForecastModelTrainer


def build_synthetic_site_forecast_history(
    *,
    num_sites: int = 4,
    num_days: int = 60,
    seed: int = 42,
    start_date: Optional[str] = None,
) -> pd.DataFrame:
    """Create deterministic site-level daily PM2.5 history for forecast testing."""
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
            base_level + trend + seasonal + noise, a_min=2.0, a_max=None
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
            dates, mean_values, min_values, max_values, n_hours
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
    """Simple deterministic model for local end-to-end forecast testing."""

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


@contextmanager
def patched_site_forecast_artifacts(history: pd.DataFrame):
    """Temporarily replace deployed artifacts with deterministic dummy ones."""
    original_loader = ForecastModelTrainer._load_site_forecast_artifacts
    ForecastModelTrainer._load_site_forecast_artifacts = staticmethod(
        lambda: build_synthetic_site_forecast_artifacts(history)
    )
    try:
        yield
    finally:
        ForecastModelTrainer._load_site_forecast_artifacts = original_loader


def run_synthetic_7day_forecast(
    *,
    num_sites: int = 4,
    num_days: int = 60,
    seed: int = 42,
    horizon: int = 7,
    use_dummy_models: bool = False,
    save_to_database: bool = False,
) -> tuple[pd.DataFrame, pd.DataFrame, Optional[Dict[str, object]]]:
    """Generate synthetic history and forecast 7 days for local print-only testing."""
    history = build_synthetic_site_forecast_history(
        num_sites=num_sites,
        num_days=num_days,
        seed=seed,
    )

    if use_dummy_models:
        with patched_site_forecast_artifacts(history):
            forecasts = ForecastModelTrainer.generate_site_daily_forecasts(
                history, horizon=horizon
            )
    else:
        forecasts = ForecastModelTrainer.generate_site_daily_forecasts(
            history, horizon=horizon
        )

    if save_to_database:
        print(
            "Database saving is disabled for this local test script. "
            "Printing forecast output only."
        )

    return history, forecasts, None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic site forecast history."
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Optional CSV output path for the synthetic history.",
    )
    parser.add_argument(
        "--sites", type=int, default=4, help="Number of synthetic sites."
    )
    parser.add_argument(
        "--days", type=int, default=60, help="Number of history days."
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument(
        "--horizon", type=int, default=7, help="Forecast horizon in days."
    )
    parser.add_argument(
        "--forecast-output",
        type=str,
        help="Optional CSV output path for the generated 7-day forecast.",
    )
    parser.add_argument(
        "--use-dummy-models",
        action="store_true",
        help="Use built-in dummy models instead of the deployed models in the bucket.",
    )
    parser.add_argument(
        "--skip-save",
        action="store_true",
        help="Deprecated no-op. This script no longer writes forecasts to database targets.",
    )
    args = parser.parse_args()

    history, forecasts, save_result = run_synthetic_7day_forecast(
        num_sites=args.sites,
        num_days=args.days,
        seed=args.seed,
        horizon=args.horizon,
        use_dummy_models=args.use_dummy_models,
        save_to_database=False,
    )

    if args.output:
        output_path = Path(args.output)
        history.to_csv(output_path, index=False)
        print(f"Wrote {len(history)} synthetic history rows to {output_path}")

    if args.forecast_output:
        forecast_output_path = Path(args.forecast_output)
        forecasts.to_csv(forecast_output_path, index=False)
        print(f"Wrote {len(forecasts)} forecast rows to {forecast_output_path}")

    print("Synthetic history preview:")
    print(history.head(10).to_string(index=False))
    print(
        "\nForecast model source: "
        + ("dummy test models" if args.use_dummy_models else "deployed bucket models")
    )
    print("\nGenerated 7-day forecast:")
    print(forecasts.to_string(index=False))
    print(f"\nHistory rows: {len(history)}")
    print(f"Forecast rows: {len(forecasts)}")
    print(f"Sites: {forecasts['site_id'].nunique()}")
    print(
        f"Forecast days per site: {forecasts.groupby('site_id')['date'].nunique().iloc[0]}"
    )

    print("\nDatabase save: skipped by design for this local test script.")


if __name__ == "__main__":
    main()
