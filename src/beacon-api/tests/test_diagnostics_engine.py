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
        features = FeatureExtractor.extract_all_features(records, expected_frequency_minutes=2)
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

    def test_dual_pm_pairs_timestamp_alignment(self):
        # pm2_5_sensor1 and pm2_5_sensor2 should only pair when both are present at same timestamp
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
        features = FeatureExtractor.extract_all_features(records)
        agreement = features.get("pm_sensor_agreement")
        self.assertIsNotNone(agreement)
        # The 3 valid co-located pairs are (20.0, 20.1), (25.0, 25.2), (30.0, 30.1)
        self.assertEqual(agreement["valid_pairs"], 3)
        self.assertGreaterEqual(agreement["correlation"], 0.99)
        self.assertLess(agreement["mean_absolute_error"], 0.3)


class TestDiagnosticsEvidenceEngine(unittest.TestCase):
    def setUp(self):
        self.engine = EvidenceEngine()

    def test_battery_rapid_discharge_evidence(self):
        features = {
            "metrics": {
                "battery_voltage": {
                    "gradient_per_hour": -0.38,
                    "min": 11.0,
                    "mean": 11.8,
                }
            }
        }
        evidences = self.engine.evaluate(features)
        codes = [e.code for e in evidences]
        self.assertIn("EVID_BATTERY_RAPID_NIGHT_DISCHARGE", codes)
        self.assertIn("EVID_BATTERY_VOLTAGE_CRITICAL_LOW", codes)

    def test_solar_clear_sky_evidence(self):
        features = {
            "metrics": {
                "solar_voltage": {"mean": 18.5},
                "solar_current": {"mean": 0.85},
            }
        }
        context = {"cloud_cover_percentage": 10.0, "is_raining": False}
        evidences = self.engine.evaluate(features, context=context)
        codes = [e.code for e in evidences]
        self.assertIn("EVID_SOLAR_INPUT_NORMAL", codes)

    def test_solar_metric_selection_ignores_gps_field8_field9(self):
        # field8 is latitude (~0.35) and field9 is longitude (~32.58)
        features = {
            "metrics": {
                "field8": {"mean": 0.3475},
                "field9": {"mean": 32.5825},
                "battery_voltage": {"mean": 12.8, "min": 12.5, "max": 13.0, "gradient_per_hour": 0.0},
            }
        }
        # 1. Profile mapping field8/field9 to GPS latitude and longitude
        context = {
            "profile": {
                "telemetry_mappings": {
                    "field8": {"key": "latitude_gps", "label": "GPS Latitude"},
                    "field9": {"key": "longitude_gps", "label": "GPS Longitude"},
                }
            },
            "cloud_cover_percentage": 5.0,
            "is_raining": False,
        }
        evidences = self.engine.evaluate(features, context=context)
        codes = [e.code for e in evidences]
        # Must NOT treat GPS coordinates as solar readings, which would falsely emit EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY
        self.assertNotIn("EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY", codes)
        self.assertNotIn("EVID_SOLAR_INPUT_NORMAL", codes)

    def test_solar_metric_selection_accepts_solar_mapped_field8_field9(self):
        features = {
            "metrics": {
                "field8": {"mean": 18.5},
                "field9": {"mean": 0.85},
            }
        }
        context = {
            "profile": {
                "telemetry_mappings": {
                    "field8": {"key": "solar_voltage", "label": "Solar Panel Voltage"},
                    "field9": {"key": "solar_current", "label": "Solar Panel Current"},
                }
            },
            "cloud_cover_percentage": 5.0,
            "is_raining": False,
        }
        evidences = self.engine.evaluate(features, context=context)
        codes = [e.code for e in evidences]
        self.assertIn("EVID_SOLAR_INPUT_NORMAL", codes)

    def test_solar_metric_selection_ignores_unmapped_field8_field9(self):
        features = {
            "metrics": {
                "field8": {"mean": 0.3475},
                "field9": {"mean": 32.5825},
            }
        }
        # No profile provided: fallback set is restricted to semantic solar keys
        context = {"cloud_cover_percentage": 5.0, "is_raining": False}
        evidences = self.engine.evaluate(features, context=context)
        codes = [e.code for e in evidences]
        self.assertNotIn("EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY", codes)

    def test_solar_open_circuit_with_solar_i_alias(self):
        # High solar voltage (> 14V) with low current (< 0.05A) using solar_i alias
        features = {
            "metrics": {
                "solar_voltage": {"mean": 18.2},
                "solar_i": {"mean": 0.01},
            }
        }
        context = {"cloud_cover_percentage": 10.0, "is_raining": False}
        evidences = self.engine.evaluate(features, context=context)
        codes = [e.code for e in evidences]
        self.assertIn("EVID_SOLAR_VOLTAGE_HIGH_CURRENT_ZERO", codes)
        self.assertNotIn("EVID_SOLAR_INPUT_NORMAL", codes)


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


