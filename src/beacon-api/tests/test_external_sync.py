"""
Phase 2: readings for devices from other sensor manufacturers, backfilled
from the platform's analytics raw-data endpoint into the local sync tables.
"""
import asyncio
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.crud.crud_sync_device_data import _resolve_devices
from app.models.device_data import SyncDailyDeviceData, SyncRawDeviceData
from app.models.device_schema import DeviceProfile
from app.models.sync import SyncDevice
from app.models.vendor import Vendor
from app.services import cohort_service, external_sync_service as ext
from app.services import manufacturer_profiles as mp
from app.utils import networks as network_utils


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


AIRQO = dict(device_id="aq_1", device_name="airqo_g5433", network_id="airqo", category="lowcost",
             device_number=2866794, readKey="k", status="deployed")
AIRGRADIENT = dict(device_id="ag_1", device_name="ag_201560", network_id="airgradient", category="lowcost",
                   serial_number="201560", api_code="https://api.airgradient.com/x", status="deployed")
IQAIR = dict(device_id="iq_1", device_name="phli_21", network_id="iqair", category="lowcost",
             serial_number="6796fa282f158127e2a1f9f3", status="deployed")
METONE = dict(device_id="mo_1", device_name="dos-addis-centr", network_id="metone", category="bam",
              serial_number="231AA1010001", status="deployed")
NO_SOURCE = dict(device_id="x_1", device_name="mystery", network_id="airbeam", category="lowcost", status="deployed")


class _DbTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()


class TestSourceKeys(unittest.TestCase):
    def test_airqo_uses_channel_and_others_use_registry_id(self):
        self.assertEqual(network_utils.device_source_key("airqo", "aq_1", 2866794), "2866794")
        self.assertEqual(network_utils.device_source_key(None, "aq_1", 2866794), "2866794")
        self.assertIsNone(network_utils.device_source_key("airqo", "aq_1", None))
        self.assertEqual(network_utils.device_source_key("airgradient", "ag_1", None), "ag_1")
        # A vendor id that looks like a channel number never becomes one
        self.assertEqual(network_utils.device_source_key("airgradient", "ag_1", 201560), "ag_1")
        self.assertEqual(
            network_utils.source_key_for_platform_device({"_id": "ag_1", "network": "airgradient"}), "ag_1",
        )


class TestSlotMapping(unittest.TestCase):
    def test_lowcost_record_maps_named_fields_to_slots(self):
        slot_map = mp.slot_map_from_mappings(mp.EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS)
        self.assertEqual(slot_map["pm2_5"], "field1")
        self.assertEqual(slot_map["temperature"], "field16")
        record = {
            "device_name": "ag_201560", "datetime": "2026-10-11 10:00:00Z",
            "pm2_5": "12.5", "pm10": 15.1, "s1_pm2_5": None, "temperature": 26.4, "humidity": 70,
            "latitude": 0.3278, "longitude": 32.569, "battery": 4.1, "co2": 512, "network": "airgradient",
        }
        slots = mp.map_record_to_slots(record, slot_map)
        self.assertEqual(slots, {
            "field1": 12.5, "field2": 15.1, "field16": 26.4, "field17": 70.0,
            "field5": 0.3278, "field6": 32.569, "field7": 4.1, "field9": 512.0,
        })
        # Nothing lands in the AirQo second-sensor slots
        self.assertNotIn("field3", slots)

    def test_bam_record_uses_bam_layout_first_value_wins(self):
        slot_map = mp.slot_map_from_mappings(mp.EXTERNAL_BAM_TELEMETRY_MAPPINGS)
        record = {"hourly_conc": 18.0, "pm2_5": 99.0, "realtime_conc": 20.5, "short_time_conc": None, "pm10": 30}
        slots = mp.map_record_to_slots(record, slot_map)
        self.assertEqual(slots["field3"], 18.0)   # hourly_conc wins over the later pm2_5 alias
        self.assertEqual(slots["field2"], 20.5)
        self.assertEqual(slots["field20"], 30.0)
        self.assertNotIn("field4", slots)

    def test_non_numeric_values_are_ignored(self):
        slot_map = mp.slot_map_from_mappings(mp.EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS)
        self.assertEqual(mp.map_record_to_slots({"pm2_5": "n/a", "pm10": float("nan")}, slot_map), {})

    def test_profile_slot_map_falls_back_to_default_layout(self):
        self.assertEqual(mp.slot_map_for_profile(None, "bam")["pm2_5"], "field3")
        custom = MagicMock(telemetry_mappings={"field4": {"key": "pm2_5"}})
        self.assertEqual(mp.slot_map_for_profile(custom, "lowcost")["pm2_5"], "field4")


