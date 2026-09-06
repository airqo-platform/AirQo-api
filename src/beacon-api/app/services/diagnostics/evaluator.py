from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.services.diagnostics.features import FeatureExtractor
from app.services.diagnostics.evidence import EvidenceEngine, EvidenceFact
from app.services.diagnostics.reasoner import DiagnosticReasoner
from app.models.health import DeviceHealthSnapshot
from app.models.diagnostics import DiagnosticTemplate, CauseDefinition, DiagnosticHypothesisRule


class DiagnosticEvaluator:
    """
    End-to-end evaluation orchestrator for IoT diagnostics in Beacon.
    Executes feature extraction, evidence evaluation, probabilistic reasoning,
    subsystem score aggregation, and lifecycle state management.
    """

    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.evidence_engine = EvidenceEngine()
        self.reasoner = DiagnosticReasoner()

    def evaluate_telemetry(
        self,
        device_id: str,
        telemetry_records: List[Dict[str, Any]],
        candidate_causes: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]] = None,
        subsystem_weights: Optional[Dict[str, float]] = None,
        window_hours: float = 24.0,
    ) -> Dict[str, Any]:
        """
        Runs pure in-memory diagnostic evaluation given telemetry records and candidate cause definitions.
        """
        context = context or {}
        subsystem_weights = subsystem_weights or {
            "power": 0.35,
            "sensors": 0.35,
            "connectivity": 0.15,
            "cooling": 0.15,
        }

        # 1. Feature Extraction
        features = self.feature_extractor.extract_all_features(telemetry_records)

        # 2. Evidence Evaluation
        evidences: List[EvidenceFact] = self.evidence_engine.evaluate(features, context)

        # 3. Diagnostic Reasoning
        top_diagnoses = self.reasoner.diagnose(evidences, candidate_causes)

        # 4. Subsystem Score Computation (Dynamically populated based on active metrics)
        metric_keys = set(features.get("metrics", {}).keys())
        subsystem_scores: Dict[str, float] = {}

        has_power = any(k in metric_keys for k in ("battery_voltage", "battery_v", "solar_voltage", "solar_v", "solar_current", "solar_i", "field7", "field8", "field9"))
        has_sensors = any(k in metric_keys for k in ("pm2_5", "pm2_5_sensor_1", "pm2_5_sensor1", "pm2_5_sensor_2", "pm2_5_sensor2", "pm10_sensor1", "pm10_sensor2", "temperature", "humidity", "field1", "field2", "field3", "field4", "field5", "field6"))
        has_cooling = any(k in metric_keys for k in ("refrigerator_temp", "chamber_temp", "compressor_current", "door_open"))
        has_connectivity = "missing_rate" in features or any(k in metric_keys for k in ("rssi", "csq", "signal"))

        if has_power:
            subsystem_scores["power"] = 100.0
        if has_sensors:
            subsystem_scores["sensors"] = 100.0
        if has_cooling:
            subsystem_scores["cooling"] = 100.0
        if has_connectivity and features.get("missing_rate", 0.0) > 0.05:
            subsystem_scores["connectivity"] = 100.0

        # Fallback if no specific subsystem matched
        if not subsystem_scores:
            subsystem_scores["general"] = 100.0

        for ev in evidences:
            conf = ev.confidence
            if ev.code == "EVID_BATTERY_RAPID_NIGHT_DISCHARGE" and "power" in subsystem_scores:
                subsystem_scores["power"] = max(0.0, subsystem_scores["power"] - (conf * 45.0))
            elif ev.code == "EVID_BATTERY_VOLTAGE_CRITICAL_LOW" and "power" in subsystem_scores:
                subsystem_scores["power"] = max(0.0, subsystem_scores["power"] - (conf * 60.0))
            elif ev.code == "EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY" and "power" in subsystem_scores:
                subsystem_scores["power"] = max(0.0, subsystem_scores["power"] - (conf * 40.0))
            elif ev.code == "EVID_PM_SENSORS_DIVERGING" and "sensors" in subsystem_scores:
                subsystem_scores["sensors"] = max(0.0, subsystem_scores["sensors"] - (conf * 50.0))
            elif "STUCK_CONSTANT_VALUE" in ev.code and "sensors" in subsystem_scores:
                subsystem_scores["sensors"] = max(0.0, subsystem_scores["sensors"] - (conf * 70.0))
            elif ev.code == "EVID_COLD_CHAIN_TEMPERATURE_BREACH" and "cooling" in subsystem_scores:
                subsystem_scores["cooling"] = max(0.0, subsystem_scores["cooling"] - (conf * 65.0))
            elif ev.code == "EVID_COMPRESSOR_NOT_RUNNING_DURING_WARM_TEMP" and "cooling" in subsystem_scores:
                subsystem_scores["cooling"] = max(0.0, subsystem_scores["cooling"] - (conf * 80.0))
            elif ev.code == "EVID_HIGH_TELEMETRY_PACKET_LOSS" and "connectivity" in subsystem_scores:
                subsystem_scores["connectivity"] = max(0.0, subsystem_scores["connectivity"] - (conf * 50.0))

        for k in subsystem_scores:
            subsystem_scores[k] = round(subsystem_scores[k], 1)

        # 5. Weighted Overall Health Score
        total_weight = sum(subsystem_weights.get(k, 0.25) for k in subsystem_scores)
        if total_weight > 0:
            weighted_sum = sum(subsystem_scores[k] * subsystem_weights.get(k, 0.25) for k in subsystem_scores)
            overall_score = round(weighted_sum / total_weight, 1)
        else:
            overall_score = 100.0

        # 6. Lifecycle State Machine
        if overall_score >= 85.0:
            lifecycle_state = "HEALTHY"
        elif overall_score >= 70.0:
            lifecycle_state = "DEGRADING"
        elif top_diagnoses and top_diagnoses[0]["confidence_percentage"] >= 85.0:
            lifecycle_state = "LIKELY_FAILURE"
        elif overall_score >= 50.0 or (top_diagnoses and top_diagnoses[0]["confidence_percentage"] >= 70.0):
            lifecycle_state = "SUSPICIOUS"
        elif overall_score >= 20.0:
            lifecycle_state = "LIKELY_FAILURE"
        else:
            lifecycle_state = "FAILED"

        # Detect symptoms
        detected_symptoms = []
        for ev in evidences:
            if "DISCHARGE" in ev.code or "CRITICAL" in ev.code:
                detected_symptoms.append("Overnight Power Loss")
            elif "DIVERGING" in ev.code:
                detected_symptoms.append("Dual Sensor Divergence")
            elif "TEMPERATURE_BREACH" in ev.code:
                detected_symptoms.append("Cold Chain Temperature Excursion")

        return {
            "device_id": device_id,
            "overall_health_score": overall_score,
            "lifecycle_state": lifecycle_state,
            "subsystem_scores": subsystem_scores,
            "active_evidences": [e.to_dict() for e in evidences],
            "detected_symptoms": list(set(detected_symptoms)),
            "top_diagnoses": top_diagnoses,
            "evaluated_window_hours": window_hours,
            "timestamp": datetime.now(timezone.utc),
        }

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
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot
