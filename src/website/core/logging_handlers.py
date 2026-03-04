import logging
import threading
import time
from typing import Dict

import requests


class SlackWebhookHandler(logging.Handler):
    """
    Lightweight Slack webhook handler for high-severity alerts.
    - Fail-open: never raises into application flow.
    - Dedupe window: suppresses repeated identical alerts briefly.
    - Low timeout: avoids request latency impact.
    """

    def __init__(
        self,
        webhook_url: str,
        channel: str = "",
        environment: str = "production",
        timeout: float = 3.0,
        dedupe_window_seconds: int = 120,
    ):
        super().__init__()
        self.webhook_url = (webhook_url or "").strip()
        self.channel = (channel or "").strip()
        self.environment = environment
        self.timeout = timeout
        self.dedupe_window_seconds = dedupe_window_seconds
        self.session = requests.Session()
        self._sent_cache: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._local = threading.local()

    def emit(self, record: logging.LogRecord) -> None:
        if not self.webhook_url:
            return

        # Prevent recursive logging loops in case of downstream logging during emit.
        if getattr(self._local, "in_emit", False):
            return

        self._local.in_emit = True
        try:
            if self._is_duplicate(record):
                return

            payload = {
                "text": self.format(record),
                "username": f"AirQo Website API [{self.environment}]",
            }

            if self.channel:
                payload["channel"] = self.channel

            self.session.post(self.webhook_url, json=payload, timeout=self.timeout)
        except Exception:
            # Keep handler fail-open; do not break request flow.
            self.handleError(record)
        finally:
            self._local.in_emit = False

    def _is_duplicate(self, record: logging.LogRecord) -> bool:
        fingerprint = f"{record.name}|{record.levelno}|{record.getMessage()}"
        now = time.time()

        with self._lock:
            # prune old cache entries
            stale_before = now - self.dedupe_window_seconds
            stale_keys = [k for k, t in self._sent_cache.items() if t < stale_before]
            for key in stale_keys:
                self._sent_cache.pop(key, None)

            last_sent = self._sent_cache.get(fingerprint)
            if last_sent and (now - last_sent) < self.dedupe_window_seconds:
                return True

            self._sent_cache[fingerprint] = now
            return False
