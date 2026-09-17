from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from app.services.diagnostics.features import FeatureExtractor
from app.services.diagnostics.indicators import DEVICE_COMPONENT, compute_indicators
from app.services.diagnostics.policy import severity_for
from app.services.diagnostics.profile_model import CHARGE_LEVEL_ROLE, DiagnosticModel, ComponentSpec, MetricSpec

PAIR_CHECKS = {"SENSOR_DISAGREEMENT", "SENSOR_ERROR_MARGIN"}


@dataclass
class EvidenceFact:
    code: str                  # Unique per finding, e.g. "METRIC_BELOW_MIN:device_battery.battery_voltage"
    component_name: str
    description: str
    confidence: float          # 0.0 to 1.0
    value: Any
    check: str = ""            # Generic check type, e.g. "METRIC_BELOW_MIN"
    component_type: Optional[str] = None
    metric: Optional[str] = None
    severity: str = "MEDIUM"
    title: str = ""
    related_components: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "check": self.check,
            "component_name": self.component_name,
            "component_type": self.component_type,
            "metric": self.metric,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "confidence": round(self.confidence, 4),
            "value": self.value,
            "related_components": self.related_components,
        }


def _fmt(value: Optional[float], unit: Optional[str]) -> str:
    if value is None:
        return "n/a"
    return f"{value:g}{' ' + unit if unit else ''}"


