"""
Multi-day trends over stored daily indicators.

A single day can look fine while the device is sliding: a battery whose daily minimum
drops a little every day, a sensor pair drifting apart, coverage thinning out. Trends fit
a line through the last N diagnosed days of each tracked indicator and report whether it
is degrading, improving or stable, and, where the indicator has a limit, when it will be reached.

Everything works from the stored indicator values, so it needs no raw data and no
device-specific knowledge: which direction is bad and how to scale a change are properties
of the indicator, not of the device.
"""
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

from app.services.diagnostics.indicators import DEVICE_COMPONENT
from app.services.diagnostics.policy import DEFAULT_POLICY, severity_for
from app.services.diagnostics.profile_model import DiagnosticModel

TREND_CHECK = "DEGRADING_TREND"
HEALTH_GROUP = "health"


@dataclass(frozen=True)
class TrendSpec:
    group: str                 # indicator group; "agreement" matches every "agreement:<other>"
    field: str
    bad_direction: str         # "up" or "down": the direction that means things are getting worse
    scale: str                 # how a change is judged: "range" (metric's expected range), "hours", "unit", "percent"
    subject: str               # neutral name, e.g. "{label} daily minimum"
    title: str                 # degrading phrasing, e.g. "{label} daily minimum falling"
    limit_field: Optional[str] = None   # indicator field holding the limit the value is heading towards
    absolute: bool = False     # follow |value| (a bias growing in either direction)


TRACKED: Tuple[TrendSpec, ...] = (
    TrendSpec("charge_cycle", "min", "down", "range", "{label} daily minimum", "{label} daily minimum falling", "expected_min"),
    TrendSpec("charge_cycle", "mean", "down", "range", "{label} daily average", "{label} daily average falling"),
    TrendSpec("charge_cycle", "hours_low_charge", "up", "hours", "time at low {label}", "More time at low {label}"),
    TrendSpec("coverage", "hours_empty", "up", "hours", "hours without data", "Hours without data increasing"),
    TrendSpec("coverage", "offline_hours", "up", "hours", "offline time", "Offline time increasing"),
    # Relative to the measured level: absolute error between two sensors rises and falls with the level itself.
    TrendSpec("agreement", "relative_error", "up", "unit", "error against {other}", "Error against {other} growing"),
    TrendSpec("agreement", "relative_bias", "up", "unit", "bias against {other}", "Bias against {other} growing", absolute=True),
    TrendSpec("agreement", "correlation", "down", "unit", "correlation with {other}", "Correlation with {other} falling"),
    TrendSpec("agreement", "within_tolerance_rate", "down", "unit", "readings within tolerance of {other}",
              "Fewer readings within tolerance of {other}"),
    TrendSpec(HEALTH_GROUP, "overall_health_score", "down", "percent", "health score", "Health score falling"),
)

DayRow = Tuple[date, Dict[str, Any], Optional[float]]   # (diagnosis date, indicators, overall health score)


def _specs_for(group: str) -> List[TrendSpec]:
    base = group.split(":", 1)[0]
    return [s for s in TRACKED if s.group == base]


def _label(model: Optional[DiagnosticModel], component: str, metric_key: Optional[str]) -> str:
    if model and metric_key and component in model.components:
        for metric in model.components[component].metrics:
            if metric.key == metric_key:
                return metric.label
    return metric_key or component


def _scale(spec: TrendSpec, latest: Dict[str, Any], window_mean: float) -> float:
    if spec.scale == "hours":
        return 24.0
    if spec.scale == "unit":
        return 1.0
    if spec.scale == "percent":
        return 100.0
    if spec.scale == "range":
        low, high = latest.get("expected_min"), latest.get("expected_max")
        if low is not None and high is not None and high > low:
            return float(high - low)
    return max(abs(window_mean), 1e-9)   # no expected range on the metric: judge against the window's own level


