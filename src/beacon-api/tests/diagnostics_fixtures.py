"""Shared device profile and telemetry builders for diagnostics tests."""
import copy
import uuid
from typing import Any, Callable, Dict, List, Optional

BATTERY_ID = "0b6a1b7e-0000-4000-8000-000000000001"
PM1_ID = "0b6a1b7e-0000-4000-8000-000000000002"
PM2_ID = "0b6a1b7e-0000-4000-8000-000000000003"
COMM_ID = "0b6a1b7e-0000-4000-8000-000000000004"

_LOWCOST_PROFILE: Dict[str, Any] = {
    "id": "0b6a1b7e-0000-4000-8000-0000000000aa",
    "name": "test_lowcost",
    "category": "air_quality",
    "meta_data": {},
    "telemetry_mappings": {
        "field1": {"key": "pm2_5_sensor1", "label": "Sensor 1 PM2.5", "unit": "ug/m3"},
        "field3": {"key": "pm2_5_sensor2", "label": "Sensor 2 PM2.5", "unit": "ug/m3"},
        "field7": {"key": "battery_voltage", "label": "Battery Voltage", "unit": "V"},
        "field16": {"key": "temperature", "label": "Ambient Temperature", "unit": "C"},
    },
    "config_mappings": {
        "config1": {"key": "reporting_interval", "label": "Reporting Interval", "unit": "s", "default": 120},
    },
    "components": [
        {
            "id": BATTERY_ID, "name": "device_battery", "component_type": "battery", "criticality": 0.7,
            "metrics": [{"key": "battery_voltage", "unit": "V", "expected_min": 3.0, "expected_max": 4.3,
                         "max_rate_of_change": 0.3, "role": "charge_level"}],
        },
        {
            "id": PM1_ID, "name": "pm_sensor1", "component_type": "sensor", "criticality": 0.5,
            "metrics": [{"key": "pm2_5_sensor1", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 500.0}],
        },
        {
            "id": PM2_ID, "name": "pm_sensor2", "component_type": "sensor", "criticality": 0.5,
            "metrics": [{"key": "pm2_5_sensor2", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 500.0}],
        },
        {"id": COMM_ID, "name": "communication", "component_type": "connectivity", "criticality": 0.55, "metrics": []},
    ],
    "relationships": [
        {"source_component_id": BATTERY_ID, "target_component_id": COMM_ID, "relationship_type": "POWERS"},
        {"source_component_id": BATTERY_ID, "target_component_id": PM1_ID, "relationship_type": "POWERS"},
        {"source_component_id": BATTERY_ID, "target_component_id": PM2_ID, "relationship_type": "POWERS"},
        {"source_component_id": PM1_ID, "target_component_id": PM2_ID, "relationship_type": "MEASURES_SAME_AS",
         "meta_data": {"tolerance": {"absolute": 5.0, "relative": 0.2}}},
    ],
}


def lowcost_profile() -> Dict[str, Any]:
    return copy.deepcopy(_LOWCOST_PROFILE)


def healthy_pm(i: int) -> float:
    return 20.0 + 10.0 * ((i % 30) / 30.0)


def healthy_battery(i: int) -> float:
    return 4.0 + 0.01 * (i % 5)


def make_records(
    count: int,
    interval_s: int = 120,
    start_ts: int = 1700000000,
    battery: Optional[Callable[[int], Optional[float]]] = healthy_battery,
    pm1: Optional[Callable[[int], Optional[float]]] = healthy_pm,
    pm2: Optional[Callable[[int], Optional[float]]] = lambda i: healthy_pm(i) + 0.5,
) -> List[Dict[str, Any]]:
    """Telemetry already mapped to the profile's semantic keys."""
    records = []
    for i in range(count):
        record: Dict[str, Any] = {"datetime": start_ts + i * interval_s}
        for key, fn in (("battery_voltage", battery), ("pm2_5_sensor1", pm1), ("pm2_5_sensor2", pm2)):
            value = fn(i) if fn else None
            if value is not None:
                record[key] = value
        records.append(record)
    return records


def profile_orm(profile: Optional[Dict[str, Any]] = None):
    """Build DeviceProfile ORM objects (with components, metrics and relationships) from a profile dict."""
    from app.models.device_schema import ComponentDefinition, ComponentRelationship, DeviceProfile, MetricDefinition

    profile = profile or lowcost_profile()
    orm = DeviceProfile(
        id=uuid.UUID(profile["id"]),
        name=profile["name"],
        category=profile["category"],
        meta_data=profile.get("meta_data"),
        telemetry_mappings=profile["telemetry_mappings"],
        config_mappings=profile["config_mappings"],
        metadata_mappings={},
    )
    for comp in profile["components"]:
        orm.components.append(ComponentDefinition(
            id=uuid.UUID(comp["id"]),
            name=comp["name"],
            component_type=comp["component_type"],
            criticality=comp["criticality"],
            meta_data=comp.get("meta_data"),
            metrics=[MetricDefinition(id=uuid.uuid4(), **metric) for metric in comp["metrics"]],
        ))
    for rel in profile["relationships"]:
        orm.relationships.append(ComponentRelationship(
            id=uuid.uuid4(),
            source_component_id=uuid.UUID(rel["source_component_id"]),
            target_component_id=uuid.UUID(rel["target_component_id"]),
            relationship_type=rel["relationship_type"],
            meta_data=rel.get("meta_data"),
        ))
    return orm
