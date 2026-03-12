import math
import json
from pathlib import Path

import pandas as pd

from airqoair import load_data, time_average, time_variation


def test_time_average_uses_circular_mean_for_wind_direction():
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
            "wd": [350, 355, 5, 10],
            "ws": [2, 2, 2, 2],
        }
    )

    result = time_average(frame, avg="D", pollutant_cols=["pm2_5"])

    assert result.shape[0] == 1
    assert result.loc[0, "pm2_5"] == 25
    assert math.isclose(result.loc[0, "wd"], 360.0, abs_tol=1e-6) or math.isclose(
        result.loc[0, "wd"], 0.0, abs_tol=1e-6
    )


def test_time_average_applies_capture_threshold():
    frame = pd.DataFrame(
        {
            "date": pd.to_datetime(
                [
                    "2025-01-01 00:00:00",
                    "2025-01-01 01:00:00",
                    "2025-01-01 02:00:00",
                    "2025-01-02 00:00:00",
                ]
            ),
            "pm2_5": [10, 20, 30, 40],
            "wd": [45, 45, 45, 45],
            "ws": [2, 2, 2, 2],
        }
    )

    result = time_average(
        frame,
        avg="D",
        pollutant_cols=["pm2_5"],
        data_capture_threshold=0.5,
    )

    assert pd.isna(result.loc[1, "pm2_5"])


def test_time_variation_returns_hour_weekday_month_panels():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=72, freq="h"),
            "pm2_5": list(range(72)),
        }
    )

    result = time_variation(frame, pollutant="pm2_5")

    assert set(result.data["period"]) == {"hour", "weekday", "month"}
    assert result.figure is not None


def test_time_average_raises_for_missing_requested_pollutant():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=4, freq="h"),
            "pm2_5": [10, 12, 14, 16],
        }
    )

    try:
        time_average(frame, pollutant_cols=["pm10"])
    except ValueError as exc:
        assert "Missing required columns" in str(exc)
    else:
        raise AssertionError("Expected ValueError for missing pollutant column")


def test_time_average_accepts_csv_path(tmp_path: Path):
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=4, freq="h"),
            "pm2_5": [10, 20, 30, 40],
            "pm10": [20, 30, 40, 50],
            "wd": [0, 90, 180, 270],
        }
    )
    csv_path = tmp_path / "kampala.csv"
    frame.to_csv(csv_path, index=False)

    result = time_average(csv_path, pollutant_cols=["pm2_5", "pm10"])

    assert result.loc[0, "pm2_5"] == 25
    assert result.loc[0, "pm10"] == 35


def test_load_data_accepts_json_path(tmp_path: Path):
    records = [
        {"date": "2025-01-01T00:00:00", "pm2_5": 12},
        {"date": "2025-01-01T01:00:00", "pm2_5": 18},
    ]
    json_path = tmp_path / "kampala.json"
    json_path.write_text(json.dumps(records), encoding="utf-8")

    result = load_data(json_path)

    assert list(result["pm2_5"]) == [12, 18]
