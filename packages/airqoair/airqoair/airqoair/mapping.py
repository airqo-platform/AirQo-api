from __future__ import annotations

from collections.abc import Sequence

import pandas as pd

from .results import AirQoMap
from .utils import DataSource, load_data, validate_columns


def station_map(
    data: DataSource,
    *,
    value: str | None = None,
    latitude: str = "latitude",
    longitude: str = "longitude",
    popup_columns: list[str] | None = None,
    tooltip_columns: list[str] | None = None,
    group_by: str | None = None,
    radius: int = 7,
    radius_col: str | None = None,
    cluster: bool = False,
    heatmap: bool = False,
    heatmap_radius: int = 18,
    tiles: str | list[str] = "CartoDB positron",
    legend: bool = True,
    zoom_start: int = 6,
) -> AirQoMap:
    import folium
    from folium.plugins import HeatMap, MarkerCluster

    frame = load_data(data, date_col=None)
    required = [latitude, longitude] + ([value] if value else []) + ([radius_col] if radius_col else [])
    validate_columns(frame, required)
    if group_by:
        validate_columns(frame, [group_by])

    working = frame.dropna(subset=[latitude, longitude]).copy()
    if working.empty:
        raise ValueError("No valid latitude/longitude rows available for mapping")

    if group_by is not None:
        aggregations: dict[str, str] = {latitude: "mean", longitude: "mean"}
        if value:
            aggregations[value] = "mean"
        if radius_col:
            aggregations[radius_col] = "mean"
        for column in [column for column in [value, radius_col, "site_id", "name"] if column]:
            if column not in aggregations and column in working.columns:
                aggregations[column] = "first"
        working = working.groupby(group_by, dropna=False).agg(aggregations).reset_index()

    fmap = create_base_map(
        working,
        latitude=latitude,
        longitude=longitude,
        tiles=tiles,
        zoom_start=zoom_start,
    )

    popup_columns = popup_columns or [column for column in [group_by, value, radius_col, "site_id", "name"] if column]
    tooltip_columns = tooltip_columns or [column for column in [group_by, "site_id", "name"] if column]

    marker_parent = fmap
    if cluster:
        marker_parent = MarkerCluster(name="Stations").add_to(fmap)
    else:
        marker_parent = folium.FeatureGroup(name="Stations").add_to(fmap)

    color_scale = None
    if value and legend:
        color_scale = add_value_legend(fmap, working[value], caption=value)

    size_series = working[radius_col] if radius_col else None
    heat_group = None
    if heatmap:
        heat_group = folium.FeatureGroup(name="Heat map", show=False).add_to(fmap)
        heat_rows = working.dropna(subset=[latitude, longitude]).copy()
        heat_values = heat_rows[value].fillna(1.0).tolist() if value and value in heat_rows.columns else [1.0] * len(heat_rows)
        HeatMap(
            data=[
                [float(row[latitude]), float(row[longitude]), float(weight)]
                for (_, row), weight in zip(heat_rows.iterrows(), heat_values)
            ],
            radius=heatmap_radius,
            blur=max(heatmap_radius // 2, 10),
            name="Heat map",
        ).add_to(heat_group)

    for _, row in working.iterrows():
        popup = popup_html(row, popup_columns)
        tooltip = popup_html(row, tooltip_columns, separator=" | ")
        marker_color = "#2a9d8f"
        if color_scale and value and pd.notna(row[value]):
            marker_color = color_scale(float(row[value]))

        marker_radius = scaled_radius(
            row=row,
            base_radius=radius,
            value_col=radius_col,
            series=size_series,
        )
        folium.CircleMarker(
            location=[float(row[latitude]), float(row[longitude])],
            radius=marker_radius,
            color=marker_color,
            fill=True,
            fill_color=marker_color,
            fill_opacity=0.8,
            weight=1.2,
            popup=popup,
            tooltip=tooltip or None,
        ).add_to(marker_parent)

    fit_map_bounds(fmap, working, latitude=latitude, longitude=longitude)
    folium.LayerControl(collapsed=False).add_to(fmap)

    return AirQoMap(
        data=working,
        map=fmap,
        metadata={
            "kind": "station_map",
            "value": value or "",
            "group_by": group_by or "",
            "cluster": cluster,
            "heatmap": heatmap,
        },
    )


def create_base_map(
    frame: pd.DataFrame,
    *,
    latitude: str,
    longitude: str,
    tiles: str | list[str],
    zoom_start: int,
):
    import folium

    tile_list = [tiles] if isinstance(tiles, str) else list(tiles)
    if not tile_list:
        tile_list = ["CartoDB positron"]

    center = [float(frame[latitude].mean()), float(frame[longitude].mean())]
    fmap = folium.Map(location=center, zoom_start=zoom_start, tiles=None, control_scale=True)
    for index, tile in enumerate(tile_list):
        folium.TileLayer(tile, name=tile, control=True, show=index == 0).add_to(fmap)
    return fmap


def add_value_legend(fmap, series: pd.Series, *, caption: str):
    import branca.colormap as cm

    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return None

    value_min = float(clean.min())
    value_max = float(clean.max())
    if value_min == value_max:
        value_max = value_min + 1.0
    scale = cm.linear.YlOrRd_09.scale(value_min, value_max)
    scale.caption = caption
    scale.add_to(fmap)
    return scale


def popup_html(row: pd.Series, columns: Sequence[str] | None, *, separator: str = "<br>") -> str | None:
    if not columns:
        return None
    items = []
    for column in columns:
        if column in row.index and pd.notna(row[column]):
            items.append(f"<b>{column}</b>: {row[column]}")
    return separator.join(items) if items else None


def scaled_radius(
    *,
    row: pd.Series,
    base_radius: int,
    value_col: str | None,
    series: pd.Series | None,
) -> float:
    if value_col is None or series is None or value_col not in row.index or pd.isna(row[value_col]):
        return float(base_radius)

    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return float(base_radius)
    value_min = float(clean.min())
    value_max = float(clean.max())
    if value_min == value_max:
        return float(base_radius)
    scaled = 4 + (float(row[value_col]) - value_min) / (value_max - value_min) * 8
    return float(max(3, min(14, scaled)))


def fit_map_bounds(fmap, frame: pd.DataFrame, *, latitude: str, longitude: str) -> None:
    bounds = frame[[latitude, longitude]].dropna().to_numpy().tolist()
    if bounds:
        fmap.fit_bounds(bounds)
