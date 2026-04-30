import httpx
import asyncio
import logging
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.sync import SyncDevice, Category, SyncMetadataValues, SyncConfigValues
from typing import List, Dict, Any, Tuple, Optional
from app.utils.performance import PerformanceAnalysis

logger = logging.getLogger(__name__)

async def decrypt_read_keys(token: str, items: List[Dict[str, Any]]) -> Dict[int, str]:
    """
    Decrypts multiple read keys in bulk using the platform API.
    Input items format: [{"encrypted_key": "...", "device_number": 123}, ...]
    Returns a mapping of device_number (int) to decrypted_key (str).
    """
    if not items:
        return {}

    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices/decrypt/bulk"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=items, headers=headers)
            if response.status_code != 200:
                logger.error(f"Decryption API error: {response.status_code} - {response.text}")
                return {}
            
            data = response.json()
            if not data.get("success"):
                logger.error(f"Decryption API failed: {data.get('message')}")
                return {}
            
            decrypted_map = {}
            for item in data.get("decrypted_keys", []):
                # API returns device_number as string in example, but we store it as int
                try:
                    dn = int(item.get("device_number"))
                    decrypted_map[dn] = item.get("decrypted_key")
                except (ValueError, TypeError):
                    logger.warning(f"Invalid device_number in decryption response: {item.get('device_number')}")
            
            return decrypted_map
    except Exception as e:
        logger.error(f"Unexpected error during decryption: {e}")
        return {}

def extract_device_category(dev: Dict[str, Any]) -> str:
    """
    Identify the device category from various platform API fields.
    Heuristic precedence (prioritizing top-level 'category' as requested):
    1. Top-level "category" field
    2. Top-level "device_category" field
    3. explicit "is_bam": True in device_categories
    4. "BAM" in device name (case-insensitive fallback)
    5. "primary_category" in device_categories
    6. Default to "lowcost"
    """
    # 1. Check top-level category fields (User preferred way)
    category = dev.get("category") or dev.get("device_category")
    if category:
        return category.lower()

    device_categories = dev.get("device_categories", {})
    
    # 2. Check boolean flags in device_categories
    if device_categories.get("is_bam"):
        return "bam"
    if device_categories.get("is_gas"):
        return "gas"
        
    # 3. Check device name for "BAM" heuristic (Safety fallback)
    name = dev.get("name", "").upper()
    if "BAM" in name:
        return "bam"
        
    # 4. Check primary_category in nested object
    primary = device_categories.get("primary_category")
    if primary:
        return primary.lower()
        
    return "lowcost"


_AUTHORITATIVE_FIELDS = (
    "category", "site_id", "network_id", "device_name",
    "device_number", "writeKey", "readKey",
)

_NON_AUTH_FILL_FIELDS = (
    "device_name", "network_id", "device_number", "writeKey", "readKey",
)


