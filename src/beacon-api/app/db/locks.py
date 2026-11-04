import logging
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


@contextmanager
def advisory_lock(bind: Engine, key: int) -> Iterator[bool]:
    """
    Hold a session-level PostgreSQL advisory lock for the duration of the block.
    Uses a dedicated connection, because an ORM session hands its connection back to
    the pool after every commit. Yields False when another connection holds the lock.
    No-op (always yields True) on databases without advisory locks.
    """
    if bind.dialect.name != "postgresql":
        yield True
        return

    conn = bind.connect()
    try:
        acquired = bool(conn.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": key}).scalar())
        conn.commit()  # the lock is session-level; don't leave the connection idle in a transaction
        try:
            yield acquired
        finally:
            if acquired:
                try:
                    conn.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
                    conn.commit()
                except Exception:
                    # A pool reset only rolls back, which keeps a session-level lock held;
                    # drop the connection instead so ending the backend session releases it.
                    logger.warning(f"Could not release advisory lock {key}; discarding connection", exc_info=True)
                    conn.invalidate()
    finally:
        conn.close()
