from __future__ import annotations

from collections.abc import Callable

import numpy as np
import matplotlib.pyplot as plt
import pandas as pd

from .results import AirQoFigure, AirQoReport
from .utils import (
    DataSource,
    available_numeric_columns,
    circular_mean,
    infer_expected_counts,
    load_data,
    validate_columns,
)

WEEKDAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

MONTH_ORDER = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

SEASON_ORDER = ["DJF", "MAM", "JJA", "SON"]


def time_average(
    data: DataSource,
    *,
    avg: str = "D",
    pollutant_cols: list[str] | None = None,
    date_col: str = "date",
    wind_speed: str = "ws",
    wind_direction: str = "wd",
    data_capture_threshold: float | None = None,
) -> pd.DataFrame:
    frame = load_data(data, date_col=date_col)
    if pollutant_cols is not None:
        validate_columns(frame, pollutant_cols)

    numeric_columns = pollutant_cols or available_numeric_columns(
        frame,
        exclude=[date_col, wind_direction],
    )

    if not numeric_columns and wind_direction not in frame.columns:
        raise ValueError("No numeric columns available for averaging")

    frame = frame.set_index(date_col)

    grouped = frame.resample(avg)
    result = pd.DataFrame(index=grouped.size().index)

    for column in numeric_columns:
        if column in frame.columns:
            result[column] = grouped[column].mean()

    if wind_direction in frame.columns:
        result[wind_direction] = grouped[wind_direction].apply(circular_mean)

    if data_capture_threshold is not None:
        if not 0 < data_capture_threshold <= 1:
            raise ValueError("data_capture_threshold must be within (0, 1]")

        expected = infer_expected_counts(frame.index.to_series(), result.index, avg)
        if expected is not None:
            counts = grouped.count()
            for column in result.columns:
                if column not in counts.columns:
                    continue
                coverage = counts[column] / expected
                result.loc[coverage < data_capture_threshold, column] = pd.NA

    return result.reset_index()


