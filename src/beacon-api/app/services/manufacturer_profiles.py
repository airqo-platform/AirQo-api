"""
Device profiles for sensor manufacturers other than AirQo.

AirQo's own profiles (``lowcost``, ``lowcost_gas``, ``bam``) describe how a
ThingSpeak channel's ``field1..field20`` slots are laid out. Devices from
other manufacturers report named fields instead (``pm2_5``, ``co2``,
``temperature`` ...). Beacon still stores every reading in the generic slot
columns, so each manufacturer gets a profile named ``<network>_<category>``
whose ``telemetry_mappings`` say which slot holds which named field. The
sync job reverses that mapping (named field → slot) when it writes rows, and
the read paths use the same profile to label slots again.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.device_schema import DeviceProfile
from app.models.sync import SyncDevice
from app.models.vendor import Vendor
from app.utils.field_mappings import ensure_dict
from app.utils.networks import AIRQO_NETWORK, normalize_network

logger = logging.getLogger(__name__)


# Slot layout shared by every external low-cost profile. field1/field2 and the
# location, battery, temperature and humidity slots line up with the AirQo
# lowcost layout so existing consumers (map view error margin, averages,
# diagnostics seeds) keep working; field3/field4 stay empty because these
# devices have a single PM sensor.
EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS: Dict[str, Dict[str, Any]] = {
    "field1": {"key": "pm2_5", "label": "PM2.5", "unit": "ug/m3"},
    "field2": {"key": "pm10", "label": "PM10", "unit": "ug/m3"},
    "field5": {"key": "latitude", "label": "Latitude", "unit": "deg"},
    "field6": {"key": "longitude", "label": "Longitude", "unit": "deg"},
    "field7": {"key": "battery_voltage", "label": "Battery Voltage", "unit": "V"},
    "field8": {"key": "pm1", "label": "PM1", "unit": "ug/m3"},
    "field9": {"key": "co2", "label": "CO2", "unit": "ppm"},
    "field10": {"key": "tvoc", "label": "TVOC Index"},
    "field11": {"key": "nox", "label": "NOx Index"},
    "field12": {"key": "wifi_rssi", "label": "WiFi Signal", "unit": "dBm"},
    "field13": {"key": "boot_count", "label": "Boot Count"},
    "field16": {"key": "temperature", "label": "Ambient Temperature", "unit": "C"},
    "field17": {"key": "humidity", "label": "Ambient Humidity", "unit": "%"},
}

# Reference monitors from other manufacturers (Met One BAMs via AirNow). The
# concentration slots follow the AirQo BAM layout (field2 realtime, field3
# hourly, field4 short-time) so BAM performance metrics keep working.
EXTERNAL_BAM_TELEMETRY_MAPPINGS: Dict[str, Dict[str, Any]] = {
    "field2": {"key": "realtime_conc", "label": "Real-time PM Conc (ConcRT)", "unit": "ug/m3"},
    "field3": {"key": "pm2_5", "label": "Hourly PM Conc (ConcHR)", "unit": "ug/m3"},
    "field4": {"key": "short_time_conc", "label": "Short-time PM Conc (ConcS)", "unit": "ug/m3"},
    "field7": {"key": "battery_voltage", "label": "Logger Battery", "unit": "V"},
    "field13": {"key": "wind_speed", "label": "Wind Speed", "unit": "m/s"},
    "field14": {"key": "wind_direction", "label": "Wind Direction", "unit": "deg"},
    "field15": {"key": "temperature", "label": "Ambient Temperature", "unit": "C"},
    "field16": {"key": "humidity", "label": "Ambient Humidity", "unit": "%"},
    "field17": {"key": "barometric_pressure", "label": "Barometric Pressure", "unit": "hPa"},
    "field18": {"key": "latitude", "label": "Latitude", "unit": "deg"},
    "field19": {"key": "longitude", "label": "Longitude", "unit": "deg"},
    "field20": {"key": "pm10", "label": "PM10", "unit": "ug/m3"},
}

# Names a reading's fields arrive under → the semantic keys above.
# - analytics raw-data rows and the registry live feed (already normalised
#   through the network adapter's field_map) use the AirQo names;
# - AirGradient's own API uses its vendor names (pm02, rco2, atmp ...), listed
#   here so the direct source maps the same way.
RECORD_KEY_ALIASES: Dict[str, str] = {
    "pm2_5": "pm2_5",
    "pm10": "pm10",
    "pm1": "pm1",
    "co2": "co2",
    "tvoc": "tvoc",
    "nox": "nox",
    "wifi_rssi": "wifi_rssi",
    "boot_count": "boot_count",
    # AirGradient vendor field names
    "pm01": "pm1",
    "pm02": "pm2_5",
    "rco2": "co2",
    "atmp": "temperature",
    "rhum": "humidity",
    "tvocIndex": "tvoc",
    "noxIndex": "nox",
    "wifi": "wifi_rssi",
    "boot": "boot_count",
    "latitude": "latitude",
    "longitude": "longitude",
    "device_latitude": "latitude",
    "device_longitude": "longitude",
    "temperature": "temperature",
    "humidity": "humidity",
    "battery": "battery_voltage",
    "battery_voltage": "battery_voltage",
    "realtime_conc": "realtime_conc",
    "hourly_conc": "pm2_5",
    "short_time_conc": "short_time_conc",
    "wind_speed": "wind_speed",
    "wind_direction": "wind_direction",
    "barometric_pressure": "barometric_pressure",
}

# (network, category, vendor display name, vendor description, profile description)
MANUFACTURER_PROFILE_SPECS: List[Tuple[str, str, str, str, str]] = [
    ("airgradient", "lowcost", "AirGradient", "AirGradient open-hardware air quality monitors",
     "AirGradient outdoor monitor read through the AirGradient API"),
    ("iqair", "lowcost", "IQAir", "IQAir AirVisual monitors",
     "IQAir AirVisual outdoor monitor read through the IQAir device API"),
    ("metone", "bam", "Met One Instruments", "Met One Instruments Regulatory Reference Monitors (BAM-1020)",
     "Met One BAM-1020 reference monitor reported through AirNow"),
    ("clarity", "lowcost", "Clarity", "Clarity Movement Co. Node-S monitors",
     "Clarity Node-S low-cost monitor"),
    ("kcca", "lowcost", "Clarity", "Clarity Movement Co. Node-S monitors",
     "KCCA Clarity Node-S low-cost monitor"),
    ("airbeam", "lowcost", "HabitatMap", "HabitatMap AirBeam monitors",
     "AirBeam low-cost monitor"),
]

_PROFILE_CATEGORY_BY_DEVICE_CATEGORY = {
    "lowcost": "air_quality",
    "gas": "air_quality_gas",
    "bam": "reference_monitor",
}


def profile_name_for(network: Any, category: Any) -> Optional[str]:
    """``<network>_<category>`` for a non-airqo device, else None."""
    net = normalize_network(network)
    if not net or net == AIRQO_NETWORK:
        return None
    cat = (str(category or "lowcost")).strip().lower()
    return f"{net}_{cat}"


def default_external_telemetry_mappings(category: Any) -> Dict[str, Dict[str, Any]]:
    """Slot layout used for an external device without a manufacturer profile."""
    cat = (str(category or "lowcost")).strip().lower()
    if cat == "bam":
        return EXTERNAL_BAM_TELEMETRY_MAPPINGS
    return EXTERNAL_LOWCOST_TELEMETRY_MAPPINGS


def external_mapping_profile(category: Any) -> SimpleNamespace:
    """A profile-like object (``telemetry_mappings``) for the default external layout."""
    cat = (str(category or "lowcost")).strip().lower()
    return SimpleNamespace(
        name=f"external_{cat}",
        category=_PROFILE_CATEGORY_BY_DEVICE_CATEGORY.get(cat, "air_quality"),
        telemetry_mappings=default_external_telemetry_mappings(cat),
    )


def slot_map_from_mappings(telemetry_mappings: Any) -> Dict[str, str]:
    """Reverse ``{fieldN: {key: ...}}`` into ``{semantic_key: fieldN}``."""
    out: Dict[str, str] = {}
    for slot, meta in ensure_dict(telemetry_mappings).items():
        key = meta.get("key") if isinstance(meta, dict) else meta
        if key and slot not in out.values():
            out[str(key)] = slot
    return out


def slot_map_for_profile(profile: Optional[Any], category: Any) -> Dict[str, str]:
    """``{semantic_key: fieldN}`` for a device: its profile's layout, else the default external one."""
    mappings = ensure_dict(getattr(profile, "telemetry_mappings", None)) if profile is not None else {}
    if not mappings:
        mappings = default_external_telemetry_mappings(category)
    return slot_map_from_mappings(mappings)