class TestManufacturerProfiles(_DbTestCase):
    def test_seed_is_idempotent_and_assigns_devices(self):
        self.db.add_all([SyncDevice(**AIRGRADIENT), SyncDevice(**METONE), SyncDevice(**AIRQO)])
        self.db.commit()

        first = mp.ensure_manufacturer_profiles(self.db)
        self.assertIn("airgradient_lowcost", first["created"])
        self.assertIn("metone_bam", first["created"])
        second = mp.ensure_manufacturer_profiles(self.db)
        self.assertEqual(second["created"], [])
        self.assertEqual(set(second["existing"]), set(first["created"]))
        self.assertEqual(self.db.query(Vendor).filter(Vendor.name == "AirGradient").count(), 1)

        assigned = mp.assign_profiles_to_external_devices(self.db)
        self.assertEqual(assigned, 2)
        ag = self.db.query(SyncDevice).filter(SyncDevice.device_id == "ag_1").one()
        mo = self.db.query(SyncDevice).filter(SyncDevice.device_id == "mo_1").one()
        aq = self.db.query(SyncDevice).filter(SyncDevice.device_id == "aq_1").one()
        self.assertEqual(self.db.get(DeviceProfile, ag.profile_id).name, "airgradient_lowcost")
        self.assertEqual(self.db.get(DeviceProfile, mo.profile_id).name, "metone_bam")
        self.assertIsNone(aq.profile_id)  # airqo devices are not touched


class TestPlanning(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add_all([SyncDevice(**d) for d in (AIRQO, AIRGRADIENT, IQAIR, METONE, NO_SOURCE)])
        self.db.commit()

    def test_select_external_devices(self):
        names = {d.device_name for d in ext.select_external_devices(self.db)}
        self.assertEqual(names, {"ag_201560", "phli_21", "dos-addis-centr"})

    def test_plan_groups_by_network_and_skips_complete_days(self):
        start, end = date(2026, 10, 1), date(2026, 10, 10)
        # ag_1 already has complete days for everything but the 9th and 10th
        for d in ext._date_range(start, date(2026, 10, 8)):
            self.db.add(SyncDailyDeviceData(id=uuid.uuid4(), channel_id="ag_1", device_id="ag_1",
                                            data_date=d, record_count=5, complete=True))
        self.db.commit()
        groups = ext.plan_fetch_groups(self.db, ext.select_external_devices(self.db), start, end)
        by_key = {(g.network, g.category): g for g in groups}
        self.assertEqual(set(by_key), {("airgradient", "lowcost"), ("iqair", "lowcost"), ("metone", "bam")})
        ag = by_key[("airgradient", "lowcost")]
        self.assertEqual((ag.start_date, ag.end_date), (date(2026, 10, 9), date(2026, 10, 10)))
        self.assertEqual(ag.device_names, ["ag_201560"])
        iq = [g for g in groups if g.network == "iqair"]
        # 10 days split into 7 + 3
        self.assertEqual([(g.start_date, g.end_date) for g in iq],
                         [(date(2026, 10, 1), date(2026, 10, 7)), (date(2026, 10, 8), date(2026, 10, 10))])

    def test_payload_shape(self):
        payload = ext.build_raw_data_payload("airgradient", "lowcost", ["ag_201560"], date(2026, 10, 1), date(2026, 10, 7))
        self.assertEqual(payload["network"], "airgradient")
        self.assertEqual(payload["device_category"], "lowcost")
        self.assertEqual(payload["startDateTime"], "2026-10-01T00:00:00Z")
        self.assertEqual(payload["endDateTime"], "2026-10-07T23:59:59Z")
        self.assertEqual(payload["frequency"], "raw")
        self.assertEqual(payload["metaDataFields"], ["latitude", "longitude"])
        self.assertEqual(ext.build_raw_data_payload("metone", "bam", [], date(2026, 10, 1), date(2026, 10, 1))["device_category"], "bam")


class TestBuildRawRows(unittest.TestCase):
    def test_rows_are_keyed_by_registry_id_with_epoch_entry_ids(self):
        ag = SyncDevice(**AIRGRADIENT)
        slot_maps = {"ag_1": mp.slot_map_from_mappings(mp.EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS)}
        records = [
            {"device_name": "ag_201560", "datetime": "2026-10-11 10:00:00Z", "pm2_5": 12.5, "pm10": 15.0},
            {"device_name": "ag_201560", "datetime": "bad", "pm2_5": 1.0},
            {"device_name": "unknown", "datetime": "2026-10-11 10:00:00Z", "pm2_5": 1.0},
            {"device_name": "ag_201560", "datetime": "2026-10-11 10:10:00Z", "s1_pm2_5": None},
        ]
        rows = ext.build_raw_rows(records, {"ag_201560": ag}, slot_maps)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["channel_id"], "ag_1")
        self.assertEqual(row["device_id"], "ag_1")
        self.assertEqual(row["created_at_ts"], datetime(2026, 10, 11, 10, 0, tzinfo=timezone.utc))
        self.assertEqual(row["entry_id"], int(row["created_at_ts"].timestamp()))
        self.assertEqual(row["field1"], 12.5)
        self.assertEqual(row["field2"], 15.0)
        self.assertIsNone(row["field3"])

    def test_parse_record_time_formats(self):
        self.assertEqual(ext.parse_record_time("2026-10-11T10:00:00Z"), datetime(2026, 10, 11, 10, tzinfo=timezone.utc))
        self.assertEqual(ext.parse_record_time("2026-10-11T10:00:00+03:00").utcoffset(), timedelta(hours=3))
        self.assertIsNone(ext.parse_record_time(None))
        self.assertIsNone(ext.parse_record_time("yesterday"))


def _response(status_code, payload=None, text=""):
    r = MagicMock()
    r.status_code = status_code
    r.json.return_value = payload if payload is not None else {}
    r.text = text
    return r


class TestFetchRawData(unittest.TestCase):
    def _run(self, coro):
        return asyncio.run(coro)

    def test_follows_cursor_pagination(self):
        client = MagicMock()
        client.post = AsyncMock(side_effect=[
            _response(200, {"data": [{"a": 1}], "metadata": {"has_more": True, "next": "c2"}}),
            _response(200, {"data": [{"a": 2}], "metadata": {"has_more": False}}),
        ])
        records, ok = self._run(ext.fetch_raw_data(client, {"network": "airgradient"}, {"token": "t"}, {}))
        self.assertTrue(ok)
        self.assertEqual(records, [{"a": 1}, {"a": 2}])
        second_body = client.post.call_args_list[1].kwargs["json"]
        self.assertEqual(second_body["cursor"], "c2")

    def test_422_falls_back_to_airqo_network(self):
        client = MagicMock()
        client.post = AsyncMock(side_effect=[
            _response(422, text="network: not a valid enumeration member"),
            _response(200, {"data": [{"a": 1}], "metadata": {"has_more": False}}),
        ])
        records, ok = self._run(ext.fetch_raw_data(client, {"network": "airgradient"}, {}, {}))
        self.assertTrue(ok)
        self.assertEqual(records, [{"a": 1}])
        self.assertEqual(client.post.call_args_list[1].kwargs["json"]["network"], "airqo")

    def test_server_error_reports_failure(self):
        client = MagicMock()
        client.post = AsyncMock(return_value=_response(500, text="boom"))
        records, ok = self._run(ext.fetch_raw_data(client, {"network": "airqo"}, {}, {}, max_retries=1))
        self.assertFalse(ok)
        self.assertEqual(records, [])


