from typing import List, Dict, Tuple, Any

from .adapter import DataSourceAdapter
from .http_client import HttpClient
from ..config import configuration
from ..constants import DeviceNetwork
from ..utils import Utils, Result


class ThingSpeakAdapter(DataSourceAdapter):
    def __init__(self) -> None:
        self.client = HttpClient()

    def fetch(
        self,
        device: Dict[str, Any],
        dates: List[Tuple[str, str]],
        resolution: Any = None,
    ) -> Result:
        """Fetch data from a ThingSpeak channel for a specific device within time ranges.

        Args:
            device (Dict[str, Any]): Device dictionary. Expected keys:
                - `device_number` (int): ThingSpeak channel id
                - `key` (str): Read API key for the channel (may be encrypted)
            dates (List[Tuple[str, str]]): List of (start_iso, end_iso) tuples (ISO 8601 strings).
            resolution (Any): Unused for ThingSpeak but kept for interface compatibility.

        Returns:
            Result: `Result.data` is a dict with:
                - `records`: List[dict] of ThingSpeak `feeds` entries
                - `meta`: dict with ThingSpeak `channel` metadata
            `Result.error` contains an error message or `None` on success.

        Raises:
            requests.exceptions.RequestException: For HTTP request issues via the shared `HttpClient`.
            ValueError: If response data cannot be parsed as JSON.
            Exception: For any other unexpected errors.
        """
        device_number = device.get("device_number")
        key = device.get("key")
        data: List[Dict[str, Any]] = []
        meta: Dict[str, Any] = {}
        if device_number is None:
            return Result(
                data={"records": [], "meta": {}},
                error="Missing device_number",
            )

        # decrypt key only when it appears to be an encrypted token (Fernet tokens start with 'gAAAA')
        if isinstance(key, str) and key.startswith("gAAAA"):
            try:
                decrypted = Utils.decrypt_key(bytes(key, "utf-8"))
                if decrypted:
                    key = decrypted
            except Exception:
                # preserve previous behaviour: if decryption fails, continue with raw key
                pass

        base_url = configuration.THINGSPEAK_CHANNEL_URL
        for start, end in dates:
            try:
                url = f"{base_url}{int(device_number)}/feeds.json"
                params = {"start": start, "end": end, "api_key": key}
                response = self.client.get_json(url, params=params)
                if (
                    response != -1
                    and isinstance(response, dict)
                    and "feeds" in response
                ):
                    feeds = response.get("feeds", [])
                    if feeds:
                        data.extend(feeds)
                    channel = response.get("channel", {})
                    if channel:
                        meta = channel
            except Exception:
                # Maintain backward-compatible resilience: ignore individual failures
                continue

        return Result(
            data={"records": data or [], "meta": meta or {}},
            error=None if data else "No data retrieved",
        )


# Self-register with the adapter registry
from .registry import register_adapter  # noqa: E402

register_adapter(DeviceNetwork.AIRQO, ThingSpeakAdapter)
