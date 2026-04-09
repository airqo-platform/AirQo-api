from __future__ import annotations

import calendar as pycalendar
from math import erf, sqrt

import numpy as np
import pandas as pd
from matplotlib import colors as mcolors
from matplotlib import patches as mpatches
from matplotlib import pyplot as plt

from .results import AirQoFigure
from .utils import DataSource, circular_mean, load_data, validate_columns


def calendar_plot(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
    year: int | list[int] | None = None,
    annotate: str | None = None,
    lim: float | None = None,
    breaks: list[float] | None = None,
    labels: list[str] | None = None,
    ws: str = "ws",
    wd: str = "wd",
    cmap: str = "YlOrRd",
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant])
    _validate_statistic(statistic)

    annotate_mode = annotate or "day"
    if annotate_mode not in {"day", "value", "ws", None}:
        raise ValueError("annotate must be one of: day, value, ws")
    if annotate_mode == "ws":
        validate_columns(frame, [ws, wd])

    daily = _calendar_daily_summary(
        frame,
        pollutant=pollutant,
        date_col=date_col,
        statistic=statistic,
        ws=ws,
        wd=wd,
    )
    if daily.empty:
        raise ValueError("No valid rows remain for calendar plot analysis")

    years = _resolve_calendar_years(daily, year=year)
    daily = daily[daily["year"].isin(years)].copy()
    if daily.empty:
        raise ValueError("No calendar data available for the requested year selection")

    color_spec = _calendar_color_spec(
        daily["value"],
        breaks=breaks,
        labels=labels,
        cmap=cmap,
    )
    arrow_scale = _calendar_arrow_scale(daily["ws_mean"]) if annotate_mode == "ws" else 0.0

    nrows = max(len(years) * 4, 1)
    fig, axes = plt.subplots(
        nrows=nrows,
        ncols=3,
        figsize=(15, 3.0 * nrows),
        constrained_layout=True,
    )
    axes = np.atleast_2d(axes)
    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    lookup = daily.set_index("date")

    for year_index, selected_year in enumerate(years):
        row_offset = year_index * 4
        for month in range(1, 13):
            axis = axes[row_offset + (month - 1) // 3, (month - 1) % 3]
            _draw_calendar_month(
                axis,
                lookup=lookup,
                year=selected_year,
                month=month,
                annotate_mode=annotate_mode,
                pollutant=pollutant,
                lim=lim,
                color_spec=color_spec,
                arrow_scale=arrow_scale,
                day_labels=day_labels,
            )

    colorbar = fig.colorbar(color_spec["mappable"], ax=axes.ravel().tolist(), pad=0.01, shrink=0.85)
    colorbar.set_label(f"{pollutant} ({statistic})")
    if color_spec["tick_values"] is not None:
        colorbar.set_ticks(color_spec["tick_values"])
    if color_spec["tick_labels"] is not None:
        colorbar.set_ticklabels(color_spec["tick_labels"])

    fig.suptitle(f"{pollutant} calendar plot ({statistic})", fontsize=16)

    return AirQoFigure(
        data=daily,
        figure=fig,
        metadata={
            "kind": "calendar_plot",
            "pollutant": pollutant,
            "statistic": statistic,
            "year": years if len(years) > 1 else years[0],
            "annotate": annotate_mode,
        },
    )


def time_proportion_plot(
    data: DataSource,
    *,
    pollutant: str,
    proportion: str,
    date_col: str = "date",
    avg_time: str = "7D",
    statistic: str = "mean",
    n_levels: int = 4,
    wd: str = "wd",
    sector_count: int = 8,
    labels: list[str] | None = None,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant, proportion])

    if statistic not in {"mean", "sum"}:
        raise ValueError("statistic must be one of: mean, sum")
    if n_levels < 2:
        raise ValueError("n_levels must be at least 2")
    if sector_count < 4:
        raise ValueError("sector_count must be at least 4")

    working = frame[[date_col, pollutant, proportion]].dropna().copy()
    if working.empty:
        raise ValueError("No valid rows remain for time proportion analysis")

    working["category"] = _time_proportion_category(
        working[proportion],
        name=proportion,
        wd=wd,
        n_levels=n_levels,
        sector_count=sector_count,
        labels=labels,
    )
    working = working.dropna(subset=["category"]).copy()
    if working.empty:
        raise ValueError("No valid rows remain after creating time proportion categories")

    grouped = working.set_index(date_col)
    if statistic == "mean":
        total = grouped[pollutant].resample(avg_time).mean().rename("total")
        counts = grouped[pollutant].resample(avg_time).count().rename("n_total")
        by_category = (
            grouped.groupby("category", observed=False)[pollutant]
            .resample(avg_time)
            .sum()
            .rename("pollutant_sum")
            .reset_index()
        )
        summary = by_category.merge(counts.reset_index(), on=date_col, how="left")
        summary["value"] = summary["pollutant_sum"] / summary["n_total"]
    else:
        total = grouped[pollutant].resample(avg_time).sum().rename("total")
        by_category = (
            grouped.groupby("category", observed=False)[pollutant]
            .resample(avg_time)
            .sum()
            .rename("value")
            .reset_index()
        )
        summary = by_category

    summary = summary.merge(total.reset_index(), on=date_col, how="left")
    summary = summary.dropna(subset=["value", "total"]).copy()
    if summary.empty:
        raise ValueError("No resampled data available for time proportion plotting")

    summary["proportion_fraction"] = np.where(
        summary["total"] != 0,
        summary["value"] / summary["total"],
        np.nan,
    )

    pivot = (
        summary.pivot(index=date_col, columns="category", values="value")
        .fillna(0)
        .sort_index()
    )

    fig, ax = plt.subplots(figsize=(12, 4.8), constrained_layout=True)
    x = np.arange(len(pivot.index), dtype=float)
    width = 0.85
    base = np.zeros(len(pivot.index), dtype=float)
    colors = plt.cm.viridis(np.linspace(0.1, 0.9, max(len(pivot.columns), 1)))

    for color, category in zip(colors, pivot.columns):
        values = pivot[category].to_numpy(dtype=float)
        ax.bar(x, values, width=width, bottom=base, color=color, label=str(category))
        base += values

    tick_step = max(len(pivot.index) // 8, 1)
    tick_positions = x[::tick_step]
    tick_labels = [pivot.index[position].strftime("%Y-%m-%d") for position in range(0, len(pivot.index), tick_step)]
    ax.set_xticks(tick_positions)
    ax.set_xticklabels(tick_labels, rotation=35, ha="right")
    ax.set_title(f"{pollutant} time proportion by {proportion}")
    ax.set_xlabel(f"Time ({avg_time})")
    ax.set_ylabel(f"{pollutant} ({statistic})")
    ax.grid(axis="y", alpha=0.2)
    ax.legend(title=proportion, bbox_to_anchor=(1.02, 1), loc="upper left")

    return AirQoFigure(
        data=summary,
        figure=fig,
        metadata={
            "kind": "time_proportion_plot",
            "pollutant": pollutant,
            "proportion": proportion,
            "avg_time": avg_time,
            "statistic": statistic,
        },
    )


def run_regression(
    data: DataSource,
    *,
    x: str,
    y: str,
    date_col: str = "date",
    avg_time: str = "MS",
    window: int = 12,
    min_points: int | None = None,
    group_by: str | None = None,
    type: str | None = None,
    wd: str = "wd",
    wd_sectors: int = 8,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [x, y])
    if window < 2:
        raise ValueError("window must be at least 2")
    if min_points is None:
        min_points = max(3, window // 2)
    if min_points < 3:
        raise ValueError("min_points must be at least 3")

    conditioned = _theil_sen_conditioned_frame(
        frame,
        date_col=date_col,
        group_by=group_by,
        type=type,
        wd=wd,
        wd_sectors=wd_sectors,
    )

    results: list[pd.DataFrame] = []
    for condition_name, subset in conditioned.groupby("condition", dropna=False):
        series = (
            subset.set_index(date_col)[[x, y]]
            .resample(avg_time)
            .mean()
            .dropna()
            .reset_index()
        )
        if series.shape[0] < min_points:
            continue

        rows: list[dict[str, float | pd.Timestamp | str | int]] = []
        for end in range(min_points, series.shape[0] + 1):
            start = max(0, end - window)
            window_frame = series.iloc[start:end].copy()
            if window_frame.shape[0] < min_points:
                continue

            metrics = _ols_window_metrics(
                window_frame[x].to_numpy(dtype=float),
                window_frame[y].to_numpy(dtype=float),
            )
            if metrics is None:
                continue
            rows.append(
                {
                    date_col: window_frame[date_col].iloc[-1],
                    "start": window_frame[date_col].iloc[0],
                    "end": window_frame[date_col].iloc[-1],
                    "n_points": int(window_frame.shape[0]),
                    "condition": condition_name,
                    **metrics,
                }
            )

        if rows:
            results.append(pd.DataFrame(rows))

    if not results:
        raise ValueError("No valid rolling regression windows could be computed")

    table = pd.concat(results, ignore_index=True)
    condition_values = [value for value in table["condition"].dropna().unique().tolist() if value != "All data"]
    has_groups = bool(condition_values)

    fig, axes = plt.subplots(3, 1, figsize=(12, 9), constrained_layout=True, sharex=True)
    for condition_name, subset in table.groupby("condition", dropna=False):
        label = str(condition_name)
        axes[0].plot(subset[date_col], subset["slope"], linewidth=2, label=label)
        axes[1].plot(subset[date_col], subset["r_squared"], linewidth=2, label=label)
        axes[2].plot(subset[date_col], subset["intercept"], linewidth=2, label=label)

    axes[0].set_title(f"Rolling regression slope: {y} vs {x}")
    axes[0].set_ylabel("Slope")
    axes[0].grid(alpha=0.2)
    axes[1].set_title("Coefficient of determination")
    axes[1].set_ylabel("R squared")
    axes[1].set_ylim(0, 1)
    axes[1].grid(alpha=0.2)
    axes[2].set_title("Intercept")
    axes[2].set_ylabel("Intercept")
    axes[2].set_xlabel(date_col)
    axes[2].grid(alpha=0.2)
    if has_groups:
        axes[0].legend(title="Condition", bbox_to_anchor=(1.02, 1), loc="upper left")

    summary = (
        table.groupby("condition", dropna=False)[["slope", "intercept", "r_squared", "correlation"]]
        .agg(["mean", "median", "min", "max"])
    )

    return AirQoFigure(
        data=table,
        figure=fig,
        metadata={
            "kind": "run_regression",
            "x": x,
            "y": y,
            "avg_time": avg_time,
            "window": window,
            "min_points": min_points,
            "condition_by": (group_by or type or ""),
            "summary": summary.to_dict(),
        },
    )


def theil_sen_trend(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    aggregate: str = "MS",
    deseason: bool = False,
    alpha: float = 0.05,
    n_boot: int = 200,
    block_length: int | None = None,
    group_by: str | None = None,
    type: str | None = None,
    wd: str = "wd",
    wd_sectors: int = 8,
    slope_percent: bool = False,
    random_state: int = 42,
    max_points: int = 400,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant])
    if not 0 < alpha < 1:
        raise ValueError("alpha must be between 0 and 1")
    if n_boot < 0:
        raise ValueError("n_boot must be non-negative")

    conditioned = _theil_sen_conditioned_frame(
        frame,
        date_col=date_col,
        group_by=group_by,
        type=type,
        wd=wd,
        wd_sectors=wd_sectors,
    )
    rng = np.random.default_rng(random_state)

    fitted_frames: list[pd.DataFrame] = []
    summaries: list[dict[str, object]] = []

    for condition_name, subset in conditioned.groupby("condition", dropna=False):
        monthly = (
            subset.set_index(date_col)[pollutant]
            .resample(aggregate)
            .mean()
            .dropna()
            .rename("observed")
            .reset_index()
        )
        if monthly.shape[0] < 2:
            continue

        monthly["analysis_value"] = monthly["observed"]
        if deseason:
            climatology = monthly.groupby(monthly[date_col].dt.month)["observed"].transform("mean")
            monthly["analysis_value"] = monthly["observed"] - climatology + monthly["observed"].mean()

        x = (monthly[date_col] - monthly[date_col].min()).dt.total_seconds() / (86400.0 * 365.25)
        slope, intercept = _theil_sen_fit(
            x.to_numpy(dtype=float),
            monthly["analysis_value"].to_numpy(dtype=float),
            max_points=max_points,
        )
        monthly["trend"] = intercept + slope * x

        lower_line = pd.Series(np.nan, index=monthly.index, dtype="float64")
        upper_line = pd.Series(np.nan, index=monthly.index, dtype="float64")
        slope_low = np.nan
        slope_high = np.nan
        intercept_low = np.nan
        intercept_high = np.nan

        if n_boot > 0 and monthly.shape[0] >= 3:
            boot = _theil_sen_bootstrap(
                x.to_numpy(dtype=float),
                monthly["analysis_value"].to_numpy(dtype=float),
                alpha=alpha,
                n_boot=n_boot,
                block_length=block_length,
                max_points=max_points,
                rng=rng,
            )
            slope_low = boot["slope_low"]
            slope_high = boot["slope_high"]
            intercept_low = boot["intercept_low"]
            intercept_high = boot["intercept_high"]
            lower_line = pd.Series(intercept_low + slope_low * x, index=monthly.index, dtype="float64")
            upper_line = pd.Series(intercept_high + slope_high * x, index=monthly.index, dtype="float64")

        p_value = _mann_kendall_p_value(monthly["analysis_value"].to_numpy(dtype=float))
        significance = _significance_stars(p_value)
        slope_value = _theil_sen_slope_value(
            slope=slope,
            intercept=intercept,
            x=x.to_numpy(dtype=float),
            slope_percent=slope_percent,
        )
        slope_low_value = _theil_sen_slope_value(
            slope=float(slope_low) if not pd.isna(slope_low) else np.nan,
            intercept=float(intercept_low) if not pd.isna(intercept_low) else np.nan,
            x=x.to_numpy(dtype=float),
            slope_percent=slope_percent,
        )
        slope_high_value = _theil_sen_slope_value(
            slope=float(slope_high) if not pd.isna(slope_high) else np.nan,
            intercept=float(intercept_high) if not pd.isna(intercept_high) else np.nan,
            x=x.to_numpy(dtype=float),
            slope_percent=slope_percent,
        )

        monthly["trend_low"] = lower_line
        monthly["trend_high"] = upper_line
        monthly["condition"] = condition_name
        monthly["p_value"] = p_value
        fitted_frames.append(monthly)

        summaries.append(
            {
                "condition": condition_name,
                "slope_value": slope_value,
                "slope_low": slope_low_value,
                "slope_high": slope_high_value,
                "p_value": p_value,
                "significance": significance,
                "records": int(monthly.shape[0]),
            }
        )

    if not fitted_frames:
        raise ValueError("At least two aggregated points are required for Theil-Sen trend estimation")

    summary = pd.DataFrame(summaries)
    combined = pd.concat(fitted_frames, ignore_index=True)
    condition_values = [value for value in summary["condition"].tolist() if value != "All data"]
    has_groups = bool(condition_values)

    if not has_groups:
        fig, ax = plt.subplots(figsize=(11, 4.8), constrained_layout=True)
        _plot_theil_sen_axis(
            ax,
            combined,
            pollutant=pollutant,
            date_col=date_col,
            deseason=deseason,
            summary_row=summary.iloc[0],
            slope_percent=slope_percent,
            alpha=alpha,
        )
    else:
        if type == "wd" and len(condition_values) == 8:
            fig, axes = plt.subplots(3, 3, figsize=(12, 10), constrained_layout=True)
            positions = {
                "N": (0, 1),
                "NE": (0, 2),
                "E": (1, 2),
                "SE": (2, 2),
                "S": (2, 1),
                "SW": (2, 0),
                "W": (1, 0),
                "NW": (0, 0),
            }
            axes[1, 1].axis("off")
            for condition_name in condition_values:
                row_index, col_index = positions.get(str(condition_name), (1, 1))
                subset = combined[combined["condition"] == condition_name]
                summary_row = summary[summary["condition"] == condition_name].iloc[0]
                _plot_theil_sen_axis(
                    axes[row_index, col_index],
                    subset,
                    pollutant=pollutant,
                    date_col=date_col,
                    deseason=deseason,
                    summary_row=summary_row,
                    slope_percent=slope_percent,
                    alpha=alpha,
                )
                axes[row_index, col_index].set_title(str(condition_name))
        else:
            n_panels = len(condition_values)
            ncols = min(3, n_panels)
            nrows = int(np.ceil(n_panels / ncols))
            fig, axes = plt.subplots(nrows, ncols, figsize=(5.2 * ncols, 4.0 * nrows), constrained_layout=True)
            axes = np.atleast_1d(axes).reshape(nrows, ncols)
            for axis in axes.ravel():
                axis.set_visible(False)
            for axis, condition_name in zip(axes.ravel(), condition_values):
                axis.set_visible(True)
                subset = combined[combined["condition"] == condition_name]
                summary_row = summary[summary["condition"] == condition_name].iloc[0]
                _plot_theil_sen_axis(
                    axis,
                    subset,
                    pollutant=pollutant,
                    date_col=date_col,
                    deseason=deseason,
                    summary_row=summary_row,
                    slope_percent=slope_percent,
                    alpha=alpha,
                )
                axis.set_title(str(condition_name))

    fig.suptitle(f"{pollutant} Theil-Sen trend", fontsize=16)
    metadata: dict[str, object] = {
        "kind": "theil_sen_trend",
        "pollutant": pollutant,
        "aggregate": aggregate,
        "deseason": deseason,
        "alpha": alpha,
        "slope_percent": slope_percent,
        "condition_by": (group_by or type or ""),
        "summary": summary.to_dict(orient="records"),
    }
    if not has_groups:
        metadata["slope_value"] = summary.loc[0, "slope_value"]
        metadata["p_value"] = summary.loc[0, "p_value"]

    return AirQoFigure(data=combined, figure=fig, metadata=metadata)


def smooth_trend(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    aggregate: str = "MS",
    avg_time: str | None = None,
    window: int = 7,
    deseason: bool = False,
    alpha: float = 0.05,
    n_boot: int = 200,
    block_length: int | None = None,
    group_by: str | None = None,
    type: str | None = None,
    wd: str = "wd",
    wd_sectors: int = 8,
    random_state: int = 42,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant])
    if avg_time is not None:
        aggregate = avg_time
    if window < 2:
        raise ValueError("window must be at least 2")
    if not 0 < alpha < 1:
        raise ValueError("alpha must be between 0 and 1")
    if n_boot < 0:
        raise ValueError("n_boot must be non-negative")

    conditioned = _theil_sen_conditioned_frame(
        frame,
        date_col=date_col,
        group_by=group_by,
        type=type,
        wd=wd,
        wd_sectors=wd_sectors,
    )
    rng = np.random.default_rng(random_state)
    fitted_frames: list[pd.DataFrame] = []
    summary_rows: list[dict[str, object]] = []

    for condition_name, subset in conditioned.groupby("condition", dropna=False):
        series = (
            subset.set_index(date_col)[pollutant]
            .resample(aggregate)
            .mean()
            .dropna()
            .rename("observed")
            .reset_index()
        )
        if series.shape[0] < 3:
            continue

        series["analysis_value"] = series["observed"]
        if deseason:
            climatology = series.groupby(series[date_col].dt.month)["observed"].transform("mean")
            series["analysis_value"] = series["observed"] - climatology + series["observed"].mean()

        x = np.arange(series.shape[0], dtype=float)
        bandwidth = max(int(window), 2)
        series["smooth"] = _gaussian_smoother(x, series["analysis_value"].to_numpy(dtype=float), bandwidth)

        if n_boot > 0 and series.shape[0] >= 4:
            lower, upper = _smooth_trend_bootstrap_interval(
                x=x,
                y=series["analysis_value"].to_numpy(dtype=float),
                window=bandwidth,
                alpha=alpha,
                n_boot=n_boot,
                block_length=block_length,
                rng=rng,
            )
            series["smooth_low"] = lower
            series["smooth_high"] = upper
        else:
            series["smooth_low"] = np.nan
            series["smooth_high"] = np.nan

        residual_sd = float((series["analysis_value"] - series["smooth"]).std(ddof=1))
        change = float(series["smooth"].iloc[-1] - series["smooth"].iloc[0])
        series["condition"] = condition_name
        fitted_frames.append(series)
        summary_rows.append(
            {
                "condition": condition_name,
                "records": int(series.shape[0]),
                "change": change,
                "residual_sd": residual_sd,
            }
        )

    if not fitted_frames:
        raise ValueError("At least three aggregated points are required for smooth trend computation")

    combined = pd.concat(fitted_frames, ignore_index=True)
    summary = pd.DataFrame(summary_rows)
    condition_values = [value for value in summary["condition"].tolist() if value != "All data"]
    has_groups = bool(condition_values)

    if not has_groups:
        fig, ax = plt.subplots(figsize=(11, 4.8), constrained_layout=True)
        _plot_smooth_trend_axis(
            ax,
            combined,
            pollutant=pollutant,
            date_col=date_col,
            deseason=deseason,
            summary_row=summary.iloc[0],
            alpha=alpha,
        )
    else:
        n_panels = len(condition_values)
        ncols = min(3, n_panels)
        nrows = int(np.ceil(n_panels / ncols))
        fig, axes = plt.subplots(nrows, ncols, figsize=(5.2 * ncols, 4.0 * nrows), constrained_layout=True)
        axes = np.atleast_1d(axes).reshape(nrows, ncols)
        for axis in axes.ravel():
            axis.set_visible(False)
        for axis, condition_name in zip(axes.ravel(), condition_values):
            axis.set_visible(True)
            subset = combined[combined["condition"] == condition_name]
            summary_row = summary[summary["condition"] == condition_name].iloc[0]
            _plot_smooth_trend_axis(
                axis,
                subset,
                pollutant=pollutant,
                date_col=date_col,
                deseason=deseason,
                summary_row=summary_row,
                alpha=alpha,
            )
            axis.set_title(str(condition_name))

    fig.suptitle(f"{pollutant} smooth trend", fontsize=16)

    metadata: dict[str, object] = {
        "kind": "smooth_trend",
        "pollutant": pollutant,
        "window": window,
        "aggregate": aggregate,
        "deseason": deseason,
        "alpha": alpha,
        "condition_by": (group_by or type or ""),
        "summary": summary.to_dict(orient="records"),
    }
    if not has_groups:
        metadata["change"] = summary.loc[0, "change"]

    return AirQoFigure(data=combined, figure=fig, metadata=metadata)


