import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.models.sync import (
    SyncGrid,
    SyncGridSite,
    SyncSite,
    SyncDevice,
    SyncSiteDevice,
    SyncGroup,
    SyncGroupCohort,
    SyncCohort,
    SyncCohortDevice,
)
from app.models.device_data import (
    SyncHourlyDeviceData,
    SyncRawDeviceData,
    SyncDailyDeviceData,
)
from app.schemas.maintenance import MapViewDeviceEntry, MapViewResponse
from app.services.maintenance_service import (
    get_synced_map_view,
    _make_map_view_entry,
    _build_stream_device_event,
)
from main import app


class TestMaintenanceMapViewSynced(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.tables = [
            SyncGrid.__table__,
            SyncGridSite.__table__,
            SyncSite.__table__,
            SyncDevice.__table__,
            SyncSiteDevice.__table__,
            SyncGroup.__table__,
            SyncGroupCohort.__table__,
            SyncCohort.__table__,
            SyncCohortDevice.__table__,
            SyncHourlyDeviceData.__table__,
            SyncRawDeviceData.__table__,
            SyncDailyDeviceData.__table__,
        ]
        Base.metadata.create_all(self.engine, tables=self.tables)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Populate sample data
        group = SyncGroup(group_id="grp_1", grp_title="airqo")
        cohort = SyncCohort(cohort_id="coh_1", name="airqo_cohort")
        group_cohort = SyncGroupCohort(group_id="grp_1", cohort_id="coh_1")

        grid = SyncGrid(grid_id="grid_1", name="Kampala Grid", network="airqo")
        site = SyncSite(site_id="site_1", name="Site A", latitude=0.3476, longitude=32.5825)
        device = SyncDevice(
            device_id="dev_1",
            device_name="aq_01",
            device_number=789012,
            network_id="airqo",
            site_id="site_1",
            status="deployed",
        )
        cohort_device = SyncCohortDevice(cohort_id="coh_1", device_id="dev_1", is_active=True)
        grid_site = SyncGridSite(grid_id="grid_1", site_id="site_1", is_active=True)
        site_device = SyncSiteDevice(site_id="site_1", device_id="dev_1", is_active=True)

        self.db.add_all([group, cohort, group_cohort, grid, site, device, cohort_device, grid_site, site_device])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine, tables=self.tables)

    def test_map_view_device_entry_schema(self):
        entry = MapViewDeviceEntry(
            device_id="dev_1",
            device_name="aq_01",
            device_number=789012,
            latitude=0.3476,
            longitude=32.5825,
            uptime=95.0,
            data_completeness=90.0,
            error_margin=1.2,
            cohorts=["airqo_cohort"],
            grids=["Kampala Grid"],
        )
        self.assertEqual(entry.device_number, 789012)
        data = entry.model_dump()
        self.assertIn("device_number", data)
        self.assertEqual(data["device_number"], 789012)

    def test_make_map_view_entry(self):
        dev = {
            "_id": "dev_1",
            "name": "aq_01",
            "device_number": 789012,
            "latitude": 0.3476,
            "longitude": 32.5825,
            "uptime": 95.0,
            "data_completeness": 90.0,
            "averages": {"pm2.5 sensor1": 15.0, "pm2.5 sensor2": 14.0},
        }
        entry = _make_map_view_entry(dev)
        self.assertEqual(entry["device_id"], "dev_1")
        self.assertEqual(entry["device_name"], "aq_01")
        self.assertEqual(entry["device_number"], 789012)
        self.assertEqual(entry["error_margin"], 1.0)

    def test_build_stream_device_event(self):
        dev = {
            "_id": "dev_1",
            "name": "aq_01",
            "device_number": 789012,
            "latitude": 0.3476,
            "longitude": 32.5825,
            "uptime": 95.0,
            "data_completeness": 90.0,
            "averages": {"pm2.5 sensor1": 15.0, "pm2.5 sensor2": 14.0},
        }
        event = _build_stream_device_event(dev, "airqo_cohort", db=self.db)
        self.assertEqual(event["event"], "device")
        self.assertEqual(event["data"]["device_number"], 789012)

    def test_get_synced_map_view_service(self):
        result = get_synced_map_view(self.db, cohort_ids=["coh_1"], days=14)
        self.assertTrue(result["success"])
        self.assertEqual(len(result["data"]), 1)
        device_entry = result["data"][0]
        self.assertEqual(device_entry["device_id"], "dev_1")
        self.assertEqual(device_entry["device_name"], "aq_01")
        self.assertEqual(device_entry["device_number"], 789012)

    def test_get_synced_map_view_endpoint(self):
        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            response = client.get("/api/v1/maintenance/map-view/synced?days=14&group=airqo")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertEqual(len(data["data"]), 1)
            entry = data["data"][0]
            self.assertEqual(entry["device_id"], "dev_1")
            self.assertEqual(entry["device_name"], "aq_01")
            self.assertEqual(entry["device_number"], 789012)
        finally:
            app.dependency_overrides.pop(get_db, None)


if __name__ == "__main__":
    unittest.main()
