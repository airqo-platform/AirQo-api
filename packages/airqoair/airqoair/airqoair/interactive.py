from __future__ import annotations

import base64
import io
import math

import folium
import pandas as pd
from matplotlib import pyplot as plt

from .directional import polar_plot, pollution_rose, wind_rose
from .mapping import add_value_legend, create_base_map, fit_map_bounds, popup_html, scaled_radius, station_map
from .results import AirQoMap
from .utils import DataSource, load_data, validate_columns


def map_primer(
    data: DataSource,
    *,
    value: str | None = None,
    latitude: str = "latitude",
    longitude: str = "longitude",
    group_by: str | None = None,
) -> AirQoMap:
    result = station_map(
        data,
        value=value,
        latitude=latitude,
        longitude=longitude,
        group_by=group_by,
        cluster=True,
        heatmap=value is not None,
        tiles=["CartoDB positron", "OpenStreetMap"],
    )
    result.metadata["kind"] = "map_primer"
    return result


def network_visualization(
    data: DataSource,
    *,
    origin_lat: str = "origin_lat",
    origin_lon: str = "origin_lon",
    target_lat: str = "target_lat",
    target_lon: str = "target_lon",
    weight: str | None = None,
    control: str | None = None,
    popup_columns: list[str] | None = None,
    tiles: str | list[str] = "CartoDB positron",
) -> AirQoMap:
    frame = load_data(data, date_col=None)
    required = [origin_lat, origin_lon, target_lat, target_lon] + ([weight] if weight else []) + ([control] if control else [])
    validate_columns(frame, required)

    working = frame.dropna(subset=[origin_lat, origin_lon, target_lat, target_lon]).copy()
    if working.empty:
        raise ValueError("No valid rows remain for network visualization")

    center_frame = pd.DataFrame(
        {
            "latitude": pd.concat([working[origin_lat], working[target_lat]], ignore_index=True),
            "longitude": pd.concat([working[origin_lon], working[target_lon]], ignore_index=True),
        }
    )
    fmap = create_base_map(
        center_frame,
        latitude="latitude",
        longitude="longitude",
        tiles=tiles,
        zoom_start=6,
    )
    default_group = folium.FeatureGroup(name="Connections").add_to(fmap)
    endpoints = folium.FeatureGroup(name="Endpoints", show=False).add_to(fmap)
    weight_scale = add_value_legend(fmap, working[weight], caption=weight) if weight else None
    popup_columns = popup_columns or ([weight] if weight else [])
    layer_groups: dict[str, folium.FeatureGroup] = {}

    def line_group_for(row: pd.Series):
        if control is None or pd.isna(row[control]):
            return default_group
        key = str(row[control])
        if key not in layer_groups:
            layer_groups[key] = folium.FeatureGroup(name=f"{control}: {key}", show=True).add_to(fmap)
        return layer_groups[key]

    for _, row in working.iterrows():
        line_weight = 3
        popup = popup_html(row, popup_columns)
        color = "#2563eb"
        if weight and pd.notna(row[weight]):
            line_weight = max(2, min(8, float(row[weight])))
            if weight_scale:
                color = weight_scale(float(row[weight]))

        folium.PolyLine(
            locations=[
                [float(row[origin_lat]), float(row[origin_lon])],
                [float(row[target_lat]), float(row[target_lon])],
            ],
            color=color,
            weight=line_weight,
            opacity=0.7,
            popup=popup,
        ).add_to(line_group_for(row))
        folium.CircleMarker(
            location=[float(row[origin_lat]), float(row[origin_lon])],
            radius=4,
            color="#0f172a",
            fill=True,
            fill_opacity=0.8,
        ).add_to(endpoints)
        folium.CircleMarker(
            location=[float(row[target_lat]), float(row[target_lon])],
            radius=4,
            color="#0f172a",
            fill=True,
            fill_opacity=0.8,
        ).add_to(endpoints)

    bounds = (
        working[[origin_lat, origin_lon]]
        .rename(columns={origin_lat: "latitude", origin_lon: "longitude"})
        .to_numpy()
        .tolist()
        + working[[target_lat, target_lon]]
        .rename(columns={target_lat: "latitude", target_lon: "longitude"})
        .to_numpy()
        .tolist()
    )
    fmap.fit_bounds(bounds)
    folium.LayerControl(collapsed=False).add_to(fmap)
    return AirQoMap(data=working, map=fmap, metadata={"kind": "network_visualization"})


