"""
Cronjob to update airqloud (cohort) table from Platform API
This script fetches cohorts from the Platform API and updates the beacon database.
It compares API total vs DB count and syncs when there are differences.
"""
import sys
import os
from pathlib import Path

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlmodel import Session, select, func
from app.configs.database import SessionLocal
from app.configs.settings import settings
from app.models.airqloud import AirQloud, AirQloudDevice
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Platform API configuration
PLATFORM_BASE_URL = settings.PLATFORM_BASE_URL
COHORTS_ENDPOINT = f"{PLATFORM_BASE_URL}/devices/cohorts"
DEFAULT_TENANT = "airqo"
PAGE_LIMIT = 30   # Number of cohorts per page
API_TOKEN = settings.TOKEN

if not API_TOKEN:
    logger.warning("TOKEN not found in environment variables. API requests may fail.")


class AirQloudUpdater:
    """Handle airqloud (cohort) updates from Platform API"""
    
    def __init__(self, session: Session):
        """
        Initialize the AirQloudUpdater.
        
        Args:
            session: SQLModel database session
        """
        self.session = session
        self.stats = {
            'total_fetched': 0,
            'new_airqlouds': 0,
            'updated_airqlouds': 0,
            'new_devices': 0,
            'updated_devices': 0,
            'deactivated_devices': 0,
            'errors': 0
        }
        self.headers = {
            'Authorization': API_TOKEN,
            'Content-Type': 'application/json'
        }
    
    def fetch_cohorts_from_platform(self, tenant: str = DEFAULT_TENANT) -> List[Dict[str, Any]]:
        """
        Fetch all cohorts from Platform API with pagination
        
        Args:
            tenant: The tenant name (default: airqo)
            
        Returns:
            List of cohort dictionaries
        """
        all_cohorts = []
        skip = 0
        
        try:
            while True:
                params = {
                    'tenant': tenant,
                    'limit': PAGE_LIMIT,
                    'skip': skip
                }
                
                logger.info(f"Fetching cohorts: skip={skip}, limit={PAGE_LIMIT}")
                response = requests.get(COHORTS_ENDPOINT, params=params, headers=self.headers, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                
                if not data.get('success'):
                    logger.error(f"API returned unsuccessful response: {data.get('message')}")
                    break
                
                cohorts = data.get('cohorts', [])
                if not cohorts:
                    break
                
                all_cohorts.extend(cohorts)
                
                meta = data.get('meta', {})
                total = meta.get('total', 0)
                
                logger.info(f"Fetched {len(cohorts)} cohorts (Total: {len(all_cohorts)}/{total})")
                
                # Check if we have more pages
                if len(all_cohorts) >= total:
                    break
                
                skip += PAGE_LIMIT
                
        except requests.RequestException as e:
            logger.error(f"Error fetching cohorts from platform: {e}")
            raise
        
        self.stats['total_fetched'] = len(all_cohorts)
        logger.info(f"Successfully fetched {len(all_cohorts)} cohorts from platform")
        return all_cohorts
    
    def get_api_total_count(self, tenant: str = DEFAULT_TENANT) -> int:
        """
        Get total count of cohorts from API without fetching all data
        
        Args:
            tenant: The tenant name (default: airqo)
            
        Returns:
            Total count from API meta
        """
        try:
            params = {
                'tenant': tenant,
                'limit': 1,
                'skip': 0
            }
            
            response = requests.get(COHORTS_ENDPOINT, params=params, headers=self.headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get('success'):
                logger.error(f"API returned unsuccessful response: {data.get('message')}")
                return 0
            
            meta = data.get('meta', {})
            return meta.get('total', 0)
            
        except requests.RequestException as e:
            logger.error(f"Error getting cohort count from platform: {e}")
            return 0
    
    def get_database_airqloud_count(self) -> int:
        """Get current count of airqlouds in database"""
        try:
            count = self.session.exec(select(func.count(AirQloud.id))).one()
            return count
        except Exception as e:
            logger.error(f"Error getting airqloud count: {e}")
            return 0
    
    def parse_cohort_from_api(self, api_cohort: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse cohort data from API format to database format
        
        Args:
            api_cohort: Cohort dictionary from Platform API
            
        Returns:
            Dictionary with fields matching AirQloud model
        """
        # Parse datetime fields
        created_at = None
        if api_cohort.get('createdAt'):
            try:
                created_at = datetime.fromisoformat(api_cohort['createdAt'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Could not parse createdAt for cohort {api_cohort.get('_id')}")
        
        # Build airqloud data
        airqloud_data = {
            'id': api_cohort.get('_id'),
            'name': api_cohort.get('name'),
            'network': api_cohort.get('network'),
            'visibility': api_cohort.get('visibility', True),
            'is_active': False,  # Default to inactive, can be activated via API
            'number_of_devices': api_cohort.get('numberOfDevices', 0),
            'created_at': created_at or datetime.now(timezone.utc),
        }
        
        return airqloud_data
    
    def parse_device_from_api(self, api_device: Dict[str, Any], cohort_id: str) -> Dict[str, Any]:
        """
        Parse device data from cohort API format to database format
        
        Args:
            api_device: Device dictionary from Platform API cohort
            cohort_id: The cohort/airqloud ID this device belongs to
            
        Returns:
            Dictionary with fields matching AirQloudDevice model
        """
        # Parse datetime fields
        created_at = None
        if api_device.get('createdAt'):
            try:
                created_at = datetime.fromisoformat(api_device['createdAt'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Could not parse createdAt for device {api_device.get('_id')}")
        
        last_raw_data = None
        if api_device.get('lastRawData'):
            try:
                last_raw_data = datetime.fromisoformat(api_device['lastRawData'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Could not parse lastRawData for device {api_device.get('_id')}")
        
        # Build device data
        device_data = {
            'id': api_device.get('_id'),
            'cohort_id': cohort_id,
            'name': api_device.get('name'),
            'long_name': api_device.get('long_name'),
            'device_number': api_device.get('device_number'),
            'is_active': api_device.get('isActive', True),
            'is_online': api_device.get('isOnline', False),
            'status': api_device.get('status', 'unknown'),
            'network': api_device.get('network'),
            'raw_online_status': api_device.get('rawOnlineStatus'),
            'last_raw_data': last_raw_data,
            'created_at': created_at or datetime.now(timezone.utc),
        }
        
        return device_data
    
    def get_airqloud_by_id(self, airqloud_id: str) -> Optional[AirQloud]:
        """Get an airqloud by ID"""
        try:
            statement = select(AirQloud).where(AirQloud.id == airqloud_id)
            return self.session.exec(statement).first()
        except Exception as e:
            logger.error(f"Error getting airqloud {airqloud_id}: {e}")
            return None
    
    def get_airqloud_device_by_id_and_cohort(self, device_id: str, cohort_id: str) -> Optional[AirQloudDevice]:
        """Get an airqloud device by ID and cohort_id (composite key)"""
        try:
            statement = select(AirQloudDevice).where(
                AirQloudDevice.id == device_id,
                AirQloudDevice.cohort_id == cohort_id
            )
            return self.session.exec(statement).first()
        except Exception as e:
            logger.error(f"Error getting airqloud device {device_id} in cohort {cohort_id}: {e}")
            return None
    
    def update_or_create_airqloud(self, airqloud_data: Dict[str, Any]) -> Optional[AirQloud]:
        """
        Update existing airqloud or create new one.
        Note: country and is_active fields are preserved if already set (user-managed fields)
        
        Args:
            airqloud_data: Parsed airqloud data from API
            
        Returns:
            The updated or created AirQloud, or None on error
        """
        airqloud_id = airqloud_data.get('id')
        if not airqloud_id:
            logger.warning("Airqloud data missing id, skipping")
            self.stats['errors'] += 1
            return None
        
        try:
            existing_airqloud = self.get_airqloud_by_id(airqloud_id)
            
            if existing_airqloud:
                # Update existing airqloud - preserve country and is_active fields (user-managed)
                update_fields = ['name', 'network', 'visibility', 'number_of_devices']
                
                for field in update_fields:
                    if field in airqloud_data and airqloud_data[field] is not None:
                        setattr(existing_airqloud, field, airqloud_data[field])
                
                self.session.add(existing_airqloud)
                self.stats['updated_airqlouds'] += 1
                logger.debug(f"Updated airqloud: {airqloud_id}")
                return existing_airqloud
            else:
                # Create new airqloud
                new_airqloud = AirQloud(**airqloud_data)
                self.session.add(new_airqloud)
                self.stats['new_airqlouds'] += 1
                logger.info(f"Created new airqloud: {airqloud_id} ({airqloud_data.get('name')})")
                return new_airqloud
        
        except Exception as e:
            logger.error(f"Error updating/creating airqloud {airqloud_id}: {e}")
            self.session.rollback()
            self.stats['errors'] += 1
            return None
    
    def update_or_create_device(self, device_data: Dict[str, Any]) -> Optional[AirQloudDevice]:
        """
        Update existing device or create new one.
        Uses composite key (id + cohort_id) to allow same device in multiple cohorts.
        
        Args:
            device_data: Parsed device data from API
            
        Returns:
            The updated or created AirQloudDevice, or None on error
        """
        device_id = device_data.get('id')
        cohort_id = device_data.get('cohort_id')
        
        if not device_id:
            logger.warning("Device data missing id, skipping")
            self.stats['errors'] += 1
            return None
        
        if not cohort_id:
            logger.warning(f"Device {device_id} missing cohort_id, skipping")
            self.stats['errors'] += 1
            return None
        
        try:
            # Look up by composite key (id + cohort_id)
            existing_device = self.get_airqloud_device_by_id_and_cohort(device_id, cohort_id)
            
            if existing_device:
                # Update existing device
                for field, value in device_data.items():
                    if field not in ('id', 'cohort_id') and value is not None:
                        setattr(existing_device, field, value)
                
                self.session.add(existing_device)
                self.stats['updated_devices'] += 1
                logger.debug(f"Updated device: {device_id} in cohort {cohort_id}")
                return existing_device
            else:
                # Create new device entry for this cohort
                new_device = AirQloudDevice(**device_data)
                self.session.add(new_device)
                self.stats['new_devices'] += 1
                logger.debug(f"Created new device: {device_id} in cohort {cohort_id}")
                return new_device
        
        except Exception as e:
            logger.error(f"Error updating/creating device {device_id} in cohort {cohort_id}: {e}")
            self.session.rollback()
            self.stats['errors'] += 1
            return None
    
    def deactivate_removed_devices(self, cohort_id: str, current_device_ids: set) -> None:
        """
        Soft delete devices that are no longer in the cohort
        
        Args:
            cohort_id: The cohort/airqloud ID
            current_device_ids: Set of device IDs currently in the cohort from API
        """
        try:
            # Get all active devices for this cohort
            statement = select(AirQloudDevice).where(
                AirQloudDevice.cohort_id == cohort_id,
                AirQloudDevice.is_active == True
            )
            existing_devices = self.session.exec(statement).all()
            
            for device in existing_devices:
                if device.id not in current_device_ids:
                    device.is_active = False
                    self.session.add(device)
                    self.stats['deactivated_devices'] += 1
                    logger.debug(f"Deactivated device {device.id} from cohort {cohort_id}")
                    
        except Exception as e:
            logger.error(f"Error deactivating removed devices for cohort {cohort_id}: {e}")
    
    def process_cohort(self, api_cohort: Dict[str, Any]) -> None:
        """
        Process a single cohort - update/create airqloud and its devices
        
        Args:
            api_cohort: Cohort dictionary from Platform API
        """
        cohort_id = api_cohort.get('_id')
        if not cohort_id:
            logger.warning("Cohort missing _id, skipping")
            self.stats['errors'] += 1
            return
        
        try:
            # Update/create the airqloud
            airqloud_data = self.parse_cohort_from_api(api_cohort)
            airqloud = self.update_or_create_airqloud(airqloud_data)
            
            if not airqloud:
                return
            
            # Process devices
            api_devices = api_cohort.get('devices', [])
            current_device_ids = set()
            
            for api_device in api_devices:
                device_id = api_device.get('_id')
                if device_id:
                    current_device_ids.add(device_id)
                    device_data = self.parse_device_from_api(api_device, cohort_id)
                    self.update_or_create_device(device_data)
            
            # Deactivate devices no longer in the cohort
            self.deactivate_removed_devices(cohort_id, current_device_ids)
            
            # Commit after each cohort
            self.session.commit()
            logger.debug(f"Committed cohort {cohort_id}")
            
        except Exception as e:
            logger.error(f"Error processing cohort {cohort_id}: {e}")
            self.session.rollback()
            self.stats['errors'] += 1
    
    def run(self, force_sync: bool = False) -> Dict[str, Any]:
        """
        Main execution method
        
        Args:
            force_sync: If True, sync regardless of count comparison
            
        Returns:
            Dictionary with execution statistics
        """
        logger.info("=" * 80)
        logger.info("Starting airqloud (cohort) update job")
        logger.info("=" * 80)
        
        try:
            # Get current counts
            db_count = self.get_database_airqloud_count()
            api_count = self.get_api_total_count()
            
            logger.info(f"Database airqlouds: {db_count}, API cohorts: {api_count}")
            
            # Check if sync is needed
            if not force_sync and db_count == api_count and db_count > 0:
                logger.info("Counts match - performing quick sync to update existing records")
            else:
                if db_count != api_count:
                    logger.info(f"Count mismatch detected (diff: {api_count - db_count})")
                elif force_sync:
                    logger.info("Force sync requested")
            
            # Always fetch and sync to get updated device data
            api_cohorts = self.fetch_cohorts_from_platform()
            
            logger.info(f"Processing {len(api_cohorts)} cohorts...")
            
            for i, api_cohort in enumerate(api_cohorts, 1):
                self.process_cohort(api_cohort)
                if i % 10 == 0:
                    logger.info(f"Processed {i}/{len(api_cohorts)} cohorts")
            
            # Final commit
            self.session.commit()
            
            # Get final count
            db_count_after = self.get_database_airqloud_count()
            
            # Prepare results
            self.stats['db_count_before'] = db_count
            self.stats['db_count_after'] = db_count_after
            self.stats['api_count'] = api_count
            self.stats['success'] = True
            
            logger.info("=" * 80)
            logger.info("Airqloud update job completed successfully")
            logger.info("Statistics:")
            logger.info(f"  - Cohorts fetched from API: {self.stats['total_fetched']}")
            logger.info(f"  - Database count before: {db_count}")
            logger.info(f"  - Database count after: {db_count_after}")
            logger.info(f"  - New airqlouds created: {self.stats['new_airqlouds']}")
            logger.info(f"  - Airqlouds updated: {self.stats['updated_airqlouds']}")
            logger.info(f"  - New devices added: {self.stats['new_devices']}")
            logger.info(f"  - Devices updated: {self.stats['updated_devices']}")
            logger.info(f"  - Devices deactivated: {self.stats['deactivated_devices']}")
            logger.info(f"  - Errors: {self.stats['errors']}")
            logger.info("=" * 80)
            
            return self.stats
            
        except Exception as e:
            logger.error(f"Airqloud update job failed: {e}", exc_info=True)
            self.stats['success'] = False
            self.stats['error'] = str(e)
            return self.stats


def main():
    """Main entry point for the cronjob"""
    session = SessionLocal()
    try:
        updater = AirQloudUpdater(session)
        results = updater.run()
        
        # Exit with error code if job failed
        if not results.get('success'):
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Fatal error in airqloud update job: {e}", exc_info=True)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