def time_variation(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    hourly, weekly, monthly, day_hour, tidy, condition_label = _build_variation_tables(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )

    if condition_label is None:
        fig, axes = plt.subplots(2, 2, figsize=(14, 9), constrained_layout=True)

        axes[0, 0].plot(hourly.index, hourly.values, color="#1b4965", linewidth=2)
        axes[0, 0].set_title("Hourly")
        axes[0, 0].set_xlabel("Hour")
        axes[0, 0].set_ylabel(pollutant)
        axes[0, 0].set_xticks(range(0, 24, 3))
        axes[0, 0].grid(alpha=0.2)

        axes[0, 1].bar(weekly.index, weekly.values, color="#5fa8d3")
        axes[0, 1].set_title("Weekday")
        axes[0, 1].tick_params(axis="x", rotation=35)
        axes[0, 1].grid(axis="y", alpha=0.2)

        axes[1, 0].plot(monthly.index, monthly.values, marker="o", color="#ca6702", linewidth=2)
        axes[1, 0].set_title("Month")
        axes[1, 0].tick_params(axis="x", rotation=45)
        axes[1, 0].grid(alpha=0.2)

        heatmap = (
            day_hour.pivot(index="weekday", columns="hour", values="value")
            .reindex(WEEKDAY_ORDER)
            .reindex(columns=range(24))
        )
        mesh = axes[1, 1].imshow(heatmap.to_numpy(dtype=float), aspect="auto", cmap="viridis")
        axes[1, 1].set_title("Hour x weekday")
        axes[1, 1].set_xlabel("Hour")
        axes[1, 1].set_ylabel("Weekday")
        axes[1, 1].set_xticks(range(0, 24, 3))
        axes[1, 1].set_yticks(range(len(WEEKDAY_ORDER)))
        axes[1, 1].set_yticklabels(WEEKDAY_ORDER)
        fig.colorbar(mesh, ax=axes[1, 1], pad=0.02)
    else:
        fig, axes = plt.subplots(1, 3, figsize=(18, 5), constrained_layout=True)
        _plot_grouped_lines(
            axes[0],
            hourly,
            bucket="hour",
            value_col="value",
            title=f"Hourly by {condition_label}",
            ylabel=pollutant,
            xticks=range(0, 24, 3),
        )
        _plot_grouped_bars(
            axes[1],
            weekly,
            bucket="weekday",
            order=WEEKDAY_ORDER,
            title=f"Weekday by {condition_label}",
            ylabel=pollutant,
            rotate=35,
        )
        _plot_grouped_bars(
            axes[2],
            monthly,
            bucket="month",
            order=MONTH_ORDER,
            title=f"Month by {condition_label}",
            ylabel=pollutant,
            rotate=45,
        )

    fig.suptitle(_variation_title(pollutant, statistic, condition_label))

    return AirQoFigure(
        data=tidy,
        figure=fig,
        metadata={
            "pollutant": pollutant,
            "statistic": statistic,
            "condition_by": condition_label or "",
        },
    )


def diurnal_profile(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> pd.DataFrame:
    frame = load_data(data, date_col=date_col)
    hourly, _, _, _, _, condition_label = _build_variation_tables(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )
    if condition_label is None:
        return hourly.rename("value").rename_axis("hour").reset_index()
    return hourly[["condition", "hour", "value"]].copy()


def weekday_profile(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> pd.DataFrame:
    frame = load_data(data, date_col=date_col)
    _, weekly, _, _, _, condition_label = _build_variation_tables(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )
    if condition_label is None:
        return weekly.rename("value").rename_axis("weekday").reset_index()
    return weekly[["condition", "weekday", "value"]].copy()


def monthly_profile(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> pd.DataFrame:
    frame = load_data(data, date_col=date_col)
    _, _, monthly, _, _, condition_label = _build_variation_tables(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )
    if condition_label is None:
        return monthly.rename("value").rename_axis("month").reset_index()
    return monthly[["condition", "month", "value"]].copy()


def diurnal_plot(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> AirQoFigure:
    table = diurnal_profile(
        data,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )
    fig, ax = plt.subplots(figsize=(9, 4.5), constrained_layout=True)

    if "condition" in table.columns:
        _plot_grouped_lines(
            ax,
            table,
            bucket="hour",
            value_col="value",
            title="Diurnal profile",
            ylabel=pollutant,
            xticks=range(0, 24, 3),
        )
        metadata = {
            "pollutant": pollutant,
            "statistic": statistic,
            "condition_by": _resolve_condition(group_by, type),
        }
    else:
        ax.plot(table["hour"], table["value"], color="#1b4965", linewidth=2)
        ax.set_title("Diurnal profile")
        ax.set_xlabel("Hour")
        ax.set_ylabel(pollutant)
        ax.set_xticks(range(0, 24, 3))
        ax.grid(alpha=0.2)
        metadata = {"pollutant": pollutant, "statistic": statistic}

    return AirQoFigure(data=table, figure=fig, metadata=metadata)


def weekday_plot(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> AirQoFigure:
    table = weekday_profile(
        data,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )
    fig, ax = plt.subplots(figsize=(10, 4.5), constrained_layout=True)

    if "condition" in table.columns:
        _plot_grouped_bars(
            ax,
            table,
            bucket="weekday",
            order=WEEKDAY_ORDER,
            title="Weekday profile",
            ylabel=pollutant,
            rotate=35,
        )
        metadata = {
            "pollutant": pollutant,
            "statistic": statistic,
            "condition_by": _resolve_condition(group_by, type),
        }
    else:
        ax.bar(table["weekday"], table["value"], color="#5fa8d3")
        ax.set_title("Weekday profile")
        ax.set_ylabel(pollutant)
        ax.tick_params(axis="x", rotation=35)
        ax.grid(axis="y", alpha=0.2)
        metadata = {"pollutant": pollutant, "statistic": statistic}

    return AirQoFigure(data=table, figure=fig, metadata=metadata)


def monthly_plot(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> AirQoFigure:
    table = monthly_profile(
        data,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )
    fig, ax = plt.subplots(figsize=(11, 4.8), constrained_layout=True)

    if "condition" in table.columns:
        _plot_grouped_bars(
            ax,
            table,
            bucket="month",
            order=MONTH_ORDER,
            title="Monthly profile",
            ylabel=pollutant,
            rotate=45,
        )
        metadata = {
            "pollutant": pollutant,
            "statistic": statistic,
            "condition_by": _resolve_condition(group_by, type),
        }
    else:
        ax.bar(table["month"], table["value"], color="#ca6702")
        ax.set_title("Monthly profile")
        ax.set_ylabel(pollutant)
        ax.tick_params(axis="x", rotation=45)
        ax.grid(axis="y", alpha=0.2)
        metadata = {"pollutant": pollutant, "statistic": statistic}

    return AirQoFigure(data=table, figure=fig, metadata=metadata)


def variation_report(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    group_by: str | None = None,
    type: str | None = None,
) -> AirQoReport:
    frame = load_data(data, date_col=date_col)
    hourly, weekly, monthly, day_hour, _, condition_label = _build_variation_tables(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    )
    summary = _build_variation_summary(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        condition_by=_resolve_condition(group_by, type),
    )
    figure = time_variation(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        group_by=group_by,
        type=type,
    ).figure

    sections: dict[str, pd.DataFrame] = {
        "summary": summary,
        "diurnal_profile": (
            hourly.rename("value").rename_axis("hour").reset_index()
            if condition_label is None
            else hourly[["condition", "hour", "value"]].copy()
        ),
        "weekday_profile": (
            weekly.rename("value").rename_axis("weekday").reset_index()
            if condition_label is None
            else weekly[["condition", "weekday", "value"]].copy()
        ),
        "monthly_profile": (
            monthly.rename("value").rename_axis("month").reset_index()
            if condition_label is None
            else monthly[["condition", "month", "value"]].copy()
        ),
    }
    if condition_label is None:
        sections["hour_weekday"] = day_hour.copy()

    return AirQoReport(
        sections=sections,
        metadata={
            "title": f"{pollutant} variation report",
            "pollutant": pollutant,
            "statistic": statistic,
            "condition_by": condition_label or "",
        },
        figure=figure,
    )


def _build_variation_tables(
    frame: pd.DataFrame,
    *,
    pollutant: str,
    date_col: str,
    statistic: str,
    group_by: str | None = None,
    type: str | None = None,
) -> tuple[
    pd.Series | pd.DataFrame,
    pd.Series | pd.DataFrame,
    pd.Series | pd.DataFrame,
    pd.DataFrame,
    pd.DataFrame,
    str | None,
]:
    validate_columns(frame, [pollutant])
    reducer = _resolve_reducer(statistic)
    condition_name = _resolve_condition(group_by, type)

    working = frame[[date_col, pollutant]].copy()
    if condition_name is not None:
        working["condition"] = _condition_series(frame, condition_name, date_col=date_col)
        working = working.dropna(subset=["condition"])

    working = working.dropna(subset=[pollutant]).copy()
    if working.empty:
        raise ValueError("No valid rows remain for time-variation analysis")

    working["hour"] = working[date_col].dt.hour
    working["weekday"] = pd.Categorical(
        working[date_col].dt.day_name(),
        categories=WEEKDAY_ORDER,
        ordered=True,
    )
    working["month"] = pd.Categorical(
        working[date_col].dt.month_name(),
        categories=MONTH_ORDER,
        ordered=True,
    )

    if condition_name is None:
        hourly = reducer(working.groupby("hour")[pollutant]).reindex(range(24))
        weekly = reducer(working.groupby("weekday", observed=False)[pollutant]).reindex(WEEKDAY_ORDER)
        monthly = reducer(working.groupby("month", observed=False)[pollutant]).reindex(MONTH_ORDER)
        day_hour = (
            reducer(working.groupby(["weekday", "hour"], observed=False)[pollutant])
            .rename("value")
            .reset_index()
        )
        tidy = pd.concat(
            [
                hourly.rename("value").rename_axis("bucket").reset_index().assign(period="hour"),
                weekly.rename("value").rename_axis("bucket").reset_index().assign(period="weekday"),
                monthly.rename("value").rename_axis("bucket").reset_index().assign(period="month"),
            ],
            ignore_index=True,
        )
        return hourly, weekly, monthly, day_hour, tidy, None

    condition_levels = _condition_levels(working["condition"])
    hourly = _grouped_bucket_table(
        working,
        pollutant=pollutant,
        reducer=reducer,
        condition_levels=condition_levels,
        bucket="hour",
        bucket_levels=list(range(24)),
    )
    weekly = _grouped_bucket_table(
        working,
        pollutant=pollutant,
        reducer=reducer,
        condition_levels=condition_levels,
        bucket="weekday",
        bucket_levels=WEEKDAY_ORDER,
    )
    monthly = _grouped_bucket_table(
        working,
        pollutant=pollutant,
        reducer=reducer,
        condition_levels=condition_levels,
        bucket="month",
        bucket_levels=MONTH_ORDER,
    )
    day_hour = _grouped_day_hour_table(
        working,
        pollutant=pollutant,
        reducer=reducer,
        condition_levels=condition_levels,
    )
    tidy = pd.concat(
        [
            hourly.assign(period="hour").rename(columns={"hour": "bucket"}),
            weekly.assign(period="weekday").rename(columns={"weekday": "bucket"}),
            monthly.assign(period="month").rename(columns={"month": "bucket"}),
        ],
        ignore_index=True,
    )
    return hourly, weekly, monthly, day_hour, tidy, condition_name


def _resolve_reducer(
    statistic: str,
) -> Callable[[pd.core.groupby.SeriesGroupBy], pd.Series]:
    if statistic not in {"mean", "median"}:
        raise ValueError("statistic must be 'mean' or 'median'")

    return lambda grouped: getattr(grouped, statistic)()


def _build_variation_summary(
    frame: pd.DataFrame,
    *,
    pollutant: str,
    date_col: str,
    condition_by: str | None,
) -> pd.DataFrame:
    working = frame[[date_col, pollutant]].copy()
    if condition_by is not None:
        working["condition"] = _condition_series(frame, condition_by, date_col=date_col)
        working = working.dropna(subset=["condition"])

    working = working.dropna(subset=[pollutant])
    if working.empty:
        raise ValueError("No valid rows remain for variation summary")

    if condition_by is None:
        return pd.DataFrame(
            [
                {
                    "pollutant": pollutant,
                    "records": int(working.shape[0]),
                    "start": working[date_col].min(),
                    "end": working[date_col].max(),
                    "mean": working[pollutant].mean(),
                    "median": working[pollutant].median(),
                    "min": working[pollutant].min(),
                    "max": working[pollutant].max(),
                }
            ]
        )

    summary = (
        working.groupby("condition", dropna=False)[pollutant]
        .agg(["count", "mean", "median", "min", "max"])
        .reset_index()
        .rename(columns={"count": "records"})
    )
    bounds = (
        working.groupby("condition", dropna=False)[date_col]
        .agg(start="min", end="max")
        .reset_index()
    )
    summary = summary.merge(bounds, on="condition", how="left")
    return summary[["condition", "records", "start", "end", "mean", "median", "min", "max"]]


def _resolve_condition(group_by: str | None, type: str | None) -> str | None:
    if group_by and type:
        raise ValueError("Use either group_by or type, not both")
    return group_by or type


def _condition_series(frame: pd.DataFrame, condition: str, *, date_col: str) -> pd.Series:
    if condition in frame.columns:
        return frame[condition]

    if condition == "year":
        return frame[date_col].dt.year.astype("Int64").astype(str)
    if condition == "monthyear":
        return frame[date_col].dt.to_period("M").astype(str)
    if condition == "season":
        month = frame[date_col].dt.month
        season = pd.Series(index=frame.index, dtype="object")
        season.loc[month.isin([12, 1, 2])] = "DJF"
        season.loc[month.isin([3, 4, 5])] = "MAM"
        season.loc[month.isin([6, 7, 8])] = "JJA"
        season.loc[month.isin([9, 10, 11])] = "SON"
        return pd.Categorical(season, categories=SEASON_ORDER, ordered=True)
    if condition == "weekday":
        return pd.Categorical(
            frame[date_col].dt.day_name(),
            categories=WEEKDAY_ORDER,
            ordered=True,
        )
    if condition == "weekend":
        labels = np.where(frame[date_col].dt.dayofweek >= 5, "Weekend", "Weekday")
        return pd.Categorical(labels, categories=["Weekday", "Weekend"], ordered=True)

    raise ValueError(
        f"Unsupported condition '{condition}'. Use a column in the data or one of "
        "'year', 'monthyear', 'season', 'weekday', or 'weekend'."
    )


def _condition_levels(series: pd.Series) -> list[object]:
    if isinstance(series.dtype, pd.CategoricalDtype):
        present = set(series.dropna())
        return [level for level in series.cat.categories if level in present]
    return list(pd.Index(series.dropna().unique()))


def _grouped_bucket_table(
    working: pd.DataFrame,
    *,
    pollutant: str,
    reducer: Callable[[pd.core.groupby.SeriesGroupBy], pd.Series],
    condition_levels: list[object],
    bucket: str,
    bucket_levels: list[object],
) -> pd.DataFrame:
    grouped = (
        reducer(working.groupby(["condition", bucket], observed=False)[pollutant])
        .rename("value")
        .reset_index()
    )
    base = pd.MultiIndex.from_product(
        [condition_levels, bucket_levels],
        names=["condition", bucket],
    ).to_frame(index=False)
    return base.merge(grouped, on=["condition", bucket], how="left")


def _grouped_day_hour_table(
    working: pd.DataFrame,
    *,
    pollutant: str,
    reducer: Callable[[pd.core.groupby.SeriesGroupBy], pd.Series],
    condition_levels: list[object],
) -> pd.DataFrame:
    grouped = (
        reducer(working.groupby(["condition", "weekday", "hour"], observed=False)[pollutant])
        .rename("value")
        .reset_index()
    )
    base = pd.MultiIndex.from_product(
        [condition_levels, WEEKDAY_ORDER, range(24)],
        names=["condition", "weekday", "hour"],
    ).to_frame(index=False)
    return base.merge(grouped, on=["condition", "weekday", "hour"], how="left")


def _variation_title(pollutant: str, statistic: str, condition_label: str | None) -> str:
    if condition_label is None:
        return f"{pollutant} time variation ({statistic})"
    return f"{pollutant} time variation by {condition_label} ({statistic})"


def _plot_grouped_lines(
    ax: plt.Axes,
    table: pd.DataFrame,
    *,
    bucket: str,
    value_col: str,
    title: str,
    ylabel: str,
    xticks: range | None = None,
) -> None:
    for condition, subset in table.groupby("condition", dropna=False):
        ax.plot(subset[bucket], subset[value_col], linewidth=2, label=str(condition))
    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.set_xlabel(bucket.title())
    if xticks is not None:
        ax.set_xticks(list(xticks))
    ax.grid(alpha=0.2)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), title="Condition")


def _plot_grouped_bars(
    ax: plt.Axes,
    table: pd.DataFrame,
    *,
    bucket: str,
    order: list[object],
    title: str,
    ylabel: str,
    rotate: int = 0,
) -> None:
    pivot = table.pivot(index=bucket, columns="condition", values="value").reindex(order)
    labels = [str(label) for label in pivot.index]
    positions = np.arange(len(labels), dtype=float)
    width = 0.8 / max(len(pivot.columns), 1)

    for idx, condition in enumerate(pivot.columns):
        offset = (idx - (len(pivot.columns) - 1) / 2) * width
        ax.bar(
            positions + offset,
            pivot[condition].to_numpy(dtype=float),
            width=width,
            label=str(condition),
        )

    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.set_xticks(positions)
    ax.set_xticklabels(labels, rotation=rotate)
    ax.grid(axis="y", alpha=0.2)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), title="Condition")
