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

from app.models.device_schema import ComponentDefinition, ComponentRelationship, DeviceProfile, MetricDefinition
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
# Component models for the IoT diagnostic engine
# ---------------------------------------------------------------------------
# The engine builds its model from a profile's components (type, criticality),
# their metrics (telemetry key, expected range, max rate of change per hour,
# role) and the relationships between components. Everything below uses the
# engine's generic vocabulary only: POWERS / COMMUNICATES_VIA dependencies, a
# ``connectivity`` component that delivers the data, and the
# ``signal_strength`` metric role. Metric keys must match the profile's
# telemetry mappings or the engine cannot evaluate them.

def _reporting_interval_config(default_seconds: int) -> Dict[str, Dict[str, Any]]:
    return {
        "config1": {
            "key": "reporting_interval", "label": "Reporting Interval", "type": "int", "unit": "s",
            "default": default_seconds,
        },
    }


_PM_METRICS = [
    {"key": "pm2_5", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 500.0, "max_rate_of_change": 300.0},
    {"key": "pm10", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 600.0, "max_rate_of_change": 400.0},
]
_ENVIRONMENT_METRICS = [
    {"key": "temperature", "unit": "C", "expected_min": -10.0, "expected_max": 60.0, "max_rate_of_change": 15.0},
    {"key": "humidity", "unit": "%", "expected_min": 0.0, "expected_max": 100.0, "max_rate_of_change": 60.0},
]
_CO2_METRIC = {"key": "co2", "unit": "ppm", "expected_min": 380.0, "expected_max": 5000.0, "max_rate_of_change": 2000.0}

# Readings for these components only reach beacon through some sources (the
# live feed and AirGradient's direct history carry CO2, WiFi and boot count;
# the analytics fallback carries PM, temperature and humidity only), so a day
# without them is not a fault. PM is every device's purpose and always
# delivered, so pm_sensor keeps the METRIC_MISSING check.
_OPTIONAL_METRICS = {"diagnostics": {"disabled_checks": ["METRIC_MISSING"]}}
# A cumulative counter that does not move is the healthy case.
_COUNTER_METRICS = {"diagnostics": {"disabled_checks": ["METRIC_MISSING", "METRIC_STUCK"]}}

# Generic mains-powered single-PM-sensor monitor reporting over an unmonitored
# link (IQAir, Clarity, AirBeam). The link is the connectivity component, so
# data gaps are attributed to it; mains power has no metrics and is only
# suspected when every dependent fails.
EXTERNAL_LOWCOST_COMPONENT_MODEL: Dict[str, Any] = {
    "config_mappings": _reporting_interval_config(3600),
    "components": [
        {"name": "pm_sensor", "component_type": "sensor", "criticality": 0.45, "metrics": list(_PM_METRICS)},
        {"name": "environment_sensor", "component_type": "sensor", "criticality": 0.15,
         "metrics": list(_ENVIRONMENT_METRICS), "meta_data": _OPTIONAL_METRICS},
        {"name": "data_link", "component_type": "connectivity", "criticality": 0.30, "metrics": []},
        {"name": "mains_power", "component_type": "power", "criticality": 0.10, "metrics": []},
    ],
    "relationships": [
        ("mains_power", "pm_sensor", "POWERS"),
        ("mains_power", "environment_sensor", "POWERS"),
        ("mains_power", "data_link", "POWERS"),
        ("pm_sensor", "data_link", "COMMUNICATES_VIA"),
        ("environment_sensor", "data_link", "COMMUNICATES_VIA"),
    ],
}

