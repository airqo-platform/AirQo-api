import pandas as pd

from airqoair import (
    diurnal_profile,
    monthly_plot,
    monthly_profile,
    time_variation,
    variation_report,
)


def test_monthly_profile_supports_group_by_column():
    frame = pd.DataFrame(
        {
            "date": pd.to_datetime(
                [
                    "2025-01-01 00:00:00",
                    "2025-01-02 00:00:00",
                    "2025-02-01 00:00:00",
                    "2025-02-02 00:00:00",
                ]
            ),
            "site_name": ["A", "B", "A", "B"],
            "pm2_5": [10, 20, 30, 40],
        }
    )

    result = monthly_profile(frame, pollutant="pm2_5", group_by="site_name")

    assert list(result.columns) == ["condition", "month", "value"]
    assert set(result["condition"]) == {"A", "B"}


def test_diurnal_profile_supports_openair_style_type_condition():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=48, freq="h"),
            "pm2_5": list(range(48)),
        }
    )

    result = diurnal_profile(frame, pollutant="pm2_5", type="weekday")

    assert list(result.columns) == ["condition", "hour", "value"]
    assert set(result["condition"]) == {"Wednesday", "Thursday"}


def test_time_variation_supports_grouped_panels():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=96, freq="h"),
            "site_name": ["A"] * 48 + ["B"] * 48,
            "pm2_5": list(range(96)),
        }
    )

    result = time_variation(frame, pollutant="pm2_5", group_by="site_name")

    assert "condition" in result.data.columns
    assert set(result.data["period"]) == {"hour", "weekday", "month"}


def test_monthly_plot_returns_figure_for_grouped_site_bars():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=96, freq="h"),
            "site_name": ["A"] * 48 + ["B"] * 48,
            "pm2_5": list(range(96)),
        }
    )

    result = monthly_plot(frame, pollutant="pm2_5", group_by="site_name")

    assert result.figure is not None
    assert "condition" in result.data.columns


def test_variation_report_summarises_by_condition():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=96, freq="h"),
            "site_name": ["A"] * 48 + ["B"] * 48,
            "pm2_5": list(range(96)),
        }
    )

    report = variation_report(frame, pollutant="pm2_5", group_by="site_name")

    assert "condition" in report.sections["summary"].columns
    assert "condition" in report.sections["monthly_profile"].columns
