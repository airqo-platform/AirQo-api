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
from app.schemas.grid import SyncedGridSiteDevice
from app.services.grid_sync_service import _build_grid_site_devices, get_synced_grids, get_synced_grid
from main import app


class TestSyncedGridDeviceNumber(unittest.TestCase):
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
            device_number=123456,
            network_id="airqo",
            site_id="site_1",
        )
        cohort_device = SyncCohortDevice(cohort_id="coh_1", device_id="dev_1", is_active=True)
        grid_site = SyncGridSite(grid_id="grid_1", site_id="site_1", is_active=True)
        site_device = SyncSiteDevice(site_id="site_1", device_id="dev_1", is_active=True)

        self.db.add_all([group, cohort, group_cohort, grid, site, device, cohort_device, grid_site, site_device])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine, tables=self.tables)

    def test_synced_grid_site_device_schema(self):
        dev_schema = SyncedGridSiteDevice(
            device_id="dev_1",
            device_name="aq_01",
            device_number=123456,
            latitude=0.3476,
            longitude=32.5825,
            is_active=True,
        )
        self.assertEqual(dev_schema.device_number, 123456)
        data = dev_schema.model_dump()
        self.assertIn("device_number", data)
        self.assertEqual(data["device_number"], 123456)

    def test_build_grid_site_devices_includes_device_number(self):
        devices = _build_grid_site_devices(self.db, "site_1")
        self.assertEqual(len(devices), 1)
        self.assertEqual(devices[0]["device_id"], "dev_1")
        self.assertEqual(devices[0]["device_name"], "aq_01")
        self.assertEqual(devices[0]["device_number"], 123456)

    def test_get_synced_grids_service(self):
        result = get_synced_grids(self.db, group_device_ids=["dev_1"])
        self.assertTrue(result["success"])
        self.assertEqual(len(result["grids"]), 1)
        grid = result["grids"][0]
        self.assertEqual(grid["grid_id"], "grid_1")
        self.assertEqual(len(grid["sites"]), 1)
        site = grid["sites"][0]
        self.assertEqual(len(site["devices"]), 1)
        dev = site["devices"][0]
        self.assertEqual(dev["device_number"], 123456)

    def test_get_synced_grid_single_service(self):
        result = get_synced_grid(self.db, "grid_1", group_device_ids=["dev_1"])
        self.assertTrue(result["success"])
        grid = result["grid"]
        self.assertEqual(grid["grid_id"], "grid_1")
        self.assertEqual(len(grid["sites"]), 1)
        site = grid["sites"][0]
        self.assertEqual(len(site["devices"]), 1)
        dev = site["devices"][0]
        self.assertEqual(dev["device_number"], 123456)

    def test_get_synced_grids_endpoint(self):
        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            response = client.get("/api/v1/grids/synced?skip=0&limit=20&group=airqo")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertEqual(len(data["grids"]), 1)
            devices = data["grids"][0]["sites"][0]["devices"]
            self.assertEqual(len(devices), 1)
            self.assertEqual(devices[0]["device_id"], "dev_1")
            self.assertEqual(devices[0]["device_name"], "aq_01")
            self.assertEqual(devices[0]["device_number"], 123456)
        finally:
            app.dependency_overrides.pop(get_db, None)


if __name__ == "__main__":
    unittest.main()
