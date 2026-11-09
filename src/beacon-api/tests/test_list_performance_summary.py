import math
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.models.device_data import SyncHourlyDeviceData
from app.models.device_schema import DeviceProfile
from app.models.health import DeviceDailyDiagnostic, DeviceDailyIssue
from app.models.sync import (
    SyncCohort,
    SyncCohortDevice,
    SyncDevice,
    SyncGrid,
    SyncGridSite,
    SyncSite,
    SyncSiteDevice,
)
from main import app


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


START = "2026-10-01T00:00:00.000Z"
END = "2026-10-02T23:59:59.999Z"
NOW = datetime(2026, 10, 3, 8, tzinfo=timezone.utc)

LISTS = {
    "cohorts": "/api/v1/cohorts/synced?group=airqo",
    "sites": "/api/v1/sites/?group=airqo",
    "grids": "/api/v1/grids/synced?group=airqo",
}


def perf_qs(start=START, end=END, frequency="hourly"):
    return f"includePerformance=true&startDateTime={start}&endDateTime={end}&frequency={frequency}"


SUMMARY = perf_qs() + "&includeSeries=false"


def _hourly(channel_id, day, hour, sensor1=10.0, sensor2=12.0, **fields):
    return SyncHourlyDeviceData(
        id=uuid.uuid4(),
        channel_id=channel_id,
        hour_start=datetime(2026, 10, day, hour, tzinfo=timezone.utc),
        field1_avg=sensor1,
        field3_avg=sensor2,
        record_count=1,
        complete=True,
        **fields,
    )


def _devices_of(kind, entity):
    if kind != "grids":
        return entity["devices"]
    return [device for site in entity["sites"] for device in site["devices"]]