def _resolve_site_id(dev: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """Return (site_id, status). site_id is non-None only if status == 'deployed'."""
    platform_site_id = (
        dev.get("site", {}).get("_id")
        or dev.get("site_id")
        or dev.get("site", {}).get("id")
    )
    status = dev.get("status")
    site_id = platform_site_id if status == "deployed" else None
    return site_id, status


def _build_field_values(
    dev: Dict[str, Any], read_key: Optional[str], site_id: Optional[str],
) -> Dict[str, Any]:
    """Map dev payload + decrypted read key to SyncDevice column values."""
    return {
        "category": extract_device_category(dev),
        "site_id": site_id,
        "network_id": dev.get("network"),
        "device_name": dev.get("name"),
        "device_number": dev.get("device_number"),
        "writeKey": dev.get("writeKey"),
        "readKey": read_key or dev.get("readKey"),
    }


def _apply_authoritative_update(
    db_device: SyncDevice, values: Dict[str, Any],
) -> bool:
    """Overwrite all known fields when sources are authoritative. Returns True if changed."""
    updated = False
    for field in _AUTHORITATIVE_FIELDS:
        new_val = values[field]
        if getattr(db_device, field) != new_val:
            setattr(db_device, field, new_val)
            updated = True
    return updated


def _apply_non_authoritative_update(
    db_device: SyncDevice,
    values: Dict[str, Any],
    status: Optional[str],
) -> bool:
    """Update only missing/safe fields when source is partial. Returns True if changed."""
    updated = False
    if not db_device.category:
        db_device.category = values["category"]
        updated = True
    if status is not None and db_device.site_id != values["site_id"]:
        db_device.site_id = values["site_id"]
        updated = True
    for field in _NON_AUTH_FILL_FIELDS:
        new_val = values[field]
        if not getattr(db_device, field) and new_val:
            setattr(db_device, field, new_val)
            updated = True
    return updated


def upsert_device_to_sync(
    db: Session,
    dev: Dict[str, Any],
    read_key: Optional[str] = None,
    is_authoritative: bool = False,
) -> Tuple[Optional[SyncDevice], bool, bool]:
    """
    Centralized logic to upsert/update a SyncDevice record based on data from Platform API.
    Returns (db_device, is_new, is_updated).

    - is_authoritative=True: Trust all fields from the input dictionary (used by /devices/sync).
    - is_authoritative=False: Only update missing fields or fields that are safe to update
      from "thin" data (used by performance sync / cohorts).
    """
    device_id = dev.get("_id")
    if not device_id:
        return None, False, False

    site_id, status = _resolve_site_id(dev)
    values = _build_field_values(dev, read_key, site_id)

    db_device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()

    if not db_device:
        # Brand-new device: if status missing entirely, fall back to platform_site_id.
        initial_site_id = site_id if status is not None else (
            dev.get("site", {}).get("_id")
            or dev.get("site_id")
            or dev.get("site", {}).get("id")
        )
        db_device = SyncDevice(
            device_id=device_id,
            device_name=values["device_name"],
            network_id=values["network_id"],
            category=values["category"],
            site_id=initial_site_id,
            device_number=values["device_number"],
            writeKey=values["writeKey"],
            readKey=values["readKey"],
        )
        db.add(db_device)
        return db_device, True, False

    if is_authoritative:
        updated = _apply_authoritative_update(db_device, values)
    else:
        updated = _apply_non_authoritative_update(db_device, values, status)

    if updated:
        db.add(db_device)
    return db_device, False, updated


from typing import Optional

def _parse_thingspeak_field(value) -> "float | None":
    """Safely parse a ThingSpeak field value to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _map_thingspeak_feeds(
    feeds: List[Dict[str, Any]], device_name: str, category: str
) -> List[Dict[str, Any]]:
    """
    Map raw ThingSpeak feeds to the format PerformanceAnalysis expects.
    """
    records: List[Dict[str, Any]] = []
    for entry in feeds:
        created_at = entry.get("created_at")
        if not created_at:
            continue

        if category == "bam":
            # BAM field mapping:
            # field2 → realtime_conc (ConcRT)
            # field3 → hourly_conc (ConcHR)
            # field4 → short_time_conc (ConcS)
            rt = _parse_thingspeak_field(entry.get("field2"))
            hc = _parse_thingspeak_field(entry.get("field3"))
            st = _parse_thingspeak_field(entry.get("field4"))

            records.append(
                {
                    "device_name": device_name,
                    "datetime": created_at,
                    "realtime_conc": rt,
                    "hourly_conc": hc,
                    "short_time_conc": st,
                }
            )
        else:
            # Lowcost field mapping:
            # field1 → s1_pm2_5
            # field3 → s2_pm2_5
            # field2 → s1_pm10
            # field4 → s2_pm10
            # field7 → battery (Battery Voltage)
            s1_pm2_5 = _parse_thingspeak_field(entry.get("field1"))
            s2_pm2_5 = _parse_thingspeak_field(entry.get("field3"))
            s1_pm10 = _parse_thingspeak_field(entry.get("field2"))
            s2_pm10 = _parse_thingspeak_field(entry.get("field4"))
            battery = _parse_thingspeak_field(entry.get("field7"))

            # Compute average pm2_5
            pm2_5 = None
            if s1_pm2_5 is not None and s2_pm2_5 is not None:
                pm2_5 = (s1_pm2_5 + s2_pm2_5) / 2.0
            elif s1_pm2_5 is not None:
                pm2_5 = s1_pm2_5
            elif s2_pm2_5 is not None:
                pm2_5 = s2_pm2_5

            records.append(
                {
                    "device_name": device_name,
                    "datetime": created_at,
                    "pm2_5": pm2_5,
                    "s1_pm2_5": s1_pm2_5,
                    "s2_pm2_5": s2_pm2_5,
                    "s1_pm10": s1_pm10,
                    "s2_pm10": s2_pm10,
                    "battery": battery,
                }
            )

    return records


_TS_PAGE_SIZE = 8000
_TS_MAX_PAGES = 15


def _ts_clean_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return value.replace("T", " ").replace("Z", "")


def _build_ts_params(
    read_key: str,
    min_id: Optional[int],
    start_date: Optional[str],
    end_date: Optional[str],
) -> Dict[str, Any]:
    params: Dict[str, Any] = {"api_key": read_key, "results": _TS_PAGE_SIZE}
    if min_id:
        params["min_id"] = min_id
    elif start_date:
        params["start"] = _ts_clean_date(start_date)
    cleaned_end = _ts_clean_date(end_date)
    if cleaned_end:
        params["end"] = cleaned_end
    return params


def _next_min_id(feeds: List[Dict[str, Any]]) -> Optional[int]:
    """Return next min_id if a full page was returned, else None to signal stop."""
    if len(feeds) < _TS_PAGE_SIZE:
        return None
    last_id = feeds[-1].get("entry_id")
    if last_id is None:
        return None
    return last_id + 1


async def _fetch_thingspeak_feeds(
    device_number: int,
    device_name: str,
    read_key: str,
    start_date: Optional[str],
    end_date: Optional[str],
) -> List[Dict[str, Any]]:
    """Fetch all paginated ThingSpeak feeds for a device. Empty list on failure."""
    ts_url = f"https://api.thingspeak.com/channels/{device_number}/feeds.json"
    all_feeds: List[Dict[str, Any]] = []
    min_id: Optional[int] = None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for page in range(1, _TS_MAX_PAGES + 1):
                params = _build_ts_params(read_key, min_id, start_date, end_date)
                resp = await client.get(ts_url, params=params)
                if resp.status_code != 200:
                    logger.warning(
                        f"[ThingSpeak Direct] API error for {device_name} (page {page}): {resp.status_code}"
                    )
                    break
                feeds = resp.json().get("feeds", [])
                if not feeds:
                    break
                all_feeds.extend(feeds)
                min_id = _next_min_id(feeds)
                if min_id is None:
                    break
        if all_feeds:
            logger.info(
                f"[ThingSpeak Direct] Successfully fetched {len(all_feeds)} total feeds for {device_name}"
            )
    except Exception as exc:
        logger.warning(
            f"[ThingSpeak Direct] Failed to fetch feeds for {device_name}: {exc}"
        )
    return all_feeds


async def _fetch_platform_feeds(
    device_number: Optional[int], device_name: str, token: str,
) -> List[Dict[str, Any]]:
    """Fallback to the platform recent-feeds endpoint."""
    url = f"{settings.PLATFORM_BASE_URL}/devices/feeds/recent/{device_number}"
    headers = {"Authorization": f"JWT {token}"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            body = resp.json()
            return body if isinstance(body, list) else [body]
    except Exception as exc:
        logger.warning(
            f"[Feeds Fallback] Failed to fetch feeds for {device_name} "
            f"(device_number={device_number}): {exc}"
        )
        return []


async def fetch_feeds_for_device(
    device_number: int,
    device_name: str,
    token: Optional[str] = None,
    read_key: Optional[str] = None,
    category: str = "lowcost",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch feeds for a device.
    Uses ThingSpeak directly as default, with Platform API as fallback.
    Handles ThingSpeak pagination if records exceed the 8000 limit.
    """
    if device_number and read_key:
        feeds = await _fetch_thingspeak_feeds(
            device_number, device_name, read_key, start_date, end_date,
        )
        if feeds:
            return _map_thingspeak_feeds(feeds, device_name, category)

    if token:
        entries = await _fetch_platform_feeds(device_number, device_name, token)
        if entries:
            return _map_thingspeak_feeds(entries, device_name, category)

    return []

_DEFAULT_CATEGORY_HIERARCHY = [
    {
        "level": "equipment",
        "category": "lowcost",
        "description": "Low-cost sensor device",
    },
    {
        "level": "deployment",
        "category": "static",
        "description": "Static deployment (fixed location, site-based)",
    },
]


async def _fetch_platform_devices(
    token: str, params: Optional[Dict[str, Any]],
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Fetch /devices from the platform. Returns (payload, error)."""
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(
            f"{settings.PLATFORM_BASE_URL}/devices", headers=headers, params=params,
        )
    if response.status_code != 200:
        logger.error(f"Platform API returned error status: {response.status_code}")
        logger.error(f"Raw Response Content: {response.text}")
        return None, {
            "success": False,
            "message": f"Platform API error: {response.status_code}",
            "status_code": response.status_code,
            "devices": [],
        }
    try:
        return response.json(), None
    except Exception as e:
        logger.error(f"Failed to parse platform API response: {e}")
        logger.error(f"Raw Response Content: {response.text}")
        return None, {
            "success": False,
            "message": "Failed to parse platform API response",
            "status_code": 502,
            "devices": [],
        }


async def _decrypt_keys_for_devices(
    token: str, devices: List[Dict[str, Any]],
) -> Dict[int, str]:
    items = [
        {"encrypted_key": dev["readKey"], "device_number": dev["device_number"]}
        for dev in devices
        if dev.get("readKey") and dev.get("device_number")
    ]
    return await decrypt_read_keys(token, items) if items else {}


def _beacon_data_from_db(db_device: SyncDevice) -> Dict[str, Any]:
    return {
        "network_id": db_device.network_id,
        "site_id": db_device.site_id,
        "current_firmware": db_device.current_firmware,
        "previous_firmware": db_device.previous_firmware,
        "file_upload_state": db_device.file_upload_state,
        "firmware_download_state": db_device.firmware_download_state,
        "device_number": db_device.device_number,
        "writeKey": db_device.writeKey,
        "readKey": db_device.readKey,
    }


def _beacon_data_from_platform(
    dev: Dict[str, Any], read_key_to_store: Optional[str],
) -> Dict[str, Any]:
    platform_site_id = dev.get("site", {}).get("_id")
    return {
        "network_id": dev.get("network"),
        "site_id": platform_site_id if dev.get("status") == "deployed" else None,
        "current_firmware": None,
        "previous_firmware": None,
        "file_upload_state": False,
        "firmware_download_state": None,
        "device_number": dev.get("device_number"),
        "writeKey": dev.get("writeKey"),
        "readKey": read_key_to_store,
    }


def _enrich_device_payload(
    db: Session, dev: Dict[str, Any], decrypted_keys_map: Dict[int, str],
) -> None:
    """Mutate a single platform device dict by attaching beacon_data + category_hierarchy."""
    device_id = dev.get("_id")
    if not device_id:
        return

    dn = dev.get("device_number")
    raw_read_key = dev.get("readKey")
    read_key_to_store = (
        decrypted_keys_map.get(dn, raw_read_key) if dn else raw_read_key
    )

    db_device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
    if db_device:
        beacon_data = _beacon_data_from_db(db_device)
    else:
        beacon_data = _beacon_data_from_platform(dev, read_key_to_store)

    category_hierarchy = (
        dev.get("device_categories", {}).get("category_hierarchy")
        or _DEFAULT_CATEGORY_HIERARCHY
    )

    dev["beacon_data"] = beacon_data
    dev["category_hierarchy"] = category_hierarchy


async def get_device_details(db: Session, token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    platform_data, error = await _fetch_platform_devices(token, params)
    if error is not None:
        return error

    devices = platform_data.get("devices", [])
    decrypted_keys_map = await _decrypt_keys_for_devices(token, devices)

    for dev in devices:
        try:
            _enrich_device_payload(db, dev, decrypted_keys_map)
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing device {dev.get('_id', 'unknown')}: {e}")
            continue

    return platform_data

async def get_device_by_id(db: Session, token: str, device_id: str) -> Dict[str, Any]:
    # 1. Fetch data from PLATFORM_BASE_URL/devices/{device_id}
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(
            f"{settings.PLATFORM_BASE_URL}/devices/{device_id}", 
            headers=headers
        )
        
        if response.status_code != 200:
            logger.error(f"Platform API returned error status: {response.status_code} for device {device_id}")
            logger.error(f"Raw Response Content: {response.text}")
            return {
                "success": False, 
                "message": f"Platform API error: {response.status_code}", 
                "status_code": response.status_code,
                "data": None
            }

        try:
            platform_data = response.json()
        except Exception as e:
            logger.error(f"Failed to parse platform API response for device {device_id}: {e}")
            logger.error(f"Raw Response Content: {response.text}")
            return {
                "success": False, 
                "message": "Failed to parse platform API response", 
                "status_code": 502,
                "data": None
            }
    
    device_data = platform_data.get("data")
    if not device_data:
        # Ensure success field is present even if data is missing
        if "success" not in platform_data:
            platform_data["success"] = True
        return platform_data

    # Decrypt read key if available
    dn = device_data.get("device_number")
    raw_read_key = device_data.get("readKey")
    read_key_to_store = raw_read_key
    if raw_read_key and dn:
        decrypted_map = await decrypt_read_keys(token, [{"encrypted_key": raw_read_key, "device_number": dn}])
        read_key_to_store = decrypted_map.get(dn, raw_read_key)

    # Ensure success field is present
    if "success" not in platform_data:
        platform_data["success"] = True

    # 2. Fetch beacon_data from sync_device (read-only)
    # Updates are only allowed via /devices/sync
    db_device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
    
    if db_device:
        beacon_data = {
            "network_id": db_device.network_id,
            "site_id": db_device.site_id,
            "current_firmware": db_device.current_firmware,
            "previous_firmware": db_device.previous_firmware,
            "file_upload_state": db_device.file_upload_state,
            "firmware_download_state": db_device.firmware_download_state,
            "device_number": db_device.device_number,
            "writeKey": db_device.writeKey,
            "readKey": db_device.readKey
        }
    else:
        # Device not synced yet — use defaults or platform data
        platform_site_id = device_data.get("site", {}).get("_id")
        beacon_data = {
            "network_id": device_data.get("network"),
            "site_id": platform_site_id if device_data.get("status") == "deployed" else None,
            "current_firmware": None,
            "previous_firmware": None,
            "file_upload_state": False,
            "firmware_download_state": None,
            "device_number": device_data.get("device_number"),
            "writeKey": device_data.get("writeKey"),
            "readKey": read_key_to_store
        }
    
    # 3. Add category data
    category_hierarchy = device_data.get("device_categories", {}).get("category_hierarchy")
    if not category_hierarchy:
        category_hierarchy = [
            {
                "level": "equipment",
                "category": "lowcost",
                "description": "Low-cost sensor device"
            },
            {
                "level": "deployment",
                "category": "static",
                "description": "Static deployment (fixed location, site-based)"
            }
        ]
    
    # Merge all data into the device object
    device_data["beacon_data"] = beacon_data
    device_data["category_hierarchy"] = category_hierarchy
    
    return platform_data

async def get_device_metadata(db: Session, device_id: str, category_name: str, skip: int = 0, limit: int = 30) -> Dict[str, Any]:
    # 1. Fetch category details
    db_cat = db.query(Category).filter(Category.name == category_name).first()
    if not db_cat:
        return {
            "success": False,
            "message": f"Category {category_name} not found",
            "status_code": 404
        }
    
    # 2. Fetch metadata values for the device
    query = db.query(SyncMetadataValues).filter(SyncMetadataValues.device_id == device_id)
    total = query.count()
    metadata_values = query.order_by(SyncMetadataValues.created_at.desc()).offset(skip).limit(limit).all()
    
    # 3. Format metadata based on category mapping
    cat_details = {
        "name": db_cat.name,
        "level": db_cat.level,
        "description": db_cat.description,
    }
    # Include metadata and field mappings in category details
    for i in range(1, 16):
        cat_details[f"metadata{i}"] = getattr(db_cat, f"metadata{i}")
        cat_details[f"field{i}"] = getattr(db_cat, f"field{i}")
    
    metadata_list = []
    for mv in metadata_values:
        data = {"created_at": mv.created_at.isoformat() if mv.created_at else None}
        for i in range(1, 16):
            attr_name = f"metadata{i}"
            label = getattr(db_cat, attr_name)
            if label:
                data[label] = getattr(mv, attr_name)
        # Handle field15 specifically if it has a mapping
        if db_cat.field15:
            data[db_cat.field15] = mv.field15
        metadata_list.append(data)
    
    return {
        "success": True,
        "message": "Metadata fetched successfully",
        "meta": {
            "total": total,
            "skip": skip,
            "limit": limit
        },
        "beacon_data": {
            "category_details": cat_details,
            "metadata": metadata_list
        }
    }

async def get_device_configdata(db: Session, device_id: str, category_name: str, skip: int = 0, limit: int = 30) -> Dict[str, Any]:
    # 1. Fetch category details
    db_cat = db.query(Category).filter(Category.name == category_name).first()
    if not db_cat:
        return {
            "success": False,
            "message": f"Category {category_name} not found",
            "status_code": 404
        }
    
    # 2. Fetch config values for the device
    query = db.query(SyncConfigValues).filter(SyncConfigValues.device_id == device_id)
    total = query.count()
    config_values = query.order_by(SyncConfigValues.created_at.desc()).offset(skip).limit(limit).all()
    
    # 3. Format config based on category mapping
    cat_details = {
        "name": db_cat.name,
        "level": db_cat.level,
        "description": db_cat.description,
    }
    # Include config and field mappings in category details
    for i in range(1, 11):
        cat_details[f"config{i}"] = getattr(db_cat, f"config{i}")
    for i in range(1, 16):
        cat_details[f"field{i}"] = getattr(db_cat, f"field{i}")
    
    config_list = []
    for cv in config_values:
        data = {
            "created_at": cv.created_at.isoformat() if cv.created_at else None,
            "config_updated": cv.config_updated
        }
        for i in range(1, 11):
            attr_name = f"config{i}"
            label = getattr(db_cat, attr_name)
            if label:
                data[label] = getattr(cv, attr_name)
        config_list.append(data)
    
    return {
        "success": True,
        "message": "Config data fetched successfully",
        "meta": {
            "total": total,
            "skip": skip,
            "limit": limit
        },
        "beacon_data": {
            "category_details": cat_details,
            "config_data": config_list
        }
    }

async def get_device_performance(
    db: Session,
    device_names: List[str],
    start_date_time: str,
    end_date_time: str,
    frequency: str = "raw",
) -> Dict[str, Any]:
    """
    Per-device performance read from local sync_*_device_data tables
    (the locally-synced ThingSpeak data).

    For ``raw`` (the default) this matches the live ThingSpeak feed at the
    cadence the local sync job ingested it. ``hourly`` / ``daily`` read from
    the corresponding aggregate tables.
    """
    from app.services import cohort_service

    # Flatten comma-separated device names into individual entries
    expanded_names: List[str] = []
    for name in device_names or []:
        expanded_names.extend([n.strip() for n in name.split(",") if n.strip()])

    if not expanded_names:
        return {"success": True, "message": "Performance data fetched successfully", "data": []}

    logger.info(f"Fetching performance for devices: {expanded_names} (frequency={frequency})")

    metrics = cohort_service.compute_device_performance(
        db, expanded_names, start_date_time, end_date_time, frequency=frequency,
    )

    data_list: List[Dict[str, Any]] = []
    for d_name in expanded_names:
        m = metrics.get(d_name)
        if not m:
            data_list.append({
                "device_name": d_name,
                "category": "lowcost",
                "uptime": 0.0,
                "data_completeness": 0.0,
                "averages": {},
                "data": [],
            })
            continue

        data_list.append({
            "device_name": d_name,
            "category": m.get("category", "lowcost"),
            "uptime": round(float(m.get("uptime") or 0.0), 4),
            "data_completeness": round(float(m.get("data_completeness") or 0.0), 4),
            "averages": m.get("averages") or {},
            "data": m.get("data") or [],
        })

    return {
        "success": True,
        "message": "Performance data fetched successfully",
        "data": data_list,
    }


async def get_device_files(device_id: str) -> Dict[str, Any]:
    # Blank list for now as requested
    return {
        "success": True,
        "message": "Device files fetched successfully",
        "data": []
    }

async def _ensure_device(db: Session, device_id: str) -> SyncDevice:
    """Ensure a device exists in sync_device; if missing, insert id-only."""
    device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
    if not device:
        device = SyncDevice(device_id=device_id)
        db.add(device)
        db.commit()
        db.refresh(device)
    return device

async def create_device_metadata(db: Session, device_id: str, category_name: str, values: Dict[str, Any]) -> Dict[str, Any]:
    try:
        await _ensure_device(db, device_id)
        category = db.query(Category).filter(Category.name == category_name).first()
        if not category:
            return {"success": False, "message": f"Category '{category_name}' not found", "status_code": 404}

        # Build insert payload mapping label -> metadataN or direct metadataN keys
        insert_kwargs: Dict[str, Any] = {"device_id": device_id}
        # Accept direct metadataN keys
        for i in range(1, 16):
            key = f"metadata{i}"
            if key in values:
                insert_kwargs[key] = values.get(key)
        # Map category labels -> columns
        for i in range(1, 16):
            label = getattr(category, f"metadata{i}")
            if label and label in values:
                insert_kwargs[f"metadata{i}"] = values[label]

        record = SyncMetadataValues(**insert_kwargs)
        db.add(record)
        db.commit()

        return {"success": True, "message": "Metadata created successfully"}
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to create metadata for device {device_id}: {e}")
        return {"success": False, "message": "Failed to create metadata", "status_code": 500}

async def create_device_configdata(db: Session, device_id: str, category_name: str, values: Dict[str, Any]) -> Dict[str, Any]:
    try:
        await _ensure_device(db, device_id)
        category = db.query(Category).filter(Category.name == category_name).first()
        if not category:
            return {"success": False, "message": f"Category '{category_name}' not found", "status_code": 404}

        insert_kwargs: Dict[str, Any] = {"device_id": device_id}
        # Accept direct configN keys
        for i in range(1, 11):
            key = f"config{i}"
            if key in values:
                insert_kwargs[key] = values.get(key)
        # Map category labels -> columns
        for i in range(1, 11):
            label = getattr(category, f"config{i}")
            if label and label in values:
                insert_kwargs[f"config{i}"] = values[label]

        record = SyncConfigValues(**insert_kwargs)
        db.add(record)
        db.commit()

        return {"success": True, "message": "Config data created successfully"}
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to create config data for device {device_id}: {e}")
        return {"success": False, "message": "Failed to create config data", "status_code": 500}

async def sync_device_sites(db: Session, token: str) -> Dict[str, Any]:
    """
    Deprecated: Use /devices/sync instead.
    Updates to sync_device are now handled exclusively by the main sync endpoint.
    """
    return {
        "success": True,
        "message": "This endpoint is deprecated. Device sites are now synced via /devices/sync.",
        "total_updated": 0
    }


async def _fetch_all_platform_devices(
    client: httpx.AsyncClient, url: str, headers: Dict[str, str],
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Fetch page 1 + remaining pages in parallel. Returns (devices, error)."""
    response = await client.get(url, headers=headers, params={"limit": 100, "skip": 0})
    if response.status_code != 200:
        logger.error(f"Platform API error during device sync: {response.status_code}")
        return [], {
            "success": False,
            "message": f"Platform API error: {response.status_code}",
            "status_code": response.status_code,
        }

    data = response.json()
    all_devices: List[Dict[str, Any]] = list(data.get("devices", []))
    meta = data.get("meta", {}) or {}
    total_pages = meta.get("totalPages", 1)
    actual_limit = meta.get("limit", 100)

    if total_pages > 1:
        fetch_tasks = [
            client.get(
                url, headers=headers,
                params={"limit": actual_limit, "skip": (p - 1) * actual_limit},
            )
            for p in range(2, total_pages + 1)
        ]
        for resp in await asyncio.gather(*fetch_tasks):
            if resp.status_code == 200:
                all_devices.extend(resp.json().get("devices", []))
    return all_devices, None


def _sync_category_record(db: Session, cat: Dict[str, Any]) -> None:
    """Upsert a single category row from a category_hierarchy entry."""
    cat_name = cat.get("category")
    if not cat_name:
        return
    db_cat = db.query(Category).filter(Category.name == cat_name).first()
    if not db_cat:
        db.add(Category(
            name=cat_name,
            level=cat.get("level"),
            description=cat.get("description"),
        ))
        return
    cat_updated = False
    if db_cat.level != cat.get("level"):
        db_cat.level = cat.get("level")
        cat_updated = True
    if db_cat.description != cat.get("description"):
        db_cat.description = cat.get("description")
        cat_updated = True
    if cat_updated:
        db.add(db_cat)


def _sync_device_categories_from_payload(
    db: Session, dev: Dict[str, Any], categories_synced: set,
) -> None:
    hierarchy = dev.get("device_categories", {}).get("category_hierarchy", []) or []
    for cat in hierarchy:
        cat_name = cat.get("category")
        if not cat_name or cat_name in categories_synced:
            continue
        _sync_category_record(db, cat)
        categories_synced.add(cat_name)


def _sync_single_device(
    db: Session,
    dev: Dict[str, Any],
    decrypted_keys_map: Dict[int, str],
    categories_synced: set,
) -> Tuple[bool, bool]:
    """Upsert one device + its categories. Returns (is_new, is_updated)."""
    if not dev.get("_id"):
        return False, False
    dn = dev.get("device_number")
    raw_read_key = dev.get("readKey")
    read_key_to_store = (
        decrypted_keys_map.get(dn, raw_read_key) if dn else raw_read_key
    )
    _, is_new, is_updated = upsert_device_to_sync(
        db, dev, read_key=read_key_to_store, is_authoritative=True,
    )
    _sync_device_categories_from_payload(db, dev, categories_synced)
    return is_new, is_updated


async def sync_devices(db: Session, token: str) -> Dict[str, Any]:
    """
    Synchronizes both sites and categories of all devices from the Platform API.
    Uses the /devices endpoint which contains both site and category information.
    """
    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices"

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            all_devices, error = await _fetch_all_platform_devices(client, url, headers)
        if error is not None:
            return error
    except Exception as e:
        logger.exception(f"Unexpected error fetching devices for sync: {e}")
        return {"success": False, "message": f"Network or Parsing error: {str(e)}", "status_code": 500}

    decrypted_keys_map = await _decrypt_keys_for_devices(token, all_devices)

    updates_count = 0
    new_count = 0
    categories_synced: set = set()

    for dev in all_devices:
        try:
            is_new, is_updated = _sync_single_device(
                db, dev, decrypted_keys_map, categories_synced,
            )
            if is_new:
                new_count += 1
            elif is_updated:
                updates_count += 1
            if (updates_count + new_count) % 50 == 0:
                db.commit()
        except Exception as e:
            logger.error(f"Error syncing device {dev.get('_id')}: {e}")
            db.rollback()

    db.commit()

    return {
        "success": True,
        "message": f"Successfully synced devices. {updates_count} updated, {new_count} new devices added.",
        "updates_count": updates_count,
        "new_count": new_count,
    }

async def sync_device_categories(db: Session, token: str) -> Dict[str, Any]:
    """
    Deprecated: Use /devices/sync instead.
    Updates to sync_device are now handled exclusively by the main sync endpoint.
    """
    return {
        "success": True,
        "message": "This endpoint is deprecated. Device categories are now synced via /devices/sync.",
        "updates_count": 0,
        "new_count": 0
    }
