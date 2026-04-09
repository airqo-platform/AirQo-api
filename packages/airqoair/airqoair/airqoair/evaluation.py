from __future__ import annotations

from collections.abc import Iterable

import numpy as np
import pandas as pd
from matplotlib import pyplot as plt

from .results import AirQoFigure, AirQoReport
from .utils import DataSource, load_data, validate_columns


def model_evaluation(
    data: DataSource | None = None,
    *,
    observed: Iterable[float] | None = None,
    predicted: Iterable[float] | None = None,
    observed_col: str = "observed",
    predicted_col: str = "predicted",
) -> AirQoReport:
    frame = _prepare_model_frame(
        data=data,
        observed=observed,
        predicted=predicted,
        observed_col=observed_col,
        predicted_col=predicted_col,
    )
    metrics = _metrics_table(frame, observed_col=observed_col, predicted_col=predicted_col)

    fig, ax = plt.subplots(figsize=(5.5, 5.5), constrained_layout=True)
    ax.scatter(frame[observed_col], frame[predicted_col], alpha=0.6, color="#2563eb")
    minimum = min(frame[observed_col].min(), frame[predicted_col].min())
    maximum = max(frame[observed_col].max(), frame[predicted_col].max())
    ax.plot([minimum, maximum], [minimum, maximum], color="#dc2626", linestyle="--")
    ax.set_title("Model evaluation")
    ax.set_xlabel("Observed")
    ax.set_ylabel("Predicted")
    ax.grid(alpha=0.2)

    return AirQoReport(
        sections={"metrics": metrics, "paired_data": frame.reset_index(drop=True)},
        metadata={"title": "Model evaluation report"},
        figure=fig,
    )


def taylor_diagram(
    data: DataSource | None = None,
    *,
    observed: Iterable[float] | None = None,
    predicted: Iterable[float] | None = None,
    observed_col: str = "observed",
    predicted_col: str = "predicted",
    label: str = "Model",
) -> AirQoFigure:
    frame = _prepare_model_frame(
        data=data,
        observed=observed,
        predicted=predicted,
        observed_col=observed_col,
        predicted_col=predicted_col,
    )
    observed_values = frame[observed_col].to_numpy(dtype=float)
    predicted_values = frame[predicted_col].to_numpy(dtype=float)
    correlation = _safe_correlation(observed_values, predicted_values)
    observed_std = float(np.std(observed_values, ddof=0))
    predicted_std = float(np.std(predicted_values, ddof=0))
    if len(frame) < 2 or observed_std == 0 or not np.isfinite(correlation):
        raise ValueError("Taylor diagram requires at least two paired values with non-zero observed variability")

    theta = np.arccos(np.clip(correlation, -1.0, 1.0))
    radius = predicted_std / observed_std

    fig, ax = plt.subplots(subplot_kw={"projection": "polar"}, figsize=(6, 6), constrained_layout=True)
    ax.scatter([0], [1], color="#111827", s=70, label="Observed")
    ax.scatter([theta], [radius], color="#2563eb", s=70, label=label)
    ax.set_thetamin(0)
    ax.set_thetamax(90)
    ax.set_title("Taylor diagram")
    ax.legend(loc="upper right", bbox_to_anchor=(1.2, 1.1))

    summary = pd.DataFrame(
        [
            {
                "correlation": correlation,
                "observed_std": observed_std,
                "predicted_std": predicted_std,
                "std_ratio": radius,
            }
        ]
    )
    return AirQoFigure(data=summary, figure=fig, metadata={"kind": "taylor_diagram"})


def conditional_quantiles(
    data: DataSource,
    *,
    x: str,
    y: str,
    quantiles: tuple[float, ...] = (0.1, 0.5, 0.9),
    bins: int = 10,
    date_col: str | None = None,
) -> AirQoFigure:
    frame = load_data(data, date_col=date_col)
    validate_columns(frame, [x, y])

    tidy = frame[[x, y]].dropna().copy()
    if tidy.empty:
        raise ValueError("No valid rows remain for conditional quantile analysis")

    tidy["x_bin"] = pd.cut(tidy[x], bins=bins)
    summary = (
        tidy.groupby("x_bin", observed=False)
        .agg(x_mid=(x, "median"))
        .reset_index(drop=True)
    )

    fig, ax = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    for quantile in quantiles:
        values = (
            tidy.groupby("x_bin", observed=False)[y]
            .quantile(quantile)
            .reset_index(drop=True)
        )
        label = f"q={quantile:.2f}"
        summary[label] = values
        ax.plot(summary["x_mid"], values, linewidth=2, label=label)

    ax.set_title(f"Conditional quantiles of {y} by {x}")
    ax.set_xlabel(x)
    ax.set_ylabel(y)
    ax.grid(alpha=0.2)
    ax.legend()

    return AirQoFigure(
        data=summary,
        figure=fig,
        metadata={"kind": "conditional_quantiles", "x": x, "y": y},
    )


def _prepare_model_frame(
    *,
    data: DataSource | None,
    observed: Iterable[float] | None,
    predicted: Iterable[float] | None,
    observed_col: str,
    predicted_col: str,
) -> pd.DataFrame:
    if data is not None:
        frame = load_data(data, date_col=None)
        validate_columns(frame, [observed_col, predicted_col])
        tidy = frame[[observed_col, predicted_col]].dropna().copy()
    else:
        if observed is None or predicted is None:
            raise ValueError("Provide either `data` or both `observed` and `predicted`")
        tidy = pd.DataFrame({observed_col: list(observed), predicted_col: list(predicted)}).dropna()

    if tidy.empty:
        raise ValueError("No valid rows remain for model evaluation")
    return tidy.reset_index(drop=True)


def _metrics_table(frame: pd.DataFrame, *, observed_col: str, predicted_col: str) -> pd.DataFrame:
    observed = frame[observed_col].to_numpy(dtype=float)
    predicted = frame[predicted_col].to_numpy(dtype=float)
    errors = predicted - observed
    rmse = float(np.sqrt(np.mean(errors**2)))
    mae = float(np.mean(np.abs(errors)))
    bias = float(np.mean(errors))
    correlation = _safe_correlation(observed, predicted)
    sse = float(np.sum(errors**2))
    sst = float(np.sum((observed - observed.mean()) ** 2))
    r_squared = float(1 - sse / sst) if sst else np.nan

    return pd.DataFrame(
        [
            {
                "n": len(frame),
                "rmse": rmse,
                "mae": mae,
                "bias": bias,
                "correlation": correlation,
                "r_squared": r_squared,
            }
        ]
    )


def _safe_correlation(observed: np.ndarray, predicted: np.ndarray) -> float:
    if observed.size < 2 or predicted.size < 2:
        return float("nan")
    observed_std = float(np.std(observed, ddof=0))
    predicted_std = float(np.std(predicted, ddof=0))
    if observed_std == 0 or predicted_std == 0:
        return float("nan")
    return float(np.corrcoef(observed, predicted)[0, 1])
