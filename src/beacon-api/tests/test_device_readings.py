"""
Per-device readings on demand: GET /devices/{id}/readings answers from the
local tables and refreshes a stale device in the background, behind a
device_readings_refresh claim per device. GET /devices/{id} and single-device performance trigger the
same refresh.
"""
import asyncio
import base64
import json
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.models.device_data import DeviceReadingsRefresh, SyncHourlyDeviceData, SyncRawDeviceData
from app.models.sync import SyncDevice
from app.services import device_readings_service as drs
from app.services import device_service
from app.services import external_sync_service as ext
from app.services import thingspeak_sync_service as ts
from main import app


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


NOW = datetime(2026, 10, 28, 9, 30, tzinfo=timezone.utc)
CLAIM = NOW + timedelta(seconds=drs._RUNNING_TTL_SECONDS)   # a claim taken at NOW
CHANNEL = "2866794"


def _jwt(payload):
    seg = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
    return f"{seg({'alg': 'HS256', 'typ': 'JWT'})}.{seg(payload)}.sig"


AUTH = {"Authorization": f"JWT {_jwt({'_id': 'user_1'})}"}

AIRQO = dict(device_id="aq_1", device_name="airqo_g5433", network_id="airqo", category="lowcost",
             device_number=2866794, readKey="k", status="deployed")
AIRGRADIENT = dict(device_id="ag_1", device_name="ag_201560", network_id="airgradient", category="lowcost",
                   serial_number="201560", api_code="https://api.airgradient.com/x", status="deployed")
NO_SOURCE = dict(device_id="x_1", device_name="mystery", network_id="airbeam", category="lowcost", status="deployed")


class FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW if tz else NOW.replace(tzinfo=None)


def _raw(channel, entry_id, ts_, field1=None, device_id="aq_1"):
    return SyncRawDeviceData(id=uuid.uuid4(), channel_id=channel, device_id=device_id, entry_id=entry_id,
                             created_at_ts=ts_, field1=field1)


def _response(status_code, payload):
    r = MagicMock()
    r.status_code = status_code
    r.json.return_value = payload
    r.text = ""
    return r