class TestOrchestrator(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add_all([SyncDevice(**AIRQO), SyncDevice(**AIRGRADIENT), SyncDevice(**METONE)])
        self.db.commit()

    def test_end_to_end_with_mocked_platform(self):
        captured = {"raw": [], "hourly": [], "daily": []}

        def fake_upsert(kind):
            def _upsert(db, records, batch_size=2000):
                captured[kind].extend(records)
                return len(records)
            return _upsert

        responses = {
            "airgradient": {"data": [
                {"device_name": "ag_201560", "datetime": "2026-10-11 10:00:00Z", "pm2_5": 10.0, "pm10": 12.0, "temperature": 25.0},
                {"device_name": "ag_201560", "datetime": "2026-10-11 10:30:00Z", "pm2_5": 14.0, "pm10": 16.0, "temperature": 27.0},
            ], "metadata": {"has_more": False}},
            "metone": {"data": [
                {"device_name": "dos-addis-centr", "datetime": "2026-10-11 11:00:00Z", "hourly_conc": 18.0, "realtime_conc": 19.0},
            ], "metadata": {"has_more": False}},
        }

        async def fake_post(url, json=None, params=None, headers=None):
            return _response(200, responses[json["network"]])

        client = MagicMock()
        client.post = AsyncMock(side_effect=fake_post)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(ext, "SessionLocal", self.Session), \
             patch.object(ext.httpx, "AsyncClient", return_value=client), \
             patch.object(ext.crud_device_data, "upsert_raw_data", fake_upsert("raw")), \
             patch.object(ext.crud_device_data, "upsert_hourly_data", fake_upsert("hourly")), \
             patch.object(ext.crud_device_data, "upsert_daily_data", fake_upsert("daily")), \
             patch.object(ext.settings, "PLATFORM_API_TOKEN", "api-token"):
            summary = asyncio.run(ext.sync_external_device_data(start_date="2026-10-11", end_date="2026-10-11"))

        self.assertTrue(summary["success"], summary)
        self.assertEqual(summary["devices"], 2)          # the airqo device is not an external device
        self.assertEqual(summary["groups"], 2)           # one request per (network, category)
        self.assertEqual(summary["failed_groups"], 0)
        self.assertIn("airgradient_lowcost", summary["profiles_created"])
        self.assertEqual(summary["profiles_assigned"], 2)
        self.assertEqual(summary["raw_records"], 3)

        # Auth was passed as the platform API token
        self.assertEqual(client.post.call_args_list[0].kwargs["params"], {"token": "api-token"})

        ag_rows = [r for r in captured["raw"] if r["channel_id"] == "ag_1"]
        self.assertEqual([r["field1"] for r in ag_rows], [10.0, 14.0])
        self.assertEqual(ag_rows[0]["field16"], 25.0)
        mo_rows = [r for r in captured["raw"] if r["channel_id"] == "mo_1"]
        self.assertEqual(mo_rows[0]["field3"], 18.0)
        self.assertEqual(mo_rows[0]["field2"], 19.0)

        hourly_ag = [h for h in captured["hourly"] if h["channel_id"] == "ag_1"]
        self.assertEqual(len(hourly_ag), 1)
        self.assertEqual(hourly_ag[0]["field1_avg"], 12.0)
        self.assertEqual(hourly_ag[0]["record_count"], 2)
        daily_ag = [d for d in captured["daily"] if d["channel_id"] == "ag_1"]
        self.assertEqual(daily_ag[0]["data_date"], date(2026, 10, 11))
        self.assertTrue(daily_ag[0]["complete"])

    def test_no_external_devices_short_circuits(self):
        self.db.query(SyncDevice).filter(SyncDevice.device_id != "aq_1").delete()
        self.db.commit()
        with patch.object(ext, "SessionLocal", self.Session):
            summary = asyncio.run(ext.sync_external_device_data(days=1))
        self.assertTrue(summary["success"])
        self.assertEqual(summary["devices"], 0)


class TestReadPathForExternalDevices(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add_all([SyncDevice(**AIRQO), SyncDevice(**AIRGRADIENT)])
        self.db.commit()
        mp.ensure_manufacturer_profiles(self.db)
        mp.assign_profiles_to_external_devices(self.db)
        base = datetime(2026, 10, 11, 10, 0, tzinfo=timezone.utc)
        for i, (pm, temp) in enumerate([(10.0, 25.0), (14.0, 27.0)]):
            self.db.add(SyncRawDeviceData(
                id=uuid.uuid4(), channel_id="ag_1", device_id="ag_1", entry_id=100 + i,
                created_at_ts=base + timedelta(minutes=30 * i), field1=pm, field2=pm + 2, field16=temp,
            ))
        self.db.add(SyncRawDeviceData(
            id=uuid.uuid4(), channel_id="2866794", device_id="aq_1", entry_id=1,
            created_at_ts=base, field1=20.0, field3=22.0,
        ))
        self.db.commit()

    def test_resolve_devices_uses_source_keys(self):
        info, by_channel = _resolve_devices(self.db, ["airqo_g5433", "ag_201560"])
        self.assertEqual(by_channel, {"2866794": "airqo_g5433", "ag_1": "ag_201560"})
        self.assertEqual(info["ag_201560"]["source_key"], "ag_1")
        self.assertEqual(info["ag_201560"]["network"], "airgradient")
        self.assertIsNotNone(info["ag_201560"]["profile_id"])

    def test_performance_labels_external_device_through_its_profile(self):
        metrics = cohort_service.compute_device_performance(
            self.db, ["airqo_g5433", "ag_201560"],
            "2026-10-11T00:00:00.000Z", "2026-10-12T00:00:00.000Z", frequency="raw",
        )
        ag = metrics["ag_201560"]
        self.assertEqual(ag["device_id"], "ag_1")
        self.assertEqual(ag["averages"]["PM2.5"], 12.0)
        self.assertEqual(ag["averages"]["PM10"], 14.0)
        self.assertEqual(ag["averages"]["Ambient Temperature"], 26.0)
        self.assertEqual(ag["data"][0]["PM2.5"], 10.0)
        self.assertGreater(ag["uptime"], 0.0)
        # airqo devices keep the static ThingSpeak labels
        aq = metrics["airqo_g5433"]
        self.assertEqual(aq["averages"]["pm2.5 sensor1"], 20.0)
        self.assertEqual(aq["averages"]["pm2.5"], 21.0)


if __name__ == "__main__":
    unittest.main()
