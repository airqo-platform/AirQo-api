import unittest
import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.models.device_data import SyncDailyDeviceData, SyncHourlyDeviceData, SyncRawDeviceData
from app.models.device_schema import DeviceProfile
from app.models.health import DeviceDailyDiagnostic, DeviceDailyIssue
from app.models.sync import SyncCohort, SyncCohortDevice, SyncDevice, SyncSite
from main import app


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


START = "2026-10-01T00:00:00Z"
END = "2026-10-01T04:00:00Z"
URL = "/api/v1/cohorts/synced/coh_a"


def perf_qs(frequency="hourly", start=START, end=END):
    return f"includePerformance=true&startDateTime={start}&endDateTime={end}&frequency={frequency}"


def _at(hour):
    return datetime(2026, 10, 1, hour, tzinfo=timezone.utc)


def _hourly(channel_id, hour, field1=10.0):
    return SyncHourlyDeviceData(
        id=uuid.uuid4(), channel_id=channel_id, hour_start=_at(hour),
        field1_avg=field1, field3_avg=field1 + 10, record_count=1, complete=True,
    )


def _raw(channel_id, hour, minute, entry_id):
    return SyncRawDeviceData(
        id=uuid.uuid4(), channel_id=channel_id, entry_id=entry_id,
        created_at_ts=_at(hour) + timedelta(minutes=minute), field1=12.0, field3=22.0,
    )


def _daily(channel_id, day):
    return SyncDailyDeviceData(
        id=uuid.uuid4(), channel_id=channel_id, data_date=date(2026, 10, day),
        field1_avg=14.0, field3_avg=24.0, record_count=1, complete=True,
    )


