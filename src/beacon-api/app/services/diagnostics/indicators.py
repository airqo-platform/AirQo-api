"""
Indicators: continuous per-component measurements computed on every evaluation,
whether or not anything is wrong. Issues are threshold breaches on top of these;
trends are computed from the stored daily values.

Shape: {component_name: {indicator_group: {...values}}}
- "agreement:<other component>"  for each MEASURES_SAME_AS pair (owned by the first component)
- "charge_cycle"                 for each metric with role charge_level
- "generation"                   for each metric with role charge_source
- "coverage"                     for each connectivity component (or "device" when there is none)
"""
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.services.diagnostics.features import FeatureExtractor
from app.services.diagnostics.profile_model import (
    CHARGE_LEVEL_ROLE,
    CHARGE_SOURCE_ROLE,
    DiagnosticModel,
    MetricSpec,
    RedundantPair,
)

DEVICE_COMPONENT = "device"
MAX_LISTED_OUTAGES = 24


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _r(value: Optional[float], digits: int = 3) -> Optional[float]:
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return None
    return round(float(value), digits)


def _metric_series(features: Dict[str, Any], key: str) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    stats = features.get("metrics", {}).get(key)
    if not stats or not stats.get("count"):
        return None
    ts = np.array(stats["timestamps"], dtype=float)
    vals = np.array(stats["values"], dtype=float)
    # Average duplicates so time-based maths never divides by a zero interval.
    uniq, inverse = np.unique(ts, return_inverse=True)
    if len(uniq) != len(ts):
        sums = np.bincount(inverse, weights=vals)
        counts = np.bincount(inverse)
        ts, vals = uniq, sums / counts
    return ts, vals


def _record_timestamps(records: List[Dict[str, Any]]) -> np.ndarray:
    stamps = [FeatureExtractor.get_record_timestamp(r) for r in records or []]
    return np.array(sorted(t for t in stamps if t is not None), dtype=float)


def outage_gap_seconds(policy: Dict[str, Any], expected_interval_seconds: Optional[float], timestamps: np.ndarray) -> float:
    """A gap counts as an outage when longer than both the minimum and a multiple of the reporting interval."""
    cov = policy["coverage"]
    floor = float(cov["outage_min_minutes"]) * 60.0
    interval = expected_interval_seconds
    if not interval and len(timestamps) > 1:
        interval = float(np.median(np.diff(timestamps)))
    return max(floor, float(cov["outage_interval_multiple"]) * interval) if interval else floor


def low_charge_threshold(metric: MetricSpec, policy: Dict[str, Any]) -> Optional[float]:
    if metric.range is None:
        return None
    return metric.expected_min + float(policy["coverage"]["low_charge_fraction"]) * metric.range


# ── Sensor agreement ──────────────────────────────────────────────────────────

def agreement_stats(records: List[Dict[str, Any]], pair: RedundantPair) -> Optional[Dict[str, Any]]:
    series_a, series_b = FeatureExtractor.paired_values(records, pair.metric_a, pair.metric_b)
    if len(series_a) < 3:
        return None
    a, b = np.array(series_a), np.array(series_b)
    agreement = FeatureExtractor.calculate_cross_sensor_agreement(series_a, series_b)
    diff = a - b
    stats: Dict[str, Any] = {
        "with": pair.component_b,
        "metric": pair.metric_a,
        "other_metric": pair.metric_b,
        "paired_count": int(len(a)),
        "correlation": agreement["correlation"],
        "mean_abs_error": agreement["mean_absolute_error"],
        "p95_abs_error": _r(np.percentile(np.abs(diff), 95)),
        "bias": _r(np.mean(diff)),                          # positive: this component reads higher than the other
        "relative_error": agreement["divergence_ratio"],   # mean abs error / mean level
        "tolerance_abs": pair.tolerance_abs,
        "tolerance_rel": pair.tolerance_rel,
        "within_tolerance_rate": None,
    }
    if pair.has_tolerance:
        stats["within_tolerance_rate"] = _r(np.mean([pair.within_tolerance(x, y) for x, y in zip(a, b)]), 4)
    return stats


# ── Charge cycle ──────────────────────────────────────────────────────────────

def _smooth(ts: np.ndarray, vals: np.ndarray, window_seconds: float) -> np.ndarray:
    """Time-aware moving average: each point becomes the mean of readings within ±window/2."""
    if len(vals) < 3 or window_seconds <= 0:
        return vals.copy()
    csum = np.concatenate([[0.0], np.cumsum(vals)])
    lo = np.searchsorted(ts, ts - window_seconds / 2.0, side="left")
    hi = np.searchsorted(ts, ts + window_seconds / 2.0, side="right")
    return (csum[hi] - csum[lo]) / np.maximum(1, hi - lo)