def dilution_plot(
    data: DataSource,
    *,
    pollutant: str,
    wind_speed: str = "ws",
    date_col: str | None = None,
    bins: int = 12,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant, wind_speed])

    tidy = frame[[pollutant, wind_speed]].dropna().copy()
    if tidy.empty:
        raise ValueError("No valid rows remain for dilution analysis")

    tidy["speed_bin"] = pd.cut(tidy[wind_speed], bins=bins)
    median_line = (
        tidy.groupby("speed_bin", observed=False)[[pollutant, wind_speed]]
        .median()
        .reset_index(drop=True)
    )

    fig, ax = plt.subplots(figsize=(8, 5), constrained_layout=True)
    ax.scatter(tidy[wind_speed], tidy[pollutant], alpha=0.35, color="#64748b", s=18)
    ax.plot(median_line[wind_speed], median_line[pollutant], color="#dc2626", linewidth=2.5)
    ax.set_title(f"{pollutant} dilution line")
    ax.set_xlabel(wind_speed)
    ax.set_ylabel(pollutant)
    ax.grid(alpha=0.2)

    return AirQoFigure(
        data=tidy,
        figure=fig,
        metadata={"kind": "dilution_plot", "pollutant": pollutant, "wind_speed": wind_speed},
    )


def pollutant_ratio_plot(
    data: DataSource,
    *,
    numerator: str,
    denominator: str,
    date_col: str | None = "date",
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [numerator, denominator])

    tidy = frame[[column for column in [date_col, numerator, denominator] if column is not None]].dropna().copy()
    tidy = tidy[tidy[denominator] != 0]
    if tidy.empty:
        raise ValueError("No valid rows remain for pollutant ratio computation")

    ratio_column = f"{numerator}_to_{denominator}"
    tidy[ratio_column] = tidy[numerator] / tidy[denominator]

    fig, ax = plt.subplots(figsize=(10, 4.5), constrained_layout=True)
    if date_col is None:
        ax.plot(np.arange(len(tidy)), tidy[ratio_column], color="#7c3aed", linewidth=2)
        ax.set_xlabel("Observation")
    else:
        ax.plot(tidy[date_col], tidy[ratio_column], color="#7c3aed", linewidth=2)
        ax.set_xlabel(date_col)
    ax.set_title(f"{numerator}/{denominator} pollutant ratio")
    ax.set_ylabel(ratio_column)
    ax.grid(alpha=0.2)

    return AirQoFigure(
        data=tidy,
        figure=fig,
        metadata={"kind": "pollutant_ratio_plot", "numerator": numerator, "denominator": denominator},
    )


