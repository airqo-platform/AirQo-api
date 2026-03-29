import threading
import time
from typing import Any, Dict, Optional


class TTLCache:
    """A minimal thread-safe in-memory TTL cache with background cleanup.

    Stores arbitrary Python objects in memory with a per-key expiration.
    Each entry keeps `created_at` and `expires_at` timestamps which callers
    can inspect to compare against external sources (e.g., file mtime).
    """

    def __init__(
        self, default_ttl: int = 3600, maxsize: int = 128, cleanup_interval: int = 60
    ):
        self.default_ttl = default_ttl
        self.maxsize = maxsize
        self.cleanup_interval = cleanup_interval
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._stop = False
        self._thread = threading.Thread(target=self._cleanup_worker, daemon=True)
        self._thread.start()

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        ttl = ttl or self.default_ttl
        with self._lock:
            if len(self._store) >= self.maxsize and key not in self._store:
                # simple eviction: remove oldest entry by created_at
                oldest = min(self._store.items(), key=lambda kv: kv[1]["created_at"])[0]
                del self._store[oldest]

            now = time.time()
            self._store[key] = {
                "value": value,
                "created_at": now,
                "expires_at": now + ttl,
            }

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            if item["expires_at"] < time.time():
                del self._store[key]
                return None
            return item["value"]

    def get_meta(self, key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            return {"created_at": item["created_at"], "expires_at": item["expires_at"]}

    def clear(self, key: str) -> None:
        with self._lock:
            if key in self._store:
                del self._store[key]

    def _cleanup_worker(self) -> None:
        while not self._stop:
            with self._lock:
                now = time.time()
                expired = [k for k, v in self._store.items() if v["expires_at"] < now]
                for k in expired:
                    del self._store[k]
            time.sleep(self.cleanup_interval)

    def stop(self) -> None:
        self._stop = True
        try:
            self._thread.join(timeout=1.0)
        except Exception:
            pass
