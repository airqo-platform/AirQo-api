import unittest
import uuid
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.models.device_data import SyncDailyDeviceData, SyncRawDeviceData
from app.models.health import DeviceDailyDiagnostic, DeviceDailyIssue
from app.models.sync import SyncDevice
from app.services.diagnostics import daily
from app.services.diagnostics.issues import extract_issues, max_severity
from main import app
from tests.diagnostics_fixtures import lowcost_profile, profile_orm


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


DEVICE_ID = "aq_daily_test_01"
CHANNEL_ID = "990001"
NO_PROFILE_DEVICE_ID = "aq_daily_no_profile"
NO_PROFILE_CHANNEL_ID = "990002"
TODAY = datetime.now(timezone.utc).date()
DAY_NO_RAW = TODAY - timedelta(days=5)
DAY_FAULT_1 = TODAY - timedelta(days=4)
DAY_FAULT_2 = TODAY - timedelta(days=3)
DAY_HEALTHY = TODAY - timedelta(days=2)
DAY_INCOMPLETE = TODAY - timedelta(days=1)

BATTERY_LOW = "METRIC_BELOW_MIN:device_battery.battery_voltage"


def _raw_day(day: date, battery, readings: int = 720, device_id: str = DEVICE_ID, channel_id: str = CHANNEL_ID):
    """A day of readings every 2 minutes (the profile's reporting interval) with agreeing PM sensors."""
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    rows = []
    for i in range(readings):
        pm = 20.0 + 10.0 * ((i % 30) / 30.0)
        rows.append(SyncRawDeviceData(
            id=uuid.uuid4(),
            channel_id=channel_id,
            device_id=device_id,
            entry_id=day.toordinal() * 1000 + i,
            created_at_ts=start + timedelta(minutes=2 * i),
            field1=pm,
            field3=pm + 0.5,
            field7=battery(i, readings),
        ))
    return rows


def _collapsing_battery(i, n):
    return 3.9 - 1.3 * i / (n - 1)  # below the profile's 3.0 V minimum for the last ~30% of the day


def _healthy_battery(i, n):
    return 4.0 + 0.01 * (i % 5)


def _daily_row(day: date, complete: bool = True, device_id: str = DEVICE_ID, channel_id: str = CHANNEL_ID):
    return SyncDailyDeviceData(
        id=uuid.uuid4(),
        channel_id=channel_id,
        device_id=device_id,
        data_date=day,
        record_count=720,
        complete=complete,
    )


class DailyDiagnosticsDBTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.session_patch = patch.object(daily, "SessionLocal", self.Session)
        self.session_patch.start()
        self._seed()

    def tearDown(self):
        self.session_patch.stop()
        self.engine.dispose()

    def _seed(self):
        db = self.Session()
        profile = profile_orm(lowcost_profile())
        db.add(profile)
        db.add(SyncDevice(device_id=DEVICE_ID, device_name=DEVICE_ID, device_number=int(CHANNEL_ID), profile_id=profile.id))
        db.add(SyncDevice(device_id=NO_PROFILE_DEVICE_ID, device_name=NO_PROFILE_DEVICE_ID, device_number=int(NO_PROFILE_CHANNEL_ID)))
        db.add_all([
            _daily_row(DAY_NO_RAW),
            _daily_row(DAY_FAULT_1),
            _daily_row(DAY_FAULT_2),
            _daily_row(DAY_HEALTHY),
            _daily_row(DAY_INCOMPLETE, complete=False),
            _daily_row(DAY_FAULT_1, device_id=NO_PROFILE_DEVICE_ID, channel_id=NO_PROFILE_CHANNEL_ID),
        ])
        db.add_all(_raw_day(DAY_FAULT_1, _collapsing_battery))
        db.add_all(_raw_day(DAY_FAULT_2, _collapsing_battery))
        db.add_all(_raw_day(DAY_HEALTHY, _healthy_battery))
        db.add_all(_raw_day(DAY_INCOMPLETE, _collapsing_battery, readings=100))
        db.add_all(_raw_day(
            DAY_FAULT_1, _healthy_battery, readings=50, device_id=NO_PROFILE_DEVICE_ID, channel_id=NO_PROFILE_CHANNEL_ID
        ))
        db.commit()
        db.close()

    def _run(self, **kwargs):
        params = {"start_date": DAY_NO_RAW, "end_date": DAY_INCOMPLETE, "device_ids": [DEVICE_ID]}
        params.update(kwargs)
        return daily.run_daily_diagnostics(**params)


class TestIssueExtraction(unittest.TestCase):
    def test_issues_carry_profile_component_and_order_by_severity(self):
        evidences = [
            {"code": "DATA_GAPS:communication", "check": "DATA_GAPS", "component_name": "communication",
             "component_type": "connectivity", "title": "Data gaps", "severity": "MEDIUM", "confidence": 0.5},
            {"code": BATTERY_LOW, "check": "METRIC_BELOW_MIN", "component_name": "device_battery",
             "component_type": "battery", "metric": "battery_voltage", "title": "Battery Voltage below expected minimum",
             "severity": "CRITICAL", "confidence": 1.0},
        ]
        issues = extract_issues(evidences)
        self.assertEqual([i["code"] for i in issues], [BATTERY_LOW, "DATA_GAPS:communication"])
        self.assertEqual(issues[0]["subsystem"], "battery")
        self.assertEqual(issues[0]["component_name"], "device_battery")
        self.assertEqual(issues[0]["metric"], "battery_voltage")
        self.assertEqual(max_severity(issues), "CRITICAL")
        self.assertIsNone(max_severity([]))

    def test_duplicate_codes_keep_highest_confidence(self):
        issues = extract_issues([
            {"code": "METRIC_STUCK:pm_sensor1.pm2_5_sensor1", "confidence": 0.4},
            {"code": "METRIC_STUCK:pm_sensor1.pm2_5_sensor1", "confidence": 0.8},
        ])
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["confidence"], 0.8)
        self.assertEqual(issues[0]["check"], "METRIC_STUCK")


class TestResolveWindow(unittest.TestCase):
    today = date(2026, 9, 13)

    def test_defaults_to_lookback_ending_yesterday(self):
        self.assertEqual(daily.resolve_window(today=self.today), (date(2026, 9, 10), date(2026, 9, 12)))

    def test_end_date_is_capped_at_yesterday(self):
        _, end = daily.resolve_window(end_date=date(2026, 9, 20), today=self.today)
        self.assertEqual(end, date(2026, 9, 12))

    def test_start_date_is_clamped_to_raw_retention(self):
        start, _ = daily.resolve_window(start_date=date(2026, 8, 1), today=self.today)
        self.assertEqual(start, date(2026, 8, 31))

    def test_window_entirely_before_retention_is_empty(self):
        start, end = daily.resolve_window(date(2026, 8, 1), date(2026, 8, 5), today=self.today)
        self.assertGreater(start, end)


