import json
from pathlib import Path

import pandas as pd

from airqoair import load_data, model_evaluation, taylor_diagram, time_proportion_plot


def test_load_data_supports_jsonl(tmp_path: Path):
    records = [
        {"date": "2025-01-01T00:00:00", "pm2_5": 10},
        {"date": "2025-01-01T01:00:00", "pm2_5": 20},
    ]
    path = tmp_path / "kampala.jsonl"
    path.write_text("\n".join(json.dumps(row) for row in records), encoding="utf-8")

    result = load_data(path)

    assert list(result["pm2_5"]) == [10, 20]


def test_time_proportion_plot_handles_constant_pollutant_values():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=6, freq="h"),
            "pm2_5": [20, 20, 20, 20, 20, 20],
            "site_name": ["A", "A", "B", "B", "A", "B"],
        }
    )

    result = time_proportion_plot(frame, pollutant="pm2_5", proportion="site_name", avg_time="1D")

    assert result.metadata["kind"] == "time_proportion_plot"


def test_time_proportion_plot_segments_sum_to_interval_mean():
    frame = pd.DataFrame(
        {
            "date": pd.to_datetime(
                [
                    "2025-01-01 00:00:00",
                    "2025-01-01 01:00:00",
                    "2025-01-01 02:00:00",
                    "2025-01-01 03:00:00",
                ]
            ),
            "pm2_5": [10, 20, 30, 40],
            "site_name": ["A", "A", "B", "B"],
        }
    )

    result = time_proportion_plot(frame, pollutant="pm2_5", proportion="site_name", avg_time="1D")

    interval_total = result.data.groupby("date")["value"].sum().iloc[0]
    assert interval_total == 25


def test_taylor_diagram_rejects_constant_observed_series():
    frame = pd.DataFrame(
        {
            "observed": [10, 10, 10],
            "predicted": [9, 10, 11],
        }
    )

    try:
        taylor_diagram(frame, observed_col="observed", predicted_col="predicted")
    except ValueError as exc:
        assert "Taylor diagram requires" in str(exc)
    else:
        raise AssertionError("Expected ValueError for constant observed series")


def test_model_evaluation_returns_nan_correlation_for_constant_series():
    frame = pd.DataFrame(
        {
            "observed": [10, 10, 10],
            "predicted": [9, 10, 11],
        }
    )

    result = model_evaluation(frame, observed_col="observed", predicted_col="predicted")

    assert pd.isna(result.sections["metrics"].loc[0, "correlation"])
