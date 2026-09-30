"""
Plain-language summary of a diagnosis.

Deterministic templates over the indicators, issues, trends and top diagnosis: the same
inputs always produce the same text, and every number in the text is a stored value.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from app.services.diagnostics.policy import DEFAULT_POLICY
from app.services.diagnostics.profile_model import DiagnosticModel
from app.services.diagnostics.trends import describe_trend

STATE_LABELS = {
    "HEALTHY": "Healthy",
    "DEGRADING": "Degrading",
    "SUSPICIOUS": "Suspicious",
    "LIKELY_FAILURE": "Likely failure",
    "FAILED": "Failed",
    "NO_DATA": "No data",
}
MAX_LISTED = 4


def _n(value: Any, digits: int = 2) -> str:
    if value is None:
        return "n/a"
    return f"{round(float(value), digits):g}"


def _time(iso: Optional[str]) -> str:
    if not iso:
        return "n/a"
    return datetime.fromisoformat(iso).strftime("%H:%M UTC")


def _unit(unit: Optional[str]) -> str:
    return f" {unit}" if unit else ""


def _label(model: Optional[DiagnosticModel], component: str, metric_key: Optional[str]) -> str:
    if model and metric_key and component in model.components:
        for metric in model.components[component].metrics:
            if metric.key == metric_key:
                return metric.label
    return metric_key or component


def _listed(items: Sequence[str]) -> str:
    items = list(dict.fromkeys(items))
    shown = "; ".join(items[:MAX_LISTED])
    return shown + (f"; and {len(items) - MAX_LISTED} more" if len(items) > MAX_LISTED else "")


def build_headline(result: Dict[str, Any]) -> str:
    state = STATE_LABELS.get(result["lifecycle_state"], result["lifecycle_state"].title())
    if result["lifecycle_state"] == "NO_DATA":
        return state
    headline = f"{state} ({_n(result['overall_health_score'], 0)}/100)"
    top = (result.get("top_diagnoses") or [None])[0]
    if top:
        headline += f": {top['title']} ({_n(top['confidence_percentage'], 0)}%)"
    return headline[:300]


def _charge_sentence(component: str, cycle: Dict[str, Any], model: Optional[DiagnosticModel]) -> str:
    label, unit = _label(model, component, cycle.get("metric")), _unit(cycle.get("unit"))
    text = f"{label} ranged {_n(cycle['min'])}–{_n(cycle['max'])}{unit} (lowest at {_time(cycle.get('min_at'))})"
    if cycle.get("hours_charging") is not None:
        text += f", charging for {_n(cycle['hours_charging'], 1)} h and discharging for {_n(cycle['hours_discharging'], 1)} h"
    if cycle.get("hours_below_min"):
        text += f"; {_n(cycle['hours_below_min'], 1)} h below the {_n(cycle.get('expected_min'))}{unit} minimum"
    elif cycle.get("hours_low_charge"):
        text += f"; {_n(cycle['hours_low_charge'], 1)} h below the low-charge line of {_n(cycle['low_charge_threshold'])}{unit}"
    return text + "."


def _coverage_sentence(coverage: Dict[str, Any], model: Optional[DiagnosticModel]) -> str:
    if coverage.get("hours_total") is None:
        return "No readings were received in this window."
    text = f"Data arrived in {coverage['hours_with_data']} of {coverage['hours_total']} hours"
    if coverage.get("expected_records"):
        text += f" ({coverage['records']} of {coverage['expected_records']} expected readings)"
    else:
        text += f" ({coverage['records']} readings)"
    outages = coverage.get("outage_count") or 0
    if not outages:
        return text + ", with no outages."
    text += (
        f". {outages} outage{'s' if outages != 1 else ''} totalling {_n(coverage['offline_hours'], 1)} h "
        f"(longest {_n(coverage['longest_outage_hours'], 1)} h)"
    )
    low, healthy = coverage.get("outages_after_low_charge") or 0, coverage.get("outages_with_healthy_charge") or 0
    charge_key = coverage.get("charge_metric")
    if low or healthy:
        charge_label = charge_key or "charge"
        if model and charge_key:
            charge_label = next(
                (m.label for c in model.components.values() for m in c.metrics if m.key == charge_key), charge_key
            )
        threshold = _n(coverage.get("low_charge_threshold"))
        if low and not healthy:
            text += f", {'all ' if low > 1 else ''}after {charge_label.lower()} dropped below {threshold}, which points to power"
        elif healthy and not low:
            text += f", {'all ' if healthy > 1 else ''}with a healthy {charge_label.lower()}, which points to the link rather than power"
        else:
            text += f": {low} after {charge_label.lower()} dropped below {threshold}, {healthy} with a healthy charge level"
    return text + "."


def _agreement_sentence(
    component: str, group: str, stats: Dict[str, Any], model: Optional[DiagnosticModel], policy: Dict[str, Any]
) -> str:
    other = group.split(":", 1)[1]
    label_a = _label(model, component, stats.get("metric"))
    label_b = _label(model, other, stats.get("other_metric"))
    unit = ""
    if model and component in model.components:
        unit = _unit(next((m.unit for m in model.components[component].metrics if m.key == stats.get("metric")), None))

    agreement = policy["agreement"]
    within = stats.get("within_tolerance_rate")
    agrees = (
        stats["correlation"] >= agreement["min_correlation"]
        and stats["relative_error"] <= agreement["max_divergence_ratio"]
        and (within is None or within >= agreement["min_within_tolerance_rate"])
    )
    text = (
        f"{label_a} and {label_b} {'agree' if agrees else 'disagree'} "
        f"(r={_n(stats['correlation'])}, mean error {_n(stats['mean_abs_error'])}{unit}"
    )
    bias = stats.get("bias") or 0.0
    if abs(bias) >= 0.5 * (stats.get("mean_abs_error") or 0.0) and abs(bias) > 0:
        text += f", {label_a} reads {_n(abs(bias))}{unit} {'higher' if bias > 0 else 'lower'}"
    if within is not None:
        text += f", {_n(within * 100, 0)}% of readings within tolerance"
    return text + ")."


def _issue_sentences(issues: Sequence[Dict[str, Any]], resolved_titles: Sequence[str]) -> List[str]:
    sentences: List[str] = []
    if not issues:
        sentences.append("No issues detected.")
    elif all("is_new" in i for i in issues):
        new = [i["title"] for i in issues if i["is_new"]]
        persisting = [f"{i['title']} (day {i['streak_days']})" for i in issues if not i["is_new"]]
        if new:
            sentences.append(f"New today: {_listed(new)}.")
        if persisting:
            sentences.append(f"Persisting: {_listed(persisting)}.")
    else:
        sentences.append(f"Issues: {_listed([i['title'] for i in issues])}.")
    if resolved_titles:
        sentences.append(f"Resolved since the previous diagnosis: {_listed(resolved_titles)}.")
    return sentences


def build_summary(
    result: Dict[str, Any],
    model: Optional[DiagnosticModel] = None,
    issues: Optional[Sequence[Dict[str, Any]]] = None,
    resolved_titles: Sequence[str] = (),
    trends: Sequence[Dict[str, Any]] = (),
) -> Dict[str, str]:
    """
    `issues` are issue dicts (title, and is_new/streak_days when known); when omitted, the
    evaluation's evidence titles are used. Returns {"headline", "summary"}.
    """
    headline = build_headline(result)
    if result["lifecycle_state"] == "NO_DATA":
        return {"headline": headline, "summary": "No readings were received in this window."}

    policy = model.policy if model else DEFAULT_POLICY
    indicators = result.get("indicators") or {}
    sentences: List[str] = []

    for component, groups in indicators.items():
        if "charge_cycle" in groups:
            sentences.append(_charge_sentence(component, groups["charge_cycle"], model))
        if "generation" in groups:
            gen = groups["generation"]
            sentences.append(
                f"{_label(model, component, gen.get('metric'))} peaked at {_n(gen['peak'])}{_unit(gen.get('unit'))} "
                f"at {_time(gen.get('peak_at'))} and was active for {_n(gen['hours_active'], 1)} h."
            )
    coverage = next((g["coverage"] for g in indicators.values() if "coverage" in g), None)
    if coverage:
        sentences.append(_coverage_sentence(coverage, model))
    for component, groups in indicators.items():
        for group, stats in groups.items():
            if group.startswith("agreement:"):
                sentences.append(_agreement_sentence(component, group, stats, model, policy))

    if issues is None:
        issues = [{"title": e["title"]} for e in result.get("active_evidences") or []]
    sentences.extend(_issue_sentences(issues, resolved_titles))

    for trend in trends:
        if trend["status"] == "degrading":
            sentences.append(f"Trend: {describe_trend(trend)}.")
    improving = [t["subject"] for t in trends if t["status"] == "improving"]
    if improving:
        sentences.append(f"Improving over the last days: {_listed(improving)}.")

    top = (result.get("top_diagnoses") or [None])[0]
    if top and top.get("recommended_action"):
        sentences.append(f"Recommended: {top['recommended_action']}")

    return {"headline": headline, "summary": " ".join(sentences)}
