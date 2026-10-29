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
    get_synced_site_map_view,
    _make_map_view_entry,
    _build_stream_device_event,
    _latest_timestamp,
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

    def test_get_device_metrics_for_map_view_crud(self):
        import uuid
        from datetime import datetime, timezone, timedelta
        from app.crud.crud_sync_device_data import get_device_metrics_for_map_view

        now = datetime.now(timezone.utc)
        h1 = now - timedelta(hours=2)
        h2 = now - timedelta(hours=1)

        row1 = SyncHourlyDeviceData(
            id=uuid.uuid4(),
            channel_id="789012",
            hour_start=h1,
            field1_avg=20.0,
            field3_avg=17.5,
            record_count=60,
            complete=True,
        )
        row2 = SyncHourlyDeviceData(
            id=uuid.uuid4(),
            channel_id="789012",
            hour_start=h2,
            field1_avg=22.0,
            field3_avg=18.5,
            record_count=60,
            complete=True,
        )
        self.db.add_all([row1, row2])
        self.db.commit()

        start = (now - timedelta(days=1)).isoformat()
        end = now.isoformat()

        metrics = get_device_metrics_for_map_view(
            self.db,
            channel_ids=["789012"],
            start=start,
            end=end,
            frequency="hourly",
        )
        self.assertIn("789012", metrics)
        m = metrics["789012"]
        # avg s1 is (20 + 22) / 2 = 21.0
        # avg s2 is (17.5 + 18.5) / 2 = 18.0
        # error margin is |21.0 - 18.0| = 3.0
        self.assertEqual(m["error_margin"], 3.0)
        self.assertGreater(m["uptime"], 0.0)
        self.assertEqual(m["data_completeness"], m["uptime"])

    def test_get_synced_map_view_with_performance_data(self):
        import uuid
        from datetime import datetime, timezone, timedelta

        now = datetime.now(timezone.utc)
        h1 = now - timedelta(hours=3)
        h2 = now - timedelta(hours=2)

        row1 = SyncHourlyDeviceData(
            id=uuid.uuid4(),
            channel_id="789012",
            hour_start=h1,
            field1_avg=15.0,
            field3_avg=14.0,
            record_count=60,
            complete=True,
        )
        row2 = SyncHourlyDeviceData(
            id=uuid.uuid4(),
            channel_id="789012",
            hour_start=h2,
            field1_avg=17.0,
            field3_avg=14.0,
            record_count=60,
            complete=True,
        )
        raw_row = SyncRawDeviceData(
            id=uuid.uuid4(),
            channel_id="789012",
            entry_id=1,
            created_at_ts=h2,
        )
        self.db.add_all([row1, row2, raw_row])
        self.db.commit()

        result = get_synced_map_view(self.db, cohort_ids=["coh_1"], days=14)
        self.assertTrue(result["success"])
        self.assertEqual(len(result["data"]), 1)
        entry = result["data"][0]
        self.assertEqual(entry["device_name"], "aq_01")
        # avg s1 = (15 + 17) / 2 = 16.0; avg s2 = (14 + 14) / 2 = 14.0 -> error_margin = 2.0
        self.assertEqual(entry["error_margin"], 2.0)
        self.assertGreater(entry["uptime"], 0.0)
        self.assertEqual(entry["data_completeness"], entry["uptime"])
        self.assertIsNotNone(entry["last_active"])


