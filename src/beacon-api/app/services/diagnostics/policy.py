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
from typing import Any, Dict, Optional

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
    },
    # Penalty applied to a component's score (and weight in root-cause confidence) per check type.
    "impact": {
        "METRIC_BELOW_MIN": 0.6,
        "METRIC_ABOVE_MAX": 0.6,
        "METRIC_RATE_EXCEEDED": 0.4,
        "METRIC_STUCK": 0.7,
        "METRIC_MISSING": 0.8,
        "SENSOR_DISAGREEMENT": 0.5,
        "DATA_GAPS": 0.5,
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
