from typing import List, Optional, Dict, Any
from sqlmodel import Session, select, func, and_
from datetime import datetime, timedelta, timezone
from app.crud.base import CRUDBase
from app.models.device import Device, DeviceCreate, DeviceUpdate
import logging

logger = logging.getLogger(__name__)


class CRUDDevice(CRUDBase[Device, DeviceCreate, DeviceUpdate]):
    def get_by_device_id(self, db: Session, *, device_id: str) -> Optional[Device]:
        statement = select(Device).where(Device.device_id == device_id)
        result = db.exec(statement).first()
        logger.info(f"Searching for device_id: '{device_id}', found: {result is not None}")
        if not result:
            # Debug: Let's see what device IDs are actually in the database
            sample_devices = db.exec(select(Device.device_id).limit(10)).all()
            logger.info(f"Available device IDs: {sample_devices}")
        return result
    
    def get_by_name(self, db: Session, *, device_name: str) -> Optional[Device]:
        statement = select(Device).where(Device.device_name == device_name)
        return db.exec(statement).first()
    
    def get_by_read_key(self, db: Session, *, read_key: str) -> Optional[Device]:
        statement = select(Device).where(Device.read_key == read_key)
        return db.exec(statement).first()
    
    def get_by_channel_id(self, db: Session, *, channel_id: int) -> Optional[Device]:
        statement = select(Device).where(Device.channel_id == channel_id)
        return db.exec(statement).first()
    
    def get_by_site(self, db: Session, *, site_id: str, skip: int = 0, limit: int = 100) -> List[Device]:
        statement = select(Device).where(Device.site_id == site_id).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_active(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Device]:
        statement = select(Device).where(Device.status == "active").offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_by_network(self, db: Session, *, network: str, skip: int = 0, limit: int = 100) -> List[Device]:
        statement = select(Device).where(Device.network == network).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_offline_devices(self, db: Session, *, hours: int = 24) -> List[Device]:
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        statement = select(Device).where(
            (Device.is_online == False) | 
            (Device.last_updated < cutoff_time) | 
            (Device.last_updated == None)
        )
        return db.exec(statement).all()
    
    def update_last_seen(self, db: Session, *, device_key: int) -> Device:
        device = self.get(db, id=device_key)
        if device:
            device.last_updated = datetime.now(timezone.utc)
            db.add(device)
            db.commit()
            db.refresh(device)
        return device
    
    def update_firmware(self, db: Session, *, device_id: str, firmware_data: dict) -> Optional[Device]:
        """Update device firmware versions and network_id"""
        from app.models.firmware import Firmware
        
        device = self.get_by_device_id(db, device_id=device_id)
        if not device:
            return None
        
        # Update only the provided fields
        update_fields = {}
        for field, value in firmware_data.items():
            if value is not None and hasattr(device, field):
                # Handle firmware fields - validate that firmware version exists
                if field in ['current_firmware', 'previous_firmware', 'target_firmware'] and value:
                    # Value should be a firmware version string like "lcv42.74"
                    # Verify the firmware version exists in the database
                    firmware = db.exec(select(Firmware).where(Firmware.firmware_version == value)).first()
                    if firmware:
                        logger.info(f"Found firmware version '{value}' (ID: {firmware.id})")
                        # Store the firmware_version string directly (not the UUID)
                        update_fields[field] = value
                    else:
                        logger.warning(f"Firmware version '{value}' not found in database")
                        # List available firmware for debugging
                        available_firmware = db.exec(select(Firmware.firmware_version, Firmware.id).limit(10)).all()
                        available_list = [f"{fw.firmware_version}" for fw in available_firmware]
                        raise ValueError(f"Firmware version '{value}' not found in database. Available firmware versions: {', '.join(available_list)}")
                else:
                    update_fields[field] = value
        
        if update_fields:
            try:
                for field, value in update_fields.items():
                    setattr(device, field, value)
                device.updated_at = datetime.now(timezone.utc)
                db.add(device)
                db.commit()
                db.refresh(device)
            except Exception as e:
                db.rollback()
                logger.error(f"Database error during firmware update: {str(e)}")
                raise e
        
        return device
    
    def get_devices_with_details(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: Optional[int] = None,
        network: Optional[str] = "airqo",
        status: Optional[str] = None,
        search: Optional[str] = None,
        batch_size: int = 500
    ) -> Dict[str, Any]:
        """
        Get devices with related site, location, and reading data using optimized batch queries.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return (None = all records)
            network: Filter by network
            status: Filter by status
            search: Search term to filter devices by name, device_id, site_id, or location (city, district, country, site_name)
            batch_size: Size of batches for processing related data (default 500)
        
        Returns:
            Dictionary containing:
                - devices: List of device data with related information
                - pagination: Metadata about total count, pages, current page, etc.
        
        Note: When limit is None, all matching devices are returned but processed
        in batches to avoid memory issues with related data queries.
        Search is applied across the entire dataset before pagination.
        """
        from app.models import Site, DeviceReading
        from app.models.location import Location
        
        # Build base query for counting total
        if search:
            # Join with Site table for location-based search
            count_query = (
                select(func.count(func.distinct(Device.device_key)))
                .select_from(Device)
                .outerjoin(Site, Device.site_id == Site.site_id)
            )
        else:
            count_query = select(func.count(Device.device_key))
        
        # Apply same filters to count query
        if network:
            count_query = count_query.where(Device.network == network)
        if status:
            count_query = count_query.where(Device.status == status)
        if search:
            # Search across device fields and location fields
            search_pattern = f"%{search}%"
            count_query = count_query.where(
                (Device.device_name.ilike(search_pattern)) |
                (Device.device_id.ilike(search_pattern)) |
                (Device.site_id.ilike(search_pattern)) |
                (Site.site_name.ilike(search_pattern)) |
                (Site.city.ilike(search_pattern)) |
                (Site.district.ilike(search_pattern)) |
                (Site.country.ilike(search_pattern)) |
                (Site.location_name.ilike(search_pattern))
            )
        
        # Get total count
        total_count = db.exec(count_query).first() or 0
        
        # Build query for fetching devices
        if search:
            # Join with Site table for location-based search
            query = (
                select(Device)
                .outerjoin(Site, Device.site_id == Site.site_id)
            )
        else:
            query = select(Device)
        
        # Apply filters
        if network:
            query = query.where(Device.network == network)
        if status:
            query = query.where(Device.status == status)
        if search:
            # Search across device fields and location fields
            search_pattern = f"%{search}%"
            query = query.where(
                (Device.device_name.ilike(search_pattern)) |
                (Device.device_id.ilike(search_pattern)) |
                (Device.site_id.ilike(search_pattern)) |
                (Site.site_name.ilike(search_pattern)) |
                (Site.city.ilike(search_pattern)) |
                (Site.district.ilike(search_pattern)) |
                (Site.country.ilike(search_pattern)) |
                (Site.location_name.ilike(search_pattern))
            )
        
        # Apply ordering
        query = query.order_by(Device.device_name)
        
        # Apply pagination
        query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)
        
        # Execute query
        devices = db.exec(query).all()
        
        if not devices:
            return {
                "devices": [],
                "pagination": {
                    "total": total_count,
                    "skip": skip,
                    "limit": limit,
                    "returned": 0,
                    "pages": 0 if limit is None else (total_count + limit - 1) // limit,
                    "current_page": 0 if limit is None else (skip // limit) + 1 if limit > 0 else 1,
                    "has_next": False,
                    "has_previous": skip > 0
                }
            }
        
        # Process devices in batches to avoid overwhelming the database
        # with large IN queries for sites, locations, and readings
        device_list = []
        total_devices = len(devices)
        
        for batch_start in range(0, total_devices, batch_size):
            batch_end = min(batch_start + batch_size, total_devices)
            batch_devices = devices[batch_start:batch_end]
            
            # Collect all device keys and site_ids for this batch
            device_keys = [device.device_key for device in batch_devices]
            site_ids = list(set([device.site_id for device in batch_devices if device.site_id]))
            
            # Initialize empty maps
            site_map = {}
            location_map = {}
            reading_map = {}
            
            # Batch query for site information
            if site_ids:
                sites = db.exec(
                    select(Site).where(Site.site_id.in_(site_ids))
                ).all()
                site_map = {site.site_id: site for site in sites}
            
            # Batch query for latest locations
            if device_keys:
                location_subquery = (
                    select(
                        Location.device_key,
                        func.max(Location.recorded_at).label("max_recorded_at")
                    )
                    .where(Location.device_key.in_(device_keys))
                    .where(Location.is_active.is_(True))
                    .group_by(Location.device_key)
                    .subquery()
                )
                
                locations_query = (
                    select(Location)
                    .join(
                        location_subquery,
                        and_(
                            Location.device_key == location_subquery.c.device_key,
                            Location.recorded_at == location_subquery.c.max_recorded_at,
                            Location.is_active.is_(True)
                        )
                    )
                )
                locations = db.exec(locations_query).all()
                location_map = {loc.device_key: loc for loc in locations}
            
            # Batch query for latest readings
            if device_keys:
                reading_subquery = (
                    select(
                        DeviceReading.device_key,
                        func.max(DeviceReading.created_at).label("max_created_at")
                    )
                    .where(DeviceReading.device_key.in_(device_keys))
                    .group_by(DeviceReading.device_key)
                    .subquery()
                )
                
                readings_query = (
                    select(DeviceReading)
                    .join(
                        reading_subquery,
                        and_(
                            DeviceReading.device_key == reading_subquery.c.device_key,
                            DeviceReading.created_at == reading_subquery.c.max_created_at
                        )
                    )
                )
                readings = db.exec(readings_query).all()
                reading_map = {reading.device_key: reading for reading in readings}
            
            # Format response for this batch
            for device in batch_devices:
                site = site_map.get(device.site_id) if device.site_id else None
                location = location_map.get(device.device_key)
                latest_reading = reading_map.get(device.device_key)
                
                device_data = {
                    "device_key": device.device_key,
                    "device_id": device.device_id,
                    "device_name": device.device_name,
                    "site_id": device.site_id,
                    "network": device.network,
                    "category": device.category,
                    "is_active": device.is_active,
                    "status": device.status,
                    "is_online": device.is_online,
                    "mount_type": device.mount_type,
                    "power_type": device.power_type,
                    "height": device.height,
                    "next_maintenance": device.next_maintenance.isoformat() if device.next_maintenance else None,
                    "first_seen": device.first_seen.isoformat() if device.first_seen else None,
                    "last_updated": device.last_updated.isoformat() if device.last_updated else None,
                    "created_at": device.created_at.isoformat() if device.created_at else None,
                    "updated_at": device.updated_at.isoformat() if device.updated_at else None,
                    # "read_key": device.read_key,
                    # "write_key": device.write_key,
                    "channel_id": device.channel_id,
                    "network_id": device.network_id,
                    "current_firmware": device.current_firmware,
                    "previous_firmware": device.previous_firmware,
                    "target_firmware": device.target_firmware,
                    "file_upload_state": device.file_upload_state,
                    "firmware_download_state": device.firmware_download_state,
                    "site_location": {
                        "site_name": site.site_name,
                        "city": site.city,
                        "district": site.district,
                        "country": site.country,
                        "latitude": site.latitude,
                        "longitude": site.longitude,
                        "site_category": site.site_category
                    } if site else None,
                    "location": {
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                        "site_name": location.site_name
                    } if location else None,
                    "latest_reading": {
                        "pm2_5": latest_reading.pm2_5,
                        "pm10": latest_reading.pm10,
                        "temperature": latest_reading.temperature,
                        "humidity": latest_reading.humidity,
                        "timestamp": latest_reading.created_at.isoformat() if latest_reading.created_at else None
                    } if latest_reading else None
                }
                device_list.append(device_data)
        
        # Calculate pagination metadata
        returned_count = len(device_list)
        total_pages = 0 if limit is None else (total_count + limit - 1) // limit
        current_page = 0 if limit is None else (skip // limit) + 1 if limit > 0 else 1
        has_next = (skip + returned_count) < total_count
        has_previous = skip > 0
        
        return {
            "devices": device_list,
            "pagination": {
                "total": total_count,
                "skip": skip,
                "limit": limit,
                "returned": returned_count,
                "pages": total_pages,
                "current_page": current_page,
                "has_next": has_next,
                "has_previous": has_previous
            }
        }
    
    def get_comprehensive_stats(
        self,
        db: Session,
        *,
        include_networks: bool = True,
        include_categories: bool = True,
        include_maintenance: bool = True
    ) -> Dict[str, Any]:
        """
        Get comprehensive device statistics including summary counts, deployment status,
        network breakdown, category breakdown, and maintenance information.
        
        Note: This endpoint is hardcoded to only show statistics for AirQo network devices.
        
        Args:
            db: Database session
            include_networks: Include network breakdown in results
            include_categories: Include category breakdown in results
            include_maintenance: Include maintenance information in results
        
        Returns:
            Dictionary containing comprehensive device statistics for AirQo network only
        """
        # Hardcoded network filter - only AirQo devices
        network_filter = Device.network == "airqo"
        
        # Get basic counts (filtered by AirQo network)
        total_devices = db.exec(
            select(func.count(Device.device_key)).where(network_filter)
        ).first() or 0
        active_devices = db.exec(
            select(func.count(Device.device_key)).where(
                and_(network_filter, Device.is_active.is_(True))
            )
        ).first() or 0
        online_devices = db.exec(
            select(func.count(Device.device_key)).where(
                and_(network_filter, Device.is_online.is_(True))
            )
        ).first() or 0
        offline_devices = db.exec(
            select(func.count(Device.device_key)).where(
                and_(network_filter, Device.is_online.is_(False))
            )
        ).first() or 0
        
        # Get deployment counts (filtered by AirQo network)
        deployed = db.exec(
            select(func.count(Device.device_key)).where(
                and_(network_filter, Device.status == "deployed")
            )
        ).first() or 0
        not_deployed = db.exec(
            select(func.count(Device.device_key)).where(
                and_(network_filter, (Device.status != "deployed") | (Device.status == None))
            )
        ).first() or 0
        recalled = db.exec(
            select(func.count(Device.device_key)).where(
                and_(network_filter, Device.status == "recalled")
            )
        ).first() or 0
        
        # Get status breakdown (filtered by AirQo network)
        statuses = db.exec(
            select(Device.status, func.count(Device.device_key))
            .where(network_filter)
            .group_by(Device.status)
        ).all()
        
        # Build base result
        result = {
            "summary": {
                "total": total_devices,
                "active": active_devices,
                "inactive": total_devices - active_devices,
                "online": online_devices,
                "offline": offline_devices
            },
            "deployment": {
                "deployed": deployed,
                "not_deployed": not_deployed,
                "recalled": recalled
            },
            "status_breakdown": {status or "unknown": count for status, count in statuses},
            "percentages": {
                "active_rate": round((active_devices / total_devices * 100), 2) if total_devices > 0 else 0,
                "online_rate": round((online_devices / total_devices * 100), 2) if total_devices > 0 else 0,
                "deployment_rate": round((deployed / total_devices * 100), 2) if total_devices > 0 else 0
            }
        }
        
        # Add network breakdown if requested (filtered by AirQo network)
        if include_networks:
            networks = db.exec(
                select(Device.network, func.count(Device.device_key))
                .where(network_filter)
                .group_by(Device.network)
            ).all()
            result["networks"] = {network or "unknown": count for network, count in networks}
        
        # Add category breakdown if requested (filtered by AirQo network)
        if include_categories:
            categories = db.exec(
                select(Device.category, func.count(Device.device_key))
                .where(network_filter)
                .group_by(Device.category)
            ).all()
            result["categories"] = {category or "unknown": count for category, count in categories}
        
        # Add maintenance information if requested (filtered by AirQo network)
        if include_maintenance:
            maintenance_cutoff = datetime.now(timezone.utc) + timedelta(days=30)
            upcoming_maintenance = db.exec(
                select(func.count(Device.device_key)).where(
                    and_(
                        network_filter,
                        (Device.next_maintenance != None),
                        (Device.next_maintenance <= maintenance_cutoff)
                    )
                )
            ).first() or 0
            result["maintenance"] = {
                "upcoming_30_days": upcoming_maintenance,
                "percentage": round((upcoming_maintenance / total_devices * 100), 2) if total_devices > 0 else 0
            }
        
        # Add timestamp
        result["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        return result


device = CRUDDevice(Device)