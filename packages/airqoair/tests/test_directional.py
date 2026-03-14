from pathlib import Path

import pandas as pd

from airqoair import pollution_rose, wind_rose


def test_wind_rose_returns_percentage_table():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=8, freq="h"),
            "ws": [1, 2, 3, 4, 5, 6, 7, 8],
            "wd": [0, 45, 90, 135, 180, 225, 270, 315],
        }
    )

    result = wind_rose(frame, direction_bins=8, speed_bins=[0, 4, 8, 12])

    assert round(result.data["value"].sum(), 6) == 100.0


def test_pollution_rose_keeps_requested_pollutant_metadata():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=8, freq="h"),
            "ws": [1, 2, 3, 4, 5, 6, 7, 8],
            "wd": [0, 45, 90, 135, 180, 225, 270, 315],
            "pm2_5": [12, 14, 16, 20, 18, 15, 11, 9],
        }
    )

    result = pollution_rose(
        frame,
        pollutant="pm2_5",
        direction_bins=8,
        speed_bins=[0, 4, 8, 12],
    )

    assert result.metadata["pollutant"] == "pm2_5"
    assert "value" in result.data.columns


def test_wind_rose_does_not_require_date_column():
    frame = pd.DataFrame(
        {
            "ws": [1, 2, 3, 4],
            "wd": [0, 90, 180, 270],
        }
    )

    result = wind_rose(frame, direction_bins=4, speed_bins=[0, 2, 4, 6])

    assert result.figure is not None


def test_wind_rose_raises_when_required_values_are_all_missing():
    frame = pd.DataFrame(
        {
            "ws": [None, None],
            "wd": [None, None],
        }
    )

    try:
        wind_rose(frame, direction_bins=4, speed_bins=[0, 2, 4, 6])
    except ValueError as exc:
        assert "No valid rows remain" in str(exc)
    else:
        raise AssertionError("Expected ValueError for all-missing directional input")


def test_wind_rose_accepts_csv_path(tmp_path: Path):
    frame = pd.DataFrame(
        {
            "ws": [1, 2, 3, 4],
            "wd": [0, 90, 180, 270],
        }
    )
    csv_path = tmp_path / "directional.csv"
    frame.to_csv(csv_path, index=False)

    result = wind_rose(csv_path, direction_bins=4, speed_bins=[0, 2, 4, 6])

    assert round(result.data["value"].sum(), 6) == 100.0
