import unittest
from unittest.mock import patch
import numpy as np
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.services.diagnostics.features import FeatureExtractor
from app.services.diagnostics.evidence import EvidenceEngine, EvidenceFact
from app.services.diagnostics.reasoner import DiagnosticReasoner
from app.services.diagnostics.evaluator import DiagnosticEvaluator
from app.services.diagnostics.seeds import get_default_candidate_causes
from app.services.diagnostics.profile_model import (
    ProfileNotDiagnosableError,
    build_model,
    resolve_expected_interval_seconds,
)
from tests.diagnostics_fixtures import COMM_ID, healthy_pm, lowcost_profile, make_records, profile_orm
from main import app


class TestDiagnosticsFeatureExtractor(unittest.TestCase):
    def test_cross_sensor_agreement_perfect(self):
        series_a = [10.0, 15.0, 20.0, 25.0, 30.0]
        series_b = [10.1, 14.9, 20.2, 24.8, 30.1]
        res = FeatureExtractor.calculate_cross_sensor_agreement(series_a, series_b)
        self.assertGreaterEqual(res["correlation"], 0.99)
        self.assertLess(res["divergence_ratio"], 0.05)
        self.assertEqual(res["valid_pairs"], 5)

    def test_cross_sensor_agreement_divergent(self):
        # Sensor A rises, Sensor B stays low or drops
        series_a = [10.0, 30.0, 50.0, 70.0, 90.0]
        series_b = [10.0, 12.0, 11.0, 13.0, 10.0]
        res = FeatureExtractor.calculate_cross_sensor_agreement(series_a, series_b)
        self.assertLess(res["correlation"], 0.40)
        self.assertGreater(res["divergence_ratio"], 0.40)

    def test_discharge_gradient(self):
        # Drops by 0.5V per hour over 4 hours
        start_ts = 1700000000
        timestamps = [start_ts + (i * 3600) for i in range(5)]
        voltages = [13.0, 12.5, 12.0, 11.5, 11.0]
        gradient = FeatureExtractor.calculate_discharge_gradient(voltages, timestamps)
        self.assertAlmostEqual(gradient, -0.5, places=2)

    def test_missing_rate(self):
        # 120 expected, 90 actual -> 25% missing
        missing_rate = FeatureExtractor.calculate_missing_rate(actual_records=90, expected_records=120)
        self.assertEqual(missing_rate, 0.25)

    def test_extract_all_features_expected_records_endpoint_counting(self):
        # 6 records evenly spaced over a 10-minute span (every 2 minutes: t=0, 2, 4, 6, 8, 10 min)
        base_ts = 1700000000
        records = [
            {"datetime": base_ts + (i * 120), "battery_voltage": 12.5}
            for i in range(6)
        ]
        features = FeatureExtractor.extract_all_features(records, expected_interval_seconds=120)
        # Interval span is 10 min / 2 min = 5 intervals. Including initial sample, expected is 5 + 1 = 6 records.
        self.assertEqual(features["record_count"], 6)
        self.assertEqual(features["expected_records"], 6)
        self.assertEqual(features["missing_rate"], 0.0)

    def test_sparse_metric_discharge_gradient_alignment(self):
        # 5 total records, but battery_voltage is only present in 3 records at t=0, t=1h, t=2h
        base_ts = 1700000000
        records = [
            {"datetime": base_ts + 0, "battery_voltage": 13.0, "temperature": 25.0},
            {"datetime": base_ts + 1800, "temperature": 25.5},  # missing battery_voltage
            {"datetime": base_ts + 3600, "battery_voltage": 12.5, "temperature": 26.0},
            {"datetime": base_ts + 5400, "temperature": 26.5},  # missing battery_voltage
            {"datetime": base_ts + 7200, "battery_voltage": 12.0, "temperature": 27.0},
        ]
        features = FeatureExtractor.extract_all_features(records)
        batt_metrics = features["metrics"]["battery_voltage"]
        # Gradient should be -0.5 V/hr (drops 1.0 V over 2 hours)
        self.assertAlmostEqual(batt_metrics["gradient_per_hour"], -0.5, places=2)
        self.assertEqual(batt_metrics["count"], 3)

    def test_completeness_is_skipped_without_reporting_interval(self):
        records = [{"datetime": 1700000000 + i * 120, "battery_voltage": 4.0} for i in range(6)]
        features = FeatureExtractor.extract_all_features(records)
        self.assertIsNone(features["missing_rate"])
        self.assertIsNone(features["expected_records"])

    def test_completeness_over_a_fixed_window(self):
        records = [{"datetime": 1700000000 + i * 600, "battery_voltage": 4.0} for i in range(36)]
        features = FeatureExtractor.extract_all_features(records, expected_interval_seconds=300, window_seconds=86400)
        self.assertEqual(features["expected_records"], 288)
        self.assertAlmostEqual(features["missing_rate"], 1 - 36 / 288, places=3)

    def test_max_rate_per_hour_uses_windowed_fit(self):
        base_ts = 1700000000
        # Flat for an hour, then rising 1.2 units/hour for the next hour
        timestamps = [base_ts + i * 600 for i in range(12)]
        values = [4.0] * 6 + [4.0 + 0.2 * i for i in range(6)]
        max_rate, signed = FeatureExtractor.calculate_max_rate_per_hour(values, timestamps)
        self.assertAlmostEqual(max_rate, 1.2, places=2)
        self.assertGreater(signed, 0)

    def test_dual_pm_pairs_timestamp_alignment(self):
        # Paired series should only include records where both sensors are present
        base_ts = 1700000000
        records = [
            # Both present: 20.0 and 20.1
            {"datetime": base_ts + 0, "pm2_5_sensor1": 20.0, "pm2_5_sensor2": 20.1},
            # Only sensor1 present: 500.0 (anomalous spike on sensor1 only)
            {"datetime": base_ts + 120, "pm2_5_sensor1": 500.0},
            # Only sensor2 present: 500.0 (anomalous spike on sensor2 only)
            {"datetime": base_ts + 240, "pm2_5_sensor2": 500.0},
            # Both present: 25.0 and 25.2
            {"datetime": base_ts + 360, "pm2_5_sensor1": 25.0, "pm2_5_sensor2": 25.2},
            # Both present: 30.0 and 30.1
            {"datetime": base_ts + 480, "pm2_5_sensor1": 30.0, "pm2_5_sensor2": 30.1},
        ]
        series_a, series_b = FeatureExtractor.paired_values(records, "pm2_5_sensor1", "pm2_5_sensor2")
        agreement = FeatureExtractor.calculate_cross_sensor_agreement(series_a, series_b)
        # The 3 valid co-located pairs are (20.0, 20.1), (25.0, 25.2), (30.0, 30.1)
        self.assertEqual(agreement["valid_pairs"], 3)
        self.assertGreaterEqual(agreement["correlation"], 0.99)
        self.assertLess(agreement["mean_absolute_error"], 0.3)


