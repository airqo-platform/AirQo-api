import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.models.device_data import SyncRawDeviceData
from app.models.device_schema import DeviceProfile
from app.models.health import DeviceDailyDiagnostic, DeviceDailyIssue
from app.models.sync import (
    SyncCohort,
    SyncCohortDevice,
    SyncDevice,
    SyncGrid,
    SyncGridSite,
    SyncGroup,
    SyncGroupCohort,
    SyncSite,
    SyncSiteDevice,
)
from app.services.diagnostics.summaries import load_latest_diagnostics, summarize_diagnostics
from main import app


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


TODAY = datetime.now(timezone.utc).date()
YESTERDAY = TODAY - timedelta(days=1)

BATTERY = "METRIC_BELOW_MIN:device_battery.battery_voltage"
GAPS = "DATA_GAPS:device"
SENSOR = "SENSOR_DISAGREEMENT:pm_sensor_1"
STUCK = "METRIC_STUCK:device.temperature"


def _diagnosis(device_id, day, score, state, issues=()):
    diagnostic = DeviceDailyDiagnostic(
        id=uuid.uuid4(),
        device_id=device_id,
        diagnosis_date=day,
        overall_health_score=score,
        lifecycle_state=state,
        subsystem_scores={},
        issue_count=len(issues),
        max_severity=max((s for _, s, _ in issues), key=["LOW", "MEDIUM", "HIGH", "CRITICAL"].index, default=None),
        top_cause_code=issues[0][0] if issues else None,
        headline=f"{state} ({score:.0f}/100)",
    )
    rows = [diagnostic]
    for code, severity, streak in issues:
        rows.append(DeviceDailyIssue(
            id=uuid.uuid4(),
            daily_diagnostic_id=diagnostic.id,
            device_id=device_id,
            diagnosis_date=day,
            issue_code=code,
            check_type=code.split(":", 1)[0],
            title=f"title {code}",
            subsystem=code.split(":", 1)[1].split(".")[0],
            severity=severity,
            is_new=streak == 1,
            streak_days=streak,
            streak_start_date=day - timedelta(days=streak - 1),
        ))
    return rows


