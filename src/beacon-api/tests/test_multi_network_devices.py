"""
Devices from other sensor manufacturers ("networks") are mirrored alongside
AirQo devices: identity fields, data-source classification, network filters,
per-manufacturer profile resolution and the networks endpoint.
"""
import json
import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.session import Base, get_db
from app.models.device_data import SyncRawDeviceData
from app.models.device_schema import DeviceProfile
from app.models.sync import (
    SyncCohort,
    SyncCohortDevice,
    SyncDevice,
    SyncGroup,
    SyncGroupCohort,
    SyncNetwork,
)
from app.services import cohort_service, device_service, network_sync_service
from app.services.thingspeak_sync_service import select_thingspeak_devices
from app.utils import networks as network_utils
from main import app
from tests.auth_helpers import auth_headers, enable_jwt_verification, make_token


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


# Platform payloads shaped like staging device-registry responses.
AIRQO_DEVICE = {
    "_id": "aq_dev_1",
    "name": "airqo_g5433",
    "long_name": "airqo_g5433",
    "network": "airqo",
    "category": "lowcost",
    "device_number": 2866794,
    "readKey": "enc-read",
    "writeKey": "enc-write",
    "serial_number": "2866794",
    "status": "deployed",
    "site": {"_id": "site_1"},
    "device_categories": {"category_hierarchy": []},
}

AIRGRADIENT_DEVICE = {
    "_id": "ag_dev_1",
    "name": "ag_201560",
    "long_name": "ag_201560",
    "network": "airgradient",
    "category": "lowcost",
    "serial_number": "201560",
    "api_code": "https://api.airgradient.com/public/api/v1/world/locations/201560/measures/current",
    "authRequired": False,
    "status": "deployed",
    "site": {"_id": "site_2"},
    "device_categories": {"category_hierarchy": []},
}

METONE_DEVICE = {
    "_id": "mo_dev_1",
    "name": "dos-addis-centr",
    "long_name": "dos-addis-central",
    "network": "metone",
    "category": "bam",
    "serial_number": "231AA1010001",
    "authRequired": True,
    "status": "deployed",
    "site": {"_id": "site_3"},
    "device_categories": {"category_hierarchy": []},
}


class _DbTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

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
        self.db.close()
        self.engine.dispose()


class TestNetworkPolicy(unittest.TestCase):
    def test_every_network_enabled_by_default(self):
        with patch.object(settings, "ENABLED_NETWORKS", ""):
            self.assertEqual(network_utils.enabled_networks(), set())
            self.assertTrue(network_utils.is_network_enabled("airqo"))
            self.assertTrue(network_utils.is_network_enabled("AirGradient"))
            self.assertTrue(network_utils.is_network_enabled(None))

    def test_allow_list_limits_networks(self):
        with patch.object(settings, "ENABLED_NETWORKS", "airqo, IQAir ,"):
            self.assertEqual(network_utils.enabled_networks(), {"airqo", "iqair"})
            self.assertTrue(network_utils.is_network_enabled("airqo"))
            self.assertTrue(network_utils.is_network_enabled("iqair"))
            self.assertFalse(network_utils.is_network_enabled("airgradient"))
            self.assertFalse(network_utils.is_network_enabled(None))
            self.assertFalse(network_utils.is_enabled_network_device({"network": "metone"}))

    def test_analytics_request_network(self):
        # Values the unchanged analytics raw-data endpoint accepts pass through; every other
        # manufacturer is sent as airqo, since analytics selects rows by device name only.
        f = network_utils.analytics_request_network
        self.assertEqual({n: f(n) for n in ("airqo", "iqair", "airnow", "metone")},
                         {"airqo": "airqo", "iqair": "iqair", "airnow": "airnow", "metone": "metone"})
        for other in ("airgradient", "kcca", "clarity", "airbeam", "AirGradient", None, ""):
            self.assertEqual(f(other), "airqo", other)

    def test_device_data_source_classification(self):
        ds = network_utils.device_data_source
        self.assertEqual(ds("airqo", 2866794, "key"), network_utils.DATA_SOURCE_THINGSPEAK)
        # Legacy rows without a network are treated as airqo
        self.assertEqual(ds(None, 2866794, "key"), network_utils.DATA_SOURCE_THINGSPEAK)
        self.assertEqual(ds("airqo", 2866794, None), network_utils.DATA_SOURCE_NONE)
        self.assertEqual(ds("airqo", None, "key"), network_utils.DATA_SOURCE_NONE)
        self.assertEqual(
            ds("airgradient", None, None, serial_number="201560"),
            network_utils.DATA_SOURCE_EXTERNAL_API,
        )
        self.assertEqual(
            ds("iqair", None, None, api_code="https://device.iqair.com/v2/abc"),
            network_utils.DATA_SOURCE_EXTERNAL_API,
        )
        # A non-airqo device with a channel-like number is never ThingSpeak
        self.assertEqual(ds("airgradient", 201560, "key"), network_utils.DATA_SOURCE_NONE)
        self.assertEqual(ds("metone", None, None), network_utils.DATA_SOURCE_NONE)