class TestMaintenanceSiteMapViewSynced(unittest.TestCase):
    """Sites roll up the devices of the device view: two at Site A, one at Site B, one with no site."""

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

        rows = [
            SyncGroup(group_id="grp_1", grp_title="airqo"),
            SyncCohort(cohort_id="coh_1", name="cohort_one"),
            SyncCohort(cohort_id="coh_2", name="cohort_two"),
            SyncGroupCohort(group_id="grp_1", cohort_id="coh_1"),
            SyncGroupCohort(group_id="grp_1", cohort_id="coh_2"),
            SyncGrid(grid_id="grid_1", name="Kampala Grid", network="airqo"),
            SyncSite(
                site_id="site_a", name="Site A", generated_name="site_101",
                latitude=0.35, longitude=32.58, city="Kampala", district="Kampala",
                region="Central Region", country="Uganda",
            ),
            SyncSite(site_id="site_b", name="Site B", generated_name="site_102", latitude=0.4, longitude=32.6),
            SyncGridSite(grid_id="grid_1", site_id="site_a", is_active=True),
        ]
        devices = [
            # name, number, site, cohort
            ("dev_1", "aq_01", 1001, "site_a", "coh_1"),
            ("dev_2", "aq_02", 1002, "site_a", "coh_2"),
            ("dev_3", "aq_03", 1003, "site_b", "coh_1"),
            ("dev_4", "aq_04", 1004, None, "coh_1"),
        ]
        for device_id, name, number, site_id, cohort_id in devices:
            rows.append(SyncDevice(
                device_id=device_id, device_name=name, device_number=number,
                network_id="airqo", site_id=site_id, status="deployed",
            ))
            rows.append(SyncCohortDevice(cohort_id=cohort_id, device_id=device_id, is_active=True))
            if site_id:
                rows.append(SyncSiteDevice(site_id=site_id, device_id=device_id, is_active=True))
        self.db.add_all(rows)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine, tables=self.tables)

    def _add_hours(self, channel_id, hours_ago, s1, s2):
        import uuid
        from datetime import datetime, timezone, timedelta

        now = datetime.now(timezone.utc)
        self.db.add_all([
            SyncHourlyDeviceData(
                id=uuid.uuid4(), channel_id=channel_id, hour_start=now - timedelta(hours=h),
                field1_avg=s1, field3_avg=s2, record_count=60, complete=True,
            )
            for h in hours_ago
        ])
        self.db.add(SyncRawDeviceData(
            id=uuid.uuid4(), channel_id=channel_id, entry_id=len(hours_ago),
            created_at_ts=now - timedelta(hours=min(hours_ago)),
        ))
        self.db.commit()

    def test_sites_roll_up_their_devices(self):
        # aq_01 reads both sensors 2 µg/m³ apart; aq_02 has sensor 1 only; aq_03 has no data
        self._add_hours("1001", [1, 2, 3, 4], 20.0, 18.0)
        self._add_hours("1002", [1, 2], 25.0, None)

        devices = {d["device_name"]: d for d in get_synced_map_view(self.db, cohort_ids=["coh_1", "coh_2"])["data"]}
        result = get_synced_site_map_view(self.db, cohort_ids=["coh_1", "coh_2"])
        self.assertTrue(result["success"])
        sites = {s["site_id"]: s for s in result["data"]}

        # aq_04 has no site, so it is only in the device view
        self.assertEqual(set(sites), {"site_a", "site_b"})
        self.assertIn("aq_04", devices)

        site_a = sites["site_a"]
        self.assertEqual(site_a["site_name"], "Site A")
        self.assertEqual(site_a["generated_name"], "site_101")
        self.assertEqual((site_a["latitude"], site_a["longitude"]), (0.35, 32.58))
        self.assertEqual(site_a["city"], "Kampala")
        self.assertEqual(site_a["number_of_devices"], 2)
        self.assertEqual([d["device_name"] for d in site_a["devices"]], ["aq_01", "aq_02"])
        self.assertAlmostEqual(
            site_a["uptime"], (devices["aq_01"]["uptime"] + devices["aq_02"]["uptime"]) / 2, places=3
        )
        # The single-sensor device's 0.0 is left out of the error margin
        self.assertEqual(site_a["error_margin"], 2.0)
        self.assertEqual(site_a["error_margin_devices"], 1)
        self.assertEqual(site_a["cohorts"], ["cohort_one", "cohort_two"])
        self.assertEqual(site_a["grids"], ["Kampala Grid"])
        self.assertEqual(site_a["last_active"], _latest_timestamp(
            [devices["aq_01"]["last_active"], devices["aq_02"]["last_active"]]
        ))

        site_b = sites["site_b"]
        self.assertEqual(site_b["uptime"], 0.0)
        self.assertEqual(site_b["error_margin"], 0.0)
        self.assertEqual(site_b["error_margin_devices"], 0)
        self.assertIsNone(site_b["last_active"])
        self.assertEqual(site_b["grids"], [])

    def test_sites_follow_the_cohort_scope(self):
        result = get_synced_site_map_view(self.db, cohort_ids=["coh_2"])
        self.assertEqual([s["site_id"] for s in result["data"]], ["site_a"])
        self.assertEqual([d["device_name"] for d in result["data"][0]["devices"]], ["aq_02"])

    def test_latest_timestamp_compares_mixed_formats(self):
        self.assertEqual(
            _latest_timestamp(["2026-10-28T10:00:00.000Z", "2026-10-28T12:30:00+03:00", None]),
            "2026-10-28T10:00:00.000Z",
        )
        self.assertIsNone(_latest_timestamp([None, "", "not a date"]))

    def test_site_map_view_endpoint(self):
        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            response = client.get("/api/v1/maintenance/map-view/sites/synced?days=14&group=airqo")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertEqual([s["site_name"] for s in data["data"]], ["Site A", "Site B"])
            self.assertEqual(data["data"][0]["devices"][0]["device_number"], 1001)

            bad = client.get("/api/v1/maintenance/map-view/sites/synced?frequency=weekly")
            self.assertEqual(bad.status_code, 400)
            unknown = client.get("/api/v1/maintenance/map-view/sites/synced?group=nobody")
            self.assertEqual(unknown.status_code, 404)
        finally:
            app.dependency_overrides.pop(get_db, None)


if __name__ == "__main__":
    unittest.main()
