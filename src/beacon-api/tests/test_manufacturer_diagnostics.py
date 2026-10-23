"""
Phase 3: manufacturer profiles carry component models the IoT diagnostic
engine can evaluate, and the daily job diagnoses external devices with them.
"""
import unittest
import uuid
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.models.device_data import SyncDailyDeviceData, SyncRawDeviceData
from app.models.device_schema import ComponentDefinition, DeviceProfile
from app.models.health import DeviceDailyDiagnostic, DeviceDailyIssue
from app.models.sync import SyncDevice
from app.services import manufacturer_profiles as mp
from app.services.diagnostics import daily
from app.services.diagnostics.profile_model import build_model
from main import app


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


DEVICE_ID = "ag_1"
DAY = datetime.now(timezone.utc).date() - timedelta(days=2)


class _DbTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()


class TestManufacturerComponentModels(_DbTestCase):
    def test_every_manufacturer_profile_is_diagnosable(self):
        result = mp.ensure_manufacturer_profiles(self.db)
        self.assertEqual(set(result["components_added"]), set(result["created"]))
        readiness = mp.manufacturer_profile_readiness(self.db)
        self.assertEqual(len(readiness), len(mp.MANUFACTURER_PROFILE_SPECS))
        for entry in readiness:
            with self.subTest(profile=entry["name"]):
                self.assertTrue(entry["diagnosable"], entry["errors"])
                self.assertTrue(entry["transmission_components"], "needs a connectivity component")
                unmapped = [w for w in entry["warnings"] if "not mapped to any telemetry field" in w]
                self.assertEqual(unmapped, [], "every metric must have a telemetry slot")

    def test_airgradient_model_has_signal_role_and_reboot_rate_limit(self):
        mp.ensure_manufacturer_profiles(self.db)
        profile = self.db.query(DeviceProfile).filter(DeviceProfile.name == "airgradient_lowcost").one()
        model = build_model(profile)
        wifi = model.components["wifi_modem"]
        self.assertEqual(wifi.component_type, "connectivity")
        self.assertEqual([m.key for m in wifi.metrics_with_role("signal_strength")], ["wifi_rssi"])
        boot = next(m for m in model.components["controller"].metrics if m.key == "boot_count")
        self.assertEqual(boot.max_rate_of_change, 2.0)
        # Sensors report through the WiFi modem, which is powered by mains
        self.assertIn("wifi_modem", model.upstream["pm_sensor"])
        self.assertIn("mains_power", model.upstream["wifi_modem"])
        self.assertEqual(model.transmission_components, ["wifi_modem"])
        self.assertEqual(profile.config_mappings["config1"]["default"], 600)

    def test_component_model_is_retrofitted_once(self):
        # A Phase 2 style profile: slot layout only
        self.db.add(DeviceProfile(
            name="airgradient_lowcost", category="air_quality",
            telemetry_mappings=mp.EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS, config_mappings={}, metadata_mappings={},
        ))
        self.db.commit()
        first = mp.ensure_manufacturer_profiles(self.db)
        self.assertIn("airgradient_lowcost", first["existing"])
        self.assertIn("airgradient_lowcost", first["components_added"])
        profile = self.db.query(DeviceProfile).filter(DeviceProfile.name == "airgradient_lowcost").one()
        count = self.db.query(ComponentDefinition).filter(ComponentDefinition.profile_id == profile.id).count()
        self.assertEqual(count, 6)
        self.assertEqual(profile.config_mappings["config1"]["key"], "reporting_interval")
        controller = self.db.query(ComponentDefinition).filter(
            ComponentDefinition.profile_id == profile.id, ComponentDefinition.name == "controller",
        ).one()
        self.assertEqual(controller.meta_data["diagnostics"]["disabled_checks"], ["METRIC_MISSING", "METRIC_STUCK"])

        second = mp.ensure_manufacturer_profiles(self.db)
        self.assertNotIn("airgradient_lowcost", second["components_added"])
        self.assertEqual(
            self.db.query(ComponentDefinition).filter(ComponentDefinition.profile_id == profile.id).count(), 6,
        )

    def test_operator_modelled_profile_is_left_alone(self):
        profile = DeviceProfile(
            name="iqair_lowcost", category="air_quality",
            telemetry_mappings=mp.EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS, config_mappings={}, metadata_mappings={},
        )
        self.db.add(profile)
        self.db.flush()
        self.db.add(ComponentDefinition(profile_id=profile.id, name="custom", component_type="sensor", criticality=1.0))
        self.db.commit()
        result = mp.ensure_manufacturer_profiles(self.db)
        self.assertNotIn("iqair_lowcost", result["components_added"])
        names = [c.name for c in self.db.query(ComponentDefinition).filter(ComponentDefinition.profile_id == profile.id)]
        self.assertEqual(names, ["custom"])