class TestDiagnosticsSummaries(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.tables = [
            SyncGroup.__table__,
            SyncGroupCohort.__table__,
            SyncCohort.__table__,
            SyncCohortDevice.__table__,
            SyncDevice.__table__,
            SyncSite.__table__,
            SyncSiteDevice.__table__,
            SyncGrid.__table__,
            SyncGridSite.__table__,
            SyncRawDeviceData.__table__,
            DeviceProfile.__table__,
            DeviceDailyDiagnostic.__table__,
            DeviceDailyIssue.__table__,
        ]
        Base.metadata.create_all(self.engine, tables=self.tables)
        self.Session = sessionmaker(bind=self.engine)
        db = self.Session()

        # Group "ministry" -> coh_a -> dev_1, dev_2, dev_3. Group "other" -> coh_b -> dev_4.
        # Grid grid_1 holds site_1 (dev_1, dev_2) and site_2 (dev_3); site_3 (dev_4) is outside it.
        db.add_all([
            SyncGroup(group_id="grp_a", grp_title="ministry"),
            SyncGroup(group_id="grp_b", grp_title="other"),
            SyncCohort(cohort_id="coh_a", name="ministry_cohort"),
            SyncCohort(cohort_id="coh_b", name="other_cohort"),
            SyncGroupCohort(group_id="grp_a", cohort_id="coh_a"),
            SyncGroupCohort(group_id="grp_b", cohort_id="coh_b"),
            SyncDevice(device_id="dev_1", device_name="aq_01", device_number=1, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_2", device_name="aq_02", device_number=2, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_3", device_name="aq_03", device_number=3, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_4", device_name="aq_04", device_number=4, network_id="airqo", status="deployed"),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_1", is_active=True),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_2", is_active=True),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_3", is_active=True),
            SyncCohortDevice(cohort_id="coh_b", device_id="dev_4", is_active=True),
            SyncSite(site_id="site_1", name="A Site"),
            SyncSite(site_id="site_2", name="B Site"),
            SyncSite(site_id="site_3", name="C Site"),
            SyncSiteDevice(site_id="site_1", device_id="dev_1", is_active=True),
            SyncSiteDevice(site_id="site_1", device_id="dev_2", is_active=True),
            SyncSiteDevice(site_id="site_2", device_id="dev_3", is_active=True),
            SyncSiteDevice(site_id="site_3", device_id="dev_4", is_active=True),
            SyncGrid(grid_id="grid_1", name="Kampala", network="airqo"),
            SyncGridSite(grid_id="grid_1", site_id="site_1", is_active=True),
            SyncGridSite(grid_id="grid_1", site_id="site_2", is_active=True),
        ])
        # dev_1: healthy five days ago, failing yesterday with four issues (latest wins).
        db.add_all(_diagnosis("dev_1", TODAY - timedelta(days=5), 95.0, "HEALTHY"))
        db.add_all(_diagnosis("dev_1", YESTERDAY, 47.0, "LIKELY_FAILURE", [
            (GAPS, "HIGH", 2),
            (STUCK, "LOW", 1),
            (BATTERY, "CRITICAL", 4),
            (SENSOR, "MEDIUM", 1),
        ]))
        # dev_2: last diagnosed two days ago (offline since), one new issue.
        db.add_all(_diagnosis("dev_2", TODAY - timedelta(days=2), 70.0, "DEGRADING", [(GAPS, "MEDIUM", 1)]))
        # dev_3: only diagnosed outside the 7-day window, so it counts as not diagnosed.
        db.add_all(_diagnosis("dev_3", TODAY - timedelta(days=10), 90.0, "HEALTHY"))
        # dev_4 (other group): healthy yesterday.
        db.add_all(_diagnosis("dev_4", YESTERDAY, 98.0, "HEALTHY"))
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

    # --- shared helper ------------------------------------------------------

    def test_load_latest_diagnostics_picks_latest_day_in_window(self):
        db = self.Session()
        try:
            diagnoses = load_latest_diagnostics(db, ["dev_1", "dev_2", "dev_3", "dev_1", None, "missing"])
        finally:
            db.close()
        self.assertEqual(set(diagnoses), {"dev_1", "dev_2"})
        dev_1 = diagnoses["dev_1"]
        self.assertEqual(dev_1["diagnosis_date"], YESTERDAY)
        self.assertEqual(dev_1["lifecycle_state"], "LIKELY_FAILURE")
        self.assertEqual([i["severity"] for i in dev_1["issues"]], ["CRITICAL", "HIGH", "MEDIUM", "LOW"])
        self.assertEqual(dev_1["issues"][0]["streak_days"], 4)
        self.assertEqual(diagnoses["dev_2"]["diagnosis_date"], TODAY - timedelta(days=2))

    def test_summarize_diagnostics(self):
        db = self.Session()
        try:
            diagnoses = load_latest_diagnostics(db, ["dev_1", "dev_2", "dev_3"])
        finally:
            db.close()
        summary = summarize_diagnostics(["dev_1", "dev_2", "dev_3", "dev_2"], diagnoses)
        self.assertEqual(summary["devices_total"], 3)
        self.assertEqual(summary["devices_diagnosed"], 2)
        self.assertEqual(summary["devices_not_diagnosed"], 1)
        self.assertEqual(summary["devices_with_issues"], 2)
        self.assertEqual(summary["average_health_score"], 58.5)
        self.assertEqual(summary["min_health_score"], 47.0)
        self.assertEqual(summary["lifecycle_state_counts"], {"LIKELY_FAILURE": 1, "DEGRADING": 1})
        self.assertEqual(summary["max_severity"], "CRITICAL")
        self.assertEqual(summary["latest_diagnosis_date"], YESTERDAY)
        # Data gaps affect both devices, so it ranks first, at its highest severity.
        self.assertEqual(summary["top_issues"][0], {
            "issue_code": GAPS, "title": f"title {GAPS}", "severity": "HIGH", "subsystem": "device", "device_count": 2,
        })
        self.assertEqual(summary["top_issues"][1]["issue_code"], BATTERY)

    def test_summarize_with_no_diagnoses(self):
        summary = summarize_diagnostics(["dev_3"], {})
        self.assertEqual(summary["devices_not_diagnosed"], 1)
        self.assertIsNone(summary["average_health_score"])
        self.assertIsNone(summary["max_severity"])
        self.assertEqual(summary["top_issues"], [])

    # --- list endpoints -----------------------------------------------------

    def test_devices_include_diagnostics(self):
        data = self.client.get("/api/v1/devices/synced?group=ministry&includeDiagnostics=true").json()
        devices = {d["_id"]: d for d in data["devices"]}
        dev_1 = devices["dev_1"]["diagnostics"]
        self.assertEqual(dev_1["diagnosis_date"], YESTERDAY.isoformat())
        self.assertEqual(dev_1["overall_health_score"], 47.0)
        self.assertEqual(dev_1["issue_count"], 4)
        # Only the three most severe issues are attached to each device.
        self.assertEqual([i["issue_code"] for i in dev_1["issues"]], [BATTERY, GAPS, SENSOR])
        self.assertIsNone(devices["dev_3"]["diagnostics"])

    def test_devices_without_flag_have_no_diagnostics(self):
        data = self.client.get("/api/v1/devices/synced?group=ministry").json()
        self.assertNotIn("diagnostics", data["devices"][0])

    def test_devices_next_page_keeps_diagnostics_flag(self):
        data = self.client.get("/api/v1/devices/synced?group=ministry&limit=1&includeDiagnostics=true").json()
        self.assertIn("includeDiagnostics=true", data["meta"]["nextPage"])

    def test_sites_include_diagnostics(self):
        data = self.client.get("/api/v1/sites/?group=ministry&includeDiagnostics=true").json()
        sites = {s["site_id"]: s for s in data["sites"]}
        site_1 = sites["site_1"]["diagnostics_summary"]
        self.assertEqual(site_1["devices_total"], 2)
        self.assertEqual(site_1["devices_diagnosed"], 2)
        self.assertEqual(site_1["average_health_score"], 58.5)
        self.assertEqual(site_1["max_severity"], "CRITICAL")
        self.assertEqual(site_1["top_issues"][0]["device_count"], 2)
        devices = {d["device_id"]: d for d in sites["site_1"]["devices"]}
        self.assertEqual(devices["dev_2"]["diagnostics"]["lifecycle_state"], "DEGRADING")

        site_2 = sites["site_2"]["diagnostics_summary"]
        self.assertEqual(site_2["devices_not_diagnosed"], 1)
        self.assertIsNone(sites["site_2"]["devices"][0]["diagnostics"])

    def test_sites_without_flag_have_no_summary(self):
        data = self.client.get("/api/v1/sites/?group=ministry").json()
        self.assertIsNone(data["sites"][0]["diagnostics_summary"])
        self.assertIsNone(data["sites"][0]["devices"][0]["diagnostics"])

    def test_single_site_include_diagnostics(self):
        site = self.client.get("/api/v1/sites/site_1?includeDiagnostics=true").json()["site"]
        self.assertEqual(site["diagnostics_summary"]["devices_diagnosed"], 2)

    def test_sites_combine_performance_and_diagnostics(self):
        start, end = f"{YESTERDAY.isoformat()}T00:00:00Z", f"{TODAY.isoformat()}T00:00:00Z"
        with patch(
            "app.services.cohort_service.get_device_data_for_devices",
            side_effect=lambda db, names, s, e, frequency="hourly": ({n: [] for n in names}, {}),
        ):
            data = self.client.get(
                f"/api/v1/sites/?group=ministry&includePerformance=true&startDateTime={start}"
                f"&endDateTime={end}&includeDiagnostics=true"
            ).json()
        site_1 = next(s for s in data["sites"] if s["site_id"] == "site_1")
        self.assertEqual(site_1["uptime"], 0.0)
        self.assertEqual(site_1["diagnostics_summary"]["devices_diagnosed"], 2)

    def test_grids_include_diagnostics(self):
        data = self.client.get("/api/v1/grids/synced?group=ministry&includeDiagnostics=true").json()
        grid = data["grids"][0]
        self.assertEqual(grid["diagnostics_summary"]["devices_total"], 3)
        self.assertEqual(grid["diagnostics_summary"]["devices_diagnosed"], 2)
        self.assertEqual(grid["diagnostics_summary"]["lifecycle_state_counts"], {"LIKELY_FAILURE": 1, "DEGRADING": 1})
        sites = {s["site_id"]: s for s in grid["sites"]}
        self.assertEqual(sites["site_1"]["diagnostics_summary"]["devices_diagnosed"], 2)
        self.assertEqual(sites["site_2"]["diagnostics_summary"]["devices_not_diagnosed"], 1)
        devices = {d["device_id"]: d for d in sites["site_1"]["devices"]}
        self.assertEqual(devices["dev_1"]["diagnostics"]["headline"], "LIKELY_FAILURE (47/100)")

    def test_single_grid_include_diagnostics(self):
        grid = self.client.get("/api/v1/grids/synced/grid_1?group=ministry&includeDiagnostics=true").json()["grid"]
        self.assertEqual(grid["diagnostics_summary"]["devices_total"], 3)

    def test_cohorts_include_diagnostics(self):
        data = self.client.get("/api/v1/cohorts/synced?group=ministry&includeDiagnostics=true").json()
        cohort = data["cohorts"][0]
        self.assertEqual(cohort["cohort_id"], "coh_a")
        self.assertEqual(cohort["diagnostics_summary"]["devices_total"], 3)
        self.assertEqual(cohort["diagnostics_summary"]["devices_with_issues"], 2)
        devices = {d["device_id"]: d for d in cohort["devices"]}
        self.assertEqual(devices["dev_1"]["diagnostics"]["max_severity"], "CRITICAL")

    def test_single_cohort_include_diagnostics(self):
        cohort = self.client.get("/api/v1/cohorts/synced/coh_b?includeDiagnostics=true").json()["cohort"]
        self.assertEqual(cohort["diagnostics_summary"]["lifecycle_state_counts"], {"HEALTHY": 1})

    # --- fleet summary by group --------------------------------------------

    def test_fleet_summary_whole_fleet(self):
        fleet = self.client.get("/api/v1/diagnostics/fleet/daily-summary").json()
        self.assertEqual(fleet["diagnosis_date"], YESTERDAY.isoformat())
        self.assertEqual(fleet["devices_diagnosed"], 2)

    def test_fleet_summary_scoped_to_group(self):
        fleet = self.client.get("/api/v1/diagnostics/fleet/daily-summary?group=ministry").json()
        self.assertEqual(fleet["diagnosis_date"], YESTERDAY.isoformat())
        self.assertEqual(fleet["devices_diagnosed"], 1)
        self.assertEqual(fleet["lifecycle_state_counts"], {"LIKELY_FAILURE": 1})
        self.assertEqual([d["device_id"] for d in fleet["worst_devices"]], ["dev_1"])
        self.assertEqual(len(fleet["top_issues"]), 4)

        other = self.client.get("/api/v1/diagnostics/fleet/daily-summary?group=other").json()
        self.assertEqual(other["lifecycle_state_counts"], {"HEALTHY": 1})
        self.assertEqual(other["top_issues"], [])

    def test_fleet_summary_group_defaults_to_its_own_latest_day(self):
        db = self.Session()
        try:
            db.query(DeviceDailyIssue).filter(DeviceDailyIssue.device_id == "dev_1").delete()
            db.query(DeviceDailyDiagnostic).filter(DeviceDailyDiagnostic.device_id == "dev_1").delete()
            db.commit()
        finally:
            db.close()
        fleet = self.client.get("/api/v1/diagnostics/fleet/daily-summary?group=ministry").json()
        self.assertEqual(fleet["diagnosis_date"], (TODAY - timedelta(days=2)).isoformat())
        self.assertEqual(fleet["devices_diagnosed"], 1)

    def test_fleet_summary_supergroup_is_unscoped(self):
        fleet = self.client.get("/api/v1/diagnostics/fleet/daily-summary?group=airqo").json()
        self.assertEqual(fleet["devices_diagnosed"], 2)

    def test_fleet_summary_unknown_group_is_404(self):
        response = self.client.get("/api/v1/diagnostics/fleet/daily-summary?group=nope")
        self.assertEqual(response.status_code, 404)

    # --- fleet issues by group ---------------------------------------------

    def test_fleet_issues_scoped_to_group(self):
        issues = self.client.get("/api/v1/diagnostics/fleet/issues?group=ministry").json()
        self.assertEqual({i["device_id"] for i in issues}, {"dev_1"})
        self.assertEqual([i["issue_code"] for i in issues], [BATTERY, GAPS, SENSOR, STUCK])
        self.assertEqual(issues[0]["device_name"], "aq_01")

        self.assertEqual(self.client.get("/api/v1/diagnostics/fleet/issues?group=other").json(), [])

    def test_fleet_issues_group_combines_with_other_filters(self):
        critical = self.client.get("/api/v1/diagnostics/fleet/issues?group=ministry&severity=critical").json()
        self.assertEqual([i["issue_code"] for i in critical], [BATTERY])

        since = (TODAY - timedelta(days=7)).isoformat()
        gaps = self.client.get(f"/api/v1/diagnostics/fleet/issues?group=ministry&start_date={since}&issue_code={GAPS}").json()
        self.assertEqual([i["device_id"] for i in gaps], ["dev_1", "dev_2"])

    def test_fleet_issues_group_defaults_to_its_own_latest_day(self):
        db = self.Session()
        try:
            db.query(DeviceDailyIssue).filter(DeviceDailyIssue.device_id == "dev_1").delete()
            db.query(DeviceDailyDiagnostic).filter(DeviceDailyDiagnostic.device_id == "dev_1").delete()
            db.commit()
        finally:
            db.close()
        issues = self.client.get("/api/v1/diagnostics/fleet/issues?group=ministry").json()
        self.assertEqual([(i["device_id"], i["issue_code"]) for i in issues], [("dev_2", GAPS)])

    def test_fleet_issues_supergroup_is_unscoped(self):
        unscoped = self.client.get("/api/v1/diagnostics/fleet/issues").json()
        supergroup = self.client.get("/api/v1/diagnostics/fleet/issues?group=airqo").json()
        self.assertEqual(len(supergroup), len(unscoped))

    def test_fleet_issues_unknown_group_is_404(self):
        response = self.client.get("/api/v1/diagnostics/fleet/issues?group=nope")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
