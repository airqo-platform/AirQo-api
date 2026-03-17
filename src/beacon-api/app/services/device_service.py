import asyncio
import httpx
import logging
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.sync import SyncDevice, Category, SyncMetadataValues, SyncConfigValues
from typing import List, Dict, Any
from app.utils.performance import PerformanceAnalysis

logger = logging.getLogger(__name__)

async def get_device_details(db: Session, token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    # 1. Fetch data from PLATFORM_BASE_URL/devices
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
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
    
    for dev in devices:
        try:
            device_id = dev.get("_id")
            if not device_id:
                continue
                
            # 2. Fetch/Merge beacon_data from sync_device
            db_device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
            
            if not db_device:
                # Sync to sync_device if doesn't exist. Save ONLY the device_id as requested.
                db_device = SyncDevice(
                    device_id=device_id,
                    network_id=dev.get("network")
                )
                db.add(db_device)
                db.commit()
                db.refresh(db_device)
            elif not db_device.network_id:
                # Update network_id if it's missing
                db_device.network_id = dev.get("network")
                db.commit()
                db.refresh(db_device)
            
            beacon_data = {
                "network_id": db_device.network_id,
                "current_firmware": db_device.current_firmware,
                "previous_firmware": db_device.previous_firmware,
                "file_upload_state": db_device.file_upload_state,
                "firmware_download_state": db_device.firmware_download_state
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
            
            # Synchronize categories
            for cat in category_hierarchy:
                cat_name = cat.get("category")
                if not cat_name:
                    continue
                db_cat = db.query(Category).filter(Category.name == cat_name).first()
                if not db_cat:
                    db_cat = Category(
                        name=cat_name,
                        level=cat.get("level"),
                        description=cat.get("description")
                    )
                    db.add(db_cat)
                    db.commit()
            
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
    async with httpx.AsyncClient(timeout=30.0) as client:
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

    # Ensure success field is present
    if "success" not in platform_data:
        platform_data["success"] = True

    # 2. Fetch/Merge beacon_data from sync_device
    db_device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
    
    if not db_device:
        # Sync to sync_device if doesn't exist. Save ONLY the device_id as requested.
        db_device = SyncDevice(
            device_id=device_id,
            network_id=device_data.get("network")
        )
        db.add(db_device)
        db.commit()
        db.refresh(db_device)
    elif not db_device.network_id:
        # Update network_id if it's missing
        db_device.network_id = device_data.get("network")
        db.commit()
        db.refresh(db_device)
    
    beacon_data = {
        "network_id": db_device.network_id,
        "current_firmware": db_device.current_firmware,
        "previous_firmware": db_device.previous_firmware,
        "file_upload_state": db_device.file_upload_state,
        "firmware_download_state": db_device.firmware_download_state
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
    
    # Synchronize categories
    for cat in category_hierarchy:
        try:
            cat_name = cat.get("category")
            if not cat_name:
                continue
            db_cat = db.query(Category).filter(Category.name == cat_name).first()
            if not db_cat:
                db_cat = Category(
                    name=cat_name,
                    level=cat.get("level"),
                    description=cat.get("description")
                )
                db.add(db_cat)
                db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error synchronizing category {cat.get('category', 'unknown')}: {e}")
            # We can continue, just that this device might not have the category synced
    
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

async def get_device_performance(device_names: List[str], startDateTime: str, endDateTime: str) -> Dict[str, Any]:
    from app.core.config import settings
    
    # Flatten comma-separated device names into individual entries
    # e.g. ["airqo_g5567,airqo_g5566"] -> ["airqo_g5567", "airqo_g5566"]
    expanded_names: List[str] = []
    for name in device_names:
        expanded_names.extend([n.strip() for n in name.split(",") if n.strip()])
    device_names = expanded_names
    logger.info(f"Fetching performance for devices: {device_names}")
    
    payload = {
        "network": "airqo",
        "device_category": "lowcost",
        "device_names": device_names,
        "pollutants": ["pm2_5", "pm10"],
        "metaDataFields": ["latitude", "longitude", "battery"],
        "weatherFields": ["temperature", "humidity"],
        "startDateTime": startDateTime,
        "endDateTime": endDateTime,
        "frequency": "raw"
    }

    try:
        token = settings.PLATFORM_API_TOKEN
    except AttributeError:
        # Fallback if PLATFORM_API_TOKEN is not in settings
        token = ""

    raw_data = []
    pagination_incomplete = False
    max_retries = 3
    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f"{settings.PLATFORM_BASE_URL}/analytics/raw-data?token={token}"
        
        has_more = True
        while has_more:
            last_error = None
            for attempt in range(1, max_retries + 1):
                try:
                    response = await client.post(url, json=payload)

                    if response.status_code == 200:
                        try:
                            platform_data = response.json()
                            curr_data = platform_data.get("data", [])
                            raw_data.extend(curr_data)
                            metadata = platform_data.get("metadata", {})
                            has_more = metadata.get("has_more", False)
                            cursor = metadata.get("next")
                            if has_more and cursor:
                                payload["cursor"] = cursor
                            else:
                                has_more = False
                        except Exception as e:
                            logger.error(f"Failed to parse platform raw-data response: {e}")
                            if not raw_data:
                                return {
                                    "success": False,
                                    "message": "Failed to parse platform raw-data response",
                                    "data": []
                                }
                            pagination_incomplete = True
                            has_more = False
                        break  # success or handled parse error — exit retry loop

                    elif response.status_code >= 500:
                        # Server error — retryable
                        last_error = f"status {response.status_code}"
                        if attempt < max_retries:
                            delay = 2 ** attempt
                            logger.warning(
                                f"Platform API returned {response.status_code} "
                                f"(attempt {attempt}/{max_retries}). Retrying in {delay}s..."
                            )
                            await asyncio.sleep(delay)
                        else:
                            logger.error(
                                f"Platform API returned {response.status_code} "
                                f"after {max_retries} attempts"
                            )
                            if not raw_data:
                                return {
                                    "success": False,
                                    "message": f"Platform API error: {response.status_code}",
                                    "data": []
                                }
                            pagination_incomplete = True
                            has_more = False
                    else:
                        # Client error (4xx) — not retryable
                        logger.error(f"Platform API returned error status: {response.status_code}")
                        logger.error(f"Platform API response body: {response.text[:500]}")
                        if not raw_data:
                            return {
                                "success": False,
                                "message": f"Platform API error: {response.status_code}",
                                "data": []
                            }
                        pagination_incomplete = True
                        has_more = False
                        break  # don't retry client errors

                except (httpx.RemoteProtocolError, httpx.ReadError, httpx.ConnectError) as e:
                    last_error = e
                    if attempt < max_retries:
                        delay = 2 ** attempt
                        logger.warning(
                            f"Transient error fetching raw data "
                            f"(attempt {attempt}/{max_retries}): {e}. Retrying in {delay}s..."
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"Failed to fetch raw data after {max_retries} attempts: {e}"
                        )
                        if not raw_data:
                            return {
                                "success": False,
                                "message": f"Connection error: {e}",
                                "data": []
                            }
                        pagination_incomplete = True
                        has_more = False

    analysis = PerformanceAnalysis(raw_data)
    metrics_map = analysis.compute_device_metrics(startDateTime, endDateTime)

    # Group raw records by device name
    raw_data_by_device: Dict[str, List[Dict[str, Any]]] = {}
    for record in raw_data:
        dev_name = record.get("device_name")
        if dev_name:
            raw_data_by_device.setdefault(dev_name, []).append(record)
    
    data_list = []
    # Include all requested devices even if no data was returned (metrics will be 0)
    for d_name in device_names:
        if d_name in metrics_map:
            m = metrics_map[d_name]
            data_list.append({
                "device_name": d_name,
                "uptime": m["uptime"],
                "data_completeness": m["data_completeness"],
                "sensor_error_margin": m["sensor_error_margin"],
                "raw_data": raw_data_by_device.get(d_name, [])
            })
        else:
            data_list.append({
                "device_name": d_name,
                "uptime": 0.0,
                "data_completeness": 0.0,
                "sensor_error_margin": 0.0,
                "raw_data": []
            })

    result = {
        "success": True,
        "message": "Performance data fetched successfully",
        "data": data_list,
    }
    if pagination_incomplete:
        result["partial"] = True
        result["message"] = "Performance data fetched with incomplete pagination (some pages failed)"
    return result

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