def charge_cycle_stats(
    ts: np.ndarray,
    vals: np.ndarray,
    metric: MetricSpec,
    policy: Dict[str, Any],
    max_gap_seconds: float,
    max_fall_per_hour: float,
) -> Dict[str, Any]:
    i_min, i_max = int(np.argmin(vals)), int(np.argmax(vals))
    stats: Dict[str, Any] = {
        "metric": metric.key,
        "unit": metric.unit,
        "readings": int(len(vals)),
        "min": _r(vals[i_min]),
        "min_at": _iso(ts[i_min]),
        "max": _r(vals[i_max]),
        "max_at": _iso(ts[i_max]),
        "mean": _r(np.mean(vals)),
        "swing": _r(vals[i_max] - vals[i_min]),
        "start": _r(vals[0]),
        "end": _r(vals[-1]),
        "net_change": _r(vals[-1] - vals[0]),
    }
    if len(vals) < 3 or ts[-1] <= ts[0]:
        return stats

    # Time each reading "covers": until the next reading, but never across an outage.
    dt = np.minimum(np.diff(ts), max_gap_seconds)
    observed_range = metric.range or float(vals.max() - vals.min())
    flat_rate = float(policy["cycle"]["flat_rate_fraction_per_hour"]) * observed_range
    smoothed = _smooth(ts, vals, float(policy["cycle"]["smoothing_minutes"]) * 60.0)
    rate = np.gradient(smoothed, ts / 3600.0)  # units per hour
    state = np.where(rate > flat_rate, 1, np.where(rate < -flat_rate, -1, 0))[:-1]

    def hours_in(mask: np.ndarray) -> float:
        return float(np.sum(dt[mask])) / 3600.0

    def longest_run(target: int) -> float:
        best = run = 0.0
        for i, s in enumerate(state):
            if s == target and (i == 0 or (ts[i] - ts[i - 1]) <= max_gap_seconds):
                run += dt[i]
                best = max(best, run)
            else:
                run = dt[i] if s == target else 0.0
        return best / 3600.0

    non_flat = [s for s in state if s != 0]
    cycles = sum(1 for prev, cur in zip(non_flat, non_flat[1:]) if prev == -1 and cur == 1)
    charging, discharging = state == 1, state == -1

    stats.update({
        "hours_charging": _r(hours_in(charging), 2),
        "hours_discharging": _r(hours_in(discharging), 2),
        "hours_flat": _r(hours_in(state == 0), 2),
        "longest_charge_hours": _r(longest_run(1), 2),
        "longest_discharge_hours": _r(longest_run(-1), 2),
        "cycle_count": int(cycles),
        "charge_rate_per_hour": _r(np.median(rate[:-1][charging])) if charging.any() else None,
        "discharge_rate_per_hour": _r(np.median(-rate[:-1][discharging])) if discharging.any() else None,
        "max_discharge_rate_per_hour": _r(max_fall_per_hour),
        "hours_below_min": _r(hours_in(vals[:-1] < metric.expected_min), 2) if metric.expected_min is not None else None,
        "hours_above_max": _r(hours_in(vals[:-1] > metric.expected_max), 2) if metric.expected_max is not None else None,
    })
    threshold = low_charge_threshold(metric, policy)
    stats["low_charge_threshold"] = _r(threshold)
    stats["hours_low_charge"] = _r(hours_in(vals[:-1] < threshold), 2) if threshold is not None else None
    return stats


def generation_stats(ts: np.ndarray, vals: np.ndarray, metric: MetricSpec, max_gap_seconds: float) -> Dict[str, Any]:
    i_max = int(np.argmax(vals))
    reference = metric.expected_max if metric.expected_max else float(vals.max())
    active = vals > 0.05 * reference if reference > 0 else vals > 0
    hours_active = float(np.sum(np.minimum(np.diff(ts), max_gap_seconds)[active[:-1]])) / 3600.0 if len(vals) > 1 else 0.0
    return {
        "metric": metric.key,
        "unit": metric.unit,
        "readings": int(len(vals)),
        "peak": _r(vals[i_max]),
        "peak_at": _iso(ts[i_max]),
        "mean": _r(np.mean(vals)),
        "hours_active": _r(hours_active, 2),
    }


# ── Coverage & outages ────────────────────────────────────────────────────────