class TestProfileModel(unittest.TestCase):
    def test_builds_dependencies_pairs_and_transmission_from_profile(self):
        model = build_model(lowcost_profile())
        self.assertTrue(model.diagnosable)
        self.assertEqual(model.upstream["communication"], ["device_battery"])
        self.assertEqual(model.upstream["pm_sensor1"], ["device_battery"])
        self.assertEqual(model.transmission_components, ["communication"])
        self.assertEqual(len(model.redundant_pairs), 1)
        pair = model.redundant_pairs[0]
        self.assertEqual((pair.metric_a, pair.metric_b), ("pm2_5_sensor1", "pm2_5_sensor2"))
        self.assertTrue(any("temperature" in w for w in model.warnings))

    def test_readiness_reports_missing_profile_pieces(self):
        profile = lowcost_profile()
        profile["config_mappings"] = {}
        profile["components"][1]["metrics"][0]["expected_max"] = None
        profile["components"][1]["metrics"][0]["expected_min"] = None
        profile["components"][1]["metrics"].append({"key": "not_mapped_metric", "unit": "x"})
        # A second mapped metric with the same unit makes the MEASURES_SAME_AS pairing ambiguous
        profile["components"][2]["metrics"].append({"key": "temperature", "unit": "ug/m3"})
        profile["relationships"].append(
            {"source_component_id": profile["components"][0]["id"],
             "target_component_id": profile["components"][1]["id"], "relationship_type": "HEATS"}
        )
        warnings = " | ".join(build_model(profile).warnings)
        self.assertIn("No 'reporting_interval' config mapping", warnings)
        self.assertIn("'pm_sensor1.pm2_5_sensor1' has no expected_min/expected_max", warnings)
        self.assertIn("'pm_sensor1.not_mapped_metric' is not mapped", warnings)
        self.assertIn("Unsupported relationship types ignored: HEATS", warnings)
        self.assertIn("could not match metrics", warnings)

    def test_profile_without_components_is_not_diagnosable(self):
        profile = lowcost_profile()
        profile["components"], profile["relationships"] = [], []
        model = build_model(profile)
        self.assertFalse(model.diagnosable)
        self.assertTrue(model.errors)

    def test_policy_overrides_from_profile_and_component_metadata(self):
        profile = lowcost_profile()
        profile["meta_data"] = {"diagnostics": {"completeness": {"max_missing_rate": 0.9}}}
        profile["components"][0]["meta_data"] = {"diagnostics": {"disabled_checks": ["METRIC_RATE_EXCEEDED"]}}
        model = build_model(profile)
        self.assertEqual(model.policy["completeness"]["max_missing_rate"], 0.9)
        self.assertEqual(model.components["device_battery"].policy["disabled_checks"], ["METRIC_RATE_EXCEEDED"])
        self.assertEqual(model.components["pm_sensor1"].policy["disabled_checks"], [])

    def test_reporting_interval_prefers_device_config_then_profile_default(self):
        model = build_model(lowcost_profile())
        self.assertEqual(resolve_expected_interval_seconds(model), 120.0)
        self.assertEqual(resolve_expected_interval_seconds(model, {"config1": "600"}), 600.0)
        profile = lowcost_profile()
        profile["config_mappings"]["config1"].update({"unit": "min", "default": 10})
        self.assertEqual(resolve_expected_interval_seconds(build_model(profile)), 600.0)