def trend_heatmap(
    data: DataSource,
    *,
    pollutant: str,
    date_col: str = "date",
    statistic: str = "mean",
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant])
    _validate_statistic(statistic)

    monthly = (
        frame[[date_col, pollutant]]
        .dropna()
        .assign(year=lambda df: df[date_col].dt.year, month=lambda df: df[date_col].dt.month_name())
    )
    if monthly.empty:
        raise ValueError("No valid rows remain for trend heatmap analysis")
    month_order = [
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
    pivot = (
        monthly.groupby(["year", "month"])[pollutant]
        .agg(statistic)
        .unstack("month")
        .reindex(columns=month_order)
        .sort_index()
    )

    fig, ax = plt.subplots(figsize=(11, 4.5), constrained_layout=True)
    mesh = ax.imshow(pivot.to_numpy(dtype=float), aspect="auto", cmap="magma")
    ax.set_title(f"{pollutant} trend heatmap ({statistic})")
    ax.set_xlabel("Month")
    ax.set_ylabel("Year")
    ax.set_xticks(range(len(pivot.columns)))
    ax.set_xticklabels(pivot.columns, rotation=45, ha="right")
    ax.set_yticks(range(len(pivot.index)))
    ax.set_yticklabels([str(value) for value in pivot.index])
    fig.colorbar(mesh, ax=ax, pad=0.02)

    return AirQoFigure(
        data=monthly,
        figure=fig,
        metadata={"kind": "trend_heatmap", "pollutant": pollutant, "statistic": statistic},
    )


def trend_level(
    data: DataSource,
    *,
    pollutant: str,
    x: str = "month",
    y: str = "hour",
    date_col: str = "date",
    statistic: str | Callable[[pd.Series], float] = "mean",
    n_levels: int = 12,
    type: str | None = None,
    group_by: str | None = None,
    wd: str = "wd",
    wd_sectors: int = 8,
    breaks: list[float] | None = None,
    labels: list[str] | None = None,
    cmap: str = "viridis",
    colors: list[str] | None = None,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [pollutant])
    if n_levels < 2:
        raise ValueError("n_levels must be at least 2")

    conditioned = _theil_sen_conditioned_frame(
        frame,
        date_col=date_col,
        group_by=group_by,
        type=type,
        wd=wd,
        wd_sectors=wd_sectors,
    )
    if conditioned.empty:
        raise ValueError("No valid rows remain for trend level analysis")

    conditioned["x_bucket"] = _trend_level_axis_series(
        conditioned,
        axis=x,
        date_col=date_col,
        wd=wd,
        wd_sectors=wd_sectors,
        n_levels=n_levels,
    )
    conditioned["y_bucket"] = _trend_level_axis_series(
        conditioned,
        axis=y,
        date_col=date_col,
        wd=wd,
        wd_sectors=wd_sectors,
        n_levels=n_levels,
    )
    conditioned = conditioned.dropna(subset=["x_bucket", "y_bucket", pollutant]).copy()
    if conditioned.empty:
        raise ValueError("No valid rows remain after creating trend level axes")

    reducer = _trend_level_reducer(statistic)
    summary = (
        conditioned.groupby(["condition", "x_bucket", "y_bucket"], observed=False)[pollutant]
        .apply(reducer)
        .rename("value")
        .reset_index()
    )
    if summary.empty:
        raise ValueError("Trend level summary is empty")

    x_order = _trend_level_order(conditioned["x_bucket"])
    y_order = _trend_level_order(conditioned["y_bucket"])
    color_spec = _trend_level_color_spec(
        summary["value"],
        breaks=breaks,
        labels=labels,
        cmap=cmap,
        colors=colors,
    )

    condition_order = _trend_level_order(conditioned["condition"])
    has_groups = any(str(value) != "All data" for value in condition_order)
    n_panels = max(len(condition_order), 1)
    ncols = min(3, n_panels)
    nrows = int(np.ceil(n_panels / ncols))
    fig, axes = plt.subplots(nrows, ncols, figsize=(5.2 * ncols, 4.6 * nrows), constrained_layout=True)
    axes = np.atleast_1d(axes).reshape(nrows, ncols)
    for axis in axes.ravel():
        axis.set_visible(False)

    for axis, condition_name in zip(axes.ravel(), condition_order):
        axis.set_visible(True)
        subset = summary[summary["condition"] == condition_name]
        pivot = (
            subset.pivot(index="y_bucket", columns="x_bucket", values="value")
            .reindex(index=y_order, columns=x_order)
        )
        mesh = axis.imshow(
            pivot.to_numpy(dtype=float),
            aspect="auto",
            cmap=color_spec["cmap"],
            norm=color_spec["norm"],
        )
        axis.set_xticks(range(len(x_order)))
        axis.set_xticklabels([str(value) for value in x_order], rotation=45, ha="right")
        axis.set_yticks(range(len(y_order)))
        axis.set_yticklabels([str(value) for value in y_order])
        axis.set_xlabel(x)
        axis.set_ylabel(y)
        axis.set_title(str(condition_name) if has_groups else f"{pollutant} trend level")

        for row_index, y_value in enumerate(y_order):
            for col_index, x_value in enumerate(x_order):
                value = pivot.loc[y_value, x_value] if y_value in pivot.index and x_value in pivot.columns else np.nan
                if pd.notna(value):
                    axis.text(
                        col_index,
                        row_index,
                        _trend_level_label(value),
                        ha="center",
                        va="center",
                        fontsize=7,
                        color="#ffffff" if color_spec["dark_text"](value) else "#111827",
                    )

    colorbar = fig.colorbar(color_spec["mappable"], ax=axes.ravel().tolist(), pad=0.02, shrink=0.9)
    colorbar.set_label(f"{pollutant} ({_trend_level_statistic_name(statistic)})")
    if color_spec["tick_values"] is not None:
        colorbar.set_ticks(color_spec["tick_values"])
    if color_spec["tick_labels"] is not None:
        colorbar.set_ticklabels(color_spec["tick_labels"])

    fig.suptitle(f"{pollutant} trend level", fontsize=16)

    return AirQoFigure(
        data=summary,
        figure=fig,
        metadata={
            "kind": "trend_level",
            "pollutant": pollutant,
            "x": x,
            "y": y,
            "statistic": _trend_level_statistic_name(statistic),
            "condition_by": (group_by or type or ""),
        },
    )


def _calendar_daily_summary(
    frame: pd.DataFrame,
    *,
    pollutant: str,
    date_col: str,
    statistic: str,
    ws: str,
    wd: str,
) -> pd.DataFrame:
    working_columns = [date_col, pollutant]
    if ws in frame.columns:
        working_columns.append(ws)
    if wd in frame.columns:
        working_columns.append(wd)

    working = frame[working_columns].dropna(subset=[pollutant]).copy()
    if working.empty:
        return pd.DataFrame(columns=[date_col, "value", "ws_mean", "wd_mean", "year", "month"])

    grouped = working.set_index(date_col).resample("D")
    daily = grouped[pollutant].agg(statistic).rename("value").to_frame()

    if ws in working.columns:
        daily["ws_mean"] = grouped[ws].mean()
    else:
        daily["ws_mean"] = np.nan

    if wd in working.columns:
        daily["wd_mean"] = grouped[wd].apply(circular_mean)
    else:
        daily["wd_mean"] = np.nan

    daily = daily.reset_index()
    daily["year"] = daily[date_col].dt.year
    daily["month"] = daily[date_col].dt.month
    daily["day"] = daily[date_col].dt.day
    return daily


def _resolve_calendar_years(daily: pd.DataFrame, *, year: int | list[int] | None) -> list[int]:
    available = sorted(int(value) for value in daily["year"].dropna().unique())
    if year is None:
        return available
    requested = [int(year)] if isinstance(year, int) else [int(value) for value in year]
    valid = [value for value in requested if value in available]
    if not valid:
        raise ValueError(f"No data available for requested year selection: {requested}")
    return valid


def _calendar_color_spec(
    values: pd.Series,
    *,
    breaks: list[float] | None,
    labels: list[str] | None,
    cmap: str,
) -> dict[str, object]:
    clean = values.dropna().astype(float)
    if clean.empty:
        raise ValueError("Calendar plot requires at least one non-missing daily value")

    if breaks is not None:
        if len(breaks) < 2:
            raise ValueError("breaks must contain at least two edges")
        if any(right <= left for left, right in zip(breaks, breaks[1:])):
            raise ValueError("breaks must be strictly increasing")
        if labels is not None and len(labels) != len(breaks) - 1:
            raise ValueError("labels length must match len(breaks) - 1")

        color_count = len(breaks) - 1
        cmap_obj = plt.get_cmap(cmap, color_count)
        color_values = cmap_obj(np.linspace(0, 1, color_count))
        discrete_map = mcolors.ListedColormap(color_values)
        norm = mcolors.BoundaryNorm(breaks, discrete_map.N)
        mappable = plt.cm.ScalarMappable(norm=norm, cmap=discrete_map)
        tick_values = [(breaks[index] + breaks[index + 1]) / 2 for index in range(color_count)]
        tick_labels = labels
        return {
            "cmap": discrete_map,
            "norm": norm,
            "mappable": mappable,
            "tick_values": tick_values,
            "tick_labels": tick_labels,
        }

    vmin = float(clean.min())
    vmax = float(clean.max())
    if np.isclose(vmin, vmax):
        vmax = vmin + 1.0

    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)
    mappable = plt.cm.ScalarMappable(norm=norm, cmap=cmap)
    return {
        "cmap": cmap,
        "norm": norm,
        "mappable": mappable,
        "tick_values": None,
        "tick_labels": None,
    }


