from __future__ import annotations

import matplotlib.pyplot as plt
import pandas as pd

from .results import AirQoFigure
from .utils import DataSource, load_data, validate_columns


def time_series_plot(
    data: DataSource,
    *,
    pollutant: str | list[str],
    date_col: str = "date",
    title: str | None = None,
    ylabel: str | None = None,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    pollutants = [pollutant] if isinstance(pollutant, str) else pollutant
    if not pollutants:
        raise ValueError("pollutant must contain at least one column")

    validate_columns(frame, pollutants)

    tidy = frame[[date_col, *pollutants]].copy()
    fig, ax = plt.subplots(figsize=(11, 4.5), constrained_layout=True)

    for column in pollutants:
        ax.plot(tidy[date_col], tidy[column], linewidth=2, label=column)

    ax.set_title(title or "Air quality time series")
    ax.set_xlabel(date_col)
    ax.set_ylabel(ylabel or "Value")
    ax.grid(alpha=0.2)
    if len(pollutants) > 1:
        ax.legend()

    return AirQoFigure(
        data=tidy,
        figure=fig,
        metadata={"kind": "time_series_plot", "pollutants": pollutants},
    )


def distribution_plot(
    data: DataSource,
    *,
    pollutant: str,
    bins: int = 30,
    date_col: str | None = "date",
    title: str | None = None,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant])

    tidy = frame[[pollutant]].dropna().copy()
    if tidy.empty:
        raise ValueError("No valid rows remain for the requested pollutant")

    fig, ax = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    ax.hist(tidy[pollutant], bins=bins, color="#1b4965", edgecolor="white", alpha=0.9)
    ax.set_title(title or f"{pollutant} distribution")
    ax.set_xlabel(pollutant)
    ax.set_ylabel("Frequency")
    ax.grid(axis="y", alpha=0.2)

    return AirQoFigure(
        data=tidy,
        figure=fig,
        metadata={"kind": "distribution_plot", "pollutant": pollutant, "bins": bins},
    )
