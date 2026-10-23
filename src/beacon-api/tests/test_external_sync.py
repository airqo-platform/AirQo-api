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
        # Running again changes nothing
        self.assertEqual(mp.assign_profiles_to_external_devices(self.db), 0)

    def test_assignment_replaces_stale_airqo_profile_but_keeps_deliberate_ones(self):
        lowcost = DeviceProfile(id=uuid.uuid4(), name="lowcost", category="air_quality")
        custom = DeviceProfile(id=uuid.uuid4(), name="my_custom_profile", category="air_quality")
        self.db.add_all([lowcost, custom])
        self.db.add_all([
            # synced before manufacturer profiles existed: carries the AirQo lowcost profile
            SyncDevice(**{**AIRGRADIENT, "profile_id": lowcost.id}),
            # an operator pointed this one at a profile of their own
            SyncDevice(**{**IQAIR, "profile_id": custom.id}),
            SyncDevice(**{**AIRQO, "profile_id": lowcost.id}),
        ])
        self.db.commit()
        mp.ensure_manufacturer_profiles(self.db)
        self.assertEqual(mp.assign_profiles_to_external_devices(self.db), 1)
        ag = self.db.query(SyncDevice).filter(SyncDevice.device_id == "ag_1").one()
        iq = self.db.query(SyncDevice).filter(SyncDevice.device_id == "iq_1").one()
        aq = self.db.query(SyncDevice).filter(SyncDevice.device_id == "aq_1").one()
        self.assertEqual(self.db.get(DeviceProfile, ag.profile_id).name, "airgradient_lowcost")
        self.assertEqual(iq.profile_id, custom.id)
        self.assertEqual(aq.profile_id, lowcost.id)


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


# ── Phase 2b: live feed + direct AirGradient source ───────────────────────────

AIRGRADIENT_PRIVATE = dict(device_id="ag_2", device_name="ag_private", network_id="airgradient", category="lowcost",
                           serial_number="88123", api_code="https://api.airgradient.com/public/api/v1/locations/88123/measures/current",
                           auth_required=True, status="deployed")