def _calendar_arrow_scale(ws_values: pd.Series) -> float:
    clean = ws_values.dropna().astype(float)
    if clean.empty:
        return 0.0
    max_ws = float(clean.max())
    if np.isclose(max_ws, 0.0):
        return 0.0
    return 0.32 / max_ws


def _draw_calendar_month(
    axis: plt.Axes,
    *,
    lookup: pd.DataFrame,
    year: int,
    month: int,
    annotate_mode: str | None,
    pollutant: str,
    lim: float | None,
    color_spec: dict[str, object],
    arrow_scale: float,
    day_labels: list[str],
) -> None:
    month_name = pycalendar.month_name[month]
    axis.set_xlim(0, 7)
    axis.set_ylim(6, 0)
    axis.set_aspect("equal")
    axis.set_xticks(np.arange(7) + 0.5)
    axis.set_xticklabels(day_labels, fontsize=8)
    axis.set_yticks([])
    axis.tick_params(length=0)
    axis.set_title(f"{month_name} {year}", loc="left", fontsize=11, pad=8)

    calendar_rows = pycalendar.Calendar(firstweekday=0).monthdayscalendar(year, month)
    while len(calendar_rows) < 6:
        calendar_rows.append([0] * 7)

    for row_index, week in enumerate(calendar_rows):
        for col_index, day in enumerate(week):
            x = col_index
            y = row_index
            if day == 0:
                axis.add_patch(
                    mpatches.Rectangle(
                        (x, y),
                        1,
                        1,
                        facecolor="#f8fafc",
                        edgecolor="#e2e8f0",
                        linewidth=0.8,
                    )
                )
                continue

            current_date = pd.Timestamp(year=year, month=month, day=day)
            if current_date in lookup.index:
                row = lookup.loc[current_date]
                if isinstance(row, pd.DataFrame):
                    row = row.iloc[0]
                value = row["value"]
                facecolor = "#e2e8f0" if pd.isna(value) else color_spec["mappable"].to_rgba(float(value))
                ws_mean = row.get("ws_mean", np.nan)
                wd_mean = row.get("wd_mean", np.nan)
            else:
                value = np.nan
                ws_mean = np.nan
                wd_mean = np.nan
                facecolor = "#e2e8f0"

            axis.add_patch(
                mpatches.Rectangle(
                    (x, y),
                    1,
                    1,
                    facecolor=facecolor,
                    edgecolor="white",
                    linewidth=1.0,
                )
            )
            axis.text(x + 0.08, y + 0.2, str(day), fontsize=8, color="#0f172a", va="top")

            if annotate_mode == "value" and not pd.isna(value):
                text = f"{float(value):.1f}"
                text_color = "#7f1d1d" if lim is not None and float(value) >= lim else "#111827"
                axis.text(x + 0.5, y + 0.62, text, ha="center", va="center", fontsize=8, color=text_color)
            elif annotate_mode == "ws" and not pd.isna(ws_mean) and not pd.isna(wd_mean) and arrow_scale > 0:
                angle = np.deg2rad(float(wd_mean))
                dx = float(np.sin(angle) * float(ws_mean) * arrow_scale)
                dy = float(-np.cos(angle) * float(ws_mean) * arrow_scale)
                axis.arrow(
                    x + 0.5,
                    y + 0.55,
                    dx,
                    dy,
                    width=0.02,
                    head_width=0.16,
                    head_length=0.14,
                    color="#0f172a",
                    length_includes_head=True,
                )
            elif lim is not None and not pd.isna(value) and float(value) >= lim:
                axis.text(x + 0.5, y + 0.62, "!", ha="center", va="center", fontsize=10, color="#991b1b")

    for spine in axis.spines.values():
        spine.set_visible(False)