IQAIR_COMPONENT_MODEL: Dict[str, Any] = {
    **EXTERNAL_LOWCOST_COMPONENT_MODEL,
    "components": [
        {"name": "pm_sensor", "component_type": "sensor", "criticality": 0.40, "metrics": list(_PM_METRICS)},
        {"name": "gas_sensor", "component_type": "sensor", "criticality": 0.15, "metrics": [dict(_CO2_METRIC)],
         "meta_data": _OPTIONAL_METRICS},
        {"name": "environment_sensor", "component_type": "sensor", "criticality": 0.15,
         "metrics": list(_ENVIRONMENT_METRICS), "meta_data": _OPTIONAL_METRICS},
        {"name": "data_link", "component_type": "connectivity", "criticality": 0.20, "metrics": []},
        {"name": "mains_power", "component_type": "power", "criticality": 0.10, "metrics": []},
    ],
    "relationships": EXTERNAL_LOWCOST_COMPONENT_MODEL["relationships"] + [
        ("mains_power", "gas_sensor", "POWERS"),
        ("gas_sensor", "data_link", "COMMUNICATES_VIA"),
    ],
}

# AirGradient reports WiFi signal and a boot counter, so the link is monitored
# (weak signal → METRIC_BELOW_MIN on wifi_rssi) and reboot storms show up as
# the boot counter rising faster than ``max_rate_of_change`` per hour.
# Readings arrive about every 10 minutes through the pipeline.
AIRGRADIENT_COMPONENT_MODEL: Dict[str, Any] = {
    "config_mappings": _reporting_interval_config(600),
    "components": [
        {"name": "pm_sensor", "component_type": "sensor", "criticality": 0.35, "metrics": list(_PM_METRICS)},
        {"name": "gas_sensor", "component_type": "sensor", "criticality": 0.15, "metrics": [
            dict(_CO2_METRIC),
            {"key": "tvoc", "expected_min": 0.0, "expected_max": 500.0, "max_rate_of_change": 300.0},
            {"key": "nox", "expected_min": 0.0, "expected_max": 500.0, "max_rate_of_change": 300.0},
        ], "meta_data": _OPTIONAL_METRICS},
        {"name": "environment_sensor", "component_type": "sensor", "criticality": 0.10,
         "metrics": list(_ENVIRONMENT_METRICS), "meta_data": _OPTIONAL_METRICS},
        {"name": "wifi_modem", "component_type": "connectivity", "criticality": 0.25, "metrics": [
            {"key": "wifi_rssi", "unit": "dBm", "expected_min": -85.0, "expected_max": -20.0, "role": "signal_strength"},
        ], "meta_data": _OPTIONAL_METRICS},
        {"name": "controller", "component_type": "compute", "criticality": 0.10, "metrics": [
            # cumulative reboot counter: more than 2 reboots in an hour is a reboot storm
            {"key": "boot_count", "max_rate_of_change": 2.0},
        ], "meta_data": _COUNTER_METRICS},
        {"name": "mains_power", "component_type": "power", "criticality": 0.05, "metrics": []},
    ],
    "relationships": [
        ("mains_power", "pm_sensor", "POWERS"),
        ("mains_power", "gas_sensor", "POWERS"),
        ("mains_power", "environment_sensor", "POWERS"),
        ("mains_power", "wifi_modem", "POWERS"),
        ("mains_power", "controller", "POWERS"),
        ("pm_sensor", "wifi_modem", "COMMUNICATES_VIA"),
        ("gas_sensor", "wifi_modem", "COMMUNICATES_VIA"),
        ("environment_sensor", "wifi_modem", "COMMUNICATES_VIA"),
        ("controller", "wifi_modem", "COMMUNICATES_VIA"),
    ],
}