class TestExternalDeviceSync(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add(DeviceProfile(id=uuid.uuid4(), name="lowcost", category="air_quality"))
        self.db.commit()

    def test_upsert_keeps_manufacturer_identity(self):
        dev, is_new, _ = device_service.upsert_device_to_sync(
            self.db, AIRGRADIENT_DEVICE, is_authoritative=True,
        )
        self.db.commit()
        self.assertTrue(is_new)
        row = self.db.query(SyncDevice).filter(SyncDevice.device_id == "ag_dev_1").one()
        self.assertEqual(row.network_id, "airgradient")
        self.assertEqual(row.serial_number, "201560")
        self.assertEqual(row.api_code, AIRGRADIENT_DEVICE["api_code"])
        self.assertIs(row.auth_required, False)
        self.assertIsNone(row.device_number)
        self.assertIsNone(row.readKey)
        self.assertEqual(row.category, "lowcost")

    def test_external_device_does_not_inherit_airqo_profile(self):
        device_service.upsert_device_to_sync(self.db, AIRGRADIENT_DEVICE, is_authoritative=True)
        device_service.upsert_device_to_sync(self.db, AIRQO_DEVICE, read_key="plain-read", is_authoritative=True)
        self.db.commit()
        ag = self.db.query(SyncDevice).filter(SyncDevice.device_id == "ag_dev_1").one()
        aq = self.db.query(SyncDevice).filter(SyncDevice.device_id == "aq_dev_1").one()
        lowcost = self.db.query(DeviceProfile).filter(DeviceProfile.name == "lowcost").one()
        self.assertIsNone(ag.profile_id)
        self.assertEqual(aq.profile_id, lowcost.id)

    def test_manufacturer_profile_is_preferred(self):
        ag_profile = DeviceProfile(id=uuid.uuid4(), name="airgradient_lowcost", category="air_quality")
        self.db.add(ag_profile)
        self.db.commit()
        device_service.upsert_device_to_sync(self.db, AIRGRADIENT_DEVICE, is_authoritative=True)
        self.db.commit()
        ag = self.db.query(SyncDevice).filter(SyncDevice.device_id == "ag_dev_1").one()
        self.assertEqual(ag.profile_id, ag_profile.id)

    def test_authoritative_update_refreshes_identity_fields(self):
        device_service.upsert_device_to_sync(self.db, AIRGRADIENT_DEVICE, is_authoritative=True)
        self.db.commit()
        changed = {**AIRGRADIENT_DEVICE, "serial_number": "201561", "authRequired": True}
        _, is_new, is_updated = device_service.upsert_device_to_sync(self.db, changed, is_authoritative=True)
        self.db.commit()
        self.assertFalse(is_new)
        self.assertTrue(is_updated)
        row = self.db.query(SyncDevice).filter(SyncDevice.device_id == "ag_dev_1").one()
        self.assertEqual(row.serial_number, "201561")
        self.assertIs(row.auth_required, True)


class TestSyncedDeviceListing(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add_all([
            SyncGroup(group_id="grp_1", grp_title="airqo"),
            SyncDevice(
                device_id="aq_dev_1", device_name="airqo_g5433", network_id="airqo",
                category="lowcost", device_number=2866794, readKey="plain", status="deployed",
            ),
            SyncDevice(
                device_id="ag_dev_1", device_name="ag_201560", network_id="airgradient",
                category="lowcost", serial_number="201560", api_code="https://api.airgradient.com/x",
                auth_required=False, status="deployed",
            ),
            SyncDevice(
                device_id="mo_dev_1", device_name="dos-addis-centr", network_id="metone",
                category="bam", serial_number="231AA1010001", status="deployed",
            ),
        ])
        self.db.commit()

    def test_all_networks_listed_with_data_source(self):
        result = device_service.get_synced_device_details(self.db, skip=0, limit=30)
        self.assertEqual(result["meta"]["total"], 3)
        by_id = {d["_id"]: d for d in result["devices"]}
        self.assertEqual(by_id["aq_dev_1"]["data_source"], "thingspeak")
        self.assertEqual(by_id["ag_dev_1"]["data_source"], "external_api")
        self.assertEqual(by_id["ag_dev_1"]["serial_number"], "201560")
        self.assertEqual(by_id["ag_dev_1"]["network"], "airgradient")
        self.assertEqual(by_id["ag_dev_1"]["beacon_data"]["data_source"], "external_api")
        self.assertEqual(by_id["mo_dev_1"]["data_source"], "external_api")

    def test_network_filter_accepts_csv(self):
        result = device_service.get_synced_device_details(self.db, network="AirGradient, metone")
        self.assertEqual(result["meta"]["total"], 2)
        self.assertEqual({d["network"] for d in result["devices"]}, {"airgradient", "metone"})

    def test_allow_list_is_applied_to_local_listing(self):
        with patch.object(settings, "ENABLED_NETWORKS", "airqo"):
            result = device_service.get_synced_device_details(self.db)
        self.assertEqual(result["meta"]["total"], 1)
        self.assertEqual(result["devices"][0]["_id"], "aq_dev_1")

    def test_synced_endpoint_passes_network_filter(self):
        response = self.client.get("/api/v1/devices/synced", params={"group": "airqo", "network": "airgradient"})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["meta"]["total"], 1)
        self.assertEqual(body["devices"][0]["_id"], "ag_dev_1")
        self.assertEqual(body["devices"][0]["beacon_data"]["serial_number"], "201560")
        self.assertIn("network=airgradient", body["meta"].get("nextPage") or "network=airgradient")


class TestThingSpeakEligibility(_DbTestCase):
    def test_only_airqo_devices_with_keys_are_selected(self):
        self.db.add_all([
            SyncDevice(device_id="aq_ok", network_id="airqo", device_number=1, readKey="k"),
            SyncDevice(device_id="aq_legacy", network_id=None, device_number=2, readKey="k"),
            SyncDevice(device_id="aq_nokey", network_id="airqo", device_number=3, readKey=None),
            SyncDevice(device_id="ag_num", network_id="airgradient", device_number=4, readKey="k"),
            SyncDevice(device_id="ag_plain", network_id="airgradient", serial_number="s"),
        ])
        self.db.commit()
        selected = {d.device_id for d in select_thingspeak_devices(self.db)}
        self.assertEqual(selected, {"aq_ok", "aq_legacy"})


class TestLocalCohorts(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add_all([
            SyncCohort(cohort_id="coh_1", name="mixed"),
            SyncDevice(device_id="aq_dev_1", device_name="airqo_g5433", network_id="airqo", category="lowcost"),
            SyncDevice(device_id="ag_dev_1", device_name="ag_201560", network_id="airgradient", category="lowcost"),
            SyncCohortDevice(cohort_id="coh_1", device_id="aq_dev_1", is_active=True),
            SyncCohortDevice(cohort_id="coh_1", device_id="ag_dev_1", is_active=True),
        ])
        self.db.commit()

    def test_hydration_includes_every_enabled_network(self):
        by_cohort = cohort_service._hydrate_cohort_devices(self.db, ["coh_1"])
        self.assertEqual({d["network"] for d in by_cohort["coh_1"]}, {"airqo", "airgradient"})
        with patch.object(settings, "ENABLED_NETWORKS", "airqo"):
            by_cohort = cohort_service._hydrate_cohort_devices(self.db, ["coh_1"])
        self.assertEqual([d["_id"] for d in by_cohort["coh_1"]], ["aq_dev_1"])

    def test_platform_cohort_filter_uses_allow_list(self):
        cohorts = [{"devices": [{"network": "airqo"}, {"network": "iqair"}]}]
        cohort_service._filter_cohort_devices_to_enabled_networks(cohorts)
        self.assertEqual(len(cohorts[0]["devices"]), 2)
        with patch.object(settings, "ENABLED_NETWORKS", "iqair"):
            cohort_service._filter_cohort_devices_to_enabled_networks(cohorts)
        self.assertEqual(cohorts[0]["devices"], [{"network": "iqair"}])

    def test_raw_data_payload_carries_network(self):
        payload = cohort_service._build_raw_data_payload(
            ["phli_21"], "2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z", "hourly", "lowcost",
            network="iqair",
        )
        self.assertEqual(payload["network"], "iqair")
        self.assertEqual(payload["device_category"], "lowcost")


class TestNetworksEndpoint(_DbTestCase):
    def setUp(self):
        super().setUp()
        now = datetime.now(timezone.utc)
        self.db.add_all([
            SyncNetwork(network_id="64bd62fe6f7bfc19e3d73aee", name="airqo", status="active", website="https://airqo.net/"),
            SyncNetwork(network_id="691f0b2e1482cf001336a57d", name="airgradient", status="inactive"),
            SyncDevice(device_id="aq_1", device_name="aq_1", network_id="airqo", device_number=1, readKey="k", status="deployed"),
            SyncDevice(device_id="aq_2", device_name="aq_2", network_id="airqo", device_number=2, readKey="k", status="not deployed"),
            SyncDevice(device_id="ag_1", device_name="ag_1", network_id="airgradient", serial_number="201560", status="deployed"),
            SyncDevice(device_id="mo_1", device_name="mo_1", network_id="metone", serial_number="231", status="deployed"),
            SyncRawDeviceData(id=uuid.uuid4(), channel_id="1", device_id="aq_1", entry_id=1, created_at_ts=now, field1=1.0),
        ])
        self.db.commit()

    def test_list_networks_with_counts(self):
        response = self.client.get("/api/v1/networks/")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["success"])
        by_name = {n["name"]: n for n in body["networks"]}
        self.assertEqual(set(by_name), {"airqo", "airgradient", "metone"})

        airqo = by_name["airqo"]
        self.assertEqual(airqo["network_id"], "64bd62fe6f7bfc19e3d73aee")
        self.assertEqual(airqo["total_devices"], 2)
        self.assertEqual(airqo["deployed_devices"], 1)
        self.assertEqual(airqo["online_devices"], 1)
        self.assertEqual(airqo["thingspeak_devices"], 2)
        self.assertEqual(airqo["external_api_devices"], 0)

        ag = by_name["airgradient"]
        self.assertEqual(ag["status"], "inactive")
        self.assertEqual(ag["total_devices"], 1)
        self.assertEqual(ag["external_api_devices"], 1)
        self.assertEqual(ag["online_devices"], 0)

        # Seen on a device but never synced from the platform
        metone = by_name["metone"]
        self.assertIsNone(metone["network_id"])
        self.assertEqual(metone["total_devices"], 1)
        self.assertTrue(metone["enabled"])

    def test_counts_scoped_to_an_organisation(self):
        # Organisation "ministry" owns only the airgradient device
        self.db.add_all([
            SyncGroup(group_id="grp_m", grp_title="ministry"),
            SyncCohort(cohort_id="coh_m", name="ministry_cohort"),
            SyncGroupCohort(group_id="grp_m", cohort_id="coh_m"),
            SyncCohortDevice(cohort_id="coh_m", device_id="ag_1", is_active=True),
        ])
        self.db.commit()

        response = self.client.get("/api/v1/networks/", params={"group": "ministry"})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["scoped_to_group"])
        by_name = {n["name"]: n for n in body["networks"]}
        self.assertEqual(by_name["airgradient"]["total_devices"], 1)
        self.assertEqual(by_name["airqo"]["total_devices"], 0)
        self.assertEqual(by_name["airqo"]["online_devices"], 0)

        response = self.client.get("/api/v1/networks/", params={"group": "ministry", "only_with_devices": "true"})
        self.assertEqual([n["name"] for n in response.json()["networks"]], ["airgradient"])

        # the supergroup is unrestricted and the fleet-wide default is unchanged
        fleet = self.client.get("/api/v1/networks/", params={"group": "airqo"}).json()
        self.assertFalse(fleet["scoped_to_group"])
        self.assertEqual({n["name"]: n["total_devices"] for n in fleet["networks"]},
                         {"airqo": 2, "airgradient": 1, "metone": 1})
        self.assertEqual(self.client.get("/api/v1/networks/", params={"group": "nope"}).status_code, 404)

    def test_enabled_flag_reflects_allow_list(self):
        with patch.object(settings, "ENABLED_NETWORKS", "airqo"):
            body = network_sync_service.list_networks(self.db)
        flags = {n["name"]: n["enabled"] for n in body["networks"]}
        self.assertEqual(flags, {"airqo": True, "airgradient": False, "metone": False})


