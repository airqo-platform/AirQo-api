import unittest
from unittest.mock import patch
from urllib.parse import parse_qs

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.models.device_data import SyncRawDeviceData
from app.models.device_schema import DeviceProfile
from app.models.sync import (
    SyncSite,
    SyncDevice,
    SyncSiteDevice,
    SyncGroup,
    SyncGroupCohort,
    SyncCohort,
    SyncCohortDevice,
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from main import app


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


START = "2026-10-01T00:00:00Z"
END = "2026-10-01T04:00:00Z"
PERF_QS = f"includePerformance=true&startDateTime={START}&endDateTime={END}&frequency=hourly"

# aq_01 reports in 2 of the 4 hourly buckets; every other device reports nothing.
FAKE_RECORDS = {
    "aq_01": [
        {"datetime": "2026-10-01T00:00:00+00:00", "frequency": "hourly", "field1": 10.0, "field3": 20.0},
        {"datetime": "2026-10-01T01:00:00+00:00", "frequency": "hourly", "field1": 30.0, "field3": 40.0},
    ],
}


def fake_get_device_data_for_devices(db, device_names, start, end, frequency="hourly"):
    records = {name: list(FAKE_RECORDS.get(name, [])) for name in device_names}
    info = {name: {"category": "lowcost"} for name in device_names}
    return records, info


class TestSiteAndDeviceHealth(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.tables = [
            SyncSite.__table__,
            SyncDevice.__table__,
            SyncSiteDevice.__table__,
            SyncGroup.__table__,
            SyncGroupCohort.__table__,
            SyncCohort.__table__,
            SyncCohortDevice.__table__,
            SyncRawDeviceData.__table__,
            DeviceProfile.__table__,
        ]
        Base.metadata.create_all(self.engine, tables=self.tables)
        self.Session = sessionmaker(bind=self.engine)
        db = self.Session()

        # Group "ministry" -> cohort coh_a -> devices dev_1, dev_3, dev_4.
        # dev_2 is airqo but outside the group; dev_3 is in the group but on another
        # network (kcca) — listed like any other manufacturer unless filtered by network.
        db.add_all([
            SyncGroup(group_id="grp_a", grp_title="ministry"),
            SyncCohort(cohort_id="coh_a", name="ministry_cohort"),
            SyncGroupCohort(group_id="grp_a", cohort_id="coh_a"),
            SyncSite(site_id="site_1", name="A Site"),
            SyncSite(site_id="site_2", name="B Site"),
            SyncSite(site_id="site_3", name="C Site"),
            SyncSite(site_id="site_4", name="D Site"),
            SyncDevice(device_id="dev_1", device_name="aq_01", device_number=1, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_2", device_name="aq_02", device_number=2, network_id="airqo", status="deployed"),
            SyncDevice(device_id="dev_3", device_name="other_01", device_number=3, network_id="kcca", status="deployed"),
            SyncDevice(device_id="dev_4", device_name="aq_04", device_number=4, network_id="airqo", status="deployed"),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_1", is_active=True),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_3", is_active=True),
            SyncCohortDevice(cohort_id="coh_a", device_id="dev_4", is_active=True),
            SyncSiteDevice(site_id="site_1", device_id="dev_1", is_active=True),
            SyncSiteDevice(site_id="site_1", device_id="dev_2", is_active=True),
            SyncSiteDevice(site_id="site_2", device_id="dev_3", is_active=True),
            SyncSiteDevice(site_id="site_3", device_id="dev_4", is_active=True),
            SyncSiteDevice(site_id="site_4", device_id="dev_2", is_active=True),
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
        patcher = patch(
            "app.services.cohort_service.get_device_data_for_devices",
            side_effect=fake_get_device_data_for_devices,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(self.engine, tables=self.tables)

    # --- sites -------------------------------------------------------------

    def test_sites_without_group_are_unscoped(self):
        data = self.client.get("/api/v1/sites/").json()
        self.assertEqual([s["site_id"] for s in data["sites"]], ["site_1", "site_2", "site_3", "site_4"])
        site_1 = data["sites"][0]
        self.assertEqual({d["device_id"] for d in site_1["devices"]}, {"dev_1", "dev_2"})
        self.assertIsNone(site_1["uptime"])

    def test_sites_scoped_to_group(self):
        data = self.client.get("/api/v1/sites/?group=ministry").json()
        self.assertEqual(data["meta"]["total"], 3)
        self.assertEqual([s["site_id"] for s in data["sites"]], ["site_1", "site_2", "site_3"])
        site_1 = data["sites"][0]
        self.assertEqual([d["device_id"] for d in site_1["devices"]], ["dev_1"])
        self.assertEqual(site_1["number_of_devices"], 1)

    def test_sites_with_performance(self):
        data = self.client.get(f"/api/v1/sites/?group=ministry&{PERF_QS}").json()
        # site_2 only holds a non-airqo device, so it drops out before paging.
        self.assertEqual(data["meta"]["total"], 2)
        sites = {s["site_id"]: s for s in data["sites"]}
        self.assertEqual(set(sites), {"site_1", "site_3"})

        site_1 = sites["site_1"]
        self.assertEqual(site_1["uptime"], 50.0)
        self.assertEqual(site_1["data_completeness"], 50.0)
        self.assertEqual(site_1["averages"]["pm2.5 sensor1"], 20.0)
        self.assertEqual(len(site_1["data"]), 2)
        dev_1 = site_1["devices"][0]
        self.assertEqual(dev_1["uptime"], 50.0)
        self.assertEqual(len(dev_1["data"]), 2)

        site_3 = sites["site_3"]
        self.assertEqual(site_3["uptime"], 0.0)
        self.assertEqual(site_3["devices"][0]["uptime"], 0.0)

    def test_performance_needs_both_dates(self):
        data = self.client.get(f"/api/v1/sites/?group=ministry&includePerformance=true&startDateTime={START}").json()
        self.assertEqual(data["meta"]["total"], 3)
        self.assertIsNone(data["sites"][0]["uptime"])

    def test_single_site_with_performance(self):
        response = self.client.get(f"/api/v1/sites/site_1?group=ministry&{PERF_QS}")
        self.assertEqual(response.status_code, 200)
        site = response.json()["site"]
        self.assertEqual(site["uptime"], 50.0)
        self.assertEqual([d["device_id"] for d in site["devices"]], ["dev_1"])

    def test_single_site_outside_group_is_404(self):
        response = self.client.get("/api/v1/sites/site_4?group=ministry")
        self.assertEqual(response.status_code, 404)

    def test_single_site_without_airqo_devices_is_404_with_performance(self):
        self.assertEqual(self.client.get("/api/v1/sites/site_2?group=ministry").status_code, 200)
        response = self.client.get(f"/api/v1/sites/site_2?group=ministry&{PERF_QS}")
        self.assertEqual(response.status_code, 404)

    def test_unknown_group_is_404(self):
        response = self.client.get("/api/v1/sites/?group=nope")
        self.assertEqual(response.status_code, 404)

    def test_empty_group_is_400(self):
        self.assertEqual(self.client.get("/api/v1/sites/?group=").status_code, 400)
        self.assertEqual(self.client.get("/api/v1/sites/site_1?group=").status_code, 400)

    def test_invalid_frequency_is_400(self):
        response = self.client.get("/api/v1/sites/?frequency=weekly")
        self.assertEqual(response.status_code, 400)

    # --- devices -----------------------------------------------------------

    def test_synced_devices_without_performance(self):
        data = self.client.get("/api/v1/devices/synced?group=ministry").json()
        # Every manufacturer's devices are listed; dev_3 is on the kcca network.
        self.assertEqual([d["_id"] for d in data["devices"]], ["dev_1", "dev_4", "dev_3"])
        self.assertNotIn("uptime", data["devices"][0])

        # The network filter narrows the list to one manufacturer.
        data = self.client.get("/api/v1/devices/synced?group=ministry&network=airqo").json()
        self.assertEqual([d["_id"] for d in data["devices"]], ["dev_1", "dev_4"])

    def test_synced_devices_with_performance(self):
        response = self.client.get(f"/api/v1/devices/synced?group=ministry&{PERF_QS}")
        self.assertEqual(response.status_code, 200)
        devices = {d["_id"]: d for d in response.json()["devices"]}
        self.assertEqual(devices["dev_1"]["uptime"], 50.0)
        self.assertEqual(devices["dev_1"]["data_completeness"], 50.0)
        self.assertEqual(devices["dev_1"]["averages"]["pm2.5"], 25.0)
        self.assertEqual(len(devices["dev_1"]["data"]), 2)
        self.assertEqual(devices["dev_4"]["uptime"], 0.0)
        self.assertEqual(devices["dev_4"]["data"], [])

    def test_synced_devices_next_page_keeps_performance_params(self):
        data = self.client.get(f"/api/v1/devices/synced?group=ministry&limit=1&{PERF_QS}").json()
        next_params = parse_qs(data["meta"]["nextPage"])
        self.assertEqual(next_params["includePerformance"], ["true"])
        self.assertEqual(next_params["startDateTime"], [START])
        self.assertEqual(next_params["endDateTime"], [END])
        self.assertEqual(next_params["skip"], ["1"])

    def test_synced_devices_invalid_frequency_is_400(self):
        response = self.client.get("/api/v1/devices/synced?group=ministry&frequency=weekly")
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