def _time_proportion_category(
    series: pd.Series,
    *,
    name: str,
    wd: str,
    n_levels: int,
    sector_count: int,
    labels: list[str] | None,
) -> pd.Series:
    if pd.api.types.is_numeric_dtype(series):
        numeric = pd.to_numeric(series, errors="coerce")
        if name == wd:
            edges = np.linspace(0, 360, sector_count + 1)
            sector_labels = labels or _direction_sector_labels(sector_count)
            if len(sector_labels) != sector_count:
                raise ValueError("labels length must match sector_count for wind-direction proportioning")
            wrapped = numeric % 360
            categories = pd.cut(
                wrapped,
                bins=edges,
                labels=sector_labels,
                include_lowest=True,
                right=False,
                ordered=True,
            )
            tail_mask = wrapped == 360
            if tail_mask.any():
                categories = categories.astype("object")
                categories.loc[tail_mask] = sector_labels[0]
            return pd.Categorical(categories, categories=sector_labels, ordered=True)

        quantiles = np.linspace(0, 1, n_levels + 1)
        edges = np.unique(numeric.quantile(quantiles).to_numpy(dtype=float))
        if len(edges) < 2:
            edges = np.array([float(numeric.min()), float(numeric.min()) + 1.0], dtype=float)
        category_labels = labels or [
            f"{edges[index]:.1f}-{edges[index + 1]:.1f}"
            for index in range(len(edges) - 1)
        ]
        if len(category_labels) != len(edges) - 1:
            raise ValueError("labels length must match the number of numeric proportion bins")
        return pd.cut(
            numeric,
            bins=edges,
            labels=category_labels,
            include_lowest=True,
            ordered=True,
            duplicates="drop",
        )

    categories = pd.Series(series, copy=True)
    category_order = labels or list(pd.Index(categories.dropna().astype(str).unique()))
    categories = categories.astype(str)
    categories = categories.where(series.notna(), np.nan)
    return pd.Categorical(categories, categories=category_order, ordered=True)


