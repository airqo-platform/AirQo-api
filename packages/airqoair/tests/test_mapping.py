import json
from pathlib import Path

import pandas as pd

from airqoair import station_map


def test_station_map_does_not_require_date_column():
    frame = pd.DataFrame(
        {
            "site_id": ["A", "B"],
            "latitude": [0.3476, 0.3136],
            "longitude": [32.5825, 32.5811],
            "pm2_5": [12.4, 18.7],
        }
    )

    result = station_map(frame, value="pm2_5")

    assert result.metadata["kind"] == "station_map"
    assert result.map is not None


def test_station_map_accepts_json_path(tmp_path: Path):
    records = [
        {"site_id": "A", "latitude": 0.3476, "longitude": 32.5825, "pm2_5": 12.4},
        {"site_id": "B", "latitude": 0.3136, "longitude": 32.5811, "pm2_5": 18.7},
    ]
    json_path = tmp_path / "kampala.json"
    json_path.write_text(json.dumps(records), encoding="utf-8")

    result = station_map(json_path, value="pm2_5")

    assert result.metadata["kind"] == "station_map"
    assert result.map is not None


def test_station_map_supports_grouping_clustering_and_heatmap():
    frame = pd.DataFrame(
        {
            "site_name": ["A", "A", "B", "B"],
            "latitude": [0.3476, 0.3478, 0.3136, 0.3138],
            "longitude": [32.5825, 32.5827, 32.5811, 32.5813],
            "pm2_5": [12.4, 13.4, 18.7, 17.7],
            "count": [10, 12, 20, 22],
        }
    )

    result = station_map(
        frame,
        value="pm2_5",
        group_by="site_name",
        radius_col="count",
        cluster=True,
        heatmap=True,
        tiles=["CartoDB positron", "OpenStreetMap"],
    )

    assert result.metadata["kind"] == "station_map"
    assert result.metadata["group_by"] == "site_name"
    assert result.metadata["cluster"] is True
    assert result.metadata["heatmap"] is True
    assert set(result.data["site_name"]) == {"A", "B"}


def test_station_map_keeps_value_based_coloring_when_legend_is_disabled():
    frame = pd.DataFrame(
        {
            "site_id": ["A", "B"],
            "latitude": [0.3476, 0.3136],
            "longitude": [32.5825, 32.5811],
            "pm2_5": [12.4, 18.7],
        }
    )

    result = station_map(frame, value="pm2_5", legend=False)
    html = result.map.get_root().render()

    assert "#2a9d8f" not in html