class TestDiagnosticsEvidenceEngine(unittest.TestCase):
    def setUp(self):
        self.engine = EvidenceEngine()

    def _evidence(self, records, profile=None, interval=120):
        model = build_model(profile or lowcost_profile())
        features = FeatureExtractor.extract_all_features(records, expected_interval_seconds=interval)
        return {e.code: e for e in self.engine.evaluate(features, model, records, interval)}

    def test_limits_come_from_profile_metrics(self):
        records = make_records(60, battery=lambda i: 3.9)
        self.assertFalse(any(c.startswith("METRIC_BELOW_MIN") for c in self._evidence(records)))

        profile = lowcost_profile()
        profile["components"][0]["metrics"][0]["expected_min"] = 3.95
        evidence = self._evidence(records, profile)
        below = evidence["METRIC_BELOW_MIN:device_battery.battery_voltage"]
        self.assertEqual(below.confidence, 1.0)
        self.assertEqual(below.severity, "CRITICAL")  # criticality 0.7 x confidence 1.0

    def test_battery_below_min_and_rate_exceeded(self):
        # 3.9 V -> 2.6 V over 3 hours (~0.43 V/h against a 0.3 V/h limit)
        records = make_records(90, battery=lambda i: 3.9 - 1.3 * i / 89)
        evidence = self._evidence(records)
        self.assertIn("METRIC_BELOW_MIN:device_battery.battery_voltage", evidence)
        rate = evidence["METRIC_RATE_EXCEEDED:device_battery.battery_voltage"]
        self.assertIn("falling", rate.description)

    def test_stuck_and_missing_metrics(self):
        records = make_records(30, pm1=lambda i: 12.0, pm2=None)
        evidence = self._evidence(records)
        self.assertIn("METRIC_STUCK:pm_sensor1.pm2_5_sensor1", evidence)
        self.assertIn("METRIC_MISSING:pm_sensor2.pm2_5_sensor2", evidence)

    def test_sensor_disagreement_uses_measures_same_as(self):
        records = make_records(40, pm2=lambda i: 80.0 - healthy_pm(i))
        evidence = self._evidence(records)
        disagreement = evidence["SENSOR_DISAGREEMENT:pm_sensor1.pm2_5_sensor1~pm2_5_sensor2"]
        self.assertEqual(disagreement.related_components, ["pm_sensor2"])

        profile = lowcost_profile()
        profile["relationships"] = profile["relationships"][:3]
        self.assertFalse(any(c.startswith("SENSOR_DISAGREEMENT") for c in self._evidence(records, profile)))

    def test_data_gaps_use_reporting_interval_and_connectivity_component(self):
        records = make_records(30, interval_s=600)
        self.assertIn("DATA_GAPS:communication", self._evidence(records, interval=120))
        self.assertNotIn("DATA_GAPS:communication", self._evidence(records, interval=600))

        profile = lowcost_profile()
        profile["components"] = profile["components"][:3]
        profile["relationships"] = [r for r in profile["relationships"] if r["target_component_id"] != COMM_ID]
        self.assertIn("DATA_GAPS:device", self._evidence(records, profile, interval=120))

    def test_disabled_checks_are_skipped(self):
        profile = lowcost_profile()
        profile["components"][1]["meta_data"] = {"diagnostics": {"disabled_checks": ["METRIC_STUCK"]}}
        records = make_records(30, pm1=lambda i: 12.0)
        self.assertNotIn("METRIC_STUCK:pm_sensor1.pm2_5_sensor1", self._evidence(records, profile))