# Met One BAM-1020 reported hourly through AirNow.
METONE_BAM_COMPONENT_MODEL: Dict[str, Any] = {
    "config_mappings": _reporting_interval_config(3600),
    "components": [
        {"name": "bam_sensor", "component_type": "sensor", "criticality": 0.60, "metrics": [
            {"key": "pm2_5", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 1000.0, "max_rate_of_change": 500.0},
        ]},
        {"name": "bam_diagnostics", "component_type": "sensor", "criticality": 0.10, "metrics": [
            {"key": "realtime_conc", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 1000.0},
            {"key": "short_time_conc", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 1000.0},
        ], "meta_data": _OPTIONAL_METRICS},
        {"name": "environment_sensor", "component_type": "sensor", "criticality": 0.10, "metrics": [
            {"key": "temperature", "unit": "C", "expected_min": -30.0, "expected_max": 60.0, "max_rate_of_change": 15.0},
            {"key": "humidity", "unit": "%", "expected_min": 0.0, "expected_max": 100.0},
            {"key": "barometric_pressure", "unit": "hPa", "expected_min": 800.0, "expected_max": 1100.0, "max_rate_of_change": 20.0},
            {"key": "wind_speed", "unit": "m/s", "expected_min": 0.0, "expected_max": 60.0},
        ], "meta_data": _OPTIONAL_METRICS},
        {"name": "data_link", "component_type": "connectivity", "criticality": 0.25, "metrics": []},
        {"name": "mains_power", "component_type": "power", "criticality": 0.05, "metrics": []},
    ],
    "relationships": [
        ("mains_power", "bam_sensor", "POWERS"),
        ("mains_power", "bam_diagnostics", "POWERS"),
        ("mains_power", "environment_sensor", "POWERS"),
        ("mains_power", "data_link", "POWERS"),
        ("bam_sensor", "data_link", "COMMUNICATES_VIA"),
        ("bam_diagnostics", "data_link", "COMMUNICATES_VIA"),
        ("environment_sensor", "data_link", "COMMUNICATES_VIA"),
    ],
}

MANUFACTURER_COMPONENT_MODELS: Dict[str, Dict[str, Any]] = {
    "airgradient_lowcost": AIRGRADIENT_COMPONENT_MODEL,
    "iqair_lowcost": IQAIR_COMPONENT_MODEL,
    "metone_bam": METONE_BAM_COMPONENT_MODEL,
    "clarity_lowcost": EXTERNAL_LOWCOST_COMPONENT_MODEL,
    "kcca_lowcost": EXTERNAL_LOWCOST_COMPONENT_MODEL,
    "airbeam_lowcost": EXTERNAL_LOWCOST_COMPONENT_MODEL,
}


def component_model_for(profile_name: str, category: Any) -> Dict[str, Any]:
    model = MANUFACTURER_COMPONENT_MODELS.get((profile_name or "").lower())
    if model is not None:
        return model
    cat = (str(category or "lowcost")).strip().lower()
    return METONE_BAM_COMPONENT_MODEL if cat == "bam" else EXTERNAL_LOWCOST_COMPONENT_MODEL


def _attach_component_model(db: Session, profile: DeviceProfile, model: Dict[str, Any]) -> None:
    """Create the components, metrics and relationships of ``model`` on ``profile`` (which has none)."""
    telemetry_keys = {
        (meta.get("key") if isinstance(meta, dict) else meta)
        for meta in ensure_dict(profile.telemetry_mappings).values()
    }
    by_name: Dict[str, ComponentDefinition] = {}
    for spec in model["components"]:
        component = ComponentDefinition(
            profile_id=profile.id,
            name=spec["name"],
            component_type=spec["component_type"],
            criticality=spec.get("criticality", 1.0),
            meta_data=spec.get("meta_data"),
        )
        db.add(component)
        db.flush()
        by_name[spec["name"]] = component
        for metric in spec.get("metrics", []):
            if metric["key"] not in telemetry_keys:
                logger.warning(
                    f"Profile {profile.name}: metric {metric['key']} is not in telemetry_mappings; "
                    "the engine will not be able to evaluate it"
                )
            db.add(MetricDefinition(
                component_id=component.id,
                key=metric["key"],
                unit=metric.get("unit"),
                expected_min=metric.get("expected_min"),
                expected_max=metric.get("expected_max"),
                max_rate_of_change=metric.get("max_rate_of_change"),
                role=metric.get("role"),
            ))
    for source, target, rel_type in model["relationships"]:
        db.add(ComponentRelationship(
            profile_id=profile.id,
            source_component_id=by_name[source].id,
            target_component_id=by_name[target].id,
            relationship_type=rel_type,
        ))
    if not ensure_dict(profile.config_mappings):
        profile.config_mappings = model.get("config_mappings", {})
        db.add(profile)
    db.flush()


