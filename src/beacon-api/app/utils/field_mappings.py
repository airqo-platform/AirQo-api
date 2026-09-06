"""
Field1-20 -> human-readable label mappers per device category / profile.

The sync_raw_device_data / sync_hourly_device_data / sync_daily_device_data
tables store every ThingSpeak feed slot as a generic ``fieldN`` column.
Each device profile/category interprets those slots dynamically from the database
(DeviceProfile.telemetry_mappings) or fallback static maps.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional
import json


def ensure_dict(val: Any) -> Dict[str, Any]:
    """
    Ensures a value (whether None, JSON string, double-encoded string, or dict) is returned as a dict.
    Guards against SQLite TEXT storage or JSON string scalars in PostgreSQL.
    """
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return {}
        try:
            parsed = json.loads(val)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, str):
                parsed2 = json.loads(parsed)
                if isinstance(parsed2, dict):
                    return parsed2
        except Exception:
            return {}
    return {}


def extract_label(info: Any) -> Optional[str]:
    """Extracts human-readable label or key string from a field/meta/config mapping slot."""
    if isinstance(info, dict):
        label = info.get("label") or info.get("key")
        return str(label) if label is not None else None
    elif info is not None:
        return str(info)
    return None



# ---------------------------------------------------------------------------
# Fallback static Category → {source_field_name: readable_label} mappings.
# Used when DeviceProfile is not queried from the database.
# ---------------------------------------------------------------------------
FIELD_MAPPINGS: Dict[str, Dict[str, str]] = {
    "lowcost": {
        "field1": "pm2.5 sensor1",
        "field2": "pm10 sensor1",
        "field3": "pm2.5 sensor2",
        "field4": "pm10 sensor2",
        "field5": "latitude",
        "field6": "longitude",
        "field7": "battery",
        "field8": "latitude_gps",
        "field9": "longitude_gps",
        "field10": "altitude",
        "field11": "wind_speed",
        "field12": "satellites",
        "field13": "hdop",
        "field14": "device_temperature",
        "field15": "device_humidity",
        "field16": "temperature",
        "field17": "humidity",
        "field18": "vapor_pressure",
    },
    "lowcost_gas": {
        "field1": "pm2_5",
        "field2": "tvoc",
        "field3": "hcho",
        "field4": "co2",
        "field5": "intake_temperature",
        "field6": "intake_humidity",
        "field7": "battery",
        "field8": "latitude",
        "field9": "longitude",
        "field10": "altitude",
        "field11": "wind_speed",
        "field14": "device_temperature",
        "field15": "device_humidity",
        "field16": "temperature",
        "field17": "humidity",
    },
    "bam": {
        "field1": "timestamp",
        "field2": "ConcRT(ug/m3)",
        "field3": "ConcHR(ug/m3)",
        "field4": "ConcS(ug/m3)",
        "field5": "Flow(LPM)",
        "field6": "status",
        "field7": "battery",
        "field8": "timestamp_ext",
        "field9": "realtime_conc_diag",
        "field10": "hourly_conc_diag",
        "field11": "short_time_conc_diag",
        "field12": "air_flow_diag",
        "field13": "wind_speed",
        "field14": "wind_direction",
        "field15": "temperature",
        "field16": "humidity",
        "field17": "barometric_pressure",
        "field18": "filter_temperature",
        "field19": "filter_humidity",
        "field20": "status_ext",
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


import re
import math


DEFAULT_TELEMETRY_KEY_MAPPINGS: Dict[str, str] = {
    "field1": "pm2_5_sensor1",
    "field2": "pm10_sensor1",
    "field3": "pm2_5_sensor2",
    "field4": "pm10_sensor2",
    "field5": "latitude",
    "field6": "longitude",
    "field7": "battery_voltage",
    "field8": "latitude_gps",
    "field9": "longitude_gps",
    "field10": "altitude",
    "field11": "wind_speed",
    "field12": "satellites",
    "field13": "hdop",
    "field14": "device_temperature",
    "field15": "device_humidity",
    "field16": "temperature",
    "field17": "humidity",
    "field18": "vapor_pressure",
}


def _safe_float(value: Any) -> Optional[float]:
    """Parse a value to float, returning None for unparseable / NaN / Inf."""
    if value is None:
        return None
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _normalize_field_key(key: str) -> str:
    """Strip the ``_avg`` suffix and normalize ``field_N`` to ``fieldN``."""
    if key.endswith("_avg"):
        key = key[: -len("_avg")]
    match = re.match(r"^field_(\d+)$", key)
    if match:
        return f"field{match.group(1)}"
    return key


def normalize_and_unpack_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes field keys (e.g. field_1 -> field1) and unrolls CSV-encoded
    fields (such as field8 or field_8 containing comma-separated sensor streams).
    """
    normalized: Dict[str, Any] = {}
    field8_csv_val: Optional[str] = None

    for k, v in record.items():
        norm_k = _normalize_field_key(k)
        if norm_k == "field8" and isinstance(v, str) and "," in v:
            field8_csv_val = v
            continue
        normalized[norm_k] = v

    if field8_csv_val:
        parts = field8_csv_val.split(",")
        for idx, part in enumerate(parts[:13]):
            slot_key = f"field{8 + idx}"
            if slot_key not in normalized or normalized[slot_key] is None:
                val = _safe_float(part.strip())
                if val is not None:
                    normalized[slot_key] = val

    return normalized


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
            out[normalized] = value

    return out


