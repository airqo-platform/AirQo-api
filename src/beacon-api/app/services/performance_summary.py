"""
Performance for lists of cohorts, sites and grids, without loading the readings.

A list row shows a handful of numbers per entity, yet ``apply_local_performance`` loads every
hourly reading of every device to produce them, which for one page can be tens of megabytes
and more memory than a pod has. Here the database does the counting, and only one entity's
hourly averages are held at a time.
"""

import math
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.crud.crud_sync_device_data import get_hourly_row_counts_by_day, get_hourly_sensor_totals
from app.models.device_data import SyncHourlyDeviceData
from app.models.sync import SyncDevice
from app.services import cohort_service, site_service
from app.services.manufacturer_profiles import external_mapping_profile
from app.utils.field_mappings import ensure_dict, extract_label, get_category_mapping
from app.utils.networks import AIRQO_NETWORK, device_source_key, normalize_network

# Hourly readings are kept for 30 days (crud_device_data.cleanup_hourly_data), so a longer
# window only lowers uptime
MAX_SUMMARY_DAYS = 30

HOURS_PER_DAY = 24
SENSOR1_LABEL = "pm2.5 sensor1"
SENSOR2_LABEL = "pm2.5 sensor2"

SensorFields = Tuple[str, str]


def validate_summary_request(start_date_time: str, end_date_time: str, frequency: str) -> None:
    """Raise a 400 for anything :func:`apply_performance_summary` cannot summarise."""
    if frequency != "hourly":
        raise HTTPException(status_code=400, detail="includeSeries=false needs frequency=hourly.")
    try:
        start_dt = cohort_service._parse_iso(start_date_time)
        end_dt = cohort_service._parse_iso(end_date_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="startDateTime and endDateTime must be ISO 8601 dates.")
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="endDateTime must be after startDateTime.")
    if end_dt - start_dt > timedelta(days=MAX_SUMMARY_DAYS):
        raise HTTPException(
            status_code=400,
            detail=f"The window between startDateTime and endDateTime can be at most {MAX_SUMMARY_DAYS} days.",
        )


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_day(moment: datetime) -> str:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).date().isoformat()


def _days_ending(last_day: str, count: int) -> List[str]:
    """``count`` consecutive UTC dates, oldest first, ending on ``last_day``."""
    last = date.fromisoformat(last_day)
    return [(last - timedelta(days=offset)).isoformat() for offset in range(count - 1, -1, -1)]


def _sensor_fields(info: Dict[str, Any], profiles: Dict[Any, Any]) -> Optional[SensorFields]:
    """The fields a device reports PM2.5 sensor 1 and 2 in, labelled as the full series labels them."""
    if normalize_network(info["network"]) in (None, AIRQO_NETWORK):
        mapping = get_category_mapping(info["category"])
    else:
        mapping = ensure_dict(getattr(profiles.get(info["profile_id"]), "telemetry_mappings", None))
        if not mapping:
            mapping = external_mapping_profile(info["category"]).telemetry_mappings

    field_by_label = {extract_label(meta): field for field, meta in ensure_dict(mapping).items()}
    fields = field_by_label.get(SENSOR1_LABEL), field_by_label.get(SENSOR2_LABEL)
    if not all(fields) or not all(hasattr(SyncHourlyDeviceData, f"{field}_avg") for field in fields):
        return None
    return fields


def _load_device_sources(
    db: Session, device_ids: Iterable[str],
) -> Tuple[Dict[str, str], Dict[str, SensorFields]]:
    """``(channel by device id, PM2.5 sensor fields by device id)``, leaving out devices without either."""
    ids = list(device_ids)
    if not ids:
        return {}, {}

    rows = db.query(
        SyncDevice.device_id,
        SyncDevice.device_number,
        SyncDevice.network_id,
        SyncDevice.category,
        SyncDevice.profile_id,
    ).filter(SyncDevice.device_id.in_(ids)).all()
    info_by_id = {
        row.device_id: {"network": row.network_id, "profile_id": row.profile_id, "category": row.category or "lowcost"}
        for row in rows
    }
    profiles = cohort_service._load_profiles(db, info_by_id)

    channels: Dict[str, str] = {}
    sensors: Dict[str, SensorFields] = {}
    for row in rows:
        channel = device_source_key(row.network_id, row.device_id, row.device_number)
        if not channel:
            continue
        channels[row.device_id] = channel
        fields = _sensor_fields(info_by_id[row.device_id], profiles)
        if fields:
            sensors[row.device_id] = fields
    return channels, sensors


