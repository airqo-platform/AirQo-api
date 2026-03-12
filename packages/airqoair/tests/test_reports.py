from pathlib import Path

import pandas as pd

from airqoair import diurnal_profile, monthly_profile, variation_report, weekday_profile


def test_diurnal_weekday_monthly_profiles_return_expected_shapes():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=72, freq="h"),
            "pm2_5": list(range(72)),
        }
    )

    diurnal = diurnal_profile(frame, pollutant="pm2_5")
    weekday = weekday_profile(frame, pollutant="pm2_5")
    monthly = monthly_profile(frame, pollutant="pm2_5")

    assert list(diurnal.columns) == ["hour", "value"]
    assert list(weekday.columns) == ["weekday", "value"]
    assert list(monthly.columns) == ["month", "value"]


def test_variation_report_exports_sections_and_markdown(tmp_path: Path):
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=48, freq="h"),
            "pm2_5": list(range(48)),
        }
    )

    report = variation_report(frame, pollutant="pm2_5")
    markdown_path = tmp_path / "report.md"
    report.save_markdown(markdown_path)

    assert "summary" in report.sections
    assert "diurnal_profile" in report.sections
    assert markdown_path.exists()