def coverage_stats(
    timestamps: np.ndarray,
    records: List[Dict[str, Any]],
    features: Dict[str, Any],
    model: DiagnosticModel,
    expected_interval_seconds: Optional[float],
    window_seconds: Optional[float],
    window_start: Optional[datetime],
    charge: Optional[Tuple[np.ndarray, np.ndarray, MetricSpec]],
) -> Dict[str, Any]:
    policy = model.policy
    stats: Dict[str, Any] = {
        "records": int(len(timestamps)),
        "records_without_timestamp": features.get("records_without_timestamp", 0),
        "expected_records": features.get("expected_records"),
        "missing_rate": features.get("missing_rate"),
        "expected_interval_seconds": expected_interval_seconds,
    }
    if len(timestamps) == 0:
        return stats

    gap_limit = outage_gap_seconds(policy, expected_interval_seconds, timestamps)
    start = window_start.timestamp() if window_start else math.floor(timestamps[0] / 3600.0) * 3600.0
    end = start + window_seconds if window_seconds else max(float(timestamps[-1]), start)
    hours_total = max(1, int(math.ceil((end - start) / 3600.0)))

    # Hour buckets
    counts = np.zeros(hours_total, dtype=int)
    for t in timestamps:
        idx = int((t - start) // 3600.0)
        if 0 <= idx < hours_total:
            counts[idx] += 1
    per_hour_expected = 3600.0 / expected_interval_seconds if expected_interval_seconds else None
    complete_min = per_hour_expected * float(policy["coverage"]["hour_complete_fraction"]) if per_hour_expected else 1
    stats.update({
        "hours_total": hours_total,
        "hours_with_data": int(np.sum(counts > 0)),
        "hours_complete": int(np.sum(counts >= complete_min)),
        "hours_empty": int(np.sum(counts == 0)),
        "records_per_hour_median": _r(np.median(counts[counts > 0]), 1),
        "outage_gap_seconds": _r(gap_limit, 0),
    })

    # Payload completeness: a record is partial when it lacks a mapped metric the device does send.
    mapped_keys = {m.key for c in model.components.values() for m in c.mapped_metrics}
    sent_keys = {k for r in records for k in mapped_keys if r.get(k) is not None}
    if sent_keys:
        partial = sum(1 for r in records if any(r.get(k) is None for k in sent_keys))
        stats["partial_record_rate"] = _r(partial / len(records), 4)

    # Outages: leading gap, gaps between readings, trailing gap
    threshold = low_charge_threshold(charge[2], policy) if charge else None
    lookback = int(policy["coverage"]["readings_before_outage"])
    outages: List[Dict[str, Any]] = []

    def attribution(gap_start: float, leading: bool) -> Optional[bool]:
        if charge is None or threshold is None or leading:
            return None
        c_ts, c_vals, _ = charge
        before = c_vals[c_ts <= gap_start][-lookback:]
        return bool(len(before)) and bool(np.min(before) < threshold)

    edges = [(start, float(timestamps[0]), True)] + [
        (float(a), float(b), False) for a, b in zip(timestamps[:-1], timestamps[1:])
    ] + [(float(timestamps[-1]), end, False)]
    for gap_start, gap_end, leading in edges:
        if gap_end - gap_start <= gap_limit:
            continue
        outages.append({
            "start": _iso(gap_start),
            "end": _iso(gap_end),
            "hours": _r((gap_end - gap_start) / 3600.0, 2),
            "after_low_charge": attribution(gap_start, leading),
        })

    offline = sum(o["hours"] for o in outages)
    stats.update({
        "outage_count": len(outages),
        "offline_hours": _r(offline, 2),
        "longest_outage_hours": _r(max((o["hours"] for o in outages), default=0.0), 2),
        "outages_after_low_charge": sum(1 for o in outages if o["after_low_charge"] is True),
        "outages_with_healthy_charge": sum(1 for o in outages if o["after_low_charge"] is False),
        "outages_unattributed": sum(1 for o in outages if o["after_low_charge"] is None),
        "low_charge_threshold": _r(threshold),
        "charge_metric": f"{charge[2].key}" if charge else None,
        "outages": outages[:MAX_LISTED_OUTAGES],
    })
    return stats


# ── Entry point ───────────────────────────────────────────────────────────────

def compute_indicators(
    records: List[Dict[str, Any]],
    features: Dict[str, Any],
    model: DiagnosticModel,
    expected_interval_seconds: Optional[float] = None,
    window_seconds: Optional[float] = None,
    window_start: Optional[datetime] = None,
) -> Dict[str, Dict[str, Dict[str, Any]]]:
    indicators: Dict[str, Dict[str, Dict[str, Any]]] = {}
    timestamps = _record_timestamps(records)
    gap_limit = outage_gap_seconds(model.policy, expected_interval_seconds, timestamps)

    for pair in model.redundant_pairs:
        stats = agreement_stats(records, pair)
        if stats:
            indicators.setdefault(pair.component_a, {})[f"agreement:{pair.component_b}"] = stats

    charge_series: Dict[str, Tuple[np.ndarray, np.ndarray, MetricSpec]] = {}
    for component, metric in model.metrics_with_role(CHARGE_LEVEL_ROLE):
        series = _metric_series(features, metric.key)
        if series is None:
            continue
        charge_series[component.name] = (series[0], series[1], metric)
        max_fall = features["metrics"][metric.key].get("max_fall_per_hour", 0.0)
        indicators.setdefault(component.name, {})["charge_cycle"] = charge_cycle_stats(
            series[0], series[1], metric, component.policy, gap_limit, max_fall
        )

    for component, metric in model.metrics_with_role(CHARGE_SOURCE_ROLE):
        series = _metric_series(features, metric.key)
        if series is not None:
            indicators.setdefault(component.name, {})["generation"] = generation_stats(
                series[0], series[1], metric, gap_limit
            )

    for target in model.transmission_components or [DEVICE_COMPONENT]:
        feeding = model.charge_level_feeding(target)
        charge = charge_series.get(feeding[0].name) if feeding else None
        indicators.setdefault(target, {})["coverage"] = coverage_stats(
            timestamps, records, features, model, expected_interval_seconds, window_seconds, window_start, charge
        )
    return indicators