def _direction_sector_labels(sector_count: int) -> list[str]:
    if sector_count == 4:
        return ["N", "E", "S", "W"]
    if sector_count == 8:
        return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    step = 360 / sector_count
    return [f"{int(index * step)}-{int((index + 1) * step)}" for index in range(sector_count)]


def _ols_window_metrics(x_values: np.ndarray, y_values: np.ndarray) -> dict[str, float] | None:
    if x_values.size < 3 or y_values.size < 3:
        return None
    if np.allclose(x_values, x_values[0]) or np.allclose(y_values, y_values[0]):
        return None

    slope, intercept = np.polyfit(x_values, y_values, deg=1)
    fitted = intercept + slope * x_values
    residuals = y_values - fitted
    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((y_values - y_values.mean()) ** 2))
    r_squared = float(1 - ss_res / ss_tot) if ss_tot else np.nan
    correlation = float(np.corrcoef(x_values, y_values)[0, 1])
    rmse = float(np.sqrt(np.mean(residuals**2)))
    return {
        "slope": float(slope),
        "intercept": float(intercept),
        "r_squared": r_squared,
        "correlation": correlation,
        "rmse": rmse,
    }


def _theil_sen_conditioned_frame(
    frame: pd.DataFrame,
    *,
    date_col: str,
    group_by: str | None,
    type: str | None,
    wd: str,
    wd_sectors: int,
) -> pd.DataFrame:
    if group_by and type:
        raise ValueError("Use either group_by or type, not both")

    working = frame.copy()
    condition_name = group_by or type
    if condition_name is None:
        working["condition"] = "All data"
        return working

    if condition_name == "wd":
        validate_columns(working, [wd])
        labels = _direction_sector_labels(wd_sectors)
        edges = np.linspace(0, 360, wd_sectors + 1)
        wrapped = working[wd] % 360
        sectors = pd.cut(
            wrapped,
            bins=edges,
            labels=labels,
            include_lowest=True,
            right=False,
            ordered=True,
        )
        working["condition"] = sectors.astype("object")
        working.loc[wrapped == 360, "condition"] = labels[0]
        return working.dropna(subset=["condition"]).copy()

    if condition_name == "season":
        working["condition"] = _season_labels(working[date_col])
        return working.dropna(subset=["condition"]).copy()

    validate_columns(working, [condition_name])
    working["condition"] = working[condition_name]
    return working.dropna(subset=["condition"]).copy()


def _theil_sen_fit(x: np.ndarray, y: np.ndarray, *, max_points: int) -> tuple[float, float]:
    if x.size < 2:
        raise ValueError("At least two points are required for Theil-Sen estimation")

    if x.size > max_points:
        sample_positions = np.linspace(0, x.size - 1, max_points, dtype=int)
        sample_x = x[sample_positions]
        sample_y = y[sample_positions]
    else:
        sample_x = x
        sample_y = y

    slopes: list[float] = []
    for left in range(len(sample_x) - 1):
        delta_x = sample_x[left + 1 :] - sample_x[left]
        delta_y = sample_y[left + 1 :] - sample_y[left]
        valid = delta_x != 0
        slopes.extend((delta_y[valid] / delta_x[valid]).tolist())

    if not slopes:
        raise ValueError("Could not compute Theil-Sen slope from the provided data")

    slope = float(np.median(slopes))
    intercept = float(np.median(y - slope * x))
    return slope, intercept