class TestDailyDiagnosticsRun(DailyDiagnosticsDBTestCase):
    def test_run_persists_issues_streaks_and_resolutions(self):
        summary = self._run()

        self.assertEqual(summary["evaluated"], 3)
        self.assertEqual(summary["skipped_no_raw_data"], 1)
        self.assertEqual(summary["failed"], 0)

        db = self.Session()
        try:
            rows = {
                r.diagnosis_date: r
                for r in db.query(DeviceDailyDiagnostic).filter(DeviceDailyDiagnostic.device_id == DEVICE_ID).all()
            }
            self.assertEqual(set(rows), {DAY_FAULT_1, DAY_FAULT_2, DAY_HEALTHY})

            first = rows[DAY_FAULT_1]
            self.assertEqual(first.record_count, 720)
            self.assertEqual(first.hours_with_data, 24)
            self.assertEqual(first.max_severity, "CRITICAL")
            self.assertEqual(first.top_cause_code, "COMPONENT_FAULT:device_battery")
            self.assertEqual(str(first.profile_id), lowcost_profile()["id"])
            self.assertIn("battery_voltage", first.metrics_summary)
            self.assertEqual(first.engine_version, daily.ENGINE_VERSION)
            first_issue = {i.issue_code: i for i in first.issues}[BATTERY_LOW]
            self.assertEqual(first_issue.check_type, "METRIC_BELOW_MIN")
            self.assertEqual(first_issue.component_name, "device_battery")
            self.assertEqual(first_issue.subsystem, "battery")
            self.assertTrue(first_issue.is_new)
            self.assertEqual(first_issue.streak_days, 1)

            second_issue = {i.issue_code: i for i in rows[DAY_FAULT_2].issues}[BATTERY_LOW]
            self.assertFalse(second_issue.is_new)
            self.assertEqual(second_issue.streak_days, 2)
            self.assertEqual(second_issue.streak_start_date, DAY_FAULT_1)

            healthy = rows[DAY_HEALTHY]
            self.assertEqual(healthy.issue_count, 0)
            self.assertEqual(healthy.lifecycle_state, "HEALTHY")
            self.assertIn(BATTERY_LOW, healthy.resolved_issue_codes)
        finally:
            db.close()

    def test_rerun_is_idempotent_and_force_replaces_rows(self):
        self._run()
        db = self.Session()
        issue_count = db.query(DeviceDailyIssue).count()
        db.close()

        self.assertEqual(self._run()["evaluated"], 0)

        forced = self._run(force=True)
        self.assertEqual(forced["evaluated"], 3)
        db = self.Session()
        try:
            self.assertEqual(db.query(DeviceDailyDiagnostic).count(), 3)
            self.assertEqual(db.query(DeviceDailyIssue).count(), issue_count)
        finally:
            db.close()

    def test_overlapping_run_exits_without_processing(self):
        @contextmanager
        def lock_held_elsewhere(db):
            yield False

        with patch.object(daily, "_run_lock", lock_held_elsewhere):
            summary = self._run()

        self.assertTrue(summary["skipped_locked"])
        self.assertEqual(summary["evaluated"], 0)
        self.assertEqual(summary["failed"], 0)
        db = self.Session()
        try:
            self.assertEqual(db.query(DeviceDailyDiagnostic).count(), 0)
        finally:
            db.close()

    def test_devices_without_a_profile_are_skipped(self):
        summary = self._run(device_ids=[NO_PROFILE_DEVICE_ID])
        self.assertEqual(summary["evaluated"], 0)
        self.assertEqual(summary["skipped_no_profile"], 1)

    def test_device_filter_limits_evaluation(self):
        self.assertEqual(self._run(device_ids=["some_other_device"])["evaluated"], 0)
        self.assertEqual(self._run(device_ids=[DEVICE_ID])["evaluated"], 3)