class TestAirGradientDirectSource(unittest.TestCase):
    def setUp(self):
        self.source = ext.AirGradientRawSource()

    def test_supports_only_private_airgradient_devices_with_token(self):
        public = SyncDevice(**AIRGRADIENT)       # authRequired false → world snapshot only
        private = SyncDevice(**AIRGRADIENT_PRIVATE)
        with patch.object(ext.settings, "AIRGRADIENT_API_TOKEN", ""):
            self.assertFalse(self.source.supports(private))
        with patch.object(ext.settings, "AIRGRADIENT_API_TOKEN", "tok"):
            self.assertTrue(self.source.supports(private))
            self.assertFalse(self.source.supports(public))
            self.assertFalse(self.source.supports(SyncDevice(**IQAIR)))
            self.assertIsNone(ext.direct_source_for(public))
            self.assertIs(ext.direct_source_for(private), ext.DIRECT_SOURCES[0])

    def test_location_id_falls_back_to_api_code(self):
        dev = SyncDevice(**{**AIRGRADIENT_PRIVATE, "serial_number": None})
        self.assertEqual(self.source.location_id(dev), "88123")
        self.assertEqual(self.source.url(dev), "https://api.airgradient.com/public/api/v1/locations/88123/measures/past")
        # the registry name encodes the location id when nothing else does
        named = SyncDevice(device_id="ag_9", device_name="ag_170157", network_id="airgradient", category="lowcost")
        self.assertEqual(ext.airgradient_location_id(named), "170157")

    def test_fetch_chunks_window_and_tags_records(self):
        dev = SyncDevice(**AIRGRADIENT_PRIVATE)
        client = MagicMock()
        client.get = AsyncMock(return_value=_response(200, [
            {"timestamp": "2026-10-11T10:00:00.000Z", "pm02": 12.5, "pm10": 14.0, "rco2": 600, "atmp": 25.5, "rhum": 60, "wifi": -55, "boot": 3},
        ]))
        with patch.object(ext.settings, "AIRGRADIENT_API_TOKEN", "tok"):
            records, ok = asyncio.run(self.source.fetch(client, dev, date(2026, 10, 11), date(2026, 10, 11)))
        self.assertTrue(ok)
        # one day → one day-sized chunk against the past-measures endpoint
        self.assertEqual(client.get.await_count, 1)
        self.assertIn("/measures/past", client.get.call_args_list[0].args[0])
        first_params = client.get.call_args_list[0].kwargs["params"]
        self.assertEqual(first_params["token"], "tok")
        self.assertEqual(first_params["from"], "20261011000000Z")
        self.assertEqual(first_params["to"], "20261012000000Z")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["device_name"], "ag_private")
        self.assertEqual(records[0]["datetime"], "2026-10-11T10:00:00.000Z")

    def test_vendor_fields_map_into_slots(self):
        dev = SyncDevice(**AIRGRADIENT_PRIVATE)
        slot_maps = {"ag_2": mp.slot_map_from_mappings(mp.EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS)}
        rows = ext.build_raw_rows([
            {"device_name": "ag_private", "datetime": "2026-10-11T10:00:00.000Z",
             "pm02": 12.5, "pm01": 8.0, "pm10": 14.0, "rco2": 600, "atmp": 25.5, "rhum": 60, "wifi": -55, "boot": 3, "tvocIndex": 100},
        ], {"ag_private": dev}, slot_maps)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["created_at_ts"], datetime(2026, 10, 11, 10, tzinfo=timezone.utc))
        self.assertEqual(row["field1"], 12.5)    # pm02 → pm2_5
        self.assertEqual(row["field8"], 8.0)     # pm01 → pm1
        self.assertEqual(row["field9"], 600.0)   # rco2 → co2
        self.assertEqual(row["field10"], 100.0)  # tvocIndex → tvoc
        self.assertEqual(row["field12"], -55.0)  # wifi → wifi_rssi
        self.assertEqual(row["field13"], 3.0)    # boot → boot_count
        self.assertEqual(row["field16"], 25.5)
        self.assertEqual(row["field17"], 60.0)

    def test_failed_direct_fetch_falls_back_to_analytics(self):
        dev = SyncDevice(**AIRGRADIENT_PRIVATE)
        client = MagicMock()
        client.get = AsyncMock(return_value=_response(401, text="bad token"))
        with patch.object(ext.settings, "AIRGRADIENT_API_TOKEN", "tok"):
            records, ok = asyncio.run(self.source.fetch(client, dev, date(2026, 10, 11), date(2026, 10, 11)))
        self.assertFalse(ok)
        self.assertEqual(records, [])


