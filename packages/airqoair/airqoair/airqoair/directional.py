from __future__ import annotations

import numpy as np
import pandas as pd
from matplotlib import pyplot as plt

from .results import AirQoFigure
from .utils import DataSource, load_data, validate_columns


def _direction_edges(n_directions: int) -> np.ndarray:
    step = 360 / n_directions
    return np.linspace(-step / 2, 360 - step / 2, n_directions + 1)


def _direction_labels(n_directions: int) -> np.ndarray:
    step = 360 / n_directions
    return (np.arange(n_directions) * step) % 360


def _prepare_directional_table(
    data: DataSource,
    *,
    ws: str,
    wd: str,
    pollutant: str | None,
    statistic: str,
    direction_bins: int,
    speed_bins: list[float] | None,
) -> pd.DataFrame:
    if direction_bins < 4:
        raise ValueError("direction_bins must be at least 4")

    frame = load_data(data, date_col=None)
    required = [ws, wd] + ([pollutant] if pollutant else [])
    validate_columns(frame, required)

    working = frame[required].dropna().copy()
    if working.empty:
        raise ValueError("No valid rows remain after dropping directional-analysis columns")

    working[wd] = working[wd] % 360

    if speed_bins is None:
        max_ws = float(working[ws].max())
        upper = max(2.0, np.ceil(max_ws / 2.0) * 2.0)
        speed_bins = [0, 2, 4, 6, 8, 10, upper]
        speed_bins = sorted(set(speed_bins))
        if speed_bins[-1] <= max_ws:
            speed_bins.append(float(np.ceil(max_ws + 1)))
    else:
        if len(speed_bins) < 2:
            raise ValueError("speed_bins must contain at least two edges")
        if any(right <= left for left, right in zip(speed_bins, speed_bins[1:])):
            raise ValueError("speed_bins must be strictly increasing")

    edges = _direction_edges(direction_bins)
    labels = _direction_labels(direction_bins)
    working["direction_bin"] = pd.cut(
        working[wd],
        bins=edges,
        labels=labels,
        include_lowest=True,
        ordered=True,
    )

    tail = working[working[wd] >= edges[-1]]
    if not tail.empty:
        working.loc[tail.index, "direction_bin"] = labels[0]

    speed_labels = [
        f"{speed_bins[i]}-{speed_bins[i + 1]}"
        for i in range(len(speed_bins) - 1)
    ]
    working["speed_bin"] = pd.cut(
        working[ws],
        bins=speed_bins,
        labels=speed_labels,
        include_lowest=True,
        ordered=True,
    )

    if pollutant is None:
        grouped = (
            working.groupby(["speed_bin", "direction_bin"], observed=False)
            .size()
            .rename("value")
            .reset_index()
        )
        total = grouped["value"].sum()
        if total:
            grouped["value"] = grouped["value"] / total * 100
        return grouped

    if statistic not in {"mean", "median"}:
        raise ValueError("statistic must be 'mean' or 'median'")

    grouped = (
        working.groupby(["speed_bin", "direction_bin"], observed=False)[pollutant]
        .agg(statistic)
        .rename("value")
        .reset_index()
    )
    return grouped


def wind_rose(
    data: DataSource,
    *,
    ws: str = "ws",
    wd: str = "wd",
    direction_bins: int = 16,
    speed_bins: list[float] | None = None,
) -> AirQoFigure:
    table = _prepare_directional_table(
        data,
        ws=ws,
        wd=wd,
        pollutant=None,
        statistic="mean",
        direction_bins=direction_bins,
        speed_bins=speed_bins,
    )

    pivot = (
        table.pivot(index="speed_bin", columns="direction_bin", values="value")
        .fillna(0)
        .sort_index()
    )

    theta = np.deg2rad(pivot.columns.astype(float).to_numpy())
    width = np.deg2rad(360 / direction_bins)
    fig, ax = plt.subplots(subplot_kw={"projection": "polar"}, figsize=(8, 8))
    base = np.zeros(len(theta))
    colors = plt.cm.Blues(np.linspace(0.35, 0.95, len(pivot.index)))

    for color, label in zip(colors, pivot.index):
        values = pivot.loc[label].to_numpy(dtype=float)
        ax.bar(theta, values, width=width, bottom=base, color=color, edgecolor="white", align="center", label=str(label))
        base += values

    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)
    ax.set_title("Wind rose")
    ax.legend(loc="upper right", bbox_to_anchor=(1.2, 1.15), title="Wind speed")

    return AirQoFigure(
        data=table,
        figure=fig,
        metadata={"kind": "wind_rose", "ws": ws, "wd": wd},
    )


def polar_frequency(
    data: DataSource,
    *,
    ws: str = "ws",
    wd: str = "wd",
    direction_bins: int = 16,
    speed_bins: list[float] | None = None,
) -> AirQoFigure:
    table = _prepare_directional_table(
        data,
        ws=ws,
        wd=wd,
        pollutant=None,
        statistic="mean",
        direction_bins=direction_bins,
        speed_bins=speed_bins,
    )
    return _polar_mesh(
        table,
        title="Polar frequency",
        metadata={"kind": "polar_frequency", "ws": ws, "wd": wd},
    )