class TestDiagnosticReasoner(unittest.TestCase):
    def setUp(self):
        self.reasoner = DiagnosticReasoner()
        self.candidate_causes = get_default_candidate_causes()

    def test_battery_degradation_high_confidence(self):
        # Supporting: rapid discharge (+3.5) & solar normal (+2.0)
        evidences = [
            EvidenceFact("EVID_BATTERY_RAPID_NIGHT_DISCHARGE", "battery", "Fast drop", 0.90, -0.38),
            EvidenceFact("EVID_SOLAR_INPUT_NORMAL", "solar_panel", "Solar harvest healthy", 0.95, 18.5),
        ]
        diagnoses = self.reasoner.diagnose(evidences, self.candidate_causes)
        self.assertTrue(len(diagnoses) > 0)
        top_cause = diagnoses[0]
        self.assertEqual(top_cause["cause_code"], "CAUSE_BATTERY_DEGRADATION")
        self.assertGreaterEqual(top_cause["confidence_percentage"], 85.0)
        self.assertTrue(len(top_cause["supporting_evidence"]) >= 2)

    def test_refuting_evidence_rejects_battery_fault_during_bad_weather(self):
        # If solar underperformed and weather was poor, battery fault confidence drops
        evidences = [
            EvidenceFact("EVID_BATTERY_RAPID_NIGHT_DISCHARGE", "battery", "Fast drop", 0.50, -0.22),
            EvidenceFact("EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY", "solar_panel", "Solar low", 0.85, 6.0),
            EvidenceFact("EVID_POOR_WEATHER_CONDITIONS", "environment", "Heavy clouds", 0.90, 85.0),
        ]
        diagnoses = self.reasoner.diagnose(evidences, self.candidate_causes)
        battery_causes = [d for d in diagnoses if d["cause_code"] == "CAUSE_BATTERY_DEGRADATION"]
        # Because solar underperformed and poor weather refute battery degradation, it should not rank high
        if battery_causes:
            self.assertLess(battery_causes[0]["confidence_percentage"], 65.0)