class TestOrchestratorWithDirectSource(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add_all([SyncDevice(**AIRGRADIENT_PRIVATE), SyncDevice(**IQAIR)])
        self.db.commit()

    def test_direct_devices_skip_analytics(self):
        captured = {"raw": []}

        def fake_upsert(db, records, batch_size=2000):
            captured["raw"].extend(records)
            return len(records)

        async def fake_get(url, **kwargs):
            # Only the AirGradient raw endpoint is reached through client.get
            self.assertIn("/locations/88123/measures/past", url)
            return _response(200, [{"timestamp": "2026-10-11T10:00:00.000Z", "pm02": 9.0, "pm10": 11.0}])

        async def fake_post(url, json=None, params=None, headers=None):
            # analytics is only asked about the device without a direct source
            self.assertEqual(json["device_names"], ["phli_21"])
            self.assertEqual(json["network"], "iqair")
            return _response(200, {"data": [
                {"device_name": "phli_21", "datetime": "2026-10-11 10:00:00Z", "pm2_5": 20.0, "pm10": 25.0},
            ], "metadata": {"has_more": False}})

        client = MagicMock()
        client.get = AsyncMock(side_effect=fake_get)
        client.post = AsyncMock(side_effect=fake_post)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(ext, "SessionLocal", self.Session), \
             patch.object(ext.httpx, "AsyncClient", return_value=client), \
             patch.object(ext.crud_device_data, "upsert_raw_data", fake_upsert), \
             patch.object(ext.crud_device_data, "upsert_hourly_data", lambda db, r, batch_size=2000: len(r)), \
             patch.object(ext.crud_device_data, "upsert_daily_data", lambda db, r, batch_size=2000: len(r)), \
             patch.object(ext.settings, "AIRGRADIENT_API_TOKEN", "tok"), \
             patch.object(ext.settings, "PLATFORM_API_TOKEN", "api-token"):
            summary = asyncio.run(ext.sync_external_device_data(start_date="2026-10-11", end_date="2026-10-11"))

        self.assertTrue(summary["success"], summary)
        self.assertEqual(summary["devices"], 2)
        self.assertEqual(summary["direct_devices"], 1)
        self.assertEqual(summary["direct_requests"], 1)
        self.assertEqual(summary["direct_failed"], 0)
        self.assertEqual(summary["groups"], 1)
        keys = {r["channel_id"] for r in captured["raw"]}
        self.assertEqual(keys, {"ag_2", "iq_1"})
        ag_row = next(r for r in captured["raw"] if r["channel_id"] == "ag_2")
        self.assertEqual(ag_row["field1"], 9.0)

    def test_direct_failure_adds_device_to_analytics_fallback(self):
        asked_analytics_for = []

        async def fake_get(url, **kwargs):
            return _response(401, text="bad token")

        async def fake_post(url, json=None, params=None, headers=None):
            asked_analytics_for.extend(json["device_names"])
            return _response(200, {"data": [], "metadata": {"has_more": False}})

        client = MagicMock()
        client.get = AsyncMock(side_effect=fake_get)
        client.post = AsyncMock(side_effect=fake_post)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(ext, "SessionLocal", self.Session), \
             patch.object(ext.httpx, "AsyncClient", return_value=client), \
             patch.object(ext.settings, "AIRGRADIENT_API_TOKEN", "tok"):
            summary = asyncio.run(ext.sync_external_device_data(start_date="2026-10-11", end_date="2026-10-11"))

        self.assertFalse(summary["success"])
        self.assertEqual(summary["direct_failed"], 1)
        self.assertEqual(sorted(asked_analytics_for), ["ag_private", "phli_21"])


class TestLiveFeedPoll(_DbTestCase):
    def setUp(self):
        super().setUp()
        self.db.add_all([SyncDevice(**AIRGRADIENT), SyncDevice(**IQAIR), SyncDevice(**METONE)])
        self.db.commit()

    def test_feed_devices_limited_to_adapter_networks(self):
        with patch.object(ext.settings, "EXTERNAL_FEED_NETWORKS", "airgradient,iqair"):
            names = {d.device_name for d in ext.select_feed_devices(self.db)}
        self.assertEqual(names, {"ag_201560", "phli_21"})   # metone has no live adapter

    def test_feed_record_uses_reading_timestamp_or_poll_time(self):
        dev = SyncDevice(**AIRGRADIENT)
        polled = datetime(2026, 10, 12, 9, 7, tzinfo=timezone.utc)
        rec = ext.feed_record(dev, {"isCache": False, "pm2_5": "8.5", "timestamp": "2026-10-12T09:05:00Z", "co2": 455}, polled)
        self.assertEqual(rec["datetime"], datetime(2026, 10, 12, 9, 5, tzinfo=timezone.utc))
        self.assertNotIn("isCache", rec)
        rec = ext.feed_record(SyncDevice(**IQAIR), {"isCache": False, "pm2_5": 8.5}, polled)
        self.assertEqual(rec["datetime"], polled)
        self.assertIsNone(ext.feed_record(dev, {"isCache": False}, polled))

    def test_poll_stores_reading_and_refreshes_aggregates(self):
        feeds = {
            "201560": _response(200, {"isCache": False, "pm2_5": 8.5, "pm10": 10.0, "co2": 455, "wifi_rssi": -60,
                                      "temperature": 24.0, "humidity": 65, "timestamp": "2026-10-12T09:05:00Z"}),
            "6796fa282f158127e2a1f9f3": _response(404, {"success": False, "reason": "upstream_device_not_found"}),
        }

        async def fake_get(url, params=None, headers=None, **kwargs):
            if url.endswith("/world/locations/measures/current"):
                return _response(200, [])   # not on the public map → falls back to the registry feed
            self.assertTrue(url.endswith("/devices/feeds/transform/recent"))
            self.assertEqual(params["token"], "api-token")
            return feeds[params["serial_number"]]

        stored = {"hourly": [], "daily": []}

        def fake_upsert_raw(db, records, batch_size=2000):
            # Persist through the ORM so the aggregate recompute can read it back.
            for r in records:
                db.add(SyncRawDeviceData(id=uuid.uuid4(), **r))
            db.commit()
            return len(records)

        # An earlier sample in the same hour, already stored
        self.db.add(SyncRawDeviceData(id=uuid.uuid4(), channel_id="ag_1", device_id="ag_1", entry_id=1,
                                      created_at_ts=datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc), field1=11.5))
        self.db.commit()

        client = MagicMock()
        client.get = AsyncMock(side_effect=fake_get)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(ext, "SessionLocal", self.Session), \
             patch.object(ext.httpx, "AsyncClient", return_value=client), \
             patch.object(ext.crud_device_data, "upsert_raw_data", fake_upsert_raw), \
             patch.object(ext.crud_device_data, "upsert_hourly_data", lambda db, r, batch_size=2000: stored["hourly"].extend(r) or len(r)), \
             patch.object(ext.crud_device_data, "upsert_daily_data", lambda db, r, batch_size=2000: stored["daily"].extend(r) or len(r)), \
             patch.object(ext.settings, "PLATFORM_API_TOKEN", "api-token"), \
             patch.object(ext.settings, "EXTERNAL_FEED_NETWORKS", "airgradient,iqair"):
            summary = asyncio.run(ext.poll_external_feeds())

        self.assertEqual(summary["devices"], 2)
        self.assertEqual(summary["polled"], 2)
        self.assertEqual(summary["readings"], 1)
        self.assertEqual(summary["not_found"], 1)
        self.assertEqual(summary["failed"], 0)

        rows = self.db.query(SyncRawDeviceData).filter(SyncRawDeviceData.channel_id == "ag_1").all()
        self.assertEqual(len(rows), 2)
        new_row = next(r for r in rows if r.entry_id != 1)
        self.assertEqual(new_row.field1, 8.5)
        self.assertEqual(new_row.field9, 455.0)
        self.assertEqual(new_row.field12, -60.0)

        # The hour's aggregate averages the earlier sample and the new one
        self.assertEqual(len(stored["hourly"]), 1)
        self.assertEqual(stored["hourly"][0]["field1_avg"], 10.0)
        self.assertEqual(stored["hourly"][0]["record_count"], 2)
        self.assertEqual(stored["daily"][0]["data_date"], date(2026, 10, 12))