def map_record_from_profile(
    record: Dict[str, Any],
    profile: Any,
    *,
    use_keys: bool = False,
    drop_unmapped: bool = True,
) -> Dict[str, Any]:
    """
    Dynamically maps a raw feed record using the database DeviceProfile object
    (reading from `profile.telemetry_mappings`).

    If `use_keys=True`, outputs semantic keys (e.g. `pm2_5_sensor1`, `battery_voltage`).
    If `use_keys=False`, outputs human-readable labels (e.g. `Sensor 1 PM2.5`, `Battery Voltage`).
    """
    if profile is None:
        if use_keys:
            out: Dict[str, Any] = {}
            for key, value in record.items():
                if key in _RESERVED_KEYS:
                    out[key] = value
                    continue
                normalized = _normalize_field_key(key)
                target_key = DEFAULT_TELEMETRY_KEY_MAPPINGS.get(normalized)
                if target_key is not None:
                    out[target_key] = value
                elif not drop_unmapped:
                    out[normalized] = value
            return out
        return map_record(record, category="lowcost", drop_unmapped=drop_unmapped)

    telemetry_map = ensure_dict(getattr(profile, "telemetry_mappings", None))
    if not telemetry_map and hasattr(profile, "category"):
        if use_keys:
            out = {}
            for key, value in record.items():
                if key in _RESERVED_KEYS:
                    out[key] = value
                    continue
                normalized = _normalize_field_key(key)
                target_key = DEFAULT_TELEMETRY_KEY_MAPPINGS.get(normalized)
                if target_key is not None:
                    out[target_key] = value
                elif not drop_unmapped:
                    out[normalized] = value
            return out
        return map_record(record, category=profile.category, drop_unmapped=drop_unmapped)

    out: Dict[str, Any] = {}
    for key, value in record.items():
        if key in _RESERVED_KEYS:
            out[key] = value
            continue

        normalized = _normalize_field_key(key)
        field_meta = telemetry_map.get(normalized)
        if field_meta:
            if isinstance(field_meta, dict):
                target = field_meta.get("key") if use_keys else field_meta.get("label", field_meta.get("key"))
            else:
                target = str(field_meta)
            out[target] = value
        elif not drop_unmapped:
            out[normalized] = value

    return out


def map_records(
    records: Iterable[Dict[str, Any]],
    category: Optional[str],
    *,
    drop_unmapped: bool = True,
) -> list[Dict[str, Any]]:
    """Vectorised :func:`map_record` for convenience."""
    return [map_record(r, category, drop_unmapped=drop_unmapped) for r in records]
