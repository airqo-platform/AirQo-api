from pathlib import Path

import pandas as pd

from airqoair import distribution_plot, time_series_plot


def test_time_series_plot_accepts_csv_path(tmp_path: Path):
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=4, freq="h"),
            "pm2_5": [10, 20, 30, 40],
            "pm10": [20, 30, 40, 50],
        }
    )
    csv_path = tmp_path / "kampala.csv"
    frame.to_csv(csv_path, index=False)

    result = time_series_plot(csv_path, pollutant=["pm2_5", "pm10"])

    assert result.metadata["kind"] == "time_series_plot"
    assert result.figure is not None


def test_distribution_plot_accepts_dataframe_without_date():
    frame = pd.DataFrame({"pm2_5": [10, 20, 20, 30, 40]})

    result = distribution_plot(frame, pollutant="pm2_5", date_col=None)

    assert result.metadata["kind"] == "distribution_plot"
    assert result.figure is not None