def directional_map(
    data: DataSource,
    *,
    latitude: str = "latitude",
    longitude: str = "longitude",
    direction: str = "wd",
    magnitude: str | None = "ws",
    value: str | None = None,
    popup_columns: list[str] | None = None,
    tiles: str | list[str] = "CartoDB positron",
    arrow_scale: float = 0.05,
) -> AirQoMap:
    frame = load_data(data, date_col=None)
    required = [latitude, longitude, direction] + ([magnitude] if magnitude else []) + ([value] if value else [])
    validate_columns(frame, required)

    working = frame.dropna(subset=required).copy()
    if working.empty:
        raise ValueError("No valid rows remain for directional map analysis")

    fmap = create_base_map(
        working,
        latitude=latitude,
        longitude=longitude,
        tiles=tiles,
        zoom_start=6,
    )
    arrow_group = folium.FeatureGroup(name="Direction vectors").add_to(fmap)
    station_group = folium.FeatureGroup(name="Stations", show=False).add_to(fmap)
    color_scale = add_value_legend(fmap, working[value], caption=value) if value else None
    popup_columns = popup_columns or [column for column in [value, magnitude, direction, "site_id", "name"] if column]

    max_magnitude = 1.0
    if magnitude:
        max_magnitude = float(working[magnitude].max()) or 1.0

    for _, row in working.iterrows():
        length = arrow_scale
        if magnitude:
            length = arrow_scale * float(row[magnitude]) / max_magnitude

        start_lat = float(row[latitude])
        start_lon = float(row[longitude])
        end_lat, end_lon = _destination_point(
            start_lat,
            start_lon,
            bearing_degrees=float(row[direction]),
            distance_degrees=length,
        )

        color = "#dc2626"
        if color_scale and value and pd.notna(row[value]):
            color = color_scale(float(row[value]))

        folium.PolyLine(
            locations=[[start_lat, start_lon], [end_lat, end_lon]],
            color=color,
            weight=3,
            opacity=0.8,
            popup=popup_html(row, popup_columns),
        ).add_to(arrow_group)
        folium.CircleMarker(
            location=[start_lat, start_lon],
            radius=scaled_radius(row=row, base_radius=5, value_col=magnitude, series=working[magnitude] if magnitude else None),
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.65,
            popup=popup_html(row, popup_columns),
        ).add_to(station_group)

    fit_map_bounds(fmap, working, latitude=latitude, longitude=longitude)
    folium.LayerControl(collapsed=False).add_to(fmap)
    return AirQoMap(data=working, map=fmap, metadata={"kind": "directional_map"})