class TestDailyDiagnosticsAPI(DailyDiagnosticsDBTestCase):
    def setUp(self):
        super().setUp()
        self._run()

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)
        super().tearDown()

    def test_device_daily_history_and_detail(self):
        response = self.client.get(f"/api/v1/diagnostics/devices/{DEVICE_ID}/daily")
        self.assertEqual(response.status_code, 200)
        days = response.json()
        self.assertEqual(
            [d["diagnosis_date"] for d in days],
            [DAY_HEALTHY.isoformat(), DAY_FAULT_2.isoformat(), DAY_FAULT_1.isoformat()],
        )

        detail = self.client.get(f"/api/v1/diagnostics/devices/{DEVICE_ID}/daily/{DAY_FAULT_2.isoformat()}")
        self.assertEqual(detail.status_code, 200)
        body = detail.json()
        self.assertIn("battery_voltage", body["metrics_summary"])
        issue = next(i for i in body["issues"] if i["issue_code"] == BATTERY_LOW)
        self.assertEqual(issue["component_name"], "device_battery")
        self.assertEqual(body["top_diagnoses"][0]["component_name"], "device_battery")

        missing = self.client.get(f"/api/v1/diagnostics/devices/{DEVICE_ID}/daily/{DAY_NO_RAW.isoformat()}")
        self.assertEqual(missing.status_code, 404)

    def test_device_issue_summary(self):
        response = self.client.get(f"/api/v1/diagnostics/devices/{DEVICE_ID}/issues?days=30")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["days_diagnosed"], 3)
        self.assertEqual(body["latest_lifecycle_state"], "HEALTHY")
        self.assertEqual(len(body["health_trend"]), 3)

        battery = next(i for i in body["issues"] if i["issue_code"] == BATTERY_LOW)
        self.assertEqual(battery["days_observed"], 2)
        self.assertEqual(battery["first_seen"], DAY_FAULT_1.isoformat())
        self.assertFalse(battery["is_active"])
        self.assertEqual(battery["current_streak_days"], 0)

    def test_fleet_daily_summary(self):
        latest = self.client.get("/api/v1/diagnostics/fleet/daily-summary").json()
        self.assertEqual(latest["diagnosis_date"], DAY_HEALTHY.isoformat())
        self.assertEqual(latest["devices_with_issues"], 0)
        self.assertGreater(latest["resolved_issue_count"], 0)

        response = self.client.get(
            f"/api/v1/diagnostics/fleet/daily-summary?diagnosis_date={DAY_FAULT_2.isoformat()}"
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["devices_diagnosed"], 1)
        self.assertEqual(body["devices_with_issues"], 1)
        self.assertEqual(body["max_severity_counts"], {"CRITICAL": 1})
        self.assertEqual(body["new_issue_count"], 0)
        battery = next(i for i in body["top_issues"] if i["issue_code"] == BATTERY_LOW)
        self.assertEqual(battery["device_count"], 1)
        self.assertEqual(battery["new_device_count"], 0)
        self.assertEqual(battery["component_name"], "device_battery")
        self.assertEqual(battery["check_type"], "METRIC_BELOW_MIN")
        self.assertEqual(body["worst_devices"][0]["device_id"], DEVICE_ID)

    def test_fleet_issue_search(self):
        persistent = self.client.get(
            f"/api/v1/diagnostics/fleet/issues?diagnosis_date={DAY_FAULT_2.isoformat()}&min_streak_days=2"
        ).json()
        self.assertIn(BATTERY_LOW, [i["issue_code"] for i in persistent])
        self.assertTrue(all(i["streak_days"] >= 2 for i in persistent))

        by_component = self.client.get(
            "/api/v1/diagnostics/fleet/issues"
            f"?start_date={DAY_FAULT_1.isoformat()}&end_date={DAY_FAULT_2.isoformat()}"
            "&component_name=device_battery&check_type=metric_below_min&severity=critical"
        ).json()
        self.assertEqual(len(by_component), 2)
        self.assertEqual(by_component[0]["diagnosis_date"], DAY_FAULT_2.isoformat())

        # No date filter falls back to the latest diagnosed day, which had no issues.
        self.assertEqual(self.client.get("/api/v1/diagnostics/fleet/issues").json(), [])

    def test_trigger_run_queues_background_task(self):
        with patch("app.api.v1.diagnostics.run_daily_diagnostics") as mock_run:
            response = self.client.post(
                "/api/v1/diagnostics/daily/run"
                f"?start_date={DAY_FAULT_1.isoformat()}&device_id={DEVICE_ID}&force=true"
            )
        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertEqual(body["start_date"], DAY_FAULT_1.isoformat())
        self.assertEqual(body["end_date"], (TODAY - timedelta(days=1)).isoformat())
        mock_run.assert_called_once_with(
            start_date=DAY_FAULT_1,
            end_date=TODAY - timedelta(days=1),
            device_ids=[DEVICE_ID],
            force=True,
        )

    def test_trigger_run_rejects_invalid_ranges(self):
        inverted = self.client.post(
            f"/api/v1/diagnostics/daily/run?start_date={DAY_FAULT_2.isoformat()}&end_date={DAY_FAULT_1.isoformat()}"
        )
        self.assertEqual(inverted.status_code, 400)

        expired = self.client.post("/api/v1/diagnostics/daily/run?start_date=2020-01-01&end_date=2020-01-05")
        self.assertEqual(expired.status_code, 400)


if __name__ == "__main__":
    unittest.main()