class TestListPerformanceSummary(unittest.TestCase):
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
            SyncSiteDevice.__table__,
            SyncGrid.__table__,
            SyncGridSite.__table__,
            SyncHourlyDeviceData.__table__,
            DeviceProfile.__table__,
            DeviceDailyDiagnostic.__table__,
            DeviceDailyIssue.__table__,
        ]
        Base.metadata.create_all(self.engine, tables=self.tables)
        self.Session = sessionmaker(bind=self.engine)
        db = self.Session()

        profile_id = uuid.uuid4()
        db.add_all([
            DeviceProfile(
                id=profile_id,
                name="airgradient_lowcost",
                category="air_quality",
                telemetry_mappings={
                    "field5": {"key": "s1", "label": "pm2.5 sensor1"},
                    "field6": {"key": "s2", "label": "pm2.5 sensor2"},
                },
            ),
            SyncDevice(device_id="dev_1", device_name="aq_01", device_number=1, network_id="airqo", category="lowcost"),
            SyncDevice(device_id="dev_2", device_name="aq_02", device_number=2, network_id="airqo", category="lowcost"),
            SyncDevice(device_id="dev_3", device_name="aq_03", device_number=3, network_id="airqo", category="lowcost"),
            SyncDevice(device_id="dev_bam", device_name="bam_01", device_number=4, network_id="airqo", category="bam"),
            SyncDevice(device_id="dev_ag", device_name="ag_01", network_id="airgradient", profile_id=profile_id),
            SyncDevice(device_id="dev_plain", device_name="ag_02", network_id="airgradient"),
        ])
        db.commit()

        members = ["dev_1", "dev_2", "dev_3", "dev_bam"]
        db.add_all([
            SyncCohort(cohort_id="coh_a", name="a_cohort", number_of_devices=5, cohort_tags='["organizational"]'),
            SyncCohort(cohort_id="coh_mixed", name="mixed_cohort", number_of_devices=3),
            SyncSite(site_id="site_a", name="A site", network="airqo"),
            SyncSite(site_id="site_b", name="B site", network="airqo", country="Uganda"),
            SyncGrid(grid_id="grid_a", name="a_grid"),
            SyncGridSite(grid_id="grid_a", site_id="site_a"),
            SyncGridSite(grid_id="grid_a", site_id="site_b"),
            *[SyncCohortDevice(cohort_id="coh_a", device_id=d, is_active=True) for d in members],
            # In the cohort but with no sync_device row, so it can never report.
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_gone", is_active=False),
            *[SyncCohortDevice(cohort_id="coh_mixed", device_id=d, is_active=True)
              for d in ("dev_1", "dev_ag", "dev_plain")],
            *[SyncSiteDevice(site_id="site_a", device_id=d, is_active=True) for d in members],
            # The same device at a second site of the grid counts once.
            SyncSiteDevice(site_id="site_b", device_id="dev_1", is_active=True),
        ])
        db.add_all([
            # aq_01: four hours on the first day, three on the second.
            _hourly("1", 1, 0, 10, 12), _hourly("1", 1, 1, 20, 24), _hourly("1", 1, 2, 30, 30), _hourly("1", 1, 3, 40, 44),
            _hourly("1", 2, 0, 50, 55), _hourly("1", 2, 1, 70, 70),
            # A corrupt reading still shows the device was on, but can't be compared.
            _hourly("1", 2, 2, -1.3e24, 10),
            # Outside the window.
            _hourly("1", 3, 0, 500, 900),
            # aq_02: two hours on the first day.
            _hourly("2", 1, 0, 20, 22), _hourly("2", 1, 1, 40, 40),
            # aq_03 reports nothing. A BAM has no second sensor to compare.
            _hourly("4", 1, 5, 400, 900),
            # An external device whose profile puts the sensors in other fields.
            _hourly("dev_ag", 1, 0, 0, 0, field5_avg=30.0, field6_avg=40.0),
            # An external device on the default layout has no labelled sensor pair.
            _hourly("dev_plain", 1, 0, 500, 0),
        ])
        db.add(DeviceDailyDiagnostic(
            id=uuid.uuid4(),
            device_id="dev_1",
            diagnosis_date=datetime.now(timezone.utc).date() - timedelta(days=1),
            overall_health_score=47.0,
            lifecycle_state="LIKELY_FAILURE",
            subsystem_scores={},
            issue_count=0,
            headline="LIKELY_FAILURE (47/100)",
        ))
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
        now_patch = patch("app.services.performance_summary._utc_now", return_value=NOW)
        now_patch.start()
        self.addCleanup(now_patch.stop)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(self.engine, tables=self.tables)

    def _list(self, kind, qs):
        response = self.client.get(f"{LISTS[kind]}&{qs}")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()[kind]

    def _first(self, kind, qs):
        return self._list(kind, qs)[0]

    def test_series_is_returned_by_default(self):
        for kind in LISTS:
            with self.subTest(kind):
                entity = self._first(kind, perf_qs())
                self.assertTrue(entity["data"])
                self.assertIn("pm2.5 sensor1", entity["averages"])
                self.assertTrue(any(device["data"] for device in _devices_of(kind, entity)))
                self.assertIsNone(entity["daily"])
                self.assertIsNone(entity["error_margin"])
                self.assertEqual(entity, self._first(kind, perf_qs() + "&includeSeries=true&includeDevices=true"))

    def test_summary_leaves_out_the_readings(self):
        for kind in LISTS:
            with self.subTest(kind):
                entity = self._first(kind, SUMMARY)
                self.assertEqual(entity["data"], [])
                self.assertIsNone(entity["averages"])
                for device in _devices_of(kind, entity):
                    self.assertEqual(device["data"], [])
                    self.assertIsNone(device["averages"])

    def test_uptime_is_the_same_as_with_the_series(self):
        for kind in LISTS:
            with self.subTest(kind):
                full = self._first(kind, perf_qs())
                summary = self._first(kind, SUMMARY)
                self.assertEqual(summary["uptime"], full["uptime"])
                self.assertEqual(summary["data_completeness"], full["data_completeness"])
                # The full series leaves a device's second appearance in a grid blank.
                self.assertEqual(
                    {d["device_id"]: (d["uptime"], d["data_completeness"]) for d in _devices_of(kind, summary)},
                    {
                        d["device_id"]: (d["uptime"], d["data_completeness"])
                        for d in _devices_of(kind, full)
                        if d["uptime"] is not None
                    },
                )

    def test_daily_uptime_counts_every_device_for_every_hour(self):
        self.assertEqual(
            [(d["date"], d["uptime"]) for d in self._first("cohorts", SUMMARY)["daily"]],
            [("2026-10-01", 5.8333), ("2026-10-02", 2.5)],
        )
        # Sites and grids have no dev_gone, and the grid counts dev_1 once despite its two sites.
        for kind in ("sites", "grids"):
            with self.subTest(kind):
                self.assertEqual(
                    [(d["date"], d["uptime"]) for d in self._first(kind, SUMMARY)["daily"]],
                    [("2026-10-01", 7.2917), ("2026-10-02", 3.125)],
                )

    def test_sensors_are_averaged_across_devices_before_they_are_compared(self):
        entity = self._first("cohorts", SUMMARY)
        first_day, second_day = entity["daily"]
        self.assertEqual(first_day["error_margin"], 2.0)
        # Pearson of the hourly averages (15, 30, 30, 40) and (17, 32, 30, 44).
        self.assertAlmostEqual(first_day["correlation"], 338.75 / math.sqrt(318.75 * 366.75), places=4)
        # The corrupt hour is left out, so two hours remain.
        self.assertEqual(second_day["error_margin"], 2.5)
        self.assertEqual(second_day["correlation"], 1.0)
        self.assertEqual(entity["error_margin"], 2.25)
        self.assertAlmostEqual(entity["correlation"], (first_day["correlation"] + 1.0) / 2, places=3)

    def test_devices_with_sensors_in_other_fields_are_combined(self):
        cohorts = {c["cohort_id"]: c for c in self._list("cohorts", SUMMARY)}
        first_day = cohorts["coh_mixed"]["daily"][0]
        # Hour 0 averages aq_01 (10, 12) with ag_01 (30, 40); ag_02 has no sensor pair.
        self.assertEqual(first_day["error_margin"], (6 + 4 + 0 + 4) / 4)

    def test_offline_devices_are_those_without_a_reading_yesterday(self):
        self.assertEqual(self._first("cohorts", SUMMARY)["offline_devices"], 4)
        self.assertEqual(self._first("sites", SUMMARY)["offline_devices"], 3)
        self.assertEqual(self._first("grids", SUMMARY)["offline_devices"], 3)

    def test_daily_covers_the_last_days_of_a_window_that_starts_in_another_timezone(self):
        qs = perf_qs("2026-09-30T21:00:00.000Z", "2026-10-02T20:59:59.999Z") + "&includeSeries=false"
        self.assertEqual([d["date"] for d in self._first("cohorts", qs)["daily"]], ["2026-10-01", "2026-10-02"])

    def test_daily_ends_on_the_last_day_a_device_reported(self):
        qs = perf_qs("2026-10-01T00:00:00.000Z", "2026-10-04T23:59:59.999Z") + "&includeSeries=false"
        self.assertEqual(
            [d["date"] for d in self._first("cohorts", qs)["daily"]],
            ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"],
        )

    def test_a_cohort_without_readings_gets_empty_days(self):
        qs = perf_qs("2026-11-01T00:00:00.000Z", "2026-11-02T23:59:59.999Z") + "&includeSeries=false"
        entity = self._first("cohorts", qs)
        self.assertEqual(entity["uptime"], 0.0)
        self.assertIsNone(entity["error_margin"])
        self.assertIsNone(entity["correlation"])
        self.assertEqual(entity["offline_devices"], 5)
        self.assertEqual([d["uptime"] for d in entity["daily"]], [0.0, 0.0])

    def test_summary_does_not_read_the_readings(self):
        statements = []

        def record(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        event.listen(self.engine, "before_cursor_execute", record)
        try:
            with patch("app.services.cohort_service.get_device_data_for_devices") as full_read:
                for kind in LISTS:
                    self._first(kind, SUMMARY)
        finally:
            event.remove(self.engine, "before_cursor_execute", record)

        full_read.assert_not_called()
        readings_queries = [s for s in statements if "sync_hourly_device_data" in s]
        self.assertTrue(readings_queries)
        for statement in readings_queries:
            self.assertIn("GROUP BY", statement)

    def test_without_devices_the_counts_and_diagnostics_remain(self):
        qs = SUMMARY + "&includeDevices=false&includeDiagnostics=true"
        cohort = self._first("cohorts", qs)
        self.assertEqual(cohort["devices"], [])
        self.assertEqual(cohort["number_of_devices"], 5)
        self.assertEqual(cohort["diagnostics_summary"]["devices_total"], 5)
        self.assertEqual(cohort["diagnostics_summary"]["devices_diagnosed"], 1)
        self.assertEqual(len(cohort["daily"]), 2)

        site = self._first("sites", qs)
        self.assertEqual(site["devices"], [])
        self.assertEqual(site["number_of_devices"], 4)
        self.assertEqual(site["diagnostics_summary"]["devices_diagnosed"], 1)

    def test_a_grid_without_devices_keeps_its_count_and_country(self):
        grid = self._first("grids", SUMMARY + "&includeDevices=false&includeDiagnostics=true")
        self.assertEqual(grid["sites"], [])
        self.assertEqual(grid["number_of_sites"], 2)
        self.assertEqual(grid["number_of_devices"], 5)
        self.assertEqual(grid["country"], "Uganda")
        self.assertEqual(grid["diagnostics_summary"]["devices_diagnosed"], 1)

    def test_without_performance_nothing_is_summarised(self):
        for kind in LISTS:
            with self.subTest(kind):
                entity = self._first(kind, "includeSeries=false")
                self.assertIsNone(entity["uptime"])
                self.assertIsNone(entity["daily"])

    def test_requests_that_cannot_be_summarised_are_rejected(self):
        cases = {
            "daily frequency": perf_qs(frequency="daily"),
            "raw frequency": perf_qs(frequency="raw"),
            "not a date": perf_qs(start="yesterday"),
            "end before start": perf_qs(END, START),
            "over 30 days": perf_qs("2026-08-01T00:00:00.000Z", END),
        }
        for kind in LISTS:
            for label, qs in cases.items():
                with self.subTest(f"{kind}: {label}"):
                    response = self.client.get(f"{LISTS[kind]}&{qs}&includeSeries=false")
                    self.assertEqual(response.status_code, 400, response.text)


if __name__ == "__main__":
    unittest.main()
