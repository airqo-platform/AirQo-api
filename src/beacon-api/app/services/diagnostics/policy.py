"""
Generic diagnostic policy.

These are engine-wide tuning values for the generic checks (how many out-of-range
readings count as a fault, how evidence is weighted, lifecycle bands). They contain
no device knowledge — limits such as battery voltage come from the profile's metric
definitions. Any value can be overridden per profile via
`profile.meta_data["diagnostics"]` and per component via
`component.meta_data["diagnostics"]`.
"""
import copy
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_POLICY: Dict[str, Any] = {
    "range": {
        "min_violation_rate": 0.05,            # share of readings outside the envelope before it counts
        "full_confidence_violation_rate": 0.25,
    },
    "rate": {
        "window_minutes": 60,                  # max_rate_of_change is interpreted per hour
        "min_samples_per_window": 3,
    },
    "stuck": {
        "min_samples": 10,
    },
    "completeness": {
        "interval_config_key": "reporting_interval",  # config_mappings key holding the reporting interval
        "max_missing_rate": 0.40,
    },
    "agreement": {
        "min_pairs": 10,
        "min_correlation": 0.65,
        "max_divergence_ratio": 0.35,
        "min_within_tolerance_rate": 0.70,     # share of paired readings inside the relationship's tolerance
    },
    "coverage": {
        "outage_min_minutes": 30,              # a gap shorter than this is never an outage
        "outage_interval_multiple": 3,         # ...and it must also exceed this many reporting intervals
        "hour_complete_fraction": 0.5,         # an hour counts as covered with this share of its expected readings
        "low_charge_fraction": 0.3,            # charge below min + fraction × (max − min) before an outage = power-related
        "readings_before_outage": 3,
    },
    "cycle": {
        "smoothing_minutes": 60,               # moving-average window before classifying charge/discharge
        "flat_rate_fraction_per_hour": 0.02,   # |rate| below this share of the metric's range per hour = flat
    },
    # Multi-day trends over stored daily indicators
    "trend": {
        "window_days": 7,
        "min_days": 5,                          # diagnosed days needed inside the window (fewer fits chance too easily)
        "projection_horizon_days": 14,          # only forecast reaching a limit this far ahead
        "min_change_fraction": 0.15,            # fitted change over the window, as a share of the indicator's scale
        "full_confidence_change_fraction": 0.40,
        "min_r_squared": 0.5,                   # how consistently the days follow the fitted line
        "degrade_lifecycle": True,              # a HEALTHY day with a degrading trend is reported as DEGRADING
    },
    # Penalty applied to a component's score (and weight in root-cause confidence) per check type.
    "impact": {
        "METRIC_BELOW_MIN": 0.6,
        "METRIC_ABOVE_MAX": 0.6,
        "METRIC_RATE_EXCEEDED": 0.4,
        "METRIC_STUCK": 0.7,
        "METRIC_MISSING": 0.8,
        "SENSOR_DISAGREEMENT": 0.5,
        "SENSOR_ERROR_MARGIN": 0.5,
        "DATA_GAPS": 0.5,
        "LOW_CHARGE_OUTAGE": 0.7,
    },
    "disabled_checks": [],
    # Evidence on a dependent component counts this much toward its upstream component's fault.
    "downstream_evidence_factor": 0.5,
    # criticality × confidence thresholds
    "severity_thresholds": {"CRITICAL": 0.6, "HIGH": 0.4, "MEDIUM": 0.2},
    "min_diagnosis_confidence": 25.0,
    "device_level_criticality": 0.5,           # weight of device-wide evidence when no connectivity component exists
    "lifecycle": {
        "healthy": 85.0,
        "degrading": 70.0,
        "suspicious": 50.0,
        "likely_failure": 20.0,
        "high_confidence": 85.0,
        "medium_confidence": 70.0,
    },
}


# Settings used as divisors, window sizes or sample counts, so zero is not allowed.
_POSITIVE_SETTINGS = {
    "range.full_confidence_violation_rate",
    "rate.window_minutes",
    "rate.min_samples_per_window",
    "stuck.min_samples",
    "agreement.min_pairs",
    "coverage.outage_min_minutes",
    "coverage.outage_interval_multiple",
    "coverage.hour_complete_fraction",
    "coverage.readings_before_outage",
    "cycle.smoothing_minutes",
    "cycle.flat_rate_fraction_per_hour",
    "trend.window_days",
    "trend.min_days",
    "trend.projection_horizon_days",
    "trend.min_change_fraction",
    "trend.full_confidence_change_fraction",
}

# Shares, rates and weights: a value above 1 would make the check unreachable or always true.
_FRACTION_SETTINGS = {
    "range.min_violation_rate",
    "range.full_confidence_violation_rate",
    "completeness.max_missing_rate",
    "agreement.min_correlation",
    "agreement.min_within_tolerance_rate",
    "coverage.hour_complete_fraction",
    "coverage.low_charge_fraction",
    "cycle.flat_rate_fraction_per_hour",
    "trend.min_r_squared",
    "downstream_evidence_factor",
}
_FRACTION_SECTIONS = ("impact.", "severity_thresholds.")


def _is_fraction(relative: str) -> bool:
    return relative in _FRACTION_SETTINGS or relative.startswith(_FRACTION_SECTIONS)


def validate_policy_override(
    override: Any,
    base: Dict[str, Any] = DEFAULT_POLICY,
    path: str = "diagnostics",
    _relative: str = "",
) -> Tuple[List[str], List[str]]:
    """
    Check a policy override against the shape of the default policy.
    Returns (errors, warnings): wrong types or invalid values are errors, unknown settings are warnings.
    """
    if not isinstance(override, dict):
        return [f"'{path}' must be an object, got {type(override).__name__}."], []

    errors: List[str] = []
    warnings: List[str] = []
    for key, value in override.items():
        where = f"{path}.{key}"
        relative = f"{_relative}.{key}" if _relative else key
        if key not in base:
            warnings.append(f"Unknown diagnostic policy setting '{where}' is ignored.")
            continue
        expected = base[key]
        if isinstance(expected, dict):
            sub_errors, sub_warnings = validate_policy_override(value, expected, where, relative)
            errors.extend(sub_errors)
            warnings.extend(sub_warnings)
        elif isinstance(expected, list):
            if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                errors.append(f"'{where}' must be a list of strings.")
        elif isinstance(expected, bool):
            if not isinstance(value, bool):
                errors.append(f"'{where}' must be true or false.")
        elif isinstance(expected, (int, float)):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                errors.append(f"'{where}' must be a number, got {type(value).__name__}.")
            elif relative in _POSITIVE_SETTINGS and value <= 0:
                errors.append(f"'{where}' must be greater than 0.")
            elif value < 0:
                errors.append(f"'{where}' must not be negative.")
            elif _is_fraction(relative) and value > 1:
                errors.append(f"'{where}' must be between 0 and 1.")
        elif isinstance(expected, str):
            if not isinstance(value, str) or not value:
                errors.append(f"'{where}' must be a non-empty string.")
    return errors, warnings


def merge_policy(base: Dict[str, Any], override: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Deep-merge `override` onto a copy of `base`."""
    merged = copy.deepcopy(base)
    if not isinstance(override, dict):
        return merged
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = merge_policy(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def severity_for(criticality: float, confidence: float, policy: Dict[str, Any]) -> str:
    score = (criticality or 0.0) * (confidence or 0.0)
    thresholds = policy["severity_thresholds"]
    for level in ("CRITICAL", "HIGH", "MEDIUM"):
        if score >= thresholds[level]:
            return level
    return "LOW"