class TestEndToEndEvaluatorProfileDriven(unittest.TestCase):
    def setUp(self):
        self.evaluator = DiagnosticEvaluator()

    def test_healthy_device(self):
        result = self.evaluator.evaluate_telemetry("dev_ok", make_records(180), profile=lowcost_profile())
        self.assertEqual(result["overall_health_score"], 100.0)
        self.assertEqual(result["lifecycle_state"], "HEALTHY")
        self.assertEqual(result["top_diagnoses"], [])
        self.assertEqual(
            set(result["subsystem_scores"]), {"device_battery", "pm_sensor1", "pm_sensor2", "communication"}
        )

    def test_battery_fault_explains_downstream_data_gaps(self):
        # Battery below minimum and readings every 10 min against a 2 min reporting interval
        records = make_records(36, interval_s=600, battery=lambda i: 2.8)
        result = self.evaluator.evaluate_telemetry("dev_batt", records, profile=lowcost_profile())
        top = result["top_diagnoses"][0]
        self.assertEqual(top["cause_code"], "COMPONENT_FAULT:device_battery")
        self.assertIn("communication", top["affected_components"])
        self.assertNotIn("COMPONENT_FAULT:communication", [d["cause_code"] for d in result["top_diagnoses"]])
        self.assertLess(result["subsystem_scores"]["device_battery"], 100.0)

    def test_disagreement_is_attributed_to_the_faulty_sensor(self):
        records = make_records(60, pm1=lambda i: 12.0)
        result = self.evaluator.evaluate_telemetry("dev_pm", records, profile=lowcost_profile())
        codes = [d["cause_code"] for d in result["top_diagnoses"]]
        self.assertEqual(codes[0], "COMPONENT_FAULT:pm_sensor1")
        self.assertFalse(any(c.startswith("SENSOR_DISAGREEMENT") for c in codes))
        self.assertEqual(len(result["top_diagnoses"][0]["supporting_evidence"]), 2)

    def test_unresolved_disagreement_is_reported_between_both_sensors(self):
        records = make_records(60, pm2=lambda i: 80.0 - healthy_pm(i))
        result = self.evaluator.evaluate_telemetry("dev_pm2", records, profile=lowcost_profile())
        top = result["top_diagnoses"][0]
        self.assertTrue(top["cause_code"].startswith("SENSOR_DISAGREEMENT"))
        self.assertEqual(top["affected_components"], ["pm_sensor2"])

    def test_unmonitored_upstream_component_is_suspected(self):
        profile = lowcost_profile()
        profile["components"][0]["metrics"] = []
        records = make_records(36, interval_s=600, pm1=lambda i: 12.0, pm2=lambda i: 15.0)
        result = self.evaluator.evaluate_telemetry("dev_hidden", records, profile=profile)
        codes = [d["cause_code"] for d in result["top_diagnoses"]]
        self.assertEqual(codes[0], "COMPONENT_SUSPECTED:device_battery")

    def test_device_config_interval_overrides_profile_default(self):
        records = make_records(36, interval_s=600)
        default = self.evaluator.evaluate_telemetry("dev_cfg", records, profile=lowcost_profile())
        configured = self.evaluator.evaluate_telemetry(
            "dev_cfg", records, profile=lowcost_profile(), device_config={"config1": "600"}
        )
        self.assertTrue(any(e["check"] == "DATA_GAPS" for e in default["active_evidences"]))
        self.assertFalse(any(e["check"] == "DATA_GAPS" for e in configured["active_evidences"]))
        self.assertEqual(configured["data_completeness"]["expected_interval_seconds"], 600.0)

    def test_missing_or_incomplete_profile_raises(self):
        with self.assertRaises(ProfileNotDiagnosableError):
            self.evaluator.evaluate_telemetry("dev", make_records(10), profile=None)
        profile = lowcost_profile()
        profile["components"], profile["relationships"] = [], []
        with self.assertRaises(ProfileNotDiagnosableError):
            self.evaluator.evaluate_telemetry("dev", make_records(10), profile=profile)

    def test_lifecycle_state_bands(self):
        bands = build_model(lowcost_profile()).policy["lifecycle"]
        high = [{"confidence_percentage": 90.0}]
        medium = [{"confidence_percentage": 75.0}]
        self.assertEqual(DiagnosticEvaluator.lifecycle_state(90.0, [], bands), "HEALTHY")
        self.assertEqual(DiagnosticEvaluator.lifecycle_state(75.0, [], bands), "DEGRADING")
        self.assertEqual(DiagnosticEvaluator.lifecycle_state(60.0, high, bands), "LIKELY_FAILURE")
        self.assertEqual(DiagnosticEvaluator.lifecycle_state(60.0, medium, bands), "SUSPICIOUS")
        self.assertEqual(DiagnosticEvaluator.lifecycle_state(60.0, [], bands), "SUSPICIOUS")
        self.assertEqual(DiagnosticEvaluator.lifecycle_state(30.0, [], bands), "LIKELY_FAILURE")
        self.assertEqual(DiagnosticEvaluator.lifecycle_state(10.0, [], bands), "FAILED")


class TestDiagnosticsAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool
        from sqlalchemy.ext.compiler import compiles
        from sqlalchemy.dialects.postgresql import JSONB
        from app.db.session import Base

        @compiles(JSONB, "sqlite")
        def compile_jsonb_sqlite(type_, compiler, **kw):
            return "JSON"

        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        from app.db.session import get_db

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        from app.db.session import get_db

        app.dependency_overrides.pop(get_db, None)

    def test_evaluate_payload_without_profile_is_rejected(self):
        payload = {
            "device_id": "api_test_device",
            "telemetry_window": [
                {"pm2_5": 10.0, "pm2_5_sensor_2": 80.0, "battery_voltage": 12.6, "datetime": "2026-08-23T10:00:00Z"},
                {"pm2_5": 12.0, "pm2_5_sensor_2": 85.0, "battery_voltage": 12.6, "datetime": "2026-08-23T11:00:00Z"},
                {"pm2_5": 11.0, "pm2_5_sensor_2": 90.0, "battery_voltage": 12.6, "datetime": "2026-08-23T12:00:00Z"},
                {"pm2_5": 13.0, "pm2_5_sensor_2": 88.0, "battery_voltage": 12.6, "datetime": "2026-08-23T13:00:00Z"},
            ],
            "context": {"cloud_cover_percentage": 10.0},
            "window_hours": 4.0,
        }
        response = self.client.post("/api/v1/diagnostics/evaluate-payload", json=payload)
        self.assertEqual(response.status_code, 422)
        detail = response.json()["detail"]
        self.assertTrue(any("profile" in error for error in detail["errors"]))

    def test_evaluate_payload_resolves_profile_from_test_db(self):
        from app.models.device_schema import DeviceProfile

        db = self.Session()
        profile_dict = lowcost_profile()
        profile_dict["name"] = "AirQo-v5-Test"
        profile = profile_orm(profile_dict)
        db.add(profile)
        db.commit()
        db.refresh(profile)

        try:
            payload = {
                "device_id": "api_test_device_with_profile",
                "profile_id": "airqo_v5_test",
                "telemetry_window": [
                    {"field1": 20.0 + i, "field3": 20.5 + i, "field7": 4.0 + 0.01 * (i % 3),
                     "datetime": f"2026-08-23T10:{i * 2:02d}:00Z"}
                    for i in range(10)
                ],
            }
            response = self.client.post("/api/v1/diagnostics/evaluate-payload", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["device_id"], "api_test_device_with_profile")
            self.assertEqual(data["profile_name"], "AirQo-v5-Test")
            self.assertIn("device_battery", data["subsystem_scores"])

            readiness = self.client.get(f"/api/v1/diagnostics/profiles/{profile.id}/diagnostic-readiness")
            self.assertEqual(readiness.status_code, 200)
            self.assertTrue(readiness.json()["diagnosable"])
        finally:
            db.delete(profile)
            db.commit()
            db.close()


