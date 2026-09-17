from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.services.diagnostics.features import FeatureExtractor
from app.services.diagnostics.evidence import DEVICE_COMPONENT, EvidenceEngine, EvidenceFact
from app.services.diagnostics.indicators import compute_indicators
from app.services.diagnostics.profile_model import (
    DiagnosticModel,
    ProfileNotDiagnosableError,
    build_model,
    resolve_expected_interval_seconds,
)
from app.services.diagnostics.root_cause import RootCauseAnalyzer
from app.models.health import DeviceHealthSnapshot

NO_PROFILE_ERROR = (
    "No device profile could be resolved. Diagnostics are driven by the profile's telemetry mappings, "
    "components (with metric limits) and relationships."
)


class DiagnosticEvaluator:
    """
    End-to-end evaluation orchestrator for IoT diagnostics in Beacon.
    Everything device-specific (which metrics exist, their limits, how components depend on
    each other, how often the device reports) comes from the device profile.
    """

    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.evidence_engine = EvidenceEngine()
        self.root_cause = RootCauseAnalyzer()

    def evaluate_telemetry(
        self,
        device_id: str,
        telemetry_records: List[Dict[str, Any]],
        profile: Optional[Any] = None,
        context: Optional[Dict[str, Any]] = None,
        window_hours: float = 24.0,
        window_seconds: Optional[float] = None,
        device_config: Optional[Dict[str, Any]] = None,
        model: Optional[DiagnosticModel] = None,
        window_start: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates telemetry (already mapped to the profile's semantic keys) against the profile.

        context may carry `expected_interval_seconds` (overrides the configured reporting interval)
        and `policy` (overrides for the generic check policy).
        window_seconds, when given, is the full period the records should cover (e.g. 86400 for a day);
        otherwise completeness is measured over the span of the records. window_start anchors that
        window (hour buckets and leading outages); it defaults to the first record's hour.
        Raises ProfileNotDiagnosableError when no usable profile is available.
        """
        context = context or {}
        if model is None:
            if profile is None:
                raise ProfileNotDiagnosableError([NO_PROFILE_ERROR])
            model = build_model(profile, context.get("policy"))
        if not model.diagnosable:
            raise ProfileNotDiagnosableError(model.errors, model.warnings)

        policy = model.policy
        interval = context.get("expected_interval_seconds") or resolve_expected_interval_seconds(model, device_config)

        # 1. Feature Extraction
        features = self.feature_extractor.extract_all_features(
            telemetry_records,
            expected_interval_seconds=interval,
            window_seconds=window_seconds,
            rate_window_seconds=float(policy["rate"]["window_minutes"]) * 60.0,
            rate_min_samples=int(policy["rate"]["min_samples_per_window"]),
        )

        # 2. Indicators: continuous per-component measurements (cycles, coverage, agreement)
        indicators = compute_indicators(
            telemetry_records, features, model,
            expected_interval_seconds=interval, window_seconds=window_seconds, window_start=window_start,
        )

        # 3. Evidence from profile-driven checks
        evidences: List[EvidenceFact] = self.evidence_engine.evaluate(
            features, model, telemetry_records, expected_interval_seconds=interval, indicators=indicators
        )

        # 4. Root causes over the component graph
        top_diagnoses = self.root_cause.analyze(evidences, model)

        # 5. Component scores and criticality-weighted overall score
        if features["record_count"]:
            component_scores = self._component_scores(features, evidences, model)
            overall_score = self._overall_score(component_scores, model)
            lifecycle_state = self.lifecycle_state(overall_score, top_diagnoses, policy["lifecycle"])
        else:
            component_scores, overall_score, lifecycle_state = {}, 0.0, "NO_DATA"

        return {
            "device_id": device_id,
            "profile_id": model.profile_id,
            "profile_name": model.profile_name,
            "overall_health_score": overall_score,
            "lifecycle_state": lifecycle_state,
            "subsystem_scores": component_scores,
            "active_evidences": [e.to_dict() for e in evidences],
            "detected_symptoms": list(dict.fromkeys(e.title for e in evidences)),
            "top_diagnoses": top_diagnoses,
            "indicators": indicators,
            "data_completeness": {
                "records": features["record_count"],
                "expected_records": features["expected_records"],
                "missing_rate": features["missing_rate"],
                "expected_interval_seconds": interval,
            },
            "profile_warnings": model.warnings,
            "evaluated_window_hours": window_hours,
            "timestamp": datetime.now(timezone.utc),
        }

    @staticmethod
    def _component_scores(
        features: Dict[str, Any], evidences: List[EvidenceFact], model: DiagnosticModel
    ) -> Dict[str, float]:
        scored = {name for name, c in model.components.items() if c.mapped_metrics}
        if features.get("missing_rate") is not None:
            scored.update(model.transmission_components)

        scores: Dict[str, float] = {name: 100.0 for name in scored}
        for ev in evidences:
            for name in [ev.component_name] + ev.related_components:
                component = model.components.get(name)
                policy = component.policy if component else model.policy
                impact = policy["impact"].get(ev.check, 0.5)
                scores[name] = scores.get(name, 100.0) * (1.0 - min(1.0, ev.confidence * impact))
        return {name: round(score, 1) for name, score in sorted(scores.items())}

    @staticmethod
    def _overall_score(component_scores: Dict[str, float], model: DiagnosticModel) -> float:
        if not component_scores:
            return 100.0
        weights = {
            name: (model.components[name].criticality if name in model.components
                   else model.policy["device_level_criticality"])
            for name in component_scores
        }
        total = sum(weights.values())
        if total <= 0:
            return round(sum(component_scores.values()) / len(component_scores), 1)
        return round(sum(component_scores[n] * weights[n] for n in component_scores) / total, 1)

    @staticmethod
    def lifecycle_state(score: float, diagnoses: List[Dict[str, Any]], bands: Dict[str, float]) -> str:
        top_confidence = diagnoses[0]["confidence_percentage"] if diagnoses else 0.0
        if score >= bands["healthy"]:
            return "HEALTHY"
        if score >= bands["degrading"]:
            return "DEGRADING"
        if top_confidence >= bands["high_confidence"]:
            return "LIKELY_FAILURE"
        if score >= bands["suspicious"] or top_confidence >= bands["medium_confidence"]:
            return "SUSPICIOUS"
        if score >= bands["likely_failure"]:
            return "LIKELY_FAILURE"
        return "FAILED"

    def save_snapshot(
        self,
        db: Session,
        evaluation_result: Dict[str, Any],
    ) -> DeviceHealthSnapshot:
        """Persists evaluation result into device_health_snapshots table."""
        snapshot = DeviceHealthSnapshot(
            device_id=evaluation_result["device_id"],
            overall_health_score=evaluation_result["overall_health_score"],
            lifecycle_state=evaluation_result["lifecycle_state"],
            subsystem_scores=evaluation_result["subsystem_scores"],
            active_evidences=evaluation_result["active_evidences"],
            detected_symptoms=evaluation_result["detected_symptoms"],
            top_diagnoses=evaluation_result["top_diagnoses"],
            evaluated_window_hours=evaluation_result["evaluated_window_hours"],
            metadata_context={
                "profile_id": evaluation_result.get("profile_id"),
                "data_completeness": evaluation_result.get("data_completeness"),
                "indicators": evaluation_result.get("indicators"),
            },
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot
