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

    # Extract common fields
    device_name = dev.get("name")
    network_id = dev.get("network")
    dn = dev.get("device_number")
    write_key = dev.get("writeKey")
    # Use provided decrypted read_key if available, else what's in dev
    read_key_to_store = read_key or dev.get("readKey")

    # site_id logic
    # In authoritative sync, we have 'status' and 'site' object
    platform_site_id = (
        dev.get("site", {}).get("_id") or dev.get("site_id") or dev.get("site", {}).get("id")
    )
    status = dev.get("status")

    # Accurate logic: site_id is only valid if device is "deployed"
    # If status is missing (non-authoritative thin data), we don't know for sure.
    site_id = platform_site_id if status == "deployed" else None

    db_device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()

    if not db_device:
        # Brand-new device — derive everything
        db_device = SyncDevice(
            device_id=device_id,
            device_name=device_name,
            network_id=network_id,
            category=extract_device_category(dev),
            site_id=site_id if status is not None else platform_site_id,
            device_number=dn,
            writeKey=write_key,
            readKey=read_key_to_store,
        )
        db.add(db_device)
        return db_device, True, False
    else:
        updated = False

        if is_authoritative:
            # Full sync — update everything
            extracted_category = extract_device_category(dev)
            if db_device.category != extracted_category:
                db_device.category = extracted_category
                updated = True

            if db_device.site_id != site_id:
                db_device.site_id = site_id
                updated = True

            if db_device.network_id != network_id:
                db_device.network_id = network_id
                updated = True

            if db_device.device_name != device_name:
                db_device.device_name = device_name
                updated = True

            if db_device.device_number != dn:
                db_device.device_number = dn
                updated = True

            if db_device.writeKey != write_key:
                db_device.writeKey = write_key
                updated = True

            if db_device.readKey != read_key_to_store:
                db_device.readKey = read_key_to_store
                updated = True
        else:
            # Non-authoritative sync (e.g. from cohorts) — avoid overwriting valid metadata

            # 1. Category: Only update if missing
            if not db_device.category:
                db_device.category = extract_device_category(dev)
                updated = True

            # 2. Site ID: Only update if status is explicitly provided
            if status is not None:
                if db_device.site_id != site_id:
                    db_device.site_id = site_id
                    updated = True
            # If status is None, we TRUST the database's existing site_id
            # and ignore platform_site_id which might be None or stale in thin data.

            # 3. Other fields: update only if missing in DB
            if not db_device.device_name and device_name:
                db_device.device_name = device_name
                updated = True
            if not db_device.network_id and network_id:
                db_device.network_id = network_id
                updated = True
            if not db_device.device_number and dn:
                db_device.device_number = dn
                updated = True
            if not db_device.writeKey and write_key:
                db_device.writeKey = write_key
                updated = True
            if not db_device.readKey and read_key_to_store:
                db_device.readKey = read_key_to_store
                updated = True

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

    # 1. Try ThingSpeak Direct (Default)
    if device_number and read_key:
        ts_url = f"https://api.thingspeak.com/channels/{device_number}/feeds.json"
        all_feeds = []
        has_more = True
        min_id = None
        pages = 0
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                while has_more and pages < 15:
                    pages += 1
                    params = {"api_key": read_key, "results": 8000}
                    if min_id:
                        params["min_id"] = min_id
                    elif start_date:
                        # ThingSpeak expects YYYY-MM-DD%20HH:NN:SS
                        params["start"] = start_date.replace("T", " ").replace("Z", "")
                    
                    if end_date:
                        params["end"] = end_date.replace("T", " ").replace("Z", "")

                    resp = await client.get(ts_url, params=params)
                    if resp.status_code != 200:
                        logger.warning(
                            f"[ThingSpeak Direct] API error for {device_name} (page {pages}): {resp.status_code}"
                        )
                        break

                    body = resp.json()
                    feeds = body.get("feeds", [])
                    if not feeds:
                        has_more = False
                        break
                    
                    all_feeds.extend(feeds)
                    
                    # If we got exactly 8000, there might be more
                    if len(feeds) == 8000:
                        last_id = feeds[-1].get("entry_id")
                        if last_id is not None:
                            min_id = last_id + 1
                        else:
                            has_more = False
                    else:
                        has_more = False
                
                if all_feeds:
                    logger.info(
                        f"[ThingSpeak Direct] Successfully fetched {len(all_feeds)} total feeds for {device_name} across {pages} pages"
                    )
                    return _map_thingspeak_feeds(all_feeds, device_name, category)
        except Exception as exc:
            logger.warning(
                f"[ThingSpeak Direct] Failed to fetch feeds for {device_name}: {exc}"
            )

    # 2. Fallback to Platform API (requires token)
    if token:
        # Platform endpoint for recent feeds
        url = f"{settings.PLATFORM_BASE_URL}/devices/feeds/recent/{device_number}"
        headers = {"Authorization": f"JWT {token}"}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                body = resp.json()
                # The response can be a single object or a list of feed entries
                entries = body if isinstance(body, list) else [body]
                return _map_thingspeak_feeds(entries, device_name, category)
        except Exception as exc:
            logger.warning(
                f"[Feeds Fallback] Failed to fetch feeds for {device_name} "
                f"(device_number={device_number}): {exc}"
            )

    return []

async def get_device_details(db: Session, token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    # 1. Fetch data from PLATFORM_BASE_URL/devices
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(
            f"{settings.PLATFORM_BASE_URL}/devices", 
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            logger.error(f"Platform API returned error status: {response.status_code}")
            logger.error(f"Raw Response Content: {response.text}")
            return {
                "success": False, 
                "message": f"Platform API error: {response.status_code}", 
                "status_code": response.status_code,
                "devices": []
            }

        try:
            platform_data = response.json()
        except Exception as e:
            logger.error(f"Failed to parse platform API response: {e}")
            logger.error(f"Raw Response Content: {response.text}")
            return {
                "success": False, 
                "message": "Failed to parse platform API response", 
                "status_code": 502,
                "devices": []
            }
        
    devices = platform_data.get("devices", [])
    
    # Pre-decrypt read keys in bulk
    decryption_items = []
    for dev in devices:
        rk = dev.get("readKey")
        dn = dev.get("device_number")
        if rk and dn:
            decryption_items.append({"encrypted_key": rk, "device_number": dn})
    
    decrypted_keys_map = await decrypt_read_keys(token, decryption_items) if decryption_items else {}

    for dev in devices:
        try:
            device_id = dev.get("_id")
            if not device_id:
                continue
                
            # Use decrypted key if available
            dn = dev.get("device_number")
            raw_read_key = dev.get("readKey")
            read_key_to_store = decrypted_keys_map.get(dn, raw_read_key) if dn else raw_read_key

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
                platform_site_id = dev.get("site", {}).get("_id")
                beacon_data = {
                    "network_id": dev.get("network"),
                    "site_id": platform_site_id if dev.get("status") == "deployed" else None,
                    "current_firmware": None,
                    "previous_firmware": None,
                    "file_upload_state": False,
                    "firmware_download_state": None,
                    "device_number": dev.get("device_number"),
                    "writeKey": dev.get("writeKey"),
                    "readKey": decrypted_keys_map.get(dev.get("device_number"), dev.get("readKey"))
                }
            
            # 3. Add category data
            category_hierarchy = dev.get("device_categories", {}).get("category_hierarchy")
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
            dev["beacon_data"] = beacon_data
            dev["category_hierarchy"] = category_hierarchy
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing device {dev.get('_id', 'unknown')}: {e}")
            # Continue processing other devices instead of failing the whole request
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

async def get_device_performance(db: Session, device_names: List[str], startDateTime: str, endDateTime: str) -> Dict[str, Any]:
    from app.core.config import settings
    
    # Flatten comma-separated device names into individual entries
    expanded_names: List[str] = []
    for name in device_names:
        expanded_names.extend([n.strip() for n in name.split(",") if n.strip()])
    device_names = expanded_names
    logger.info(f"Fetching performance for devices: {device_names}")

    # Lookup categories and connection info from DB
    from app.models.sync import SyncDevice
    db_devices = db.query(SyncDevice).filter(SyncDevice.device_name.in_(expanded_names)).all()
    device_info_map = {d.device_name: d for d in db_devices if d.device_name}
    
    # Group by category
    cats_to_names = {}
    for name in device_names:
        info = device_info_map.get(name)
        cat = info.category if info and info.category else "lowcost"
        cats_to_names.setdefault(cat, []).append(name)

    try:
        token = settings.PLATFORM_API_TOKEN
    except AttributeError:
        token = ""

    # 1. Fetch from Analytics (Backup) in bulk
    analytics_raw_data = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f"{settings.PLATFORM_BASE_URL}/analytics/raw-data?token={token}"
        for cat, names in cats_to_names.items():
            payload = {
                "network": "airqo",
                "device_category": cat,
                "device_names": names,
                "startDateTime": startDateTime,
                "endDateTime": endDateTime,
                "frequency": "raw"
            }
            if cat == "bam":
                payload["pollutants"] = ["pm2_5"]
            else:
                payload["pollutants"] = ["pm2_5", "pm10"]
                payload["metaDataFields"] = ["latitude", "longitude", "battery"]
                payload["weatherFields"] = ["temperature", "humidity"]

            has_more = True
            while has_more:
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        platform_data = response.json()
                        analytics_raw_data.extend(platform_data.get("data", []))
                        metadata = platform_data.get("metadata", {})
                        has_more = metadata.get("has_more", False)
                        cursor = metadata.get("next")
                        if has_more and cursor:
                            payload["cursor"] = cursor
                        else:
                            has_more = False
                    else:
                        logger.error(f"Platform Analytics error for {cat}: {response.status_code}")
                        has_more = False
                except Exception as e:
                    logger.error(f"Failed to fetch Analytics data: {e}")
                    has_more = False

    # 2. Fetch from ThingSpeak (Primary) in parallel
    ts_tasks = []
    for d_name in device_names:
        info = device_info_map.get(d_name)
        if info and info.device_number:
            ts_tasks.append(
                fetch_feeds_for_device(
                    info.device_number,
                    d_name,
                    token=settings.TOKEN.replace("JWT ", ""), # Use current session token if available
                    read_key=info.readKey,
                    category=info.category or "lowcost",
                    start_date=startDateTime,
                    end_date=endDateTime
                )
            )
    
    ts_results = await asyncio.gather(*ts_tasks, return_exceptions=True)
    ts_data_by_device = {}
    for d_name, result in zip([n for n in device_names if device_info_map.get(n) and device_info_map[n].device_number], ts_results):
        if isinstance(result, list) and result:
            ts_data_by_device[d_name] = result

    # 3. Merge: Prefer ThingSpeak, Fallback to Analytics
    final_raw_data = []
    for d_name in device_names:
        if d_name in ts_data_by_device:
            final_raw_data.extend(ts_data_by_device[d_name])
        else:
            # Fallback to analytics
            dev_analytics = [r for r in analytics_raw_data if r.get("device_name") == d_name]
            final_raw_data.extend(dev_analytics)

    # Compute metrics separately per category
    metrics_map = {}
    for cat, names in cats_to_names.items():
        cat_raw_data = [r for r in final_raw_data if r.get("device_name") in names]
        cat_analysis = PerformanceAnalysis(cat_raw_data)
        cat_metrics = cat_analysis.compute_device_metrics(startDateTime, endDateTime, device_category=cat)
        metrics_map.update(cat_metrics)

    # Group final records by device name
    raw_data_by_device: Dict[str, List[Dict[str, Any]]] = {}
    for record in final_raw_data:
        dev_name = record.get("device_name")
        if dev_name:
            raw_data_by_device.setdefault(dev_name, []).append(record)
    
    data_list = []
    for d_name in device_names:
        info = device_info_map.get(d_name)
        cat = info.category if info and info.category else "lowcost"
        if d_name in metrics_map:
            m = metrics_map[d_name]
            entry = {
                "device_name": d_name,
                "uptime": m["uptime"],
                "data_completeness": m["data_completeness"],
                "raw_data": raw_data_by_device.get(d_name, [])
            }
            if cat == "bam":
                entry["realtime_conc_average"] = m.get("realtime_conc_average")
                entry["short_time_conc_average"] = m.get("short_time_conc_average")
                entry["hourly_conc_average"] = m.get("hourly_conc_average")
                # Also include default for schema compatibility
                entry["sensor_error_margin"] = 0.0
            else:
                entry["sensor_error_margin"] = m.get("sensor_error_margin", 0.0)
                entry["s1_pm2_5_average"] = m.get("s1_pm2_5_average")
                entry["s2_pm2_5_average"] = m.get("s2_pm2_5_average")
                entry["correlation"] = m.get("correlation")
            data_list.append(entry)
        else:
            data_list.append({
                "device_name": d_name,
                "uptime": 0.0,
                "data_completeness": 0.0,
                "sensor_error_margin": 0.0,
                "raw_data": []
            })

    return {
        "success": True,
        "message": "Performance data fetched successfully",
        "data": data_list
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


async def sync_devices(db: Session, token: str) -> Dict[str, Any]:
    """
    Synchronizes both sites and categories of all devices from the Platform API.
    Uses the /devices endpoint which contains both site and category information.
    """
    headers = {"Authorization": f"JWT {token}"}
    all_devices: List[Dict[str, Any]] = []
    
    # 1. Fetch ALL devices from platform (paginated)
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        url = f"{settings.PLATFORM_BASE_URL}/devices"
        
        # Initial request to get metadata
        try:
            response = await client.get(url, headers=headers, params={"limit": 100, "skip": 0})
            if response.status_code != 200:
                logger.error(f"Platform API error during device sync: {response.status_code}")
                return {
                    "success": False, 
                    "message": f"Platform API error: {response.status_code}", 
                    "status_code": response.status_code
                }
                
            data = response.json()
            all_devices.extend(data.get("devices", []))
            
            total_pages = data.get("meta", {}).get("totalPages", 1)
            
            # Fetch remaining pages in parallel
            if total_pages > 1:
                fetch_tasks = []
                for p in range(2, total_pages + 1):
                    params = {"limit": 100, "skip": (p - 1) * 100}
                    fetch_tasks.append(client.get(url, headers=headers, params=params))
                
                paged_responses = await asyncio.gather(*fetch_tasks)
                for resp in paged_responses:
                    if resp.status_code == 200:
                        all_devices.extend(resp.json().get("devices", []))
        except Exception as e:
            logger.exception(f"Unexpected error fetching devices for sync: {e}")
            return {"success": False, "message": f"Network or Parsing error: {str(e)}", "status_code": 500}

    # 2. Update local database
    updates_count = 0
    new_count = 0
    categories_synced = set()
    
    # Pre-decrypt read keys in bulk
    decryption_items = []
    for dev in all_devices:
        rk = dev.get("readKey")
        dn = dev.get("device_number")
        if rk and dn:
            decryption_items.append({"encrypted_key": rk, "device_number": dn})
    
    decrypted_keys_map = await decrypt_read_keys(token, decryption_items) if decryption_items else {}

    for dev in all_devices:
        try:
            device_id = dev.get("_id")
            if not device_id:
                continue

            dn = dev.get("device_number")
            raw_read_key = dev.get("readKey")
            read_key_to_store = (
                decrypted_keys_map.get(dn, raw_read_key) if dn else raw_read_key
            )

            _, is_new, is_updated = upsert_device_to_sync(
                db, dev, read_key=read_key_to_store, is_authoritative=True
            )

            if is_new:
                new_count += 1
            elif is_updated:
                updates_count += 1

            # 3. Synchronize categories table as well (normally done in get_device_details)
            category_hierarchy = dev.get("device_categories", {}).get("category_hierarchy", [])
            for cat in category_hierarchy:
                cat_name = cat.get("category")
                if not cat_name:
                    continue
                
                # Check if we already synced this category in this run
                if cat_name in categories_synced:
                    continue
                
                db_cat = db.query(Category).filter(Category.name == cat_name).first()
                if not db_cat:
                    db_cat = Category(
                        name=cat_name,
                        level=cat.get("level"),
                        description=cat.get("description")
                    )
                    db.add(db_cat)
                else:
                    # Update category details if they've changed
                    cat_updated = False
                    if db_cat.level != cat.get("level"):
                        db_cat.level = cat.get("level")
                        cat_updated = True
                    if db_cat.description != cat.get("description"):
                        db_cat.description = cat.get("description")
                        cat_updated = True
                    if cat_updated:
                        db.add(db_cat)
                
                categories_synced.add(cat_name)
            
            # Commit in batches of 50 to avoid long transactions
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
        "new_count": new_count
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