class TestCohortIncludeSeries(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.tables = [
            SyncCohort.__table__,
            SyncCohortDevice.__table__,
            SyncDevice.__table__,
            SyncSite.__table__,
            SyncRawDeviceData.__table__,
            SyncHourlyDeviceData.__table__,
            SyncDailyDeviceData.__table__,
            DeviceProfile.__table__,
            DeviceDailyDiagnostic.__table__,
            DeviceDailyIssue.__table__,
        ]
        Base.metadata.create_all(self.engine, tables=self.tables)
        self.Session = sessionmaker(bind=self.engine)
        db = self.Session()

        db.add_all([
            SyncCohort(cohort_id="coh_a", name="ministry_cohort"),
            SyncCohort(cohort_id="coh_empty", name="empty_cohort"),
            SyncDevice(device_id="dev_1", device_name="aq_01", device_number=1, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_2", device_name="aq_02", device_number=2, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_3", device_name="aq_03", device_number=3, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_ag", device_name="ag_01", network_id="airgradient", status="deployed"),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_1", is_active=True),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_2", is_active=True),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_3", is_active=True),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_ag", is_active=True),
            # In the cohort but with no sync_device row, so it can never report.
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_gone", is_active=False),
        ])
        db.add_all([
            # aq_01: 2 of the 4 hours, plus one after the window that must not count.
            _hourly("1", 0), _hourly("1", 1, field1=30.0), _hourly("1", 5),
            # aq_02: its second row sits exactly on the end, which this endpoint counts.
            _hourly("2", 3), _hourly("2", 4),
            # aq_03 reports nothing. ag_01 is keyed by its device id, not a channel number.
            _hourly("dev_ag", 2),
            # Raw: two samples in one hour are one bucket, so aq_01 is 2 of 4 hours.
            _raw("1", 0, 5, 1), _raw("1", 0, 35, 2), _raw("1", 2, 5, 3),
            # Daily.
            _daily("1", 1), _daily("2", 1),
        ])
        db.add_all([
            DeviceDailyDiagnostic(
                id=uuid.uuid4(),
                device_id="dev_1",
                diagnosis_date=datetime.now(timezone.utc).date() - timedelta(days=1),
                overall_health_score=47.0,
                lifecycle_state="LIKELY_FAILURE",
                subsystem_scores={},
                issue_count=0,
                headline="LIKELY_FAILURE (47/100)",
            ),
        ])
        db.commit()
        db.close()

        def override_get_db():
            session = self.Session()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(self.engine, tables=self.tables)

    def _cohort(self, qs, url=URL):
        response = self.client.get(f"{url}?{qs}")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["cohort"]

    def test_series_is_returned_by_default_and_when_true(self):
        default = self._cohort(perf_qs())
        explicit = self._cohort(perf_qs() + "&includeSeries=true")
        self.assertEqual(default, explicit)

        self.assertEqual([row["datetime"][:13] for row in default["data"]], [
            "2026-10-01T00", "2026-10-01T01", "2026-10-01T02", "2026-10-01T03", "2026-10-01T04",
        ])
        self.assertIn("pm2.5 sensor1", default["averages"])
        devices = {d["device_id"]: d for d in default["devices"]}
        self.assertEqual(len(devices["dev_1"]["data"]), 2)
        self.assertEqual(devices["dev_1"]["averages"]["pm2.5 sensor1"], 20.0)
        # Devices that report nothing still get the empty shape, not null.
        self.assertEqual(devices["dev_3"]["data"], [])
        self.assertEqual(devices["dev_3"]["averages"], {})

    def test_false_leaves_out_data_and_averages(self):
        cohort = self._cohort(perf_qs() + "&includeSeries=false")
        self.assertEqual(cohort["data"], [])
        self.assertIsNone(cohort["averages"])
        self.assertEqual(len(cohort["devices"]), 5)
        for device in cohort["devices"]:
            self.assertEqual(device["data"], [], device["device_id"])
            self.assertIsNone(device["averages"], device["device_id"])

    def test_false_returns_the_expected_uptime(self):
        cohort = self._cohort(perf_qs() + "&includeSeries=false")
        self.assertEqual(
            {d["device_id"]: d["uptime"] for d in cohort["devices"]},
            {"dev_1": 50.0, "dev_2": 50.0, "dev_3": 0.0, "dev_ag": 25.0, "dev_gone": 0.0},
        )
        self.assertEqual(cohort["uptime"], 25.0)
        self.assertEqual(cohort["data_completeness"], 25.0)

    def test_uptime_is_the_same_either_way(self):
        windows = {
            "hourly": perf_qs("hourly"),
            "raw": perf_qs("raw"),
            "daily": perf_qs("daily", end="2026-10-02T00:00:00Z"),
            "no rows in window": perf_qs("hourly", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"),
            "end before start": perf_qs("hourly", END, START),
        }
        for label, qs in windows.items():
            with self.subTest(label):
                full = self._cohort(qs)
                light = self._cohort(qs + "&includeSeries=false")
                self.assertEqual(light["uptime"], full["uptime"])
                self.assertEqual(light["data_completeness"], full["data_completeness"])
                self.assertEqual(
                    [(d["device_id"], d["uptime"], d["data_completeness"]) for d in light["devices"]],
                    [(d["device_id"], d["uptime"], d["data_completeness"]) for d in full["devices"]],
                )

    def test_raw_and_daily_uptime_values(self):
        raw = self._cohort(perf_qs("raw") + "&includeSeries=false")
        self.assertEqual({d["device_id"]: d["uptime"] for d in raw["devices"]}["dev_1"], 50.0)
        daily = self._cohort(perf_qs("daily", end="2026-10-02T00:00:00Z") + "&includeSeries=false")
        self.assertEqual({d["device_id"]: d["uptime"] for d in daily["devices"]}["dev_1"], 50.0)

    def test_false_does_not_read_the_readings(self):
        statements = []

        def record(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        event.listen(self.engine, "before_cursor_execute", record)
        try:
            with patch("app.services.cohort_service.get_device_data_for_devices") as full_read:
                self._cohort(perf_qs() + "&includeSeries=false")
        finally:
            event.remove(self.engine, "before_cursor_execute", record)

        full_read.assert_not_called()
        readings_queries = [s for s in statements if "sync_hourly_device_data" in s]
        self.assertTrue(readings_queries)
        for statement in readings_queries:
            self.assertNotIn("field", statement)

    def test_false_keeps_diagnostics(self):
        cohort = self._cohort(perf_qs() + "&includeSeries=false&includeDiagnostics=true")
        self.assertEqual(cohort["diagnostics_summary"]["devices_total"], 5)
        self.assertEqual(cohort["diagnostics_summary"]["devices_diagnosed"], 1)
        devices = {d["device_id"]: d for d in cohort["devices"]}
        self.assertEqual(devices["dev_1"]["diagnostics"]["headline"], "LIKELY_FAILURE (47/100)")
        self.assertEqual(devices["dev_1"]["uptime"], 50.0)
        self.assertEqual(devices["dev_1"]["data"], [])

    def test_false_without_performance_changes_nothing(self):
        self.assertEqual(self._cohort("includeSeries=false"), self._cohort("includePerformance=false"))
        self.assertIsNone(self._cohort("includeSeries=false")["uptime"])

    def test_false_on_a_cohort_without_devices(self):
        cohort = self._cohort(perf_qs() + "&includeSeries=false", url="/api/v1/cohorts/synced/coh_empty")
        self.assertEqual(cohort["uptime"], 0.0)
        self.assertEqual(cohort["data_completeness"], 0.0)
        self.assertIsNone(cohort["averages"])
        self.assertEqual(cohort["data"], [])

    def test_false_on_an_unknown_cohort_is_still_a_404(self):
        response = self.client.get(f"/api/v1/cohorts/synced/missing?{perf_qs()}&includeSeries=false")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