class TestEndToEndEvaluatorMultiDomain(unittest.TestCase):
    def setUp(self):
        self.evaluator = DiagnosticEvaluator()
        self.candidate_causes = get_default_candidate_causes()

    def test_scenario_a_air_quality_station_battery_failure(self):
        """Dual PM air quality station with degraded battery pack and healthy solar."""
        now = datetime.now(timezone.utc)
        telemetry = []
        # Generate 24 simulated hourly readings
        for h in range(24):
            ts = (now - timedelta(hours=24 - h)).isoformat()
            is_day = 6 <= h <= 18
            v_solar = 18.0 if is_day else 0.0
            i_solar = 0.9 if is_day else 0.0
            # Battery drops steeply overnight from 12.8 down to 10.4V
            v_batt = 13.8 if is_day else max(10.4, 13.5 - (0.40 * (h if h < 6 else (h - 18))))

            telemetry.append({
                "datetime": ts,
                "pm2_5": 35.0 + (h % 5),
                "pm2_5_sensor_2": 34.5 + (h % 5),
                "battery_voltage": v_batt,
                "solar_voltage": v_solar,
                "solar_current": i_solar,
                "temperature": 22.0 + (h % 6),
            })

        result = self.evaluator.evaluate_telemetry(
            device_id="aq_test_station_01",
            telemetry_records=telemetry,
            candidate_causes=self.candidate_causes,
            context={"cloud_cover_percentage": 15.0, "is_raining": False},
        )

        self.assertEqual(result["device_id"], "aq_test_station_01")
        self.assertLess(result["overall_health_score"], 80.0)
        self.assertIn(result["lifecycle_state"], ["SUSPICIOUS", "LIKELY_FAILURE", "DEGRADING"])
        self.assertTrue(len(result["top_diagnoses"]) > 0)
        self.assertEqual(result["top_diagnoses"][0]["cause_code"], "CAUSE_BATTERY_DEGRADATION")

    def test_scenario_b_cold_chain_vaccine_refrigerator_failure(self):
        """Vaccine cold storage monitor with compressor motor failure."""
        now = datetime.now(timezone.utc)
        telemetry = []
        # Temperature rising from -20C to -5C while compressor draws 0A
        for h in range(12):
            ts = (now - timedelta(hours=12 - h)).isoformat()
            telemetry.append({
                "datetime": ts,
                "refrigerator_temp": -20.0 + (h * 1.5), # rising to -3.5C
                "compressor_current": 0.0,             # compressor is dead
                "door_open": 0,
            })

        result = self.evaluator.evaluate_telemetry(
            device_id="cold_chain_freezer_04",
            telemetry_records=telemetry,
            candidate_causes=self.candidate_causes,
            context={"target_max_temperature": -15.0},
        )

        self.assertEqual(result["device_id"], "cold_chain_freezer_04")
        self.assertLess(result["overall_health_score"], 60.0)
        self.assertIn(result["lifecycle_state"], ["SUSPICIOUS", "LIKELY_FAILURE"])
        self.assertTrue(len(result["top_diagnoses"]) > 0)
        self.assertEqual(result["top_diagnoses"][0]["cause_code"], "CAUSE_COMPRESSOR_RELAY_OR_POWER_FAILURE")

    def test_scenario_c_healthy_system(self):
        """Completely healthy IoT device with high correlation and solid power."""
        now = datetime.now(timezone.utc)
        telemetry = []
        for h in range(24):
            ts = (now - timedelta(hours=24 - h)).isoformat()
            telemetry.append({
                "datetime": ts,
                "pm2_5": 22.0 + (h % 3),
                "pm2_5_sensor_2": 22.1 + (h % 3),
                "battery_voltage": 12.8,
                "solar_voltage": 18.0 if 6 <= h <= 18 else 0.0,
                "solar_current": 0.8 if 6 <= h <= 18 else 0.0,
            })

        result = self.evaluator.evaluate_telemetry(
            device_id="healthy_dev_01",
            telemetry_records=telemetry,
            candidate_causes=self.candidate_causes,
            context={"cloud_cover_percentage": 10.0, "is_raining": False},
        )

        self.assertGreaterEqual(result["overall_health_score"], 85.0)
        self.assertEqual(result["lifecycle_state"], "HEALTHY")
        self.assertEqual(len(result["top_diagnoses"]), 0)

    def test_lifecycle_state_high_confidence_in_suspicious_range(self):
        """
        Verify that a diagnosis with confidence >= 85.0 results in LIKELY_FAILURE
        even when the overall health score is in the suspicious range (50.0 - 70.0).
        Also verifies that medium confidence (70.0 - 85.0) remains SUSPICIOUS.
        """
        with patch.object(self.evaluator.evidence_engine, "evaluate") as mock_ev, \
             patch.object(self.evaluator.reasoner, "diagnose") as mock_diag:
            mock_ev.return_value = [
                EvidenceFact("EVID_COLD_CHAIN_TEMPERATURE_BREACH", "cooling", "temp high", 0.65, 5.0)
            ]

            # 1. High confidence >= 85.0 with score in suspicious range -> LIKELY_FAILURE
            mock_diag.return_value = [{"cause_code": "CAUSE_COOLING_FAIL", "confidence_percentage": 90.0}]
            res1 = self.evaluator.evaluate_telemetry(
                "dev1", [{"refrigerator_temp": 5.0}], [], subsystem_weights={"cooling": 1.0, "connectivity": 0.0}
            )
            self.assertGreaterEqual(res1["overall_health_score"], 50.0)
            self.assertLess(res1["overall_health_score"], 70.0)
            self.assertEqual(res1["lifecycle_state"], "LIKELY_FAILURE")

            # 2. Medium confidence (>= 70.0, < 85.0) with score in suspicious range -> SUSPICIOUS
            mock_diag.return_value = [{"cause_code": "CAUSE_COOLING_FAIL", "confidence_percentage": 75.0}]
            res2 = self.evaluator.evaluate_telemetry(
                "dev1", [{"refrigerator_temp": 5.0}], [], subsystem_weights={"cooling": 1.0, "connectivity": 0.0}
            )
            self.assertEqual(res2["lifecycle_state"], "SUSPICIOUS")

            # 3. No diagnoses with score in suspicious range -> SUSPICIOUS
            mock_diag.return_value = []
            res3 = self.evaluator.evaluate_telemetry(
                "dev1", [{"refrigerator_temp": 5.0}], [], subsystem_weights={"cooling": 1.0, "connectivity": 0.0}
            )
            self.assertEqual(res3["lifecycle_state"], "SUSPICIOUS")


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

    def test_evaluate_payload_api(self):
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
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["device_id"], "api_test_device")
        self.assertIn("overall_health_score", data)
        self.assertIn("top_diagnoses", data)

    def test_evaluate_payload_resolves_profile_from_test_db(self):
        from app.models.device_schema import DeviceProfile

        db = self.Session()
        profile = DeviceProfile(
            name="AirQo-v5-Test",
            category="air_quality",
            telemetry_mappings={"field8": {"key": "solar_voltage", "label": "Solar Voltage"}},
            config_mappings={},
            metadata_mappings={},
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

        try:
            payload = {
                "device_id": "api_test_device_with_profile",
                "profile_id": "airqo_v5_test",
                "telemetry_window": [
                    {"field8": 18.0, "datetime": "2026-08-23T10:00:00Z"},
                ],
            }
            response = self.client.post("/api/v1/diagnostics/evaluate-payload", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["device_id"], "api_test_device_with_profile")
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
        from app.api.v1.diagnostics import _prepare_telemetry_for_evaluation, get_default_candidate_causes
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
            candidate_causes=get_default_candidate_causes(),
            context=data.get("context"),
            window_hours=data.get("window_hours", 24.0),
        )

        self.assertIn("overall_health_score", result)
        self.assertIn("subsystem_scores", result)
        self.assertIn("sensors", result["subsystem_scores"])
        self.assertIn("power", result["subsystem_scores"])
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