def map_record_to_slots(record: Dict[str, Any], slot_map: Dict[str, str]) -> Dict[str, Optional[float]]:
    """
    Place a named-field reading into ``field1..field20``.

    Non-numeric values are ignored. When two record keys resolve to the same
    slot (``hourly_conc`` and ``pm2_5`` both mean the hourly concentration),
    the first non-null value wins.
    """
    slots: Dict[str, Optional[float]] = {}
    for raw_key, value in record.items():
        semantic = RECORD_KEY_ALIASES.get(raw_key)
        if semantic is None:
            continue
        slot = slot_map.get(semantic)
        if slot is None or slots.get(slot) is not None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if number != number:  # NaN
            continue
        slots[slot] = number
    return slots


# ---------------------------------------------------------------------------
# Seeding and assignment
# ---------------------------------------------------------------------------

def _get_or_create_vendor(db: Session, name: str, description: str) -> Vendor:
    vendor = db.query(Vendor).filter(func.lower(Vendor.name) == name.lower()).first()
    if vendor is None:
        vendor = Vendor(name=name, description=description)
        db.add(vendor)
        db.flush()
    return vendor


def ensure_manufacturer_profiles(db: Session) -> Dict[str, Any]:
    """
    Create the ``<network>_<category>`` profiles (and their vendors) that are
    missing. Existing profiles are left untouched so operator edits to the
    slot layout survive.
    """
    created: List[str] = []
    existing: List[str] = []
    for network, category, vendor_name, vendor_desc, description in MANUFACTURER_PROFILE_SPECS:
        name = profile_name_for(network, category)
        profile = db.query(DeviceProfile).filter(func.lower(DeviceProfile.name) == name).first()
        if profile is not None:
            existing.append(name)
            continue
        vendor = _get_or_create_vendor(db, vendor_name, vendor_desc)
        db.add(DeviceProfile(
            name=name,
            category=_PROFILE_CATEGORY_BY_DEVICE_CATEGORY.get(category, "air_quality"),
            description=description,
            vendor_id=vendor.id,
            telemetry_mappings=default_external_telemetry_mappings(category),
            config_mappings={},
            metadata_mappings={},
        ))
        created.append(name)
    db.commit()
    if created:
        logger.info(f"Seeded manufacturer profiles: {created}")
    return {"created": created, "existing": existing}


def assign_profiles_to_external_devices(db: Session) -> int:
    """Give every non-airqo device without a profile its ``<network>_<category>`` profile, if one exists."""
    profiles = {p.name.lower(): p.id for p in db.query(DeviceProfile).all()}
    assigned = 0
    rows = (
        db.query(SyncDevice)
        .filter(SyncDevice.profile_id.is_(None), SyncDevice.network_id.isnot(None))
        .all()
    )
    for dev in rows:
        name = profile_name_for(dev.network_id, dev.category)
        if not name:
            continue
        profile_id = profiles.get(name)
        if profile_id is None:
            continue
        dev.profile_id = profile_id
        db.add(dev)
        assigned += 1
    if assigned:
        db.commit()
    return assigned
