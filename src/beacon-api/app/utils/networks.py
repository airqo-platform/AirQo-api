"""
Network ("sensor manufacturer") helpers shared across beacon services.

In the device registry a device's ``network`` names the manufacturer or data
provider that owns it (``airqo``, ``airgradient``, ``iqair``, ``metone`` ...).
Vertex labels the same value "Sensor Manufacturer". Beacon mirrors it in
``sync_device.network_id`` and uses it to decide which measurement source a
device has:

- ``airqo`` devices transmit to ThingSpeak (``device_number`` + ``readKey``).
- every other network is fetched from the manufacturer's own API; the device
  registry knows the per-network adapter and exposes the normalised reading
  through ``GET /devices/feeds/transform/recent?serial_number=...``.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Set

from app.core.config import settings

AIRQO_NETWORK = "airqo"

DATA_SOURCE_THINGSPEAK = "thingspeak"
DATA_SOURCE_EXTERNAL_API = "external_api"
DATA_SOURCE_NONE = "none"


def normalize_network(value: Any) -> Optional[str]:
    """Lower-cased, trimmed network name, or ``None`` when empty."""
    if value is None:
        return None
    text = str(value).strip().lower()
    return text or None


def enabled_networks() -> Set[str]:
    """
    Networks beacon is allowed to mirror, from ``ENABLED_NETWORKS`` (CSV).
    An empty set means "every network the platform returns".
    """
    raw = getattr(settings, "ENABLED_NETWORKS", "") or ""
    return {n for n in (normalize_network(part) for part in raw.split(",")) if n}


def is_network_enabled(network: Any) -> bool:
    """True when ``network`` passes the ``ENABLED_NETWORKS`` allow-list."""
    allow = enabled_networks()
    if not allow:
        return True
    return normalize_network(network) in allow


def is_enabled_network_device(dev: Dict[str, Any]) -> bool:
    """True when a platform-shaped device dict belongs to an enabled network."""
    return is_network_enabled(dev.get("network"))


def device_data_source(
    network: Any,
    device_number: Any = None,
    read_key: Any = None,
    serial_number: Any = None,
    api_code: Any = None,
) -> str:
    """
    Classify where a device's measurements come from.

    - ``thingspeak``: airqo-network device with a channel number and read key.
    - ``external_api``: non-airqo device the registry can fetch through the
      manufacturer adapter (needs a serial number or connection URL).
    - ``none``: nothing beacon can currently read.
    """
    name = normalize_network(network)
    if name is None or name == AIRQO_NETWORK:
        if device_number not in (None, "", 0) and read_key:
            return DATA_SOURCE_THINGSPEAK
        return DATA_SOURCE_NONE
    if serial_number or api_code:
        return DATA_SOURCE_EXTERNAL_API
    return DATA_SOURCE_NONE


def device_source_key(network: Any, device_id: Any = None, device_number: Any = None) -> Optional[str]:
    """
    The ``channel_id`` under which a device's readings are stored in the
    ``sync_*_device_data`` tables.

    - airqo devices: the ThingSpeak channel number (``device_number``).
    - every other manufacturer: the registry device id, which is unique and
      stable, so vendor serial numbers can never collide with channel numbers.
    """
    name = normalize_network(network)
    if name is None or name == AIRQO_NETWORK:
        if device_number in (None, "", 0):
            return None
        return str(device_number)
    return str(device_id) if device_id else None


def source_key_for_platform_device(dev: Dict[str, Any]) -> Optional[str]:
    """``device_source_key`` for a platform-shaped device dict (``_id``, ``network``, ``device_number``)."""
    return device_source_key(dev.get("network"), dev.get("_id"), dev.get("device_number"))