class TestNetworkSync(_DbTestCase):
    PLATFORM_NETWORKS = {
        "success": True,
        "networks": [
            {
                "_id": "64bd62fe6f7bfc19e3d73aee", "name": "airqo", "net_name": "airqo",
                "net_acronym": "airqo", "net_category": "others", "net_status": "active",
                "net_website": "https://airqo.net/", "net_email": "data@airqo.net",
                "updatedAt": "2026-08-20T04:00:39.300Z",
            },
            {
                "_id": "691f0b2e1482cf001336a57d", "name": "airgradient", "net_name": "AirGradient",
                "net_acronym": "airgradient", "net_category": "business", "net_status": "inactive",
                "net_website": "https://www.airgradient.com/", "net_description": "Air gradient monitor makers",
            },
        ],
    }

    def _mock_client(self, payload, status_code=200):
        response = MagicMock()
        response.status_code = status_code
        response.json.return_value = payload
        client = MagicMock()
        client.get = AsyncMock(return_value=response)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)
        return client

    def test_sync_networks_upserts_rows(self):
        import asyncio

        with patch("app.services.network_sync_service.httpx.AsyncClient", return_value=self._mock_client(self.PLATFORM_NETWORKS)):
            first = asyncio.run(network_sync_service.sync_networks(self.db, "token"))
        self.assertTrue(first["success"])
        self.assertEqual(first["new_count"], 2)

        rows = {r.name: r for r in self.db.query(SyncNetwork).all()}
        self.assertEqual(set(rows), {"airqo", "airgradient"})
        self.assertEqual(rows["airgradient"].network_id, "691f0b2e1482cf001336a57d")
        self.assertEqual(rows["airgradient"].description, "Air gradient monitor makers")
        self.assertEqual(rows["airqo"].platform_updated_at.year, 2026)

        changed = json.loads(json.dumps(self.PLATFORM_NETWORKS))
        changed["networks"][1]["net_status"] = "active"
        with patch("app.services.network_sync_service.httpx.AsyncClient", return_value=self._mock_client(changed)):
            second = asyncio.run(network_sync_service.sync_networks(self.db, "token"))
        self.assertEqual(second["new_count"], 0)
        self.assertEqual(second["updates_count"], 1)
        self.assertEqual(self.db.query(SyncNetwork).filter(SyncNetwork.name == "airgradient").one().status, "active")

    def test_sync_networks_reports_platform_errors(self):
        import asyncio

        with patch("app.services.network_sync_service.httpx.AsyncClient", return_value=self._mock_client({}, status_code=401)):
            result = asyncio.run(network_sync_service.sync_networks(self.db, "token"))
        self.assertFalse(result["success"])
        self.assertEqual(result["status_code"], 401)