def polar_map(
    data: DataSource,
    *,
    site_col: str,
    latitude: str = "latitude",
    longitude: str = "longitude",
    pollutant: str | None = None,
    ws: str = "ws",
    wd: str = "wd",
    kind: str = "polar_plot",
    popup_columns: list[str] | None = None,
    tiles: str | list[str] = "CartoDB positron",
    icon_size: int = 110,
) -> AirQoMap:
    frame = load_data(data, date_col=None)
    required = [site_col, latitude, longitude, ws, wd] + ([pollutant] if pollutant else [])
    validate_columns(frame, required)

    working = frame.dropna(subset=[site_col, latitude, longitude, ws, wd]).copy()
    if pollutant:
        working = working.dropna(subset=[pollutant])
    if working.empty:
        raise ValueError("No valid rows remain for polar map analysis")

    fmap = create_base_map(
        working,
        latitude=latitude,
        longitude=longitude,
        tiles=tiles,
        zoom_start=6,
    )
    popup_columns = popup_columns or [column for column in [site_col, pollutant] if column]
    markers = folium.FeatureGroup(name="Polar markers").add_to(fmap)

    groups = working.groupby(site_col, dropna=False)
    plotted_rows: list[pd.Series] = []
    for site_name, group in groups:
        center = group.iloc[0]
        icon_html = _polar_icon_html(
            group,
            pollutant=pollutant,
            ws=ws,
            wd=wd,
            kind=kind,
            icon_size=icon_size,
        )
        popup = popup_html(center, popup_columns)
        folium.Marker(
            location=[float(center[latitude]), float(center[longitude])],
            icon=folium.DivIcon(
                html=icon_html,
                icon_size=(icon_size, icon_size),
                icon_anchor=(icon_size // 2, icon_size // 2),
                class_name="airqoair-polar-marker",
            ),
            popup=popup,
            tooltip=str(site_name),
        ).add_to(markers)
        plotted_rows.append(center)

    fit_map_bounds(fmap, pd.DataFrame(plotted_rows), latitude=latitude, longitude=longitude)
    folium.LayerControl(collapsed=False).add_to(fmap)
    return AirQoMap(
        data=pd.DataFrame(plotted_rows).reset_index(drop=True),
        map=fmap,
        metadata={"kind": "polar_map", "plot_kind": kind, "pollutant": pollutant or ""},
    )


def trajectory_analysis(
    data: DataSource,
    *,
    trajectory_id: str = "trajectory_id",
    latitude: str = "latitude",
    longitude: str = "longitude",
    date_col: str | None = None,
    value: str | None = None,
    popup_columns: list[str] | None = None,
    tiles: str | list[str] = "CartoDB positron",
) -> AirQoMap:
    frame = load_data(data, date_col=date_col)
    required = [trajectory_id, latitude, longitude] + ([value] if value else [])
    validate_columns(frame, required)

    working = frame.dropna(subset=[trajectory_id, latitude, longitude]).copy()
    if working.empty:
        raise ValueError("No valid rows remain for trajectory analysis")

    fmap = create_base_map(
        working,
        latitude=latitude,
        longitude=longitude,
        tiles=tiles,
        zoom_start=5,
    )
    palette = ["#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#ca8a04", "#0891b2"]
    line_group = folium.FeatureGroup(name="Trajectories").add_to(fmap)
    point_group = folium.FeatureGroup(name="Trajectory points", show=False).add_to(fmap)
    start_group = folium.FeatureGroup(name="Starts", show=False).add_to(fmap)
    end_group = folium.FeatureGroup(name="Ends", show=False).add_to(fmap)
    popup_columns = popup_columns or [column for column in [trajectory_id, value] if column]

    for index, (group_id, group) in enumerate(working.groupby(trajectory_id)):
        if date_col and date_col in group.columns:
            group = group.sort_values(date_col)
        color = palette[index % len(palette)]
        folium.PolyLine(
            locations=group[[latitude, longitude]].to_numpy().tolist(),
            color=color,
            weight=3,
            opacity=0.8,
            popup=f"{trajectory_id}: {group_id}",
        ).add_to(line_group)
        for _, row in group.iterrows():
            folium.CircleMarker(
                location=[float(row[latitude]), float(row[longitude])],
                radius=4,
                color=color,
                fill=True,
                fill_color=color,
                fill_opacity=0.7,
                popup=popup_html(row, popup_columns),
            ).add_to(point_group)
        start_row = group.iloc[0]
        end_row = group.iloc[-1]
        folium.Marker(
            location=[float(start_row[latitude]), float(start_row[longitude])],
            tooltip=f"Start: {group_id}",
            icon=folium.Icon(color="green", icon="play", prefix="fa"),
        ).add_to(start_group)
        folium.Marker(
            location=[float(end_row[latitude]), float(end_row[longitude])],
            tooltip=f"End: {group_id}",
            icon=folium.Icon(color="red", icon="stop", prefix="fa"),
        ).add_to(end_group)

    fit_map_bounds(fmap, working, latitude=latitude, longitude=longitude)
    folium.LayerControl(collapsed=False).add_to(fmap)
    return AirQoMap(data=working, map=fmap, metadata={"kind": "trajectory_analysis"})


def _destination_point(
    latitude: float,
    longitude: float,
    *,
    bearing_degrees: float,
    distance_degrees: float,
) -> tuple[float, float]:
    radians = math.radians(bearing_degrees)
    delta_lat = distance_degrees * math.cos(radians)
    cos_lat = math.cos(math.radians(latitude))
    if abs(cos_lat) < 1e-6:
        cos_lat = 1e-6
    delta_lon = distance_degrees * math.sin(radians) / cos_lat
    return latitude + delta_lat, longitude + delta_lon


def _polar_icon_html(
    frame: pd.DataFrame,
    *,
    pollutant: str | None,
    ws: str,
    wd: str,
    kind: str,
    icon_size: int,
) -> str:
    if kind == "wind_rose":
        result = wind_rose(frame, ws=ws, wd=wd)
    elif kind == "pollution_rose":
        if pollutant is None:
            raise ValueError("pollutant is required for kind='pollution_rose'")
        result = pollution_rose(frame, pollutant=pollutant, ws=ws, wd=wd)
    elif kind == "polar_plot":
        if pollutant is None:
            raise ValueError("pollutant is required for kind='polar_plot'")
        result = polar_plot(frame, pollutant=pollutant, ws=ws, wd=wd)
    else:
        raise ValueError("kind must be one of: wind_rose, pollution_rose, polar_plot")

    buffer = io.BytesIO()
    result.figure.savefig(buffer, format="svg", bbox_inches="tight", transparent=True)
    plt.close(result.figure)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return (
        f"<div style='width:{icon_size}px;height:{icon_size}px;'>"
        f"<img src='data:image/svg+xml;base64,{encoded}' "
        f"style='width:{icon_size}px;height:{icon_size}px;border-radius:50%;"
        "box-shadow:0 4px 14px rgba(15,23,42,0.18);background:white;'/>"
        "</div>"
    )
