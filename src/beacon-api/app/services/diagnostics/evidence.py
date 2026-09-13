from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from app.services.diagnostics.features import FeatureExtractor
from app.services.diagnostics.policy import severity_for
from app.services.diagnostics.profile_model import DiagnosticModel, ComponentSpec, MetricSpec

DEVICE_COMPONENT = "device"


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
    - per MEASURES_SAME_AS pair: sensor agreement
    - per connectivity component (or the device): data completeness against the reporting interval
    """

    def evaluate(
        self,
        features: Dict[str, Any],
        model: Optional[DiagnosticModel] = None,
        records: Optional[List[Dict[str, Any]]] = None,
        expected_interval_seconds: Optional[float] = None,
    ) -> List[EvidenceFact]:
        if model is None:
            return []

        evidences: List[EvidenceFact] = []
        for component in model.components.values():
            for metric in component.mapped_metrics:
                evidences.extend(self._metric_checks(features, component, metric))

        evidences.extend(self._agreement_checks(model, records or []))
        evidences.extend(self._completeness_checks(features, model, expected_interval_seconds))
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
        observed_rate = stats.get("max_rate_per_hour", 0.0)
        if max_rate is not None and "METRIC_RATE_EXCEEDED" not in disabled and observed_rate > max_rate:
            excess = (observed_rate - max_rate) / max_rate if max_rate > 0 else 1.0
            direction = "rising" if stats.get("max_rate_signed", 0.0) > 0 else "falling"
            found.append(self._fact(
                "METRIC_RATE_EXCEEDED", component, 0.5 + 0.5 * excess,
                f"{metric.label} changing faster than expected",
                f"{metric.label} {direction} at {_fmt(observed_rate, metric.unit)}/h "
                f"(limit {_fmt(max_rate, metric.unit)}/h)",
                {"observed_rate_per_hour": stats.get("max_rate_signed"), "limit_per_hour": max_rate},
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

    def _agreement_checks(self, model: DiagnosticModel, records: List[Dict[str, Any]]) -> List[EvidenceFact]:
        found: List[EvidenceFact] = []
        for pair in model.redundant_pairs:
            comp_a = model.components[pair.component_a]
            comp_b = model.components[pair.component_b]
            if "SENSOR_DISAGREEMENT" in set(comp_a.policy.get("disabled_checks") or []):
                continue
            policy = comp_a.policy["agreement"]
            series_a, series_b = FeatureExtractor.paired_values(records, pair.metric_a, pair.metric_b)
            if len(series_a) < policy["min_pairs"]:
                continue
            agreement = FeatureExtractor.calculate_cross_sensor_agreement(series_a, series_b)
            corr, div = agreement["correlation"], agreement["divergence_ratio"]
            if corr >= policy["min_correlation"] and div <= policy["max_divergence_ratio"]:
                continue
            label_a = next((m.label for m in comp_a.metrics if m.key == pair.metric_a), pair.metric_a)
            label_b = next((m.label for m in comp_b.metrics if m.key == pair.metric_b), pair.metric_b)
            found.append(self._fact(
                "SENSOR_DISAGREEMENT", comp_a, (1.0 - max(0.0, corr)) + div * 0.5,
                f"{label_a} and {label_b} disagree",
                f"{label_a} and {label_b} disagree (r={corr:.2f}, mean abs diff={agreement['mean_absolute_error']:.2f}, "
                f"divergence={div * 100:.0f}%)",
                agreement,
                metric=f"{pair.metric_a}~{pair.metric_b}",
                criticality=max(comp_a.criticality, comp_b.criticality),
                related=[comp_b.name],
            ))
        return found

    def _completeness_checks(
        self,
        features: Dict[str, Any],
        model: DiagnosticModel,
        expected_interval_seconds: Optional[float],
    ) -> List[EvidenceFact]:
        missing_rate = features.get("missing_rate")
        if missing_rate is None:
            return []
        policy = model.policy
        if missing_rate <= policy["completeness"]["max_missing_rate"]:
            return []

        targets = [model.components[name] for name in model.transmission_components] or [
            ComponentSpec(
                id=None,
                name=DEVICE_COMPONENT,
                component_type=DEVICE_COMPONENT,
                criticality=policy["device_level_criticality"],
                metrics=[],
                policy=policy,
            )
        ]
        interval = f" at a {expected_interval_seconds:g}s interval" if expected_interval_seconds else ""
        found = []
        for component in targets:
            if "DATA_GAPS" in set(component.policy.get("disabled_checks") or []):
                continue
            found.append(self._fact(
                "DATA_GAPS", component, missing_rate,
                "Data gaps",
                f"{missing_rate * 100:.1f}% of expected readings missing "
                f"({features['record_count']} of {features['expected_records']}{interval})",
                {
                    "missing_rate": missing_rate,
                    "records": features["record_count"],
                    "expected_records": features["expected_records"],
                    "expected_interval_seconds": expected_interval_seconds,
                },
            ))
        return found
