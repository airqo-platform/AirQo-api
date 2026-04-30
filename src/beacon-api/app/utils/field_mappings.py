"""
Field1-20 -> human-readable label mappers per device category.

The sync_raw_device_data / sync_hourly_device_data / sync_daily_device_data
tables store every ThingSpeak feed slot as a generic ``fieldN`` column.
Each device category interprets those slots differently, so we expose
per-category mappers here.

These are intentionally small dictionaries that can grow over time as
additional categories / field meanings are introduced.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional


# ---------------------------------------------------------------------------
# Category → {source_field_name: readable_label} mappings.
#
# Keys are the *raw* column names as they appear on SyncRawDeviceData
# (``field1``..``field20``). For hourly/daily tables the columns are suffixed
# with ``_avg``; the mapper strips that suffix before looking up.
# ---------------------------------------------------------------------------
FIELD_MAPPINGS: Dict[str, Dict[str, str]] = {
    "lowcost": {
        "field1": "pm2.5 sensor1",
        "field3": "pm2.5 sensor2",
        "field7": "battery",
    },
    "bam": {
        "field2": "ConcRT(ug/m3)",
        "field3": "ConcHR(ug/m3)",
        "field4": "ConcS(ug/m3)",
    },
}


# Keys that identify *metadata* on a row and should always be preserved in
# the mapped output (not subject to the field1..field20 renaming rules).
_RESERVED_KEYS = {
    "device_id",
    "device_name",
    "channel_id",
    "datetime",
    "frequency",
    "entry_id",
    "record_count",
    "complete",
}


def _normalize_field_key(key: str) -> str:
    """Strip the ``_avg`` suffix used by hourly/daily aggregate tables."""
    if key.endswith("_avg"):
        return key[: -len("_avg")]
    return key


def get_category_mapping(category: Optional[str]) -> Dict[str, str]:
    """Return the mapping dict for ``category`` (defaults to lowcost)."""
    if not category:
        return FIELD_MAPPINGS["lowcost"]
    return FIELD_MAPPINGS.get(category.lower(), FIELD_MAPPINGS["lowcost"])


def map_record(
    record: Dict[str, Any],
    category: Optional[str],
    *,
    drop_unmapped: bool = True,
) -> Dict[str, Any]:
    """
    Return a new dict where ``fieldN`` / ``fieldN_avg`` keys are rewritten to
    their human-readable labels for the given category.

    Reserved metadata keys (``device_name``, ``datetime`` etc.) are always
    kept. Unmapped ``fieldN`` slots are dropped by default; set
    ``drop_unmapped=False`` to surface them under their raw name.
    """
    mapping = get_category_mapping(category)
    out: Dict[str, Any] = {}

    for key, value in record.items():
        if key in _RESERVED_KEYS:
            out[key] = value
            continue

        normalized = _normalize_field_key(key)
        label = mapping.get(normalized)
        if label is not None:
            out[label] = value
        elif not drop_unmapped:
            out[key] = value

    return out


def map_records(
    records: Iterable[Dict[str, Any]],
    category: Optional[str],
    *,
    drop_unmapped: bool = True,
) -> list[Dict[str, Any]]:
    """Vectorised :func:`map_record` for convenience."""
    return [map_record(r, category, drop_unmapped=drop_unmapped) for r in records]