class TestProfileSeedAuth(_DbTestCase):
    """CodeRabbit on #7126: the profile seed writes to the database, so it needs the JWT header like /networks/sync."""

    def test_seed_requires_a_verified_jwt(self):
        enable_jwt_verification(self)
        seed = "/api/v1/networks/profiles/seed"
        self.assertEqual(self.client.post(seed).status_code, 401)
        self.assertEqual(self.client.post(seed, headers={"Authorization": "Bearer abc"}).status_code, 401)
        self.assertEqual(self.client.post(seed, headers=auth_headers(make_token(secret="forged"))).status_code, 401)
        ok = self.client.post(seed, headers=auth_headers())
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertIn("airgradient_lowcost", ok.json()["created"])


class TestNetworkSyncIsolation(_DbTestCase):
    """CodeRabbit on #7126: one failing network must not discard the networks synced before it."""

    def test_a_failing_network_keeps_the_others(self):
        import asyncio

        payload = {"success": True, "networks": [
            {"_id": "n1", "name": "airqo", "net_name": "airqo", "net_status": "active"},
            {"_id": "n2", "name": "broken", "net_name": "broken"},
            {"_id": "n3", "name": "iqair", "net_name": "iqair"},
        ]}
        response = MagicMock(status_code=200)
        response.json.return_value = payload
        client = MagicMock()
        client.get = AsyncMock(return_value=response)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)

        real_upsert = network_sync_service.upsert_network_to_sync

        def flaky_upsert(db, net):
            row = real_upsert(db, net)
            if net["_id"] == "n2":
                raise RuntimeError("bad network row")
            return row

        with patch("app.services.network_sync_service.httpx.AsyncClient", return_value=client), \
             patch.object(network_sync_service, "upsert_network_to_sync", flaky_upsert):
            result = asyncio.run(network_sync_service.sync_networks(self.db, "token"))

        self.assertTrue(result["success"])
        self.assertEqual(result["new_count"], 2)                  # the failed one is not counted
        names = sorted(r.name for r in self.db.query(SyncNetwork).all())
        self.assertEqual(names, ["airqo", "iqair"])               # n1 survived n2's failure


if __name__ == "__main__":
    unittest.main()