def _airgradient_day(day: date, *, stuck_pm: bool, weak_wifi: bool, reboot_storm: bool, readings: int = 144):
    """A day of 10-minute AirGradient samples laid out per the external lowcost profile."""
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    rows = []
    for i in range(readings):
        pm = 12.0 if stuck_pm else 10.0 + 8.0 * ((i % 18) / 18.0)
        rows.append(SyncRawDeviceData(
            id=uuid.uuid4(),
            channel_id=DEVICE_ID,
            device_id=DEVICE_ID,
            entry_id=day.toordinal() * 1000 + i,
            created_at_ts=start + timedelta(minutes=10 * i),
            field1=pm,                                   # pm2_5
            field2=pm + 3.0 + (i % 4),                   # pm10
            field9=450.0 + 40.0 * ((i % 12) / 12.0),     # co2
            field12=-92.0 if weak_wifi else -58.0 - (i % 5),  # wifi_rssi
            field13=float(i) if reboot_storm else 7.0,   # boot_count: +1 every 10 min vs constant
            field16=22.0 + 4.0 * ((i % 36) / 36.0),      # temperature
            field17=55.0 + 10.0 * ((i % 24) / 24.0),     # humidity
        ))
    return rows


class TestDailyDiagnosticsForExternalDevice(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.session_patch = patch.object(daily, "SessionLocal", self.Session)
        self.session_patch.start()
        mp.ensure_manufacturer_profiles(self.db)
        self.db.add(SyncDevice(
            device_id=DEVICE_ID, device_name="ag_201560", network_id="airgradient", category="lowcost",
            serial_number="201560", status="deployed",
        ))
        self.db.commit()
        self.assertEqual(mp.assign_profiles_to_external_devices(self.db), 1)
        self.db.add(SyncDailyDeviceData(
            id=uuid.uuid4(), channel_id=DEVICE_ID, device_id=DEVICE_ID, data_date=DAY, record_count=144, complete=True,
        ))
        self.db.commit()

    def tearDown(self):
        self.session_patch.stop()
        super().tearDown()

    def _run(self):
        return daily.run_daily_diagnostics(start_date=DAY, end_date=DAY, device_ids=[DEVICE_ID])

    def _issue_codes(self):
        return {
            i.issue_code for i in self.db.query(DeviceDailyIssue).filter(DeviceDailyIssue.device_id == DEVICE_ID)
        }

    def test_faulty_day_is_diagnosed_through_the_manufacturer_profile(self):
        self.db.add_all(_airgradient_day(DAY, stuck_pm=True, weak_wifi=True, reboot_storm=True))
        self.db.commit()

        summary = self._run()
        self.assertEqual(summary["evaluated"], 1, summary)
        self.assertEqual(summary.get("skipped_no_profile", 0), 0)

        diagnostic = self.db.query(DeviceDailyDiagnostic).filter(DeviceDailyDiagnostic.device_id == DEVICE_ID).one()
        self.assertEqual(diagnostic.diagnosis_date, DAY)
        self.assertNotEqual(diagnostic.lifecycle_state, "HEALTHY")

        codes = self._issue_codes()
        self.assertIn("METRIC_STUCK:pm_sensor.pm2_5", codes)
        self.assertIn("METRIC_BELOW_MIN:wifi_modem.wifi_rssi", codes)
        self.assertIn("METRIC_RATE_EXCEEDED:controller.boot_count", codes)
        self.assertFalse(any(c.startswith("DATA_GAPS") for c in codes), codes)

    def test_healthy_day_has_no_issues(self):
        self.db.add_all(_airgradient_day(DAY, stuck_pm=False, weak_wifi=False, reboot_storm=False))
        self.db.commit()

        summary = self._run()
        self.assertEqual(summary["evaluated"], 1, summary)
        diagnostic = self.db.query(DeviceDailyDiagnostic).filter(DeviceDailyDiagnostic.device_id == DEVICE_ID).one()
        self.assertEqual(self._issue_codes(), set())
        self.assertEqual(diagnostic.lifecycle_state, "HEALTHY")
        self.assertGreaterEqual(diagnostic.overall_health_score, 85.0)

    def test_analytics_only_day_is_not_penalised_for_absent_optional_metrics(self):
        # The analytics fallback delivers PM, temperature and humidity only
        rows = _airgradient_day(DAY, stuck_pm=False, weak_wifi=False, reboot_storm=False)
        for row in rows:
            row.field9 = None   # co2
            row.field12 = None  # wifi_rssi
            row.field13 = None  # boot_count
        self.db.add_all(rows)
        self.db.commit()

        summary = self._run()
        self.assertEqual(summary["evaluated"], 1, summary)
        self.assertEqual(self._issue_codes(), set())
        diagnostic = self.db.query(DeviceDailyDiagnostic).filter(DeviceDailyDiagnostic.device_id == DEVICE_ID).one()
        self.assertEqual(diagnostic.lifecycle_state, "HEALTHY")


if __name__ == "__main__":
    unittest.main()


class TestOnDemandEvaluationUsesStoredReadings(_DbTestCase):
    """POST /diagnostics/evaluate/{id} without a telemetry window evaluates the device's own stored readings."""

    def setUp(self):
        super().setUp()
        mp.ensure_manufacturer_profiles(self.db)
        self.db.add(SyncDevice(
            device_id=DEVICE_ID, device_name="ag_201560", network_id="airgradient", category="lowcost",
            serial_number="201560", device_number=201560, status="deployed",   # vendor id, not a ThingSpeak channel
        ))
        self.db.commit()
        mp.assign_profiles_to_external_devices(self.db)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        rows = []
        for i in range(120):   # last 20 hours at 10-minute cadence, weak WiFi all along
            rows.append(SyncRawDeviceData(
                id=uuid.uuid4(), channel_id=DEVICE_ID, device_id=DEVICE_ID, entry_id=i,
                created_at_ts=now - timedelta(minutes=10 * i),
                field1=8.0 + (i % 7), field2=11.0 + (i % 5), field9=450.0 + (i % 30), field12=-91.0,
                field16=24.0 + (i % 3), field17=55.0 + (i % 10),
            ))
        self.db.add_all(rows)
        self.db.commit()

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        super().tearDown()

    def test_stored_readings_are_loaded_by_source_key(self):
        from app.api.v1.diagnostics import load_stored_telemetry

        records = load_stored_telemetry(self.db, DEVICE_ID, 24)
        self.assertEqual(len(records), 120)
        self.assertEqual(records[0]["field12"], -91.0)
        self.assertEqual(load_stored_telemetry(self.db, "unknown", 24), [])

    def test_evaluation_without_window_scores_the_device(self):
        response = self.client.post(f"/api/v1/diagnostics/evaluate/{DEVICE_ID}?save_snapshot=false", json={"window_hours": 24})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["profile_name"], "airgradient_lowcost")
        self.assertTrue(body["subsystem_scores"], body)
        self.assertIn("wifi_modem", body["subsystem_scores"])
        codes = {e["code"] for e in body.get("active_evidences", [])}
        self.assertIn("METRIC_BELOW_MIN:wifi_modem.wifi_rssi", codes)
        self.assertLess(body["overall_health_score"], 100.0)