def _fit(points: Sequence[Tuple[date, float]]) -> Tuple[float, float, float]:
    """Least-squares line through (day offset, value): slope per day, intercept, r²."""
    x = np.array([(d - points[0][0]).days for d, _ in points], dtype=float)
    y = np.array([v for _, v in points], dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    if ss_tot == 0.0:
        return 0.0, float(y.mean()), 0.0
    ss_res = float(np.sum((y - (slope * x + intercept)) ** 2))
    return float(slope), float(intercept), max(0.0, 1.0 - ss_res / ss_tot)


def compute_trends(
    rows: Sequence[DayRow],
    model: Optional[DiagnosticModel] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Trends for every tracked indicator present in `rows` (any order; the newest date is "today").
    Only days inside the trend window are used, and a trend needs `min_days` diagnosed days.
    """
    trend_policy = (policy or (model.policy if model else DEFAULT_POLICY))["trend"]
    window_days, min_days = int(trend_policy["window_days"]), int(trend_policy["min_days"])
    if not rows:
        return []
    ordered = sorted(rows, key=lambda r: r[0])
    last_day = ordered[-1][0]
    ordered = [r for r in ordered if (last_day - r[0]).days < window_days]

    series: Dict[Tuple[str, str, str], List[Tuple[date, float]]] = {}
    latest_values: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for day, indicators, score in ordered:
        if score is not None:
            series.setdefault((DEVICE_COMPONENT, HEALTH_GROUP, "overall_health_score"), []).append((day, float(score)))
        for component, groups in (indicators or {}).items():
            for group, values in (groups or {}).items():
                latest_values[(component, group)] = values
                for spec in _specs_for(group):
                    value = values.get(spec.field)
                    if isinstance(value, (int, float)) and not isinstance(value, bool):
                        series.setdefault((component, group, spec.field), []).append(
                            (day, abs(float(value)) if spec.absolute else float(value))
                        )

    trends: List[Dict[str, Any]] = []
    for (component, group, field), points in sorted(series.items()):
        if len(points) < min_days or points[-1][0] != last_day:
            continue
        spec = next(s for s in _specs_for(group) if s.field == field)
        latest = latest_values.get((component, group), {})
        slope, intercept, r_squared = _fit(points)
        span = (points[-1][0] - points[0][0]).days
        change = slope * span
        mean = float(np.mean([v for _, v in points]))
        change_fraction = abs(change) / _scale(spec, latest, mean)

        significant = (
            change_fraction >= float(trend_policy["min_change_fraction"])
            and r_squared >= float(trend_policy["min_r_squared"])
        )
        direction = "up" if change > 0 else "down" if change < 0 else "flat"
        status = "stable" if not significant else ("degrading" if direction == spec.bad_direction else "improving")

        limit = latest.get(spec.limit_field) if spec.limit_field else None
        days_to_limit = None
        if status == "degrading" and isinstance(limit, (int, float)) and slope != 0:
            fitted_latest = intercept + slope * span
            remaining = (fitted_latest - limit) if spec.bad_direction == "down" else (limit - fitted_latest)
            # A short window cannot forecast far ahead: only report a limit that is close.
            if remaining > 0 and remaining / abs(slope) <= float(trend_policy["projection_horizon_days"]):
                days_to_limit = round(remaining / abs(slope), 1)

        names = {
            "label": _label(model, component, latest.get("metric")),
            "other": group.split(":", 1)[1] if ":" in group else "",
        }
        trends.append({
            "component": component,
            "group": group,
            "field": field,
            "subject": spec.subject.format(**names),
            "title": spec.title.format(**names),
            "unit": latest.get("unit") if spec.scale == "range" else None,
            "status": status,
            "direction": direction,
            "window_days": window_days,
            "points": len(points),
            "first_date": points[0][0].isoformat(),
            "last_date": points[-1][0].isoformat(),
            "first_value": round(points[0][1], 4),
            "latest": round(points[-1][1], 4),
            "mean": round(mean, 4),
            "slope_per_day": round(slope, 5),
            "change": round(change, 4),
            "change_fraction": round(change_fraction, 4),
            "r_squared": round(r_squared, 3),
            "limit": limit,
            "days_to_limit": days_to_limit,
        })
    return trends


def describe_trend(trend: Dict[str, Any]) -> str:
    unit = f" {trend['unit']}" if trend.get("unit") else ""
    moved = "rose" if trend["direction"] == "up" else "fell"
    subject = trend["subject"]
    text = (
        f"{subject[0].upper()}{subject[1:]} {moved} from {trend['first_value']:g} to {trend['latest']:g}{unit} "
        f"over {trend['points']} diagnosed days ({trend['slope_per_day']:+.3g}{unit}/day)"
    )
    if trend.get("days_to_limit") is not None:
        text += f"; at this rate it reaches the {trend['limit']:g}{unit} limit in about {trend['days_to_limit']:g} days"
    return text


def trend_issues(trends: Sequence[Dict[str, Any]], model: Optional[DiagnosticModel]) -> List[Dict[str, Any]]:
    """Degrading trends as issue dicts, in the same shape `extract_issues` produces."""
    issues: List[Dict[str, Any]] = []
    for trend in trends:
        if trend["status"] != "degrading":
            continue
        component = model.components.get(trend["component"]) if model else None
        policy = component.policy if component else (model.policy if model else DEFAULT_POLICY)
        if TREND_CHECK in set(policy.get("disabled_checks") or []):
            continue
        full = float(policy["trend"]["full_confidence_change_fraction"])
        confidence = round(min(1.0, trend["change_fraction"] / full), 4)
        criticality = component.criticality if component else policy["device_level_criticality"]
        issues.append({
            "code": f"{TREND_CHECK}:{trend['component']}.{trend['group']}.{trend['field']}",
            "check": TREND_CHECK,
            "title": trend["title"],
            "subsystem": component.component_type if component else DEVICE_COMPONENT,
            "component_name": trend["component"],
            "metric": trend["field"],
            "severity": severity_for(criticality, confidence, policy),
            "confidence": confidence,
            "description": describe_trend(trend),
            "value": trend,
        })
    return issues
