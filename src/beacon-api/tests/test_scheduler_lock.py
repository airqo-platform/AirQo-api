import unittest
from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import create_engine

from app.db.locks import advisory_lock
from app.services import scheduler_service


def _postgres_bind(acquired: bool):
    conn = MagicMock()
    conn.execute.return_value.scalar.return_value = acquired
    bind = MagicMock()
    bind.dialect.name = "postgresql"
    bind.connect.return_value = conn
    return bind, conn


def _executed_sql(conn):
    return [str(call.args[0]) for call in conn.execute.call_args_list]


class AdvisoryLockTests(unittest.TestCase):
    def test_non_postgres_databases_always_acquire(self):
        engine = create_engine("sqlite://")
        with advisory_lock(engine, 42) as acquired:
            self.assertTrue(acquired)

    def test_acquired_lock_is_released_and_connection_closed(self):
        bind, conn = _postgres_bind(acquired=True)
        with advisory_lock(bind, 42) as acquired:
            self.assertTrue(acquired)
        self.assertEqual(
            _executed_sql(conn),
            ["SELECT pg_try_advisory_lock(:key)", "SELECT pg_advisory_unlock(:key)"],
        )
        conn.close.assert_called_once()

    def test_lock_held_elsewhere_is_not_unlocked(self):
        bind, conn = _postgres_bind(acquired=False)
        with advisory_lock(bind, 42) as acquired:
            self.assertFalse(acquired)
        self.assertEqual(_executed_sql(conn), ["SELECT pg_try_advisory_lock(:key)"])
        conn.close.assert_called_once()

    def test_lock_is_released_when_the_block_raises(self):
        bind, conn = _postgres_bind(acquired=True)
        with self.assertRaises(RuntimeError):
            with advisory_lock(bind, 42):
                raise RuntimeError("sync blew up")
        self.assertIn("SELECT pg_advisory_unlock(:key)", _executed_sql(conn))
        conn.close.assert_called_once()

    def test_failed_unlock_discards_the_connection_without_raising(self):
        bind, conn = _postgres_bind(acquired=True)
        conn.execute.side_effect = [conn.execute.return_value, RuntimeError("connection reset")]
        with self.assertLogs("app.db.locks", level="WARNING"):
            with advisory_lock(bind, 42) as acquired:
                self.assertTrue(acquired)
        conn.invalidate.assert_called_once()
        conn.close.assert_called_once()


class NightlySyncLockTests(unittest.IsolatedAsyncioTestCase):
    def _lock(self, acquired: bool):
        @contextmanager
        def fake_lock(bind, key):
            self.assertEqual(key, scheduler_service.NIGHTLY_SYNC_LOCK_KEY)
            yield acquired
        return fake_lock

    async def test_replica_holding_the_lock_runs_the_sync(self):
        run = AsyncMock()
        with patch.object(scheduler_service, "advisory_lock", self._lock(True)), \
                patch.object(scheduler_service, "_run_nightly_sync", run):
            await scheduler_service.scheduled_thingspeak_sync()
        run.assert_awaited_once()

    async def test_other_replicas_skip_the_sync(self):
        run = AsyncMock()
        with patch.object(scheduler_service, "advisory_lock", self._lock(False)), \
                patch.object(scheduler_service, "_run_nightly_sync", run):
            await scheduler_service.scheduled_thingspeak_sync()
        run.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