class TestAirGradientWorldSource(_DbTestCase):
    """Public AirGradient devices are read straight from the manufacturer with no credential."""

    def setUp(self):
        super().setUp()
        self.db.add_all([
            SyncDevice(**AIRGRADIENT),                       # public, serial 201560
            SyncDevice(**AIRGRADIENT_PRIVATE),               # authRequired → not public
            SyncDevice(device_id="ag_n", device_name="ag_170157", network_id="airgradient", category="lowcost", status="deployed"),
            SyncDevice(**IQAIR),
        ])
        self.db.commit()

    def test_supports_public_devices_only_and_resolves_ids(self):
        world = ext.AirGradientWorldSource()
        self.assertTrue(world.supports(SyncDevice(**AIRGRADIENT)))
        self.assertFalse(world.supports(SyncDevice(**AIRGRADIENT_PRIVATE)))
        self.assertFalse(world.supports(SyncDevice(**IQAIR)))
        named = self.db.query(SyncDevice).filter(SyncDevice.device_id == "ag_n").one()
        self.assertTrue(world.supports(named))   # location id parsed from the name
        self.assertEqual(world.url(named), "https://api.airgradient.com/public/api/v1/world/locations/170157/measures/current")
        self.assertIsInstance(ext.direct_live_source_for(SyncDevice(**AIRGRADIENT)), ext.AirGradientWorldSource)

    def test_feed_devices_include_public_airgradient_without_serial(self):
        with patch.object(ext.settings, "EXTERNAL_FEED_NETWORKS", "iqair"):
            names = {d.device_name for d in ext.select_feed_devices(self.db)}
        # ag_201560 and ag_170157 qualify through the world source; the private one needs the registry feed
        self.assertEqual(names, {"ag_201560", "ag_170157", "phli_21"})

    def test_poll_uses_one_bulk_call_and_no_platform_auth_for_public_devices(self):
        world_payload = [
            {"locationId": 201560, "pm02": 9.5, "pm10": 12.0, "rco2": 455, "atmp": 24.0, "rhum": 65, "wifi": -60,
             "timestamp": "2026-10-23T08:43:00.000Z"},
            {"locationId": 170157, "pm02": 0.0, "pm10": 0.0, "rco2": 401, "atmp": 24.4, "rhum": 54, "wifi": -63,
             "timestamp": "2026-10-23T08:43:11.000Z"},
            {"locationId": 999, "pm02": 1.0},
        ]
        calls = []

        async def fake_get(url, params=None, headers=None, **kwargs):
            calls.append((url, params))
            if url.endswith("/world/locations/measures/current"):
                return _response(200, world_payload)
            if "/feeds/transform/recent" in url:
                return _response(200, {"isCache": False, "pm2_5": 7.0, "pm10": 9.0, "timestamp": "2026-10-23T08:40:00Z"})
            return _response(404, {})

        stored = []

        def fake_upsert_raw(db, records, batch_size=2000):
            stored.extend(records)
            for r in records:
                db.add(SyncRawDeviceData(id=uuid.uuid4(), **r))
            db.commit()
            return len(records)

        client = MagicMock()
        client.get = AsyncMock(side_effect=fake_get)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(ext, "SessionLocal", self.Session), \
             patch.object(ext.httpx, "AsyncClient", return_value=client), \
             patch.object(ext.crud_device_data, "upsert_raw_data", fake_upsert_raw), \
             patch.object(ext.crud_device_data, "upsert_hourly_data", lambda db, r, batch_size=2000: len(r)), \
             patch.object(ext.crud_device_data, "upsert_daily_data", lambda db, r, batch_size=2000: len(r)), \
             patch.object(ext.settings, "EXTERNAL_FEED_NETWORKS", "airgradient,iqair"), \
             patch.object(ext.settings, "PLATFORM_API_TOKEN", ""), patch.object(ext.settings, "TOKEN", ""):
            summary = asyncio.run(ext.poll_external_feeds())

        self.assertEqual(summary["direct"], 2)           # both public AirGradient devices, from the one bulk call
        # + the private AirGradient device and the IQAir device through the registry feed
        self.assertEqual(summary["readings"], 4)
        bulk_calls = [c for c in calls if c[0].endswith("/world/locations/measures/current")]
        self.assertEqual(len(bulk_calls), 1)
        self.assertNotIn("token", bulk_calls[0][1] or {})
        per_location = [c for c in calls if "/world/locations/" in c[0] and not c[0].endswith("/measures/current") or "/world/locations/2" in c[0]]
        self.assertEqual(per_location, [])
        by_key = {r["channel_id"]: r for r in stored}
        self.assertEqual(by_key["ag_1"]["field1"], 9.5)      # pm02 → pm2_5
        self.assertEqual(by_key["ag_1"]["field9"], 455.0)    # rco2 → co2
        self.assertEqual(by_key["ag_1"]["field12"], -60.0)   # wifi → wifi_rssi
        self.assertEqual(by_key["ag_1"]["created_at_ts"], datetime(2026, 10, 23, 8, 43, tzinfo=timezone.utc))
        self.assertEqual(by_key["ag_n"]["field1"], 0.0)
        self.assertEqual(by_key["iq_1"]["field1"], 7.0)