class EvidenceEngine:
    """
    Runs generic checks driven entirely by the device profile:
    - per metric: range (expected_min/max), rate of change, stuck value, missing readings
    - per MEASURES_SAME_AS pair: sensor agreement (shape) and error margin (tolerance)
    - per connectivity component (or the device): data completeness against the reporting interval
    - per power source: outages that followed a low charge level
    """

    def evaluate(
        self,
        features: Dict[str, Any],
        model: Optional[DiagnosticModel] = None,
        records: Optional[List[Dict[str, Any]]] = None,
        expected_interval_seconds: Optional[float] = None,
        indicators: Optional[Dict[str, Dict[str, Dict[str, Any]]]] = None,
    ) -> List[EvidenceFact]:
        if model is None:
            return []
        if indicators is None:
            indicators = compute_indicators(records or [], features, model, expected_interval_seconds)

        evidences: List[EvidenceFact] = []
        for component in model.components.values():
            for metric in component.mapped_metrics:
                evidences.extend(self._metric_checks(features, component, metric))

        evidences.extend(self._agreement_checks(model, indicators))
        evidences.extend(self._completeness_checks(features, model, expected_interval_seconds, indicators))
        evidences.extend(self._power_outage_checks(model, indicators))
        return evidences

    # ── Per-metric checks ─────────────────────────────────────────────────

    def _fact(
        self,
        check: str,
        component: ComponentSpec,
        confidence: float,
        title: str,
        description: str,
        value: Any,
        metric: Optional[str] = None,
        criticality: Optional[float] = None,
        related: Optional[List[str]] = None,
    ) -> EvidenceFact:
        suffix = f".{metric}" if metric else ""
        confidence = max(0.0, min(1.0, confidence))
        return EvidenceFact(
            code=f"{check}:{component.name}{suffix}",
            component_name=component.name,
            description=description,
            confidence=confidence,
            value=value,
            check=check,
            component_type=component.component_type,
            metric=metric,
            severity=severity_for(
                component.criticality if criticality is None else criticality, confidence, component.policy
            ),
            title=title,
            related_components=related or [],
        )

    def _metric_checks(
        self, features: Dict[str, Any], component: ComponentSpec, metric: MetricSpec
    ) -> List[EvidenceFact]:
        policy = component.policy
        disabled = set(policy.get("disabled_checks") or [])
        stats = features.get("metrics", {}).get(metric.key)
        found: List[EvidenceFact] = []

        if not stats or not stats.get("count"):
            if features.get("record_count") and "METRIC_MISSING" not in disabled:
                found.append(self._fact(
                    "METRIC_MISSING", component, 1.0,
                    f"No {metric.label} readings",
                    f"No {metric.label} readings although the device sent {features['record_count']} records",
                    {"records": features["record_count"]},
                    metric=metric.key,
                ))
            return found

        range_policy = policy["range"]
        violations = FeatureExtractor.calculate_range_violations(
            stats.get("values", []), metric.expected_min, metric.expected_max
        )
        for check, rate_key, bound, observed, word in (
            ("METRIC_BELOW_MIN", "below_rate", metric.expected_min, stats["min"], "below expected minimum"),
            ("METRIC_ABOVE_MAX", "above_rate", metric.expected_max, stats["max"], "above expected maximum"),
        ):
            rate = violations[rate_key]
            if bound is None or check in disabled or rate < range_policy["min_violation_rate"]:
                continue
            found.append(self._fact(
                check, component, rate / range_policy["full_confidence_violation_rate"],
                f"{metric.label} {word}",
                f"{metric.label} {word} {_fmt(bound, metric.unit)} in {rate * 100:.1f}% of readings "
                f"(observed {_fmt(observed, metric.unit)})",
                {"observed": observed, "limit": bound, "violation_rate": rate},
                metric=metric.key,
            ))

        max_rate = metric.max_rate_of_change
        if metric.role == CHARGE_LEVEL_ROLE:
            # Charging as fast as the source allows is normal; only the discharge rate is limited.
            observed_rate, signed_rate = stats.get("max_fall_per_hour", 0.0), -stats.get("max_fall_per_hour", 0.0)
            title, verb = f"{metric.label} discharging faster than expected", "discharging"
        else:
            observed_rate, signed_rate = stats.get("max_rate_per_hour", 0.0), stats.get("max_rate_signed", 0.0)
            title, verb = f"{metric.label} changing faster than expected", ("rising" if signed_rate > 0 else "falling")
        if max_rate is not None and "METRIC_RATE_EXCEEDED" not in disabled and observed_rate > max_rate:
            excess = (observed_rate - max_rate) / max_rate if max_rate > 0 else 1.0
            found.append(self._fact(
                "METRIC_RATE_EXCEEDED", component, 0.5 + 0.5 * excess,
                title,
                f"{metric.label} {verb} at {_fmt(observed_rate, metric.unit)}/h "
                f"(limit {_fmt(max_rate, metric.unit)}/h)",
                {"observed_rate_per_hour": signed_rate, "limit_per_hour": max_rate},
                metric=metric.key,
            ))

        if (
            "METRIC_STUCK" not in disabled
            and stats["count"] >= policy["stuck"]["min_samples"]
            and stats["std"] == 0.0
        ):
            found.append(self._fact(
                "METRIC_STUCK", component, 1.0,
                f"{metric.label} stuck at a constant value",
                f"{metric.label} stayed at {_fmt(stats['mean'], metric.unit)} for all {stats['count']} readings",
                stats["mean"],
                metric=metric.key,
            ))
        return found

    # ── Relationship checks ───────────────────────────────────────────────

    def _agreement_checks(
        self, model: DiagnosticModel, indicators: Dict[str, Dict[str, Dict[str, Any]]]
    ) -> List[EvidenceFact]:
        found: List[EvidenceFact] = []
        for pair in model.redundant_pairs:
            comp_a = model.components[pair.component_a]
            comp_b = model.components[pair.component_b]
            disabled = set(comp_a.policy.get("disabled_checks") or [])
            policy = comp_a.policy["agreement"]
            stats = indicators.get(comp_a.name, {}).get(f"agreement:{comp_b.name}")
            if not stats or stats["paired_count"] < policy["min_pairs"]:
                continue
            metric_a = next((m for m in comp_a.metrics if m.key == pair.metric_a), None)
            label_a = metric_a.label if metric_a else pair.metric_a
            label_b = next((m.label for m in comp_b.metrics if m.key == pair.metric_b), pair.metric_b)
            common = dict(
                metric=f"{pair.metric_a}~{pair.metric_b}",
                criticality=max(comp_a.criticality, comp_b.criticality),
                related=[comp_b.name],
            )

            corr, div = stats["correlation"], stats["relative_error"]
            if "SENSOR_DISAGREEMENT" not in disabled and (
                corr < policy["min_correlation"] or div > policy["max_divergence_ratio"]
            ):
                found.append(self._fact(
                    "SENSOR_DISAGREEMENT", comp_a, (1.0 - max(0.0, corr)) + div * 0.5,
                    f"{label_a} and {label_b} disagree",
                    f"{label_a} and {label_b} disagree (r={corr:.2f}, mean abs diff={stats['mean_abs_error']:.2f}, "
                    f"divergence={div * 100:.0f}%)",
                    stats,
                    **common,
                ))

            within = stats.get("within_tolerance_rate")
            min_within = policy["min_within_tolerance_rate"]
            if "SENSOR_ERROR_MARGIN" not in disabled and within is not None and within < min_within:
                allowed = " / ".join(
                    s for s in (
                        f"±{_fmt(pair.tolerance_abs, metric_a.unit if metric_a else None)}" if pair.tolerance_abs is not None else "",
                        f"±{pair.tolerance_rel * 100:.0f}%" if pair.tolerance_rel is not None else "",
                    ) if s
                )
                found.append(self._fact(
                    "SENSOR_ERROR_MARGIN", comp_a, (min_within - within) / min_within,
                    f"{label_a} and {label_b} outside tolerance",
                    f"Only {within * 100:.0f}% of paired readings within tolerance ({allowed}); "
                    f"mean abs error {stats['mean_abs_error']:.2f}, bias {stats['bias']:+.2f}",
                    stats,
                    **common,
                ))
        return found

    def _coverage_targets(self, model: DiagnosticModel) -> List[ComponentSpec]:
        return [model.components[name] for name in model.transmission_components] or [
            ComponentSpec(
                id=None,
                name=DEVICE_COMPONENT,
                component_type=DEVICE_COMPONENT,
                criticality=model.policy["device_level_criticality"],
                metrics=[],
                policy=model.policy,
            )
        ]

    def _completeness_checks(
        self,
        features: Dict[str, Any],
        model: DiagnosticModel,
        expected_interval_seconds: Optional[float],
        indicators: Dict[str, Dict[str, Dict[str, Any]]],
    ) -> List[EvidenceFact]:
        missing_rate = features.get("missing_rate")
        if missing_rate is None or missing_rate <= model.policy["completeness"]["max_missing_rate"]:
            return []

        interval = f" at a {expected_interval_seconds:g}s interval" if expected_interval_seconds else ""
        found = []
        for component in self._coverage_targets(model):
            if "DATA_GAPS" in set(component.policy.get("disabled_checks") or []):
                continue
            coverage = indicators.get(component.name, {}).get("coverage", {})
            outage_note = ""
            if coverage.get("outage_count"):
                outage_note = f"; {coverage['outage_count']} outage(s) totalling {coverage['offline_hours']:g} h"
                if coverage.get("outages_after_low_charge"):
                    outage_note += f", {coverage['outages_after_low_charge']} after low charge"
            found.append(self._fact(
                "DATA_GAPS", component, missing_rate,
                "Data gaps",
                f"{missing_rate * 100:.1f}% of expected readings missing "
                f"({features['record_count']} of {features['expected_records']}{interval}){outage_note}",
                {
                    "missing_rate": missing_rate,
                    "records": features["record_count"],
                    "expected_records": features["expected_records"],
                    "expected_interval_seconds": expected_interval_seconds,
                    "outage_count": coverage.get("outage_count"),
                    "offline_hours": coverage.get("offline_hours"),
                    "outages_after_low_charge": coverage.get("outages_after_low_charge"),
                    "outages_with_healthy_charge": coverage.get("outages_with_healthy_charge"),
                },
            ))
        return found

    def _power_outage_checks(
        self, model: DiagnosticModel, indicators: Dict[str, Dict[str, Dict[str, Any]]]
    ) -> List[EvidenceFact]:
        """An outage that followed a low charge level is evidence against the power source, not the link."""
        found: List[EvidenceFact] = []
        seen = set()
        for target in self._coverage_targets(model):
            coverage = indicators.get(target.name, {}).get("coverage", {})
            low = coverage.get("outages_after_low_charge") or 0
            feeding = model.charge_level_feeding(target.name)
            if not low or feeding is None or feeding[0].name in seen:
                continue
            source, metric = feeding
            if "LOW_CHARGE_OUTAGE" in set(source.policy.get("disabled_checks") or []):
                continue
            seen.add(source.name)
            total = coverage.get("outage_count") or low
            found.append(self._fact(
                "LOW_CHARGE_OUTAGE", source, 0.5 + 0.5 * (low / total),
                f"Outages after low {metric.label.lower()}",
                f"{low} of {total} outage(s) on {target.name} began after {metric.label.lower()} dropped below "
                f"{_fmt(coverage.get('low_charge_threshold'), metric.unit)}",
                {
                    "outages_after_low_charge": low,
                    "outage_count": total,
                    "low_charge_threshold": coverage.get("low_charge_threshold"),
                    "offline_hours": coverage.get("offline_hours"),
                },
                metric=metric.key,
                related=[target.name] if target.name != DEVICE_COMPONENT else [],
            ))
        return found
