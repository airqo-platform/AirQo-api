"""
Profile-driven diagnostic model.

Turns a DeviceProfile (ORM object or plain dict) into what the diagnostic engine
needs: components with their telemetry-mapped metrics and limits, dependency and
redundancy relationships, config defaults and the effective policy. It also reports
what a profile is missing for a complete analysis.

The only vocabulary the engine understands is the relationship types below and the
`connectivity` component type (the component responsible for delivering data).
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.services.diagnostics.policy import DEFAULT_POLICY, merge_policy, validate_policy_override
from app.utils.field_mappings import ensure_dict

# For dependency relationships, the value says which end is upstream: a fault upstream
# explains symptoms on the other end.
DEPENDENCY_RELATIONSHIPS = {"POWERS": "source", "COOLS": "source", "COMMUNICATES_VIA": "target"}
REDUNDANCY_RELATIONSHIPS = {"MEASURES_SAME_AS"}
TRANSMISSION_COMPONENT_TYPE = "connectivity"

_TIME_UNIT_SECONDS = {"ms": 0.001, "s": 1.0, "sec": 1.0, "second": 1.0, "seconds": 1.0,
                      "min": 60.0, "minute": 60.0, "minutes": 60.0, "h": 3600.0, "hour": 3600.0, "hours": 3600.0,
                      "d": 86400.0, "day": 86400.0, "days": 86400.0}


def _interval_unit(meta: Dict[str, Any]) -> str:
    return str(meta.get("unit") or "s").strip().lower()


class ProfileNotDiagnosableError(ValueError):
    def __init__(self, errors: List[str], warnings: Optional[List[str]] = None):
        self.errors = errors
        self.warnings = warnings or []
        super().__init__("; ".join(errors))


@dataclass
class MetricSpec:
    key: str
    label: str
    unit: Optional[str]
    expected_min: Optional[float]
    expected_max: Optional[float]
    max_rate_of_change: Optional[float]
    mapped: bool


@dataclass
class ComponentSpec:
    id: Optional[str]
    name: str
    component_type: str
    criticality: float
    metrics: List[MetricSpec]
    policy: Dict[str, Any]

    @property
    def mapped_metrics(self) -> List[MetricSpec]:
        return [m for m in self.metrics if m.mapped]


@dataclass
class RedundantPair:
    component_a: str
    metric_a: str
    component_b: str
    metric_b: str


@dataclass
class DiagnosticModel:
    profile_id: Optional[str]
    profile_name: Optional[str]
    components: Dict[str, ComponentSpec]
    upstream: Dict[str, List[str]]          # component -> components it depends on
    redundant_pairs: List[RedundantPair]
    transmission_components: List[str]
    config_mappings: Dict[str, Dict[str, Any]]
    policy: Dict[str, Any]
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def diagnosable(self) -> bool:
        return not self.errors

    def downstream(self, component_name: str) -> List[str]:
        return [name for name, ups in self.upstream.items() if component_name in ups]

    def readiness(self) -> Dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "profile_name": self.profile_name,
            "diagnosable": self.diagnosable,
            "errors": self.errors,
            "warnings": self.warnings,
            "evaluated_metrics": sorted(
                f"{c.name}.{m.key}" for c in self.components.values() for m in c.mapped_metrics
            ),
            "transmission_components": self.transmission_components,
            "dependencies": {k: v for k, v in self.upstream.items() if v},
            "redundant_pairs": [
                f"{p.component_a}.{p.metric_a} ~ {p.component_b}.{p.metric_b}" for p in self.redundant_pairs
            ],
        }


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _telemetry_index(telemetry_mappings: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Semantic key -> mapping metadata (label, unit)."""
    index: Dict[str, Dict[str, Any]] = {}
    for slot, meta in telemetry_mappings.items():
        if isinstance(meta, dict) and meta.get("key"):
            index[meta["key"]] = meta
        elif isinstance(meta, str) and meta:
            index[meta] = {"key": meta, "label": meta}
    return index


