import json
from pathlib import Path

import pandas as pd

from airqoair import (
    calendar_plot,
    conditional_quantiles,
    directional_map,
    dilution_plot,
    model_evaluation,
    network_visualization,
    polar_map,
    percentile_rose,
    polar_annulus,
    polar_plot,
    pollutant_ratio_plot,
    run_regression,
    smooth_trend,
    taylor_diagram,
    theil_sen_trend,
    time_proportion_plot,
    trend_level,
    trajectory_analysis,
    trend_heatmap,
)


def test_expanded_directional_and_trend_figures_return_metadata():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=48, freq="h"),
            "pm2_5": list(range(48)),
            "pm10": list(range(10, 58)),
            "ws": [1 + (index % 6) for index in range(48)],
            "wd": [(index * 20) % 360 for index in range(48)],
        }
    )

    assert percentile_rose(frame, pollutant="pm2_5").metadata["kind"] == "percentile_rose"
    assert polar_plot(frame, pollutant="pm2_5").metadata["kind"] == "polar_plot"
    assert polar_annulus(frame, pollutant="pm2_5").metadata["kind"] == "polar_annulus"
    assert calendar_plot(frame, pollutant="pm2_5").metadata["kind"] == "calendar_plot"
    assert (
        time_proportion_plot(frame, pollutant="pm2_5", proportion="wd").metadata["kind"]
        == "time_proportion_plot"
    )
    assert theil_sen_trend(frame, pollutant="pm2_5").metadata["kind"] == "theil_sen_trend"
    assert smooth_trend(frame, pollutant="pm2_5").metadata["kind"] == "smooth_trend"
    assert dilution_plot(frame, pollutant="pm2_5").metadata["kind"] == "dilution_plot"
    assert pollutant_ratio_plot(frame, numerator="pm2_5", denominator="pm10").metadata["kind"] == "pollutant_ratio_plot"
    assert trend_heatmap(frame, pollutant="pm2_5").metadata["kind"] == "trend_heatmap"


def test_calendar_plot_supports_year_filter_breaks_and_wind_annotations():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2024-12-25", periods=16, freq="D"),
            "pm2_5": list(range(16)),
            "ws": [2 + (index % 3) for index in range(16)],
            "wd": [(index * 30) % 360 for index in range(16)],
        }
    )

    result = calendar_plot(
        frame,
        pollutant="pm2_5",
        year=2025,
        annotate="ws",
        breaks=[0, 5, 10, 20],
        labels=["Low", "Medium", "High"],
    )

    assert result.metadata["kind"] == "calendar_plot"
    assert result.metadata["year"] == 2025
    assert result.metadata["annotate"] == "ws"
    assert set(result.data["year"]) == {2025}


def test_theil_sen_supports_deseason_and_grouping():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2023-01-01", periods=24, freq="MS").repeat(2),
            "site_name": ["A", "B"] * 24,
            "pm2_5": [10 + index for index in range(48)],
            "wd": [(index * 45) % 360 for index in range(48)],
        }
    )

    grouped = theil_sen_trend(
        frame,
        pollutant="pm2_5",
        group_by="site_name",
        deseason=True,
        n_boot=10,
    )
    directional = theil_sen_trend(
        frame,
        pollutant="pm2_5",
        type="wd",
        n_boot=10,
    )

    assert grouped.metadata["kind"] == "theil_sen_trend"
    assert grouped.metadata["condition_by"] == "site_name"
    assert grouped.metadata["deseason"] is True
    assert "condition" in grouped.data.columns
    assert directional.metadata["condition_by"] == "wd"


def test_run_regression_returns_rolling_metrics_and_grouping():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2023-01-01", periods=24, freq="MS").repeat(2),
            "site_name": ["A", "B"] * 24,
            "pm2_5": [20 + index for index in range(48)],
            "ws": [1 + (index % 6) for index in range(48)],
        }
    )

    result = run_regression(
        frame,
        x="ws",
        y="pm2_5",
        avg_time="MS",
        window=6,
        group_by="site_name",
    )

    assert result.metadata["kind"] == "run_regression"
    assert result.metadata["condition_by"] == "site_name"
    assert {"slope", "intercept", "r_squared", "correlation", "rmse"} <= set(result.data.columns)
    assert "condition" in result.data.columns


def test_trend_level_supports_grouped_heatmaps():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=48, freq="h"),
            "site_name": ["A"] * 24 + ["B"] * 24,
            "pm2_5": list(range(48)),
        }
    )

    result = trend_level(
        frame,
        pollutant="pm2_5",
        x="month",
        y="hour",
        group_by="site_name",
    )

    assert result.metadata["kind"] == "trend_level"
    assert result.metadata["condition_by"] == "site_name"
    assert {"condition", "x_bucket", "y_bucket", "value"} <= set(result.data.columns)


def test_smooth_trend_supports_deseason_and_grouping():
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2023-01-01", periods=24, freq="MS").repeat(2),
            "site_name": ["A", "B"] * 24,
            "pm2_5": [15 + index for index in range(48)],
        }
    )

    result = smooth_trend(
        frame,
        pollutant="pm2_5",
        group_by="site_name",
        deseason=True,
        n_boot=10,
    )

    assert result.metadata["kind"] == "smooth_trend"
    assert result.metadata["condition_by"] == "site_name"
    assert result.metadata["deseason"] is True
    assert "condition" in result.data.columns


def test_model_evaluation_and_conditional_quantiles_work():
    frame = pd.DataFrame(
        {
            "observed": [10, 20, 30, 40, 50],
            "predicted": [12, 18, 29, 43, 49],
            "x": [1, 2, 3, 4, 5],
            "y": [2, 4, 5, 8, 10],
        }
    )

    evaluation = model_evaluation(frame, observed_col="observed", predicted_col="predicted")
    taylor = taylor_diagram(frame, observed_col="observed", predicted_col="predicted")
    quantiles = conditional_quantiles(frame, x="x", y="y", date_col=None, bins=3)

    assert "metrics" in evaluation.sections
    assert taylor.metadata["kind"] == "taylor_diagram"
    assert quantiles.metadata["kind"] == "conditional_quantiles"


def test_interactive_map_helpers_accept_dataframe_and_json(tmp_path: Path):
    network = pd.DataFrame(
        {
            "origin_lat": [0.3],
            "origin_lon": [32.5],
            "target_lat": [0.4],
            "target_lon": [32.6],
            "weight": [4],
        }
    )
    directional = pd.DataFrame(
        {
            "latitude": [0.3, 0.31],
            "longitude": [32.5, 32.51],
            "site_name": ["A", "B"],
            "pm2_5": [12, 20],
            "wd": [45, 90],
            "ws": [2, 3],
        }
    )
    trajectories = [
        {"trajectory_id": "t1", "latitude": 0.3, "longitude": 32.5},
        {"trajectory_id": "t1", "latitude": 0.4, "longitude": 32.6},
    ]
    json_path = tmp_path / "trajectories.json"
    json_path.write_text(json.dumps(trajectories), encoding="utf-8")

    network_map = network_visualization(network.assign(group=["g1"]), weight="weight", control="group")
    assert network_map.metadata["kind"] == "network_visualization"
    assert directional_map(directional).metadata["kind"] == "directional_map"
    assert polar_map(directional, site_col="site_name", pollutant="pm2_5", kind="polar_plot").metadata["kind"] == "polar_map"
    assert trajectory_analysis(json_path).metadata["kind"] == "trajectory_analysis"