def pollution_rose(
    data: DataSource,
    *,
    pollutant: str,
    ws: str = "ws",
    wd: str = "wd",
    statistic: str = "mean",
    direction_bins: int = 16,
    speed_bins: list[float] | None = None,
) -> AirQoFigure:
    table = _prepare_directional_table(
        data,
        ws=ws,
        wd=wd,
        pollutant=pollutant,
        statistic=statistic,
        direction_bins=direction_bins,
        speed_bins=speed_bins,
    )
    return _polar_mesh(
        table,
        title=f"{pollutant} pollution rose ({statistic})",
        metadata={"kind": "pollution_rose", "pollutant": pollutant, "statistic": statistic},
    )


def percentile_rose(
    data: DataSource,
    *,
    pollutant: str,
    wd: str = "wd",
    percentile: float = 0.9,
    direction_bins: int = 16,
) -> AirQoFigure:
    if not 0 < percentile < 1:
        raise ValueError("percentile must be between 0 and 1")

    frame = load_data(data, date_col=None)
    validate_columns(frame, [pollutant, wd])
    working = frame[[pollutant, wd]].dropna().copy()
    if working.empty:
        raise ValueError("No valid rows remain for percentile rose analysis")

    edges = _direction_edges(direction_bins)
    labels = _direction_labels(direction_bins)
    working[wd] = working[wd] % 360
    working["direction_bin"] = pd.cut(
        working[wd],
        bins=edges,
        labels=labels,
        include_lowest=True,
        ordered=True,
    )
    tail = working[working[wd] >= edges[-1]]
    if not tail.empty:
        working.loc[tail.index, "direction_bin"] = labels[0]

    summary = (
        working.groupby("direction_bin", observed=False)[pollutant]
        .quantile(percentile)
        .reindex(labels)
        .rename("value")
        .rename_axis("direction")
        .reset_index()
    )

    theta = np.deg2rad(summary["direction"].astype(float).to_numpy())
    width = np.deg2rad(360 / direction_bins)
    fig, ax = plt.subplots(subplot_kw={"projection": "polar"}, figsize=(8, 8))
    ax.bar(theta, summary["value"].fillna(0).to_numpy(), width=width, color="#0f766e", edgecolor="white")
    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)
    ax.set_title(f"{pollutant} percentile rose (q={percentile:.2f})")

    return AirQoFigure(
        data=summary,
        figure=fig,
        metadata={"kind": "percentile_rose", "pollutant": pollutant, "percentile": percentile},
    )


def polar_plot(
    data: DataSource,
    *,
    pollutant: str,
    ws: str = "ws",
    wd: str = "wd",
    statistic: str = "mean",
    direction_bins: int = 16,
    speed_bins: list[float] | None = None,
) -> AirQoFigure:
    result = pollution_rose(
        data,
        pollutant=pollutant,
        ws=ws,
        wd=wd,
        statistic=statistic,
        direction_bins=direction_bins,
        speed_bins=speed_bins,
    )
    result.metadata["kind"] = "polar_plot"
    result.figure.axes[0].set_title(f"{pollutant} polar plot ({statistic})")
    return result


def polar_annulus(
    data: DataSource,
    *,
    pollutant: str,
    ws: str = "ws",
    wd: str = "wd",
    statistic: str = "median",
    direction_bins: int = 16,
    speed_bins: list[float] | None = None,
) -> AirQoFigure:
    table = _prepare_directional_table(
        data,
        ws=ws,
        wd=wd,
        pollutant=pollutant,
        statistic=statistic,
        direction_bins=direction_bins,
        speed_bins=speed_bins,
    )
    return _polar_mesh(
        table,
        title=f"{pollutant} polar annulus ({statistic})",
        metadata={"kind": "polar_annulus", "pollutant": pollutant, "statistic": statistic},
    )


def _polar_mesh(table: pd.DataFrame, *, title: str, metadata: dict[str, str]) -> AirQoFigure:
    pivot = (
        table.pivot(index="speed_bin", columns="direction_bin", values="value")
        .sort_index()
    )

    filled = pivot.fillna(0)
    speed_edges = _speed_edges_from_labels(filled.index)
    direction_values = filled.columns.astype(float).to_numpy()
    direction_edges = np.deg2rad(
        np.linspace(0, 360, len(direction_values) + 1, endpoint=True)
    )

    fig, ax = plt.subplots(subplot_kw={"projection": "polar"}, figsize=(8, 8))
    mesh = ax.pcolormesh(direction_edges, speed_edges, filled.to_numpy(dtype=float), cmap="viridis", shading="flat")
    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)
    ax.set_title(title)
    centers = (speed_edges[:-1] + speed_edges[1:]) / 2
    ax.set_yticks(centers)
    ax.set_yticklabels([str(label) for label in filled.index])
    ax.set_xticks(np.deg2rad(direction_values))
    ax.set_xticklabels([f"{int(value)} deg" for value in direction_values])
    fig.colorbar(mesh, ax=ax, pad=0.1)

    return AirQoFigure(data=table, figure=fig, metadata=metadata)


def _speed_edges_from_labels(index: pd.Index) -> np.ndarray:
    edges: list[float] = []
    for label in index:
        left_text, right_text = str(label).split("-", maxsplit=1)
        left = float(left_text)
        right = float(right_text)
        if not edges:
            edges.append(left)
        edges.append(right)
    return np.asarray(edges, dtype=float)
