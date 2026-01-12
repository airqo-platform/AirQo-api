from typing import List, Optional, Dict, Any, Union
from sqlmodel import Session, select, func
from datetime import datetime, timedelta, timezone
import math

from app.crud.base import CRUDBase
from app.models.airqloud import (
    AirQloud, 
    AirQloudCreate, 
    AirQloudUpdate,
    AirQloudDevice,
    AirQloudDeviceCreate,
)
import logging

logger = logging.getLogger(__name__)


def sanitize_float(value: Union[float, int, None]) -> Union[float, int, None]:
    """Sanitize float values to be JSON compliant.
    
    Converts NaN, Infinity, and -Infinity to None since these values
    are not valid JSON.
    """
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
    return value


class CRUDAirQloud(CRUDBase[AirQloud, AirQloudCreate, AirQloudUpdate]):
    """CRUD operations for AirQloud"""
    
    def get_by_name(self, db: Session, *, name: str) -> Optional[AirQloud]:
        """Get an AirQloud by name"""
        statement = select(AirQloud).where(AirQloud.name == name)
        return db.exec(statement).first()
    
    def get_by_country(
        self, 
        db: Session, 
        *, 
        country: str, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[AirQloud]:
        """Get AirQlouds by country"""
        statement = (
            select(AirQloud)
            .where(AirQloud.country == country)
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()
    
    def get_with_device_count(
        self, 
        db: Session, 
        *, 
        airqloud_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get an AirQloud with device count"""
        # Get the AirQloud
        airqloud = self.get(db, id=airqloud_id)
        if not airqloud:
            return None
        
        # Use number_of_devices from AirQloud (synced from Platform API)
        # This is the authoritative count from the Platform
        device_count = airqloud.number_of_devices or 0
        
        # Convert to dict and add device count
        result = {
            "id": airqloud.id,
            "name": airqloud.name,
            "country": airqloud.country,
            "network": airqloud.network,
            "visibility": airqloud.visibility,
            "is_active": airqloud.is_active,
            "number_of_devices": airqloud.number_of_devices,
            "created_at": airqloud.created_at,
            "device_count": device_count
        }
        return result
    
    def get_all_with_device_counts(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        country: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all AirQlouds with their device counts"""
        # Build base query
        airqloud_query = select(AirQloud)
        
        if country:
            airqloud_query = airqloud_query.where(AirQloud.country == country)
        
        if search:
            # Search across airqloud fields
            search_pattern = f"%{search}%"
            airqloud_query = airqloud_query.where(
                (AirQloud.name.ilike(search_pattern)) |
                (AirQloud.id.ilike(search_pattern)) |
                (AirQloud.country.ilike(search_pattern))
            )
        
        # Order by is_active (active first), then by name
        airqloud_query = airqloud_query.order_by(AirQloud.is_active.desc(), AirQloud.name).offset(skip).limit(limit)
        airqlouds = db.exec(airqloud_query).all()
        
        # Build results using number_of_devices from AirQloud (synced from Platform API)
        results = []
        for airqloud in airqlouds:
            # Use number_of_devices from AirQloud - this is the authoritative count from Platform
            device_count = airqloud.number_of_devices or 0
            
            results.append({
                "id": airqloud.id,
                "name": airqloud.name,
                "country": airqloud.country,
                "network": airqloud.network,
                "visibility": airqloud.visibility,
                "is_active": airqloud.is_active,
                "number_of_devices": airqloud.number_of_devices,
                "created_at": airqloud.created_at,
                "device_count": device_count
            })
        
        return results
    
    def add_device(
        self, 
        db: Session, 
        *, 
        airqloud_id: str,
        device_data: AirQloudDeviceCreate
    ) -> AirQloudDevice:
        """Add a device to an AirQloud"""
        # Check if the relationship already exists
        existing = db.exec(
            select(AirQloudDevice)
            .where(AirQloudDevice.id == device_data.id)
        ).first()
        
        if existing:
            # Update the existing relationship
            for key, value in device_data.model_dump(exclude_unset=True).items():
                setattr(existing, key, value)
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return existing
        
        # Create new relationship
        airqloud_device = AirQloudDevice(**device_data.model_dump())
        db.add(airqloud_device)
        db.commit()
        db.refresh(airqloud_device)
        return airqloud_device
    
    def remove_device(
        self, 
        db: Session, 
        *, 
        airqloud_id: str,
        device_id: str
    ) -> bool:
        """Remove a device from an AirQloud (soft delete)"""
        relationship = db.exec(
            select(AirQloudDevice)
            .where(AirQloudDevice.cohort_id == airqloud_id)
            .where(AirQloudDevice.id == device_id)
        ).first()
        
        if relationship:
            relationship.is_active = False
            db.add(relationship)
            db.commit()
            return True
        return False
    
    def get_devices(
        self, 
        db: Session, 
        *, 
        airqloud_id: str,
        include_inactive: bool = False,
        skip: int = 0,
        limit: int = 100
    ) -> List[AirQloudDevice]:
        """Get all devices in an AirQloud"""
        query = (
            select(AirQloudDevice)
            .where(AirQloudDevice.cohort_id == airqloud_id)
        )
        
        if not include_inactive:
            query = query.where(AirQloudDevice.is_active == True)
        
        query = query.offset(skip).limit(limit)
        return db.exec(query).all()
    
    def get_airqlouds_for_device(
        self, 
        db: Session, 
        *, 
        device_id: str,
        include_inactive: bool = False
    ) -> List[AirQloud]:
        """Get all AirQlouds that a device belongs to"""
        query = (
            select(AirQloud)
            .join(AirQloudDevice, AirQloudDevice.cohort_id == AirQloud.id)
            .where(AirQloudDevice.id == device_id)
        )
        
        if not include_inactive:
            query = query.where(AirQloudDevice.is_active == True)
        
        return db.exec(query).all()
    
    def get_with_performance(
        self,
        db: Session,
        *,
        airqloud_id: str,
        days: int = 30,
        fetch_missing: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Get an AirQloud with device count and performance data for the past N days
        
        Args:
            db: Database session
            airqloud_id: AirQloud ID to fetch
            days: Number of days of performance history
            fetch_missing: If True, fetch missing data synchronously. If False, return current data only.
        """
        from app.crud.performance import airqloud_performance, device_performance
        
        # Get the AirQloud with device count
        airqloud_data = self.get_with_device_count(db, airqloud_id=airqloud_id)
        if not airqloud_data:
            return None
        
        # Calculate date range (past N days from yesterday)
        end_date = datetime.now(timezone.utc) - timedelta(days=1)  # Start from yesterday
        start_date = end_date - timedelta(days=days-1)    # Adjust to get exactly N days
        
        # Get all devices in the airqloud
        devices = self.get_devices(db, airqloud_id=airqloud_id, include_inactive=False)
        device_ids = [device.id for device in devices]
        
        # Create device info map for names
        device_info_map = {device.id: {"name": device.name, "device_id": device.id} for device in devices}
        logger.info(f"Found {len(device_ids)} devices in airqloud {airqloud_id}")
        
        # Optionally ensure performance data exists (fetch missing data)
        if fetch_missing:
            from app.utils.performance_fetcher import ensure_airqloud_performance_data
            logger.info(f"Ensuring performance data for airqloud {airqloud_id} from {start_date} to {end_date}")
            ensure_airqloud_performance_data(db, airqloud_id, start_date, end_date)
        
        # Fetch airqloud performance
        performance_records = airqloud_performance.get_performance_by_airqloud(
            db,
            airqloud_id=airqloud_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Convert airqloud performance records to compact arrays
        freq_list = [sanitize_float(p.freq) for p in performance_records]
        error_margin_list = [sanitize_float(p.error_margin) for p in performance_records]
        timestamp_list = [p.timestamp for p in performance_records]
        
        # Fetch device performance for all devices in the airqloud
        device_performance_data = []
        if device_ids:
            if fetch_missing:
                from app.utils.performance_fetcher import ensure_multiple_devices_performance_data
                # Ensure device data exists
                ensure_multiple_devices_performance_data(db, device_ids, start_date, end_date)
            
            # Get device performance records
            device_performance_records = device_performance.get_performance_by_devices(
                db,
                device_ids=device_ids,
                start_date=start_date,
                end_date=end_date
            )
            
            # Group device performance by device_id and convert to compact format
            device_performance_map = {}
            for p in device_performance_records:
                if p.device_id not in device_performance_map:
                    device_performance_map[p.device_id] = {
                        "freq": [],
                        "error_margin": [],
                        "timestamp": []
                    }
                device_performance_map[p.device_id]["freq"].append(sanitize_float(p.freq))
                device_performance_map[p.device_id]["error_margin"].append(sanitize_float(p.error_margin))
                device_performance_map[p.device_id]["timestamp"].append(p.timestamp)
            
            # Convert to list format with device names
            device_performance_data = [
                {
                    "device_id": device_id,
                    "device_name": device_info_map.get(device_id, {}).get("name", "Unknown"),
                    "performance": performance_data
                }
                for device_id, performance_data in device_performance_map.items()
            ]
        
        # Add performance data to airqloud in compact format
        airqloud_data["freq"] = freq_list
        airqloud_data["error_margin"] = error_margin_list
        airqloud_data["timestamp"] = timestamp_list
        airqloud_data["device_performance"] = device_performance_data
        logger.info(f"Retrieved {len(freq_list)} airqloud performance records and {len(device_performance_data)} devices with performance data for airqloud {airqloud_id}")
        
        return airqloud_data
    
    def get_all_with_performance(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        country: Optional[str] = None,
        search: Optional[str] = None,
        days: int = 30,
        fetch_missing: bool = True
    ) -> List[Dict[str, Any]]:
        """Get all AirQlouds with device counts and performance data for the past N days
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            country: Filter by country
            search: Search term
            days: Number of days of performance history
            fetch_missing: If True, fetch missing data synchronously. If False, return current data only.
        """
        from app.crud.performance import airqloud_performance
        
        # Get all airqlouds with device counts (now includes search)
        airqlouds = self.get_all_with_device_counts(
            db,
            skip=skip,
            limit=limit,
            country=country,
            search=search
        )
        
        # Calculate date range (past N days from yesterday)
        end_date = datetime.now(timezone.utc) - timedelta(days=1)  # Start from yesterday
        start_date = end_date - timedelta(days=days-1)    # Adjust to get exactly N days
        
        # Only fetch performance data for active airqlouds
        active_airqloud_ids = [aq["id"] for aq in airqlouds if aq.get("is_active") == True]
        
        if not airqlouds:
            return []
        
        # Optionally ensure performance data exists for active airqlouds only
        if fetch_missing and active_airqloud_ids:
            from app.utils.performance_fetcher import ensure_multiple_airqlouds_performance_data
            logger.info(f"Ensuring performance data for {len(active_airqloud_ids)} active airqlouds")
            ensure_multiple_airqlouds_performance_data(db, active_airqloud_ids, start_date, end_date)
        
        # Get performance data only for active airqlouds
        all_performance_records = []
        if active_airqloud_ids:
            all_performance_records = airqloud_performance.get_performance_by_airqlouds(
                db,
                airqloud_ids=active_airqloud_ids,
                start_date=start_date,
                end_date=end_date
            )
        
        # Group performance records by airqloud_id and extract into arrays
        performance_by_airqloud = {}
        for p in all_performance_records:
            if p.airqloud_id not in performance_by_airqloud:
                performance_by_airqloud[p.airqloud_id] = {
                    "freq": [],
                    "error_margin": [],
                    "timestamp": []
                }
            performance_by_airqloud[p.airqloud_id]["freq"].append(sanitize_float(p.freq))
            performance_by_airqloud[p.airqloud_id]["error_margin"].append(sanitize_float(p.error_margin))
            performance_by_airqloud[p.airqloud_id]["timestamp"].append(p.timestamp)
        
        # Add performance data arrays to each airqloud
        results = []
        for airqloud in airqlouds:
            perf_data = performance_by_airqloud.get(airqloud["id"], {
                "freq": [],
                "error_margin": [],
                "timestamp": []
            })
            airqloud["freq"] = perf_data["freq"]
            airqloud["error_margin"] = perf_data["error_margin"]
            airqloud["timestamp"] = perf_data["timestamp"]
            results.append(airqloud)
        
        logger.info(f"Retrieved {len(results)} airqlouds with performance data")
        return results

    def create_single_airqloud_with_devices_csv(
        self,
        db: Session,
        *,
        airqloud_name: str,
        airqloud_country: Optional[str] = None,
        airqloud_visibility: Optional[bool] = None,
        devices_data: List[Dict[str, Any]],
        column_mappings: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Create a single AirQloud and add all devices from CSV to it.
        
        Args:
            airqloud_name: Name of the AirQloud to create
            airqloud_country: Country of the AirQloud (optional)
            airqloud_visibility: Visibility of the AirQloud (optional)
            devices_data: List of device data from CSV
            column_mappings: Mapping of CSV columns to device fields
                e.g., {"read": "read_key", "device": "device_id", "channel": "channel_id"}
        
        Returns:
            Dictionary with created AirQloud, added devices, errors, and summary
        """
        from app.crud.device import device
        from datetime import datetime
        import string
        import random
        
        try:
            # Generate unique ID for the AirQloud
            while True:
                id_chars = string.ascii_lowercase + string.digits
                airqloud_id = 'aq_' + ''.join(random.choices(id_chars, k=10))
                existing = self.get(db, id=airqloud_id)
                if not existing:
                    break
            
            # Create AirQloud
            airqloud_create_data = {
                'id': airqloud_id,
                'name': airqloud_name,
                'country': airqloud_country,
                'visibility': airqloud_visibility,
                'number_of_devices': 0,  # Will be updated after adding devices
                'created_at': datetime.now(timezone.utc)
            }
            
            airqloud = AirQloud(**airqloud_create_data)
            db.add(airqloud)
            db.commit()
            db.refresh(airqloud)
            
            # Process devices from CSV
            devices_added = []
            device_errors = []
            device_count = 0
            
            for row_idx, device_row in enumerate(devices_data):
                try:
                    found_device = None
                    search_attempts = []
                    
                    # Try to find device using different identifiers based on column mappings
                    for csv_column, device_field in column_mappings.items():
                        if csv_column in device_row and device_row[csv_column]:
                            value = str(device_row[csv_column]).strip()
                            if not value:
                                continue
                            
                            search_attempts.append(f"{device_field}: {value}")
                            
                            if device_field == "device_id":
                                found_device = device.get_by_device_id(db, device_id=value)
                            elif device_field == "read_key":
                                found_device = device.get_by_read_key(db, read_key=value)
                            elif device_field == "channel_id":
                                try:
                                    channel_id_int = int(value)
                                    found_device = device.get_by_channel_id(db, channel_id=channel_id_int)
                                except ValueError:
                                    continue
                            
                            if found_device:
                                break
                    
                    if found_device:
                        # Check if device already exists in dim_airqloud_device table (any AirQloud)
                        existing_device_entry = db.exec(
                            select(AirQloudDevice)
                            .where(AirQloudDevice.id == found_device.device_id)
                        ).first()
                        
                        if existing_device_entry:
                            if existing_device_entry.cohort_id == airqloud.id:
                                # Device already in this AirQloud
                                device_errors.append({
                                    "row": row_idx + 1,
                                    "device_data": device_row,
                                    "error": f"Device {found_device.device_id} already exists in this AirQloud",
                                    "search_attempts": search_attempts
                                })
                            else:
                                # Device exists in another AirQloud - update it to belong to new AirQloud
                                old_cohort = existing_device_entry.cohort_id
                                existing_device_entry.cohort_id = airqloud.id
                                existing_device_entry.long_name = f"{found_device.device_name} - {airqloud.name}"
                                existing_device_entry.device_number = device_count + 1
                                existing_device_entry.is_active = True
                                existing_device_entry.is_online = found_device.is_online
                                existing_device_entry.status = found_device.status
                                existing_device_entry.network = found_device.network
                                db.add(existing_device_entry)
                                device_count += 1
                                
                                devices_added.append({
                                    "row": row_idx + 1,
                                    "device_id": found_device.device_id,
                                    "device_name": found_device.device_name,
                                    "search_used": search_attempts[-1] if search_attempts else "unknown",
                                    "status": found_device.status,
                                    "network": found_device.network,
                                    "note": f"Moved from AirQloud {old_cohort}"
                                })
                        else:
                            # Create new AirQloud-Device relationship
                            airqloud_device = AirQloudDevice(
                                id=found_device.device_id,
                                cohort_id=airqloud.id,
                                name=found_device.device_name,
                                long_name=f"{found_device.device_name} - {airqloud.name}",
                                device_number=device_count + 1,
                                is_active=True,
                                is_online=found_device.is_online,
                                status=found_device.status,
                                network=found_device.network,
                                created_at=datetime.now(timezone.utc)
                            )
                            db.add(airqloud_device)
                            device_count += 1
                            
                            devices_added.append({
                                "row": row_idx + 1,
                                "device_id": found_device.device_id,
                                "device_name": found_device.device_name,
                                "search_used": search_attempts[-1] if search_attempts else "unknown",
                                "status": found_device.status,
                                "network": found_device.network
                            })
                    else:
                        device_errors.append({
                            "row": row_idx + 1,
                            "device_data": device_row,
                            "error": "Device not found with any of the provided identifiers",
                            "search_attempts": search_attempts
                        })
                
                except Exception as e:
                    device_errors.append({
                        "row": row_idx + 1,
                        "device_data": device_row,
                        "error": str(e),
                        "search_attempts": search_attempts if 'search_attempts' in locals() else []
                    })
            
            # Update device count
            airqloud.number_of_devices = device_count
            db.add(airqloud)
            db.commit()
            db.refresh(airqloud)
            
            # Format AirQloud response
            airqloud_response = {
                "id": airqloud.id,
                "name": airqloud.name,
                "country": airqloud.country,
                "visibility": airqloud.visibility,
                "is_active": airqloud.is_active,
                "number_of_devices": device_count,
                "created_at": airqloud.created_at
            }
            
            return {
                "airqloud": airqloud_response,
                "devices_added": devices_added,
                "device_errors": device_errors,
                "summary": {
                    "total_devices_processed": len(devices_data),
                    "devices_added": len(devices_added),
                    "devices_failed": len(device_errors),
                    "success_rate": round((len(devices_added) / len(devices_data)) * 100, 2) if len(devices_data) > 0 else 0,
                    "airqloud_created": True
                }
            }
        
        except Exception as e:
            logger.error(f"Error creating AirQloud with devices: {e}")
            return {
                "airqloud": None,
                "devices_added": [],
                "device_errors": [],
                "summary": {
                    "total_devices_processed": len(devices_data) if 'devices_data' in locals() else 0,
                    "devices_added": 0,
                    "devices_failed": len(devices_data) if 'devices_data' in locals() else 0,
                    "success_rate": 0,
                    "airqloud_created": False,
                    "error": str(e)
                }
            }


# Create instance
airqloud = CRUDAirQloud(AirQloud)