class TestDynamicFieldMappings(unittest.TestCase):
    def test_map_record_from_profile_object(self):
        from app.utils.field_mappings import map_record_from_profile
        from app.models.device_schema import DeviceProfile

        profile = DeviceProfile(
            name="test_lowcost",
            category="air_quality",
            telemetry_mappings={
                "field1": {"key": "pm2_5_s1", "label": "Sensor 1 PM2.5", "unit": "ug/m3"},
                "field3": {"key": "pm2_5_s2", "label": "Sensor 2 PM2.5", "unit": "ug/m3"},
                "field7": {"key": "batt_v", "label": "Battery (V)", "unit": "V"},
            },
            config_mappings={
                "config1": {"key": "interval_s", "label": "Interval", "default": 120},
            },
            metadata_mappings={
                "metadata1": {"key": "pcb_rev", "label": "PCB Version"},
            },
        )

        raw_feed = {
            "device_id": "test_dev_99",
            "datetime": "2026-08-27T10:00:00Z",
            "field1": 24.5,
            "field2": 50.1,  # unmapped
            "field3": 24.8,
            "field7": 12.8,
        }

        # Map to human labels
        mapped_labels = map_record_from_profile(raw_feed, profile, use_keys=False)
        self.assertEqual(mapped_labels["device_id"], "test_dev_99")
        self.assertEqual(mapped_labels["Sensor 1 PM2.5"], 24.5)
        self.assertEqual(mapped_labels["Sensor 2 PM2.5"], 24.8)
        self.assertEqual(mapped_labels["Battery (V)"], 12.8)
        self.assertNotIn("field2", mapped_labels)

        # Map to semantic keys
        mapped_keys = map_record_from_profile(raw_feed, profile, use_keys=True)
        self.assertEqual(mapped_keys["pm2_5_s1"], 24.5)
        self.assertEqual(mapped_keys["pm2_5_s2"], 24.8)
        self.assertEqual(mapped_keys["batt_v"], 12.8)

    def test_pydantic_parses_stringified_json_mappings(self):
        import json
        import uuid
        from app.schemas.device_schema import DeviceProfileResponse

        raw_obj = {
            "id": uuid.uuid4(),
            "name": "lowcost_stringified",
            "category": "air_quality",
            "meta_data": json.dumps({"is_default_lowcost": True}),
            "telemetry_mappings": json.dumps({"field1": {"key": "pm2_5", "label": "PM2.5"}}),
            "config_mappings": json.dumps({"config1": {"key": "interval", "type": "int"}}),
            "metadata_mappings": json.dumps({"metadata1": {"key": "pcb"}}),
            "components": [],
            "relationships": [],
        }

        resp = DeviceProfileResponse.model_validate(raw_obj)
        self.assertIsInstance(resp.meta_data, dict)
        self.assertTrue(resp.meta_data.get("is_default_lowcost"))
        self.assertIsInstance(resp.telemetry_mappings, dict)
        self.assertEqual(resp.telemetry_mappings["field1"]["key"], "pm2_5")
        self.assertIsInstance(resp.config_mappings, dict)
        self.assertIsInstance(resp.metadata_mappings, dict)

    def test_sync_device_profile_relationship(self):
        import uuid
        from app.models.sync import SyncDevice
        from app.models.device_schema import DeviceProfile

        profile_id = uuid.uuid4()
        dev = SyncDevice(
            device_id="aq_test_101",
            device_name="AQ-101",
            category="lowcost",
            profile_id=profile_id,
        )
        self.assertEqual(dev.device_id, "aq_test_101")
        self.assertEqual(dev.profile_id, profile_id)

    def test_profile_to_category_read(self):
        import uuid
        from app.models.device_schema import DeviceProfile
        from app.crud.crud_category import profile_to_category_read

        profile = DeviceProfile(
            id=uuid.uuid4(),
            name="lowcost",
            category="air_quality",
            description="AirQo Low-Cost PM Monitor",
            telemetry_mappings={"field1": {"label": "Sensor 1 PM2.5"}, "field7": {"label": "Battery Voltage"}},
            config_mappings={"config1": {"label": "Interval"}},
            metadata_mappings={"metadata1": {"label": "PCB Rev"}},
        )

        cat_read = profile_to_category_read(profile)
        self.assertEqual(cat_read.name, "lowcost")
        self.assertEqual(cat_read.field1, "Sensor 1 PM2.5")
        self.assertEqual(cat_read.field7, "Battery Voltage")
        self.assertEqual(cat_read.config1, "Interval")
        self.assertEqual(cat_read.metadata1, "PCB Rev")

    def test_normalize_and_unpack_record(self):
        from app.utils.field_mappings import normalize_and_unpack_record

        raw_row = {
            "datetime": "2025-08-27T00:04:27Z",
            "field_1": 10.47,
            "field_2": 10.98,
            "field_3": 3.0,
            "field_7": 4.16,
            "field_8": "0.0,0.0,0.0,0.0,0.0,0.0,17.5,70.0,0.0,0.0,0.0,0,4.167",
        }
        unpacked = normalize_and_unpack_record(raw_row)
        self.assertEqual(unpacked["datetime"], "2025-08-27T00:04:27Z")
        self.assertEqual(unpacked["field1"], 10.47)
        self.assertEqual(unpacked["field2"], 10.98)
        self.assertEqual(unpacked["field3"], 3.0)
        self.assertEqual(unpacked["field7"], 4.16)
        self.assertEqual(unpacked["field8"], 0.0)
        self.assertEqual(unpacked["field14"], 17.5) # device temperature
        self.assertEqual(unpacked["field15"], 70.0) # device humidity
        self.assertEqual(unpacked["field20"], 4.167)

        # Ensure capping at 13 values (field8..field20) ignores field21+
        raw_overflow = {
            "field_8": "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15",
        }
        unpacked_overflow = normalize_and_unpack_record(raw_overflow)
        self.assertEqual(unpacked_overflow["field20"], 12.0)
        self.assertNotIn("field21", unpacked_overflow)
        self.assertNotIn("field22", unpacked_overflow)

    def test_map_record_from_profile_with_fallback(self):
        from app.utils.field_mappings import normalize_and_unpack_record, map_record_from_profile

        raw_row = {
            "datetime": "2025-08-27T00:04:27Z",
            "field_1": 10.47,
            "field_3": 3.0,
            "field_7": 4.16,
        }
        unpacked = normalize_and_unpack_record(raw_row)
        mapped = map_record_from_profile(unpacked, profile=None, use_keys=True, drop_unmapped=False)
        self.assertEqual(mapped["pm2_5_sensor1"], 10.47)
        self.assertEqual(mapped["pm2_5_sensor2"], 3.0)
        self.assertEqual(mapped["battery_voltage"], 4.16)

    def test_evaluate_thejson_payload_end_to_end(self):
        import json
        import os
        from app.api.v1.diagnostics import _prepare_telemetry_for_evaluation
        from app.services.diagnostics.evaluator import DiagnosticEvaluator

        json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "thejson.json")
        if not os.path.exists(json_path):
            self.skipTest("thejson.json not present")

        with open(json_path) as f:
            data = json.load(f)

        telemetry = data.get("telemetry_window", [])
        prepared = _prepare_telemetry_for_evaluation(telemetry, profile=None)

        self.assertGreater(len(prepared), 0)
        first = prepared[0]
        self.assertIn("pm2_5_sensor1", first)
        self.assertIn("pm2_5_sensor2", first)
        self.assertIn("battery_voltage", first)
        self.assertIn("device_temperature", first)

        evaluator = DiagnosticEvaluator()
        result = evaluator.evaluate_telemetry(
            device_id=data.get("device_id", "AQ_DRIFT_BENCH_02"),
            telemetry_records=prepared,
            profile=lowcost_profile(),
            context=data.get("context"),
            window_hours=data.get("window_hours", 24.0),
        )

        self.assertIn("overall_health_score", result)
        self.assertIn("subsystem_scores", result)
        self.assertIn("pm_sensor1", result["subsystem_scores"])
        self.assertIn("device_battery", result["subsystem_scores"])
        self.assertIn("active_evidences", result)
        self.assertIn("top_diagnoses", result)

    def test_resolve_profile_exact_match_fallback(self):
        from unittest.mock import MagicMock, patch
        from app.api.v1.diagnostics import _resolve_profile

        mock_db = MagicMock()
        profile_match = MagicMock()
        profile_match.name = "AirQo-v5_DualPM"

        profile_other = MagicMock()
        profile_other.name = "AirQo-v5"

        with patch("app.api.v1.diagnostics.crud_diagnostics") as mock_crud:
            mock_crud.get_profile.return_value = None
            mock_crud.list_profiles.return_value = [profile_other, profile_match]

            # 1. Exact match with different casing and separators
            resolved = _resolve_profile(mock_db, profile_id="airqo_v5_dualpm")
            self.assertEqual(resolved, profile_match)

            # 2. Substring query should NOT match
            resolved_substring = _resolve_profile(mock_db, profile_id="AirQo")
            self.assertIsNone(resolved_substring)

            # 3. Superstring query should NOT match
            resolved_superstring = _resolve_profile(mock_db, profile_id="AirQo-v5-extra")
            self.assertIsNone(resolved_superstring)

    def test_symptom_definition_evaluation_logic_validation(self):
        from pydantic import ValidationError
        from app.schemas.diagnostics import SymptomDefinitionCreate

        # 1. Valid JSON string parses to dict
        valid_json = '{"metric": "battery_voltage", "threshold": 3.4}'
        symptom = SymptomDefinitionCreate(
            code="SYM_BATT_LOW",
            name="Battery Voltage Low",
            evaluation_logic=valid_json,
        )
        self.assertEqual(symptom.evaluation_logic, {"metric": "battery_voltage", "threshold": 3.4})

        # 2. Existing dict is preserved
        symptom_dict = SymptomDefinitionCreate(
            code="SYM_BATT_LOW",
            name="Battery Voltage Low",
            evaluation_logic={"metric": "battery_voltage", "threshold": 3.4},
        )
        self.assertEqual(symptom_dict.evaluation_logic, {"metric": "battery_voltage", "threshold": 3.4})

        # 3. None is preserved
        symptom_none = SymptomDefinitionCreate(
            code="SYM_BATT_LOW",
            name="Battery Voltage Low",
            evaluation_logic=None,
        )
        self.assertIsNone(symptom_none.evaluation_logic)

        # 4. Invalid JSON string raises ValidationError
        with self.assertRaises(ValidationError) as ctx:
            SymptomDefinitionCreate(
                code="SYM_BATT_LOW",
                name="Battery Voltage Low",
                evaluation_logic="not valid json {",
            )
        self.assertIn("Invalid JSON in evaluation_logic", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