def _theil_sen_bootstrap(
    x: np.ndarray,
    y: np.ndarray,
    *,
    alpha: float,
    n_boot: int,
    block_length: int | None,
    max_points: int,
    rng: np.random.Generator,
) -> dict[str, float]:
    block = block_length or max(2, int(round(len(x) ** (1 / 3))))
    slopes: list[float] = []
    intercepts: list[float] = []

    for _ in range(n_boot):
        indices = _moving_block_bootstrap_indices(len(x), block, rng)
        x_sample = x[indices]
        y_sample = y[indices]
        order = np.argsort(x_sample, kind="mergesort")
        x_sample = x_sample[order]
        y_sample = y_sample[order]
        try:
            slope, intercept = _theil_sen_fit(x_sample, y_sample, max_points=max_points)
        except ValueError:
            continue
        slopes.append(slope)
        intercepts.append(intercept)

    if not slopes:
        return {
            "slope_low": np.nan,
            "slope_high": np.nan,
            "intercept_low": np.nan,
            "intercept_high": np.nan,
        }

    lower = alpha / 2
    upper = 1 - alpha / 2
    return {
        "slope_low": float(np.quantile(slopes, lower)),
        "slope_high": float(np.quantile(slopes, upper)),
        "intercept_low": float(np.quantile(intercepts, lower)),
        "intercept_high": float(np.quantile(intercepts, upper)),
    }


def _moving_block_bootstrap_indices(
    size: int,
    block_length: int,
    rng: np.random.Generator,
) -> np.ndarray:
    starts = np.arange(max(size - block_length + 1, 1))
    indices: list[int] = []
    while len(indices) < size:
        start = int(rng.choice(starts))
        stop = min(start + block_length, size)
        indices.extend(range(start, stop))
    return np.asarray(indices[:size], dtype=int)


def _mann_kendall_p_value(values: np.ndarray) -> float:
    clean = values[~np.isnan(values)]
    n = len(clean)
    if n < 2:
        return np.nan

    s = 0
    for left in range(n - 1):
        s += np.sign(clean[left + 1 :] - clean[left]).sum()

    _, counts = np.unique(clean, return_counts=True)
    tie_term = np.sum(counts * (counts - 1) * (2 * counts + 5))
    variance = (n * (n - 1) * (2 * n + 5) - tie_term) / 18
    if variance <= 0:
        return np.nan

    if s > 0:
        z = (s - 1) / sqrt(variance)
    elif s < 0:
        z = (s + 1) / sqrt(variance)
    else:
        z = 0.0

    return float(2 * (1 - _normal_cdf(abs(z))))


def _normal_cdf(value: float) -> float:
    return 0.5 * (1 + erf(value / sqrt(2)))


def _significance_stars(p_value: float) -> str:
    if pd.isna(p_value):
        return ""
    if p_value < 0.001:
        return "***"
    if p_value < 0.01:
        return "**"
    if p_value < 0.05:
        return "*"
    return ""


def _theil_sen_slope_value(
    *,
    slope: float,
    intercept: float,
    x: np.ndarray,
    slope_percent: bool,
) -> float:
    if pd.isna(slope) or pd.isna(intercept):
        return np.nan
    if not slope_percent:
        return float(slope)

    years = float(x.max() - x.min()) if x.size else 0.0
    if years <= 0:
        return np.nan
    start = intercept + slope * float(x.min())
    end = intercept + slope * float(x.max())
    if np.isclose(start, 0.0):
        return np.nan
    return float(((end / start) - 1) * 100 / years)


def _season_labels(dates: pd.Series) -> pd.Categorical:
    months = dates.dt.month
    labels = pd.Series(index=dates.index, dtype="object")
    labels.loc[months.isin([12, 1, 2])] = "DJF"
    labels.loc[months.isin([3, 4, 5])] = "MAM"
    labels.loc[months.isin([6, 7, 8])] = "JJA"
    labels.loc[months.isin([9, 10, 11])] = "SON"
    return pd.Categorical(labels, categories=["DJF", "MAM", "JJA", "SON"], ordered=True)


def _gaussian_smoother(x: np.ndarray, y: np.ndarray, bandwidth: int) -> np.ndarray:
    if bandwidth < 2:
        raise ValueError("bandwidth must be at least 2")
    span = max(float(bandwidth) / 2.0, 1.0)
    smooth = np.empty_like(y, dtype=float)
    for index, x0 in enumerate(x):
        weights = np.exp(-0.5 * ((x - x0) / span) ** 2)
        weights_sum = weights.sum()
        smooth[index] = np.sum(weights * y) / weights_sum if weights_sum else np.nan
    return smooth