def manufacturer_profile_readiness(db: Session) -> List[Dict[str, Any]]:
    """Diagnostic readiness of every manufacturer profile, as the engine sees it."""
    from app.services.diagnostics.profile_model import build_model  # noqa: WPS433

    names = [profile_name_for(net, cat) for net, cat, *_ in MANUFACTURER_PROFILE_SPECS]
    rows = db.query(DeviceProfile).filter(func.lower(DeviceProfile.name).in_(names)).all()
    out: List[Dict[str, Any]] = []
    for profile in sorted(rows, key=lambda p: p.name):
        model = build_model(profile)
        out.append({
            "name": profile.name,
            "network": profile.name.rsplit("_", 1)[0],
            "category": profile.name.rsplit("_", 1)[-1],
            "profile_id": str(profile.id),
            "diagnosable": model.diagnosable,
            "components": sorted(model.components),
            "transmission_components": list(model.transmission_components),
            "errors": list(model.errors),
            "warnings": list(model.warnings),
        })
    return out


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
    components_added: List[str] = []
    for network, category, vendor_name, vendor_desc, description in MANUFACTURER_PROFILE_SPECS:
        name = profile_name_for(network, category)
        model = component_model_for(name, category)
        profile = db.query(DeviceProfile).filter(func.lower(DeviceProfile.name) == name).first()
        if profile is not None:
            existing.append(name)
            # Profiles seeded before component models existed get theirs now;
            # profiles an operator has already modelled are left alone.
            if not profile.components:
                _attach_component_model(db, profile, model)
                components_added.append(name)
            continue
        vendor = _get_or_create_vendor(db, vendor_name, vendor_desc)
        profile = DeviceProfile(
            name=name,
            category=_PROFILE_CATEGORY_BY_DEVICE_CATEGORY.get(category, "air_quality"),
            description=description,
            vendor_id=vendor.id,
            telemetry_mappings=default_external_telemetry_mappings(category),
            config_mappings=model.get("config_mappings", {}),
            metadata_mappings={},
        )
        db.add(profile)
        db.flush()
        _attach_component_model(db, profile, model)
        created.append(name)
        components_added.append(name)
    db.commit()
    if created:
        logger.info(f"Seeded manufacturer profiles: {created}")
    if components_added:
        logger.info(f"Attached diagnostic component models to: {components_added}")
    return {"created": created, "existing": existing, "components_added": components_added}


# The AirQo profiles describe ThingSpeak hardware; a non-airqo device carrying
# one of them was synced before manufacturer profiles existed.
AIRQO_CATEGORY_PROFILES = {"lowcost", "lowcost_gas", "bam", "airqo-v5-dualpm"}


def assign_profiles_to_external_devices(db: Session) -> int:
    """
    Give every non-airqo device its ``<network>_<category>`` profile, if one
    exists. Covers devices with no profile and devices still carrying one of
    the AirQo category profiles from before manufacturer profiles existed;
    any other assignment is treated as deliberate and left alone.
    """
    profiles = {p.name.lower(): p.id for p in db.query(DeviceProfile).all()}
    airqo_profile_ids = {pid for name, pid in profiles.items() if name in AIRQO_CATEGORY_PROFILES}
    assigned = 0
    rows = db.query(SyncDevice).filter(SyncDevice.network_id.isnot(None)).all()
    for dev in rows:
        if dev.profile_id is not None and dev.profile_id not in airqo_profile_ids:
            continue
        name = profile_name_for(dev.network_id, dev.category)
        if not name:
            continue
        profile_id = profiles.get(name)
        if profile_id is None or dev.profile_id == profile_id:
            continue
        dev.profile_id = profile_id
        db.add(dev)
        assigned += 1
    if assigned:
        db.commit()
    return assigned
