import logging
import threading
import time
from typing import Optional

import httpx

class SlackWebhookHandler(logging.Handler):
    def __init__(
        self,
        webhook_url: str,
        environment: str = "unknown",
        timeout: float = 3.0,
        dedupe_window_seconds: int = 120,
    ):
        super().__init__()
        self.webhook_url = webhook_url
        self.environment = environment
        self.timeout = timeout
        self.dedupe_window = dedupe_window_seconds
        self._cache: dict[str, float] = {}
        self._lock = threading.Lock()

    def _dedup_key(self, record: logging.LogRecord) -> str:
        return f"{record.levelname}:{record.getMessage()[:200]}"

    def _is_duplicate(self, key: str) -> bool:
        with self._lock:
            last = self._cache.get(key)
            now = time.monotonic()
            if last and now - last < self.dedupe_window:
                return True
            self._cache[key] = now
            # prune stale entries
            self._cache = {k: v for k, v in self._cache.items() if now - v < self.dedupe_window}
            return False

    def emit(self, record: logging.LogRecord) -> None:
        try:
            key = self._dedup_key(record)
            if self._is_duplicate(key):
                return

            emoji = "🚨" if record.levelno >= logging.ERROR else "⚠️"
            exc_text = self.formatException(record.exc_info) if record.exc_info else None
            stack_snippet = "\n".join(exc_text.splitlines()[-20:])[:800] if exc_text else None

            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{emoji} [beacon-api] {record.levelname} — {self.environment}",
                        "emoji": True,
                    },
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Message:* {record.getMessage()}"},
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Logger:*\n{record.name}"},
                        {"type": "mrkdwn", "text": f"*Module:*\n{record.module}:{record.lineno}"},
                    ],
                },
                *(
                    [{"type": "section", "text": {"type": "mrkdwn", "text": f"*Traceback:*\n```{stack_snippet}```"}}]
                    if stack_snippet else []
                ),
                {
                    "type": "context",
                    "elements": [
                        {"type": "mrkdwn", "text": f"{self.formatter.formatTime(record) if self.formatter else logging.Formatter().formatTime(record)} | beacon-api | #notifs-beacon-api"}
                    ],
                },
            ]

            httpx.post(
                self.webhook_url,
                json={"blocks": blocks},
                timeout=self.timeout,
            )
        except Exception:
            self.handleError(record)  # logs to stderr, never raises into FastAPI