def _pair_metrics(a: ComponentSpec, b: ComponentSpec) -> Optional[Tuple[str, str]]:
    ma, mb = a.mapped_metrics, b.mapped_metrics
    if len(ma) == 1 and len(mb) == 1:
        return ma[0].key, mb[0].key
    by_unit_a = {m.unit: m for m in ma}
    by_unit_b = {m.unit: m for m in mb}
    common = [u for u in by_unit_a if u in by_unit_b]
    if len(common) == 1 and len(by_unit_a) == len(ma) and len(by_unit_b) == len(mb):
        return by_unit_a[common[0]].key, by_unit_b[common[0]].key
    return None


def build_model(profile: Any, policy_override: Optional[Dict[str, Any]] = None) -> DiagnosticModel:
    errors: List[str] = []
    warnings: List[str] = []

    def checked(override: Any, source: str) -> Optional[Dict[str, Any]]:
        """Return the override if valid; otherwise record why it was rejected and fall back to defaults."""
        if override is None:
            return None
        override_errors, override_warnings = validate_policy_override(override, path=source)
        errors.extend(override_errors)
        warnings.extend(override_warnings)
        return None if override_errors else override

    profile_meta = ensure_dict(_get(profile, "meta_data")) or {}
    policy = merge_policy(DEFAULT_POLICY, checked(profile_meta.get("diagnostics"), "meta_data.diagnostics"))
    policy = merge_policy(policy, checked(policy_override, "context.policy"))

    telemetry = _telemetry_index(ensure_dict(_get(profile, "telemetry_mappings")) or {})
    config_mappings = {
        slot: meta for slot, meta in (ensure_dict(_get(profile, "config_mappings")) or {}).items()
        if isinstance(meta, dict)
    }

    components: Dict[str, ComponentSpec] = {}
    id_to_name: Dict[str, str] = {}
    for comp in _get(profile, "components") or []:
        name = _get(comp, "name")
        comp_meta = ensure_dict(_get(comp, "meta_data")) or {}
        metrics = []
        for metric in _get(comp, "metrics") or []:
            if _get(metric, "is_telemetry_field", True) is False:
                continue
            key = _get(metric, "key")
            mapping = telemetry.get(key)
            metrics.append(MetricSpec(
                key=key,
                label=(mapping or {}).get("label") or key,
                unit=_get(metric, "unit") or (mapping or {}).get("unit"),
                expected_min=_get(metric, "expected_min"),
                expected_max=_get(metric, "expected_max"),
                max_rate_of_change=_get(metric, "max_rate_of_change"),
                mapped=mapping is not None,
            ))
        criticality = _get(comp, "criticality")
        spec = ComponentSpec(
            id=str(_get(comp, "id")) if _get(comp, "id") is not None else None,
            name=name,
            component_type=_get(comp, "component_type") or "unknown",
            criticality=float(criticality) if criticality is not None else 1.0,
            metrics=metrics,
            policy=merge_policy(policy, checked(comp_meta.get("diagnostics"), f"components.{name}.meta_data.diagnostics")),
        )
        components[name] = spec
        if spec.id:
            id_to_name[spec.id] = name

    upstream: Dict[str, List[str]] = {name: [] for name in components}
    redundant: List[RedundantPair] = []
    comms_targets: List[str] = []
    ignored_types = set()

    for rel in _get(profile, "relationships") or []:
        rel_type = str(_get(rel, "relationship_type") or "").upper()
        source = id_to_name.get(str(_get(rel, "source_component_id")))
        target = id_to_name.get(str(_get(rel, "target_component_id")))
        if source is None or target is None:
            warnings.append(f"Relationship {rel_type} references a component that is not in this profile; ignored.")
            continue
        if rel_type in DEPENDENCY_RELATIONSHIPS:
            up, down = (source, target) if DEPENDENCY_RELATIONSHIPS[rel_type] == "source" else (target, source)
            if up not in upstream[down]:
                upstream[down].append(up)
            if rel_type == "COMMUNICATES_VIA":
                comms_targets.append(target)
        elif rel_type in REDUNDANCY_RELATIONSHIPS:
            pair = _pair_metrics(components[source], components[target])
            if pair:
                redundant.append(RedundantPair(source, pair[0], target, pair[1]))
            else:
                warnings.append(
                    f"{rel_type} between '{source}' and '{target}': could not match metrics (each side needs one "
                    f"telemetry-mapped metric, or metrics with distinct matching units); agreement check skipped."
                )
        else:
            ignored_types.add(rel_type)

    if ignored_types:
        warnings.append(
            f"Unsupported relationship types ignored: {', '.join(sorted(ignored_types))}. Supported: "
            f"{', '.join(sorted(set(DEPENDENCY_RELATIONSHIPS) | REDUNDANCY_RELATIONSHIPS))}."
        )

    transmission = sorted({
        c.name for c in components.values() if c.component_type.lower() == TRANSMISSION_COMPONENT_TYPE
    } | set(comms_targets))

    # ── Readiness checks ──────────────────────────────────────────────────
    if not components:
        errors.append("Profile has no components; add components with metrics to enable diagnostics.")

    attached_keys = set()
    for comp in components.values():
        for metric in comp.metrics:
            attached_keys.add(metric.key)
            ref = f"'{comp.name}.{metric.key}'"
            if not metric.mapped:
                warnings.append(f"Metric {ref} is not mapped to any telemetry field; it cannot be evaluated.")
                continue
            if metric.expected_min is None and metric.expected_max is None:
                warnings.append(f"Metric {ref} has no expected_min/expected_max; range check skipped.")
            if metric.max_rate_of_change is None:
                warnings.append(f"Metric {ref} has no max_rate_of_change; rate check skipped.")
        if not comp.metrics and comp.name not in transmission:
            if model_has_dependents(upstream, comp.name):
                warnings.append(
                    f"Component '{comp.name}' has no metrics; its faults can only be inferred from dependent components."
                )
            else:
                warnings.append(f"Component '{comp.name}' has no metrics and no dependents; it is not evaluated.")

    if components and not any(c.mapped_metrics for c in components.values()) and not transmission:
        errors.append("No component metric is mapped to a telemetry field, so there is nothing to evaluate.")

    if not transmission:
        warnings.append(
            "No connectivity component (component_type 'connectivity' or target of COMMUNICATES_VIA); "
            "data gaps are attributed to the device as a whole."
        )

    interval_key = policy["completeness"]["interval_config_key"]
    interval_mapping = next((m for m in config_mappings.values() if m.get("key") == interval_key), None)
    if interval_mapping is None:
        warnings.append(
            f"No '{interval_key}' config mapping; data completeness is only checked when the device's interval is known."
        )
    elif _interval_unit(interval_mapping) not in _TIME_UNIT_SECONDS:
        warnings.append(
            f"Config '{interval_key}' has unsupported unit '{interval_mapping.get('unit')}'; completeness check skipped. "
            f"Supported units: {', '.join(sorted(_TIME_UNIT_SECONDS))}."
        )
    elif interval_mapping.get("default") in (None, ""):
        warnings.append(f"Config '{interval_key}' has no default; devices without a synced value skip the completeness check.")

    unmonitored = sorted(k for k in telemetry if k not in attached_keys)
    if unmonitored:
        warnings.append(f"Telemetry keys not attached to any component are not evaluated: {', '.join(unmonitored)}.")

    return DiagnosticModel(
        profile_id=str(_get(profile, "id")) if _get(profile, "id") is not None else None,
        profile_name=_get(profile, "name"),
        components=components,
        upstream=upstream,
        redundant_pairs=redundant,
        transmission_components=transmission,
        config_mappings=config_mappings,
        policy=policy,
        errors=errors,
        warnings=warnings,
    )


def model_has_dependents(upstream: Dict[str, List[str]], component_name: str) -> bool:
    return any(component_name in ups for ups in upstream.values())


def resolve_expected_interval_seconds(
    model: DiagnosticModel,
    device_config: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    """
    Reporting interval in seconds: the device's synced config value (by config slot) if present,
    otherwise the profile's config default. None when neither is known.
    """
    interval_key = model.policy["completeness"]["interval_config_key"]
    for slot, meta in model.config_mappings.items():
        if meta.get("key") != interval_key:
            continue
        raw = (device_config or {}).get(slot)
        if raw in (None, ""):
            raw = meta.get("default")
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return None
        factor = _TIME_UNIT_SECONDS.get(_interval_unit(meta))
        if factor is None:
            return None
        seconds = value * factor
        return seconds if seconds > 0 else None
    return None