def _smooth_trend_bootstrap_interval(
    *,
    x: np.ndarray,
    y: np.ndarray,
    window: int,
    alpha: float,
    n_boot: int,
    block_length: int | None,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    block = block_length or max(2, int(round(len(x) ** (1 / 3))))
    base_smooth = _gaussian_smoother(x, y, window)
    residuals = y - base_smooth
    boot_lines: list[np.ndarray] = []

    for _ in range(n_boot):
        indices = _moving_block_bootstrap_indices(len(y), block, rng)
        resampled = residuals[indices]
        candidate = base_smooth + resampled
        boot_lines.append(_gaussian_smoother(x, candidate, window))

    if not boot_lines:
        nan_line = np.full_like(y, np.nan, dtype=float)
        return nan_line, nan_line

    stack = np.vstack(boot_lines)
    lower = np.quantile(stack, alpha / 2, axis=0)
    upper = np.quantile(stack, 1 - alpha / 2, axis=0)
    return lower.astype(float), upper.astype(float)


def _plot_smooth_trend_axis(
    axis: plt.Axes,
    frame: pd.DataFrame,
    *,
    pollutant: str,
    date_col: str,
    deseason: bool,
    summary_row: pd.Series,
    alpha: float,
) -> None:
    observed_label = "Deseasonalised" if deseason else "Observed"
    axis.plot(frame[date_col], frame["analysis_value"], color="#cbd5e1", linewidth=1.4, label=observed_label)
    axis.plot(frame[date_col], frame["smooth"], color="#0f766e", linewidth=2.5, label="Smooth trend")
    if frame["smooth_low"].notna().any() and frame["smooth_high"].notna().any():
        axis.fill_between(
            frame[date_col],
            frame["smooth_low"],
            frame["smooth_high"],
            color="#5eead4",
            alpha=0.25,
            label=f"{int((1 - alpha) * 100)}% interval",
        )

    change = float(summary_row["change"])
    residual_sd = float(summary_row["residual_sd"])
    text = f"Change: {change:.3f}\nResidual SD: {residual_sd:.3f}"
    axis.text(
        0.02,
        0.98,
        text,
        transform=axis.transAxes,
        va="top",
        ha="left",
        fontsize=8,
        bbox={"facecolor": "white", "alpha": 0.75, "edgecolor": "#e2e8f0"},
    )
    axis.set_xlabel(date_col)
    axis.set_ylabel(pollutant)
    axis.grid(alpha=0.2)
    axis.legend(loc="lower right", fontsize=8)


def _trend_level_axis_series(
    frame: pd.DataFrame,
    *,
    axis: str,
    date_col: str,
    wd: str,
    wd_sectors: int,
    n_levels: int,
) -> pd.Series:
    if axis in frame.columns:
        series = frame[axis]
        if axis == wd:
            labels = _direction_sector_labels(wd_sectors)
            edges = np.linspace(0, 360, wd_sectors + 1)
            wrapped = pd.to_numeric(series, errors="coerce") % 360
            categories = pd.cut(
                wrapped,
                bins=edges,
                labels=labels,
                include_lowest=True,
                right=False,
                ordered=True,
            )
            return pd.Categorical(categories, categories=labels, ordered=True)
        if pd.api.types.is_numeric_dtype(series):
            numeric = pd.to_numeric(series, errors="coerce")
            quantiles = np.linspace(0, 1, n_levels + 1)
            edges = np.unique(numeric.quantile(quantiles).to_numpy(dtype=float))
            if len(edges) < 2:
                edges = np.array([float(numeric.min()), float(numeric.min()) + 1.0], dtype=float)
            labels = [
                f"{edges[index]:.1f}-{edges[index + 1]:.1f}"
                for index in range(len(edges) - 1)
            ]
            return pd.cut(
                numeric,
                bins=edges,
                labels=labels,
                include_lowest=True,
                ordered=True,
                duplicates="drop",
            )
        categorical = series.astype(str).where(series.notna(), np.nan)
        order = list(pd.Index(categorical.dropna().unique()))
        return pd.Categorical(categorical, categories=order, ordered=True)

    if axis == "month":
        labels = [
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
        return pd.Categorical(frame[date_col].dt.month_name(), categories=labels, ordered=True)
    if axis == "hour":
        return frame[date_col].dt.hour
    if axis == "weekday":
        labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return pd.Categorical(frame[date_col].dt.day_name(), categories=labels, ordered=True)
    if axis == "season":
        return _season_labels(frame[date_col])
    if axis == "year":
        return frame[date_col].dt.year.astype("Int64")

    raise ValueError(
        f"Unsupported trend_level axis '{axis}'. Use an existing column or one of "
        "'hour', 'weekday', 'month', 'season', or 'year'."
    )


def _trend_level_reducer(statistic: str | Callable[[pd.Series], float]) -> Callable[[pd.Series], float]:
    if callable(statistic):
        return lambda series: float(statistic(series))

    if statistic == "frequency":
        return lambda series: float(series.count())
    if statistic not in {"mean", "median", "max", "min"}:
        raise ValueError("statistic must be one of: mean, median, max, min, frequency")
    return lambda series: float(getattr(series, statistic)())


def _trend_level_statistic_name(statistic: str | Callable[[pd.Series], float]) -> str:
    return statistic if isinstance(statistic, str) else getattr(statistic, "__name__", "custom")


def _trend_level_order(series: pd.Series) -> list[object]:
    if isinstance(series.dtype, pd.CategoricalDtype):
        present = set(series.dropna())
        return [level for level in series.cat.categories if level in present]
    return list(pd.Index(series.dropna().unique()))


def _trend_level_color_spec(
    values: pd.Series,
    *,
    breaks: list[float] | None,
    labels: list[str] | None,
    cmap: str,
    colors: list[str] | None,
) -> dict[str, object]:
    clean = values.dropna().astype(float)
    if clean.empty:
        raise ValueError("Trend level requires at least one non-missing value")

    if breaks is not None:
        if len(breaks) < 2:
            raise ValueError("breaks must contain at least two edges")
        if any(right <= left for left, right in zip(breaks, breaks[1:])):
            raise ValueError("breaks must be strictly increasing")
        if labels is not None and len(labels) != len(breaks) - 1:
            raise ValueError("labels length must match len(breaks) - 1")
        if colors is not None and len(colors) != len(breaks) - 1:
            raise ValueError("colors length must match len(breaks) - 1")

        color_values = colors or plt.get_cmap(cmap, len(breaks) - 1)(np.linspace(0, 1, len(breaks) - 1))
        discrete_map = mcolors.ListedColormap(color_values)
        norm = mcolors.BoundaryNorm(breaks, discrete_map.N)
        mappable = plt.cm.ScalarMappable(norm=norm, cmap=discrete_map)
        tick_values = [(breaks[index] + breaks[index + 1]) / 2 for index in range(len(breaks) - 1)]
        tick_labels = labels
        return {
            "cmap": discrete_map,
            "norm": norm,
            "mappable": mappable,
            "tick_values": tick_values,
            "tick_labels": tick_labels,
            "dark_text": lambda value: norm(value) > 0.6,
        }

    vmin = float(clean.min())
    vmax = float(clean.max())
    if np.isclose(vmin, vmax):
        vmax = vmin + 1.0
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)
    mappable = plt.cm.ScalarMappable(norm=norm, cmap=cmap)
    return {
        "cmap": cmap,
        "norm": norm,
        "mappable": mappable,
        "tick_values": None,
        "tick_labels": None,
        "dark_text": lambda value: norm(value) > 0.55,
    }


def _trend_level_label(value: float) -> str:
    if np.isclose(value, round(value)):
        return str(int(round(value)))
    return f"{value:.1f}"


def _plot_theil_sen_axis(
    axis: plt.Axes,
    frame: pd.DataFrame,
    *,
    pollutant: str,
    date_col: str,
    deseason: bool,
    summary_row: pd.Series,
    slope_percent: bool,
    alpha: float,
) -> None:
    observed_label = "Deseasonalised" if deseason else "Observed"
    axis.plot(frame[date_col], frame["analysis_value"], color="#94a3b8", linewidth=1.4, label=observed_label)
    axis.plot(frame[date_col], frame["trend"], color="#b91c1c", linewidth=2.4, label="Theil-Sen trend")
    if frame["trend_low"].notna().any():
        axis.plot(frame[date_col], frame["trend_low"], color="#ef4444", linewidth=1.1, linestyle="--")
    if frame["trend_high"].notna().any():
        axis.plot(frame[date_col], frame["trend_high"], color="#ef4444", linewidth=1.1, linestyle="--")

    slope_unit = "%/year" if slope_percent else "units/year"
    slope_text = f"Slope: {summary_row['slope_value']:.3f} {slope_unit}"
    if not pd.isna(summary_row["slope_low"]) and not pd.isna(summary_row["slope_high"]):
        slope_text += (
            f"\n{int((1 - alpha) * 100)}% CI: "
            f"{summary_row['slope_low']:.3f} to {summary_row['slope_high']:.3f}"
        )
    significance = str(summary_row["significance"] or "")
    if significance:
        slope_text += f"\nSignificance: {significance} (p={summary_row['p_value']:.3g})"

    axis.text(
        0.02,
        0.98,
        slope_text,
        transform=axis.transAxes,
        va="top",
        ha="left",
        fontsize=8,
        bbox={"facecolor": "white", "alpha": 0.75, "edgecolor": "#e2e8f0"},
    )
    axis.set_xlabel(date_col)
    axis.set_ylabel(pollutant)
    axis.grid(alpha=0.2)
    axis.legend(loc="lower right", fontsize=8)


def _validate_statistic(statistic: str) -> None:
    if statistic not in {"mean", "median", "max", "min"}:
        raise ValueError("statistic must be one of: mean, median, max, min")