def _daily_sensor_agreement(
    db: Session,
    channels_by_fields: Dict[SensorFields, Set[str]],
    start_date_time: str,
    end_date_time: str,
) -> Dict[str, Tuple[Optional[float], Optional[float]]]:
    """
    ``{UTC date: (error margin, correlation)}`` for one entity.

    Each sensor is averaged across the entity's devices hour by hour, then the two averages
    are compared, which is what the Performance Analysis table has always shown. Hours whose
    averages fall outside the valid PM2.5 range are left out.
    """
    hourly: Dict[datetime, List[float]] = {}
    for (sensor1, sensor2), channels in channels_by_fields.items():
        rows = get_hourly_sensor_totals(db, channels, sensor1, sensor2, start_date_time, end_date_time)
        for hour, sensor1_total, sensor1_count, sensor2_total, sensor2_count in rows:
            totals = hourly.setdefault(hour, [0.0, 0, 0.0, 0])
            totals[0] += sensor1_total or 0.0
            totals[1] += sensor1_count
            totals[2] += sensor2_total or 0.0
            totals[3] += sensor2_count

    pairs_by_day: Dict[str, Tuple[List[float], List[float]]] = {}
    for hour, (sensor1_total, sensor1_count, sensor2_total, sensor2_count) in hourly.items():
        if not sensor1_count or not sensor2_count:
            continue
        sensor1_mean = sensor1_total / sensor1_count
        sensor2_mean = sensor2_total / sensor2_count
        if not site_service._is_reading(sensor1_mean) or not site_service._is_reading(sensor2_mean):
            continue
        sensor1_values, sensor2_values = pairs_by_day.setdefault(_utc_day(hour), ([], []))
        sensor1_values.append(sensor1_mean)
        sensor2_values.append(sensor2_mean)

    return {
        day: (
            sum(abs(a - b) for a, b in zip(sensor1_values, sensor2_values)) / len(sensor1_values),
            site_service._pearson(sensor1_values, sensor2_values),
        )
        for day, (sensor1_values, sensor2_values) in pairs_by_day.items()
    }


def _own_devices(entity: Dict[str, Any]) -> List[Dict[str, Any]]:
    return entity.get("devices") or []


def apply_performance_summary(
    entities: List[Dict[str, Any]],
    db: Session,
    start_date_time: str,
    end_date_time: str,
    devices_of: Callable[[Dict[str, Any]], List[Dict[str, Any]]] = _own_devices,
) -> None:
    """
    Enrich synced-shape cohorts, sites or grids in place, without loading their readings.

    Each device and entity gets the ``uptime`` / ``data_completeness`` the full series would
    give it. Each entity also gets, from its devices' hourly data:

    - ``daily``: one entry per day of the window's length, ending on the last UTC day any of
      its devices reported: ``uptime`` (every device's hours that day, out of 24 hours per
      device), ``error_margin`` and ``correlation`` of PM2.5 sensor 1 against sensor 2
    - ``error_margin`` / ``correlation``: averages over the days that produced a value
    - ``offline_devices``: devices with no reading yesterday (UTC)

    ``data`` stays empty and ``averages`` unset. The window must have passed
    :func:`validate_summary_request`.
    """
    start_dt = cohort_service._parse_iso(start_date_time)
    end_dt = cohort_service._parse_iso(end_date_time)
    day_count = math.ceil((end_dt - start_dt) / timedelta(days=1))
    window_last_day = (end_dt - timedelta(microseconds=1)).astimezone(timezone.utc).date().isoformat()
    yesterday = (_utc_now().date() - timedelta(days=1)).isoformat()
    hours_in_window = cohort_service._total_buckets(start_dt, end_dt, use_days=False)

    devices_by_entity = [devices_of(entity) for entity in entities]
    device_ids = {d["device_id"] for devices in devices_by_entity for d in devices if d.get("device_id")}
    channels, sensors = _load_device_sources(db, device_ids)
    hours_by_channel = get_hourly_row_counts_by_day(db, channels.values(), start_date_time, end_date_time)
    hours_by_device = {device_id: hours_by_channel.get(channels.get(device_id), {}) for device_id in device_ids}
    uptime_by_device = {
        device_id: round(min(sum(hours.values()) / hours_in_window, 1.0) * 100.0, 2)
        for device_id, hours in hours_by_device.items()
    }

    for entity, devices in zip(entities, devices_by_entity):
        ids = list(dict.fromkeys(device["device_id"] for device in devices if device.get("device_id")))
        for device in devices:
            device["uptime"] = uptime_by_device.get(device.get("device_id"), 0.0)
            device["data_completeness"] = device["uptime"]

        uptime = cohort_service._mean([uptime_by_device[device_id] for device_id in ids]) or 0.0
        entity["uptime"] = uptime
        entity["data_completeness"] = uptime

        channels_by_fields: Dict[SensorFields, Set[str]] = {}
        for device_id in ids:
            if device_id in sensors:
                channels_by_fields.setdefault(sensors[device_id], set()).add(channels[device_id])
        agreement = _daily_sensor_agreement(db, channels_by_fields, start_date_time, end_date_time)

        last_reported = max((day for device_id in ids for day in hours_by_device[device_id]), default=window_last_day)
        days = _days_ending(last_reported, day_count)
        daily = []
        for day in days:
            hours = sum(min(HOURS_PER_DAY, hours_by_device[device_id].get(day, 0)) for device_id in ids)
            margin, correlation = agreement.get(day, (None, None))
            daily.append({
                "date": day,
                "uptime": round(hours / (HOURS_PER_DAY * (len(ids) or 1)) * 100.0, 4),
                "error_margin": site_service._round_or_none(margin),
                "correlation": site_service._round_or_none(correlation),
            })
        entity["daily"] = daily

        day_agreement = [agreement[day] for day in days if day in agreement]
        entity["error_margin"] = site_service._round_or_none(
            site_service._mean_or_none([margin for margin, _ in day_agreement if margin is not None])
        )
        entity["correlation"] = site_service._round_or_none(
            site_service._mean_or_none([value for _, value in day_agreement if value is not None])
        )
        entity["offline_devices"] = sum(1 for device_id in ids if not hours_by_device[device_id].get(yesterday))


def drop_device_lists(entities: List[Dict[str, Any]]) -> None:
    """Empty each cohort's or site's device list; ``number_of_devices`` keeps the count."""
    for entity in entities:
        entity["devices"] = []