class _Base(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.db.add_all([SyncDevice(**AIRQO), SyncDevice(**AIRGRADIENT), SyncDevice(**NO_SOURCE)])
        self.db.commit()

        for target, attr, value in (
            (drs, "SessionLocal", self.Session),
            (drs, "datetime", FixedDatetime),
            (drs.settings, "DEVICE_READINGS_STALE_MINUTES", 10),
            (drs.settings, "DEVICE_READINGS_REFRESH_COOLDOWN_SECONDS", 120),
            (drs.settings, "ENABLED_NETWORKS", ""),
        ):
            patcher = patch.object(target, attr, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def device(self, device_id):
        return self.db.query(SyncDevice).filter(SyncDevice.device_id == device_id).one()

    def claim(self, device_id):
        self.db.expire_all()
        row = self.db.query(DeviceReadingsRefresh).filter(DeviceReadingsRefresh.device_id == device_id).one_or_none()
        return (row.state, ext._as_utc(row.expires_at)) if row else None


class TestRefreshDecision(_Base):
    def test_window_starts_at_newest_reading_today_else_midnight(self):
        midnight = datetime(2026, 10, 28, tzinfo=timezone.utc)
        self.assertEqual(drs.refresh_window_start(NOW - timedelta(minutes=45), NOW), NOW - timedelta(minutes=45))
        self.assertEqual(drs.refresh_window_start(NOW - timedelta(days=1), NOW), midnight)
        self.assertEqual(drs.refresh_window_start(None, NOW), midnight)
        # Stored timestamps can come back naive; they are UTC
        self.assertEqual(drs.refresh_window_start(datetime(2026, 10, 28, 8, 0), NOW),
                         datetime(2026, 10, 28, 8, 0, tzinfo=timezone.utc))

    def test_staleness_threshold(self):
        self.assertTrue(drs.is_stale(None, NOW))
        self.assertFalse(drs.is_stale(NOW - timedelta(minutes=5), NOW))
        self.assertTrue(drs.is_stale(NOW - timedelta(minutes=20), NOW))
        self.assertFalse(drs.is_stale(datetime(2026, 10, 28, 9, 25), NOW))

    def test_refresh_source_by_manufacturer(self):
        self.assertEqual(drs.refresh_source(self.device("aq_1")), drs.SOURCE_THINGSPEAK)
        self.assertEqual(drs.refresh_source(self.device("ag_1")), drs.SOURCE_LIVE_FEED)
        self.assertIsNone(drs.refresh_source(self.device("x_1")))
        self.assertIsNone(drs.refresh_source(SyncDevice(**{**AIRQO, "readKey": None})))
        with patch.object(drs.settings, "ENABLED_NETWORKS", "airgradient"):
            self.assertIsNone(drs.refresh_source(self.device("aq_1")))

    def test_first_stale_view_starts_refresh_and_later_views_wait(self):
        self.db.add(_raw(CHANNEL, 1, NOW - timedelta(minutes=90), 10.0))
        self.db.commit()
        dev = self.device("aq_1")

        first = BackgroundTasks()
        self.assertEqual(drs.refresh_if_stale(self.db, first, dev, NOW), drs.REFRESH_STARTED)
        self.assertEqual(len(first.tasks), 1)
        self.assertIs(first.tasks[0].func, drs.refresh_device_readings)
        self.assertEqual(first.tasks[0].args, ("aq_1", CLAIM))
        self.assertEqual(self.claim("aq_1"), ("running", CLAIM))

        second = BackgroundTasks()
        self.assertEqual(drs.refresh_if_stale(self.db, second, dev, NOW), drs.REFRESH_RUNNING)
        self.assertEqual(second.tasks, [])

        # The refresh finished but the device has nothing newer: wait out the cooldown
        drs._release("aq_1", CLAIM, "no_data")
        self.assertEqual(self.claim("aq_1"), ("no_data", NOW + timedelta(seconds=120)))
        third = BackgroundTasks()
        self.assertEqual(drs.refresh_if_stale(self.db, third, dev, NOW), drs.REFRESH_COOLDOWN)
        self.assertEqual(third.tasks, [])

        # Once the cooldown has passed the next view takes the claim over
        later = NOW + timedelta(seconds=121)
        fourth = BackgroundTasks()
        self.assertEqual(drs.refresh_if_stale(self.db, fourth, dev, later), drs.REFRESH_STARTED)
        self.assertEqual(len(fourth.tasks), 1)
        self.assertEqual(self.claim("aq_1")[0], "running")

    def test_fresh_device_needs_no_refresh_and_no_claim(self):
        self.db.add(_raw(CHANNEL, 1, NOW - timedelta(minutes=3), 10.0))
        self.db.commit()
        tasks = BackgroundTasks()
        status = drs.refresh_if_stale(self.db, tasks, self.device("aq_1"), NOW)
        self.assertEqual(status, drs.REFRESH_NOT_NEEDED)
        self.assertEqual(tasks.tasks, [])
        self.assertIsNone(self.claim("aq_1"))

    def test_device_without_source_is_not_refreshed(self):
        tasks = BackgroundTasks()
        self.assertEqual(drs.refresh_if_stale(self.db, tasks, self.device("x_1"), NOW), drs.REFRESH_NOT_APPLICABLE)
        self.assertEqual(drs.refresh_if_stale(self.db, tasks, None, NOW), drs.REFRESH_NOT_APPLICABLE)
        self.assertEqual(tasks.tasks, [])

    def test_losing_a_first_claim_race_reports_running(self):
        # Another replica inserts the device's claim between our check and our insert
        def rival_claims_first(session, flush_context, instances):
            if any(isinstance(obj, DeviceReadingsRefresh) for obj in session.new):
                session.connection().execute(DeviceReadingsRefresh.__table__.insert().values(
                    device_id="aq_1", state="running", expires_at=NOW + timedelta(minutes=5),
                ))

        event.listen(self.Session, "before_flush", rival_claims_first)
        self.addCleanup(event.remove, self.Session, "before_flush", rival_claims_first)
        tasks = BackgroundTasks()
        self.assertEqual(drs.refresh_if_stale(self.db, tasks, self.device("aq_1"), NOW), drs.REFRESH_RUNNING)
        self.assertEqual(tasks.tasks, [])

    def test_the_claim_runs_on_the_request_session(self):
        # A second session would need a second pooled connection while the request holds one
        no_second_session = MagicMock(side_effect=AssertionError("opened a second session"))
        with patch.object(drs, "SessionLocal", no_second_session):
            status = drs.refresh_if_stale(self.db, BackgroundTasks(), self.device("aq_1"), NOW)
        self.assertEqual(status, drs.REFRESH_STARTED)
        self.assertEqual(self.claim("aq_1"), ("running", CLAIM))

    def test_a_failed_claim_leaves_the_request_session_usable(self):
        with patch.object(self.db, "commit", side_effect=RuntimeError("db gone")):
            status = drs.refresh_if_stale(self.db, BackgroundTasks(), self.device("aq_1"), NOW)
        self.assertEqual(status, drs.REFRESH_UNAVAILABLE)
        self.assertEqual(self.device("aq_1").device_id, "aq_1")
        self.assertIsNone(self.claim("aq_1"))

    def test_a_refresh_that_outlived_its_claim_leaves_the_newer_claim(self):
        self.assertEqual(drs._claim(self.db, "aq_1", NOW), (CLAIM, "running"))
        # The first refresh overran its claim and a later view took the device over
        later = CLAIM + timedelta(seconds=1)
        newer, _ = drs._claim(self.db, "aq_1", later)
        self.assertEqual(newer, later + timedelta(seconds=drs._RUNNING_TTL_SECONDS))

        self.assertFalse(drs._release("aq_1", CLAIM, "ok"))
        self.assertEqual(self.claim("aq_1"), ("running", newer))
        self.assertTrue(drs._release("aq_1", newer, "ok"))
        self.assertEqual(self.claim("aq_1")[0], "ok")

    def test_a_failed_check_never_raises(self):
        with patch.object(drs, "latest_reading_at", side_effect=RuntimeError("db gone")):
            status = drs.refresh_if_stale(self.db, BackgroundTasks(), self.device("aq_1"), NOW)
        self.assertEqual(status, drs.REFRESH_UNAVAILABLE)
        with patch.object(drs, "_claim", side_effect=RuntimeError("db gone")):
            status = drs.refresh_if_stale(self.db, BackgroundTasks(), self.device("aq_1"), NOW)
        self.assertEqual(status, drs.REFRESH_UNAVAILABLE)
        with patch.object(drs, "find_device", side_effect=RuntimeError("db gone")):
            status = drs.refresh_viewed_device(self.db, BackgroundTasks(), "aq_1")
        self.assertEqual(status, drs.REFRESH_UNAVAILABLE)

    def test_covers_today(self):
        self.assertTrue(drs.covers_today("2026-10-28T23:59:59Z", NOW))
        self.assertTrue(drs.covers_today("2026-10-29T00:00:00Z", NOW))
        self.assertFalse(drs.covers_today("2026-10-27T10:00:00Z", NOW))
        self.assertFalse(drs.covers_today("not a date", NOW))
        self.assertFalse(drs.covers_today(None, NOW))


class TestBackgroundRefresh(_Base):
    def setUp(self):
        super().setUp()
        self.captured = {"hourly": [], "daily": []}

        def fake_upsert_raw(db, records, batch_size=2000):
            # Upsert on (channel_id, entry_id) through the ORM so aggregates can read it back
            for r in records:
                db.query(SyncRawDeviceData).filter(
                    SyncRawDeviceData.channel_id == r["channel_id"], SyncRawDeviceData.entry_id == r["entry_id"],
                ).delete()
                db.add(SyncRawDeviceData(id=uuid.uuid4(), **r))
            db.commit()
            return len(records)

        for target, value in (
            ("upsert_raw_data", fake_upsert_raw),
            ("upsert_hourly_data", lambda db, r, batch_size=2000: self.captured["hourly"].extend(r) or len(r)),
            ("upsert_daily_data", lambda db, r, batch_size=2000: self.captured["daily"].extend(r) or len(r)),
        ):
            patcher = patch.object(ext.crud_device_data, target, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch.object(ext, "SessionLocal", self.Session)
        patcher.start()
        self.addCleanup(patcher.stop)
        # A refresh only runs after a view claimed the device
        drs._claim(self.db, "aq_1", NOW)
        drs._claim(self.db, "ag_1", NOW)

    def test_thingspeak_fetches_from_newest_reading_and_rebuilds_the_day(self):
        self.db.add(_raw(CHANNEL, 100, datetime(2026, 10, 28, 8, 0, tzinfo=timezone.utc), 10.0))
        self.db.commit()
        fetch = AsyncMock(return_value=[{"channel_id": CHANNEL, "feeds": [
            {"entry_id": 100, "created_at": "2026-10-28T08:00:00Z", "field1": "10"},
            {"entry_id": 101, "created_at": "2026-10-28T08:30:00Z", "field1": "20", "field8": "0.3,32.5"},
        ]}])

        with patch.object(ts, "fetch_thingspeak_data_bulk", fetch):
            result = asyncio.run(drs.refresh_device_readings("aq_1", CLAIM, NOW))

        fetch.assert_awaited_once_with(
            [{"channel_id": CHANNEL, "api_key": "k"}], "2026-10-28", "2026-10-28",
            start_time="08:00:00", end_time="09:30:00",
        )
        self.assertEqual(result["outcome"], "ok")
        self.assertEqual(result["raw_records"], 2)

        rows = self.db.query(SyncRawDeviceData).order_by(SyncRawDeviceData.entry_id).all()
        self.assertEqual([r.entry_id for r in rows], [100, 101])
        self.assertEqual(rows[1].field8, 0.3)

        # The hour is rebuilt from everything stored, not just the fetched rows
        hour = next(h for h in self.captured["hourly"] if h["hour_start"].hour == 8)
        self.assertEqual(hour["record_count"], 2)
        self.assertEqual(hour["field1_avg"], 15.0)
        self.assertEqual(self.captured["daily"][0]["data_date"], date(2026, 10, 28))
        self.assertFalse(self.captured["daily"][0]["complete"])   # today is not over

        self.assertEqual(self.claim("aq_1"), ("ok", NOW + timedelta(seconds=120)))

    def test_thingspeak_with_nothing_today_starts_at_midnight(self):
        self.db.add(_raw(CHANNEL, 1, NOW - timedelta(days=1), 10.0))
        self.db.commit()
        fetch = AsyncMock(return_value=[{"channel_id": CHANNEL, "feeds": []}])
        with patch.object(ts, "fetch_thingspeak_data_bulk", fetch):
            result = asyncio.run(drs.refresh_device_readings("aq_1", CLAIM, NOW))
        self.assertEqual(fetch.await_args.kwargs["start_time"], "00:00:00")
        self.assertEqual(result["outcome"], "no_data")
        self.assertEqual(self.captured["hourly"], [])
        self.assertEqual(self.claim("aq_1"), ("no_data", NOW + timedelta(seconds=120)))

    def test_live_feed_stores_the_current_reading(self):
        self.db.add(_raw("ag_1", 1, datetime(2026, 10, 28, 9, 0, tzinfo=timezone.utc), 11.5, device_id="ag_1"))
        self.db.commit()
        client = MagicMock()
        client.get = AsyncMock(return_value=_response(200, {
            "locationId": 201560, "pm02": 8.5, "pm10": 10.0, "rco2": 455, "timestamp": "2026-10-28T09:20:00.000Z",
        }))
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(drs.httpx, "AsyncClient", return_value=client):
            result = asyncio.run(drs.refresh_device_readings("ag_1", CLAIM, NOW))

        self.assertEqual(result["outcome"], "ok")
        self.assertTrue(client.get.await_args.args[0].endswith("/world/locations/201560/measures/current"))
        new_row = self.db.query(SyncRawDeviceData).filter(SyncRawDeviceData.entry_id != 1).one()
        self.assertEqual(new_row.channel_id, "ag_1")
        self.assertEqual(new_row.field1, 8.5)
        self.assertEqual(new_row.field9, 455.0)
        hour = next(h for h in self.captured["hourly"] if h["hour_start"].hour == 9)
        self.assertEqual(hour["field1_avg"], 10.0)   # averaged with the sample already stored
        self.assertEqual(self.claim("ag_1"), ("ok", NOW + timedelta(seconds=120)))

    def test_a_failed_refresh_still_sets_the_cooldown(self):
        with patch.object(ts, "fetch_thingspeak_data_bulk", AsyncMock(side_effect=RuntimeError("boom"))):
            result = asyncio.run(drs.refresh_device_readings("aq_1", CLAIM, NOW))
        self.assertEqual(result["outcome"], "failed")
        self.assertEqual(self.claim("aq_1"), ("failed", NOW + timedelta(seconds=120)))

    def test_unknown_device_is_a_no_op(self):
        result = asyncio.run(drs.refresh_device_readings("gone", CLAIM, NOW))
        self.assertEqual(result["outcome"], drs.REFRESH_NOT_APPLICABLE)


class TestDeviceEndpoints(_Base):
    def setUp(self):
        super().setUp()
        self.db.add_all([
            _raw(CHANNEL, 2, datetime(2026, 10, 28, 8, 30, tzinfo=timezone.utc), 20.0),
            _raw(CHANNEL, 1, datetime(2026, 10, 28, 8, 0, tzinfo=timezone.utc), 10.0),
            _raw(CHANNEL, 0, datetime(2026, 10, 27, 23, 0, tzinfo=timezone.utc), 5.0),
            SyncHourlyDeviceData(id=uuid.uuid4(), channel_id=CHANNEL, device_id="aq_1",
                                 hour_start=datetime(2026, 10, 28, 8, 0, tzinfo=timezone.utc),
                                 field1_avg=15.0, record_count=2, complete=True),
        ])
        self.db.commit()

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.addCleanup(app.dependency_overrides.pop, get_db, None)
        self.refresh = AsyncMock()
        patcher = patch.object(drs, "refresh_device_readings", self.refresh)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(app)

    def test_today_oldest_first_and_stale_device_refreshes(self):
        resp = self.client.get("/api/v1/devices/aq_1/readings", headers=AUTH)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertEqual(body["data_date"], "2026-10-28")
        self.assertEqual(body["channel_id"], CHANNEL)
        self.assertEqual(body["count"], 2)
        self.assertEqual([r["entry_id"] for r in body["data"]], [1, 2])
        self.assertTrue(body["last_reading_at"].startswith("2026-10-28T08:30:00"))
        self.assertEqual(body["refresh"], "started")
        self.refresh.assert_called_once_with("aq_1", CLAIM)

        # A second viewer while that refresh still holds the claim
        body = self.client.get("/api/v1/devices/aq_1/readings", headers=AUTH).json()
        self.assertEqual(body["refresh"], "running")
        self.assertEqual(self.refresh.call_count, 1)

    def test_lookup_by_name_and_hourly_frequency(self):
        resp = self.client.get("/api/v1/devices/airqo_g5433/readings?frequency=hourly", headers=AUTH)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertEqual(body["device_id"], "aq_1")
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["data"][0]["field1_avg"], 15.0)
        self.assertEqual(body["data"][0]["record_count"], 2)

    def test_past_day_or_refresh_off_reads_only(self):
        body = self.client.get("/api/v1/devices/aq_1/readings?date=2026-10-27", headers=AUTH).json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["refresh"], "not_applicable")
        body = self.client.get("/api/v1/devices/aq_1/readings?refresh=false", headers=AUTH).json()
        self.assertEqual(body["refresh"], "not_applicable")
        self.refresh.assert_not_called()

    def test_unknown_or_disabled_device_is_404(self):
        self.assertEqual(self.client.get("/api/v1/devices/nope/readings", headers=AUTH).status_code, 404)
        with patch.object(drs.settings, "ENABLED_NETWORKS", "airgradient"):
            self.assertEqual(self.client.get("/api/v1/devices/aq_1/readings", headers=AUTH).status_code, 404)

    def test_bad_frequency_or_auth(self):
        self.assertEqual(self.client.get("/api/v1/devices/aq_1/readings?frequency=daily", headers=AUTH).status_code, 400)
        for header in ("Bearer x", "JWT not-a-jwt", f"JWT {_jwt({'sub': 'no-id'})}"):
            self.assertEqual(
                self.client.get("/api/v1/devices/aq_1/readings", headers={"Authorization": header}).status_code, 401,
            )

    def test_get_device_by_id_refreshes_the_device(self):
        found = AsyncMock(return_value={"success": True, "message": "ok", "data": None})
        with patch.object(device_service, "get_device_by_id", found):
            self.assertEqual(self.client.get("/api/v1/devices/aq_1", headers=AUTH).status_code, 200)
        self.refresh.assert_called_once_with("aq_1", CLAIM)

        self.refresh.reset_mock()
        missing = AsyncMock(return_value={"success": False, "message": "nope", "status_code": 404})
        with patch.object(device_service, "get_device_by_id", missing):
            self.assertEqual(self.client.get("/api/v1/devices/zz_9", headers=AUTH).status_code, 404)
        self.refresh.assert_not_called()

    def test_single_device_performance_up_to_today_refreshes(self):
        perf = AsyncMock(return_value={"success": True, "message": "ok", "data": []})
        today = "startDateTime=2026-10-28T00:00:00Z&endDateTime=2026-10-28T23:59:59Z"
        with patch.object(device_service, "get_device_performance", perf):
            resp = self.client.get(f"/api/v1/devices/performance?device_name=airqo_g5433&{today}")
            self.assertEqual(resp.status_code, 200, resp.text)
            self.refresh.assert_called_once_with("aq_1", CLAIM)

            self.refresh.reset_mock()
            perf.reset_mock()
            multi = self.client.get(f"/api/v1/devices/performance?device_name=airqo_g5433,ag_201560&{today}")
            past = self.client.get(
                "/api/v1/devices/performance?device_name=airqo_g5433"
                "&startDateTime=2026-10-20T00:00:00Z&endDateTime=2026-10-27T00:00:00Z"
            )
            # Both were answered, so the refresh was skipped on purpose
            self.assertEqual((multi.status_code, past.status_code), (200, 200))
            self.assertEqual(perf.await_count, 2)
            self.refresh.assert_not_called()


if __name__ == "__main__":
    unittest.main()
