import unittest
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


class TestDiagnosticsAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

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


if __name__ == "__main__":
    unittest.main()
