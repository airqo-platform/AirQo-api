"""
Cronjob to update device table from Platform API
This script fetches devices from the Platform API and updates the beacon database.
It prioritizes updating null values for read_key and channel_id.
"""
import sys
import os
from pathlib import Path
import csv

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
from sqlmodel import Session, select, func, or_, and_
from app.configs.database import SessionLocal
from app.models.device import Device
from app.crud.device import CRUDDevice
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import settings for Platform API configuration
from app.configs.settings import settings

# Platform API configuration
PLATFORM_BASE_URL = settings.PLATFORM_BASE_URL
DEVICES_ENDPOINT = f"{PLATFORM_BASE_URL}/devices/summary"
DECRYPT_ENDPOINT = f"{PLATFORM_BASE_URL}/devices/decrypt/bulk"
DEFAULT_TENANT = "airqo"
PAGE_LIMIT = 50   # Number of devices per page (matches batch size)
BATCH_SIZE = 50   # Process devices in batches of 50
API_TOKEN = settings.TOKEN

if not API_TOKEN:
    logger.warning("TOKEN not found in environment variables. API requests may fail.")


class DeviceUpdater:
    """Handle device updates from Platform API"""
    
    def __init__(self, session: Session, force_update_keys: bool = False):
        """
        Initialize the DeviceUpdater.
        
        Args:
            session: SQLModel database session
            force_update_keys: If True, allows updating read_key, write_key, and channel_id
                              even when they already have values. Use this for key rotation
                              or data correction scenarios. Default is False (set-once behavior).
        """
        self.session = session
        self.force_update_keys = force_update_keys
        self.crud = CRUDDevice(Device)
        self.stats = {
            'total_fetched': 0,
            'new_devices': 0,
            'updated_devices': 0,
            'null_updates': 0,
            'key_updates': 0,
            'decrypted_read_keys': 0,
            'decrypted_write_keys': 0,
            'batches_processed': 0,
            'devices_missing_keys': 0,
            'errors': 0
        }
        self.headers = {
            'Authorization': API_TOKEN,
            'Content-Type': 'application/json'
        }
    
    def fetch_devices_from_platform(self, tenant: str = DEFAULT_TENANT) -> List[Dict[str, Any]]:
        """
        Fetch all devices from Platform API with pagination
        
        Args:
            tenant: The tenant name (default: airqo)
            
        Returns:
            List of device dictionaries
        """
        all_devices = []
        skip = 0
        
        try:
            while True:
                params = {
                    'tenant': tenant,
                    'detailLevel': 'summary',
                    'limit': PAGE_LIMIT,
                    'skip': skip
                }
                
                logger.info(f"Fetching devices: skip={skip}, limit={PAGE_LIMIT}")
                response = requests.get(DEVICES_ENDPOINT, params=params, headers=self.headers, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                
                if not data.get('success'):
                    logger.error(f"API returned unsuccessful response: {data.get('message')}")
                    break
                
                devices = data.get('devices', [])
                if not devices:
                    break
                
                all_devices.extend(devices)
                
                meta = data.get('meta', {})
                total = meta.get('total', 0)
                
                logger.info(f"Fetched {len(devices)} devices (Total in DB: {len(all_devices)}/{total})")
                
                # Check if we have more pages
                if not meta.get('nextPage') or len(all_devices) >= total:
                    break
                
                skip += PAGE_LIMIT
                
        except requests.RequestException as e:
            logger.error(f"Error fetching devices from platform: {e}")
            raise
        
        self.stats['total_fetched'] = len(all_devices)
        logger.info(f"Successfully fetched {len(all_devices)} devices from platform")
        return all_devices
    
    def parse_device_from_api(self, api_device: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse device data from API format to database format
        
        Args:
            api_device: Device dictionary from Platform API
            
        Returns:
            Dictionary with fields matching Device model
        """
        # Extract nested fields safely
        online_status = api_device.get('onlineStatusAccuracy', {})
        latest_deployment = api_device.get('latest_deployment_activity')
        
        # Parse datetime fields
        created_at = None
        if api_device.get('createdAt'):
            try:
                created_at = datetime.fromisoformat(api_device['createdAt'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Could not parse createdAt for device {api_device.get('_id')}")
        
        last_updated = None
        if online_status.get('lastUpdate'):
            try:
                last_updated = datetime.fromisoformat(online_status['lastUpdate'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Could not parse lastUpdate for device {api_device.get('_id')}")
        
        next_maintenance = None
        if latest_deployment and latest_deployment.get('nextMaintenance'):
            try:
                next_maintenance = datetime.fromisoformat(latest_deployment['nextMaintenance'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Could not parse nextMaintenance for device {api_device.get('_id')}")
        
        # Build device data
        device_data = {
            'device_id': api_device.get('_id'),
            'device_name': api_device.get('name'),
            'site_id': api_device.get('site', {}).get('_id') if isinstance(api_device.get('site'), dict) else None,
            'network': api_device.get('network'),
            'category': api_device.get('category'),
            'is_active': api_device.get('isActive', False),
            'status': api_device.get('status', 'unknown'),
            'is_online': api_device.get('isOnline', False),
            'mount_type': api_device.get('mountType'),
            'power_type': api_device.get('powerType'),
            'height': api_device.get('height'),
            'next_maintenance': next_maintenance,
            'last_updated': last_updated or datetime.now(timezone.utc),
            'created_at': created_at or datetime.now(timezone.utc),
            'updated_at': last_updated or datetime.now(timezone.utc),
            'read_key': api_device.get('readKey'),
            'write_key': api_device.get('writeKey'),
            'channel_id': api_device.get('device_number'),
            # network_id and firmware fields are from custom endpoints (not updated here)
        }
        
        return device_data
    
    def decrypt_keys(self, devices_with_encrypted_keys: List[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
        """
        Decrypt read and write keys using the bulk decrypt endpoint
        
        Args:
            devices_with_encrypted_keys: List of devices with encrypted keys
            
        Returns:
            Dictionary mapping device_number to {'read_key': decrypted_read_key, 'write_key': decrypted_write_key}
        """
        if not devices_with_encrypted_keys:
            logger.info("No encrypted keys to decrypt")
            return {}
        
        # Prepare payload for bulk decrypt - separate read and write keys
        decrypt_payload = []
        for device in devices_with_encrypted_keys:
            device_number = device.get('device_number')
            
            # Add read key if present
            if device.get('encrypted_read_key') and device_number:
                decrypt_payload.append({
                    'encrypted_key': device['encrypted_read_key'],
                    'device_number': device_number,
                    'key_type': 'read'
                })
            
            # Add write key if present
            if device.get('encrypted_write_key') and device_number:
                decrypt_payload.append({
                    'encrypted_key': device['encrypted_write_key'],
                    'device_number': device_number,
                    'key_type': 'write'
                })
        
        if not decrypt_payload:
            logger.info("No valid encrypted keys to decrypt")
            return {}
        
        logger.info(f"Decrypting {len(decrypt_payload)} keys (read + write)...")
        
        try:
            response = requests.post(
                DECRYPT_ENDPOINT,
                json=decrypt_payload,
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            if not data.get('success'):
                logger.error(f"Decrypt API returned unsuccessful response: {data.get('message')}")
                return {}
            
            # Map device_number to decrypted keys
            decrypted_mapping = {}
            decrypted_keys = data.get('decrypted_keys', [])
            
            for item in decrypted_keys:
                device_number = item.get('device_number')
                decrypted_key = item.get('decrypted_key')
                key_type = item.get('key_type', 'read')  # Default to read for backward compatibility
                
                if device_number and decrypted_key:
                    # Convert device_number to int for consistency
                    try:
                        device_num_int = int(device_number)
                        if device_num_int not in decrypted_mapping:
                            decrypted_mapping[device_num_int] = {}
                        
                        decrypted_mapping[device_num_int][f'{key_type}_key'] = decrypted_key
                        
                        if key_type == 'read':
                            self.stats['decrypted_read_keys'] += 1
                        elif key_type == 'write':
                            self.stats['decrypted_write_keys'] += 1
                            
                    except (ValueError, TypeError):
                        logger.warning(f"Could not convert device_number to int: {device_number}")
            
            logger.info(f"Successfully decrypted keys for {len(decrypted_mapping)} devices")
            return decrypted_mapping
            
        except requests.RequestException as e:
            logger.error(f"Error decrypting keys: {e}")
            # Fallback: If the new API format fails, try the old format for read keys only
            logger.info("Attempting fallback decryption for read keys only...")
            return self._decrypt_keys_fallback(devices_with_encrypted_keys)
    
    def _decrypt_keys_fallback(self, devices_with_encrypted_keys: List[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
        """
        Fallback method using the original API format (read keys only)
        """
        decrypt_payload = []
        for device in devices_with_encrypted_keys:
            encrypted_read_key = device.get('encrypted_read_key')
            device_number = device.get('device_number')
            
            if encrypted_read_key and device_number:
                decrypt_payload.append({
                    'encrypted_key': encrypted_read_key,
                    'device_number': device_number
                })
        
        if not decrypt_payload:
            return {}
        
        try:
            response = requests.post(
                DECRYPT_ENDPOINT,
                json=decrypt_payload,
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            if not data.get('success'):
                logger.error(f"Fallback decrypt API also failed: {data.get('message')}")
                return {}
            
            # Map device_number to read keys only
            decrypted_mapping = {}
            decrypted_keys = data.get('decrypted_keys', [])
            
            for item in decrypted_keys:
                device_number = item.get('device_number')
                decrypted_key = item.get('decrypted_key')
                
                if device_number and decrypted_key:
                    try:
                        device_num_int = int(device_number)
                        decrypted_mapping[device_num_int] = {'read_key': decrypted_key}
                        self.stats['decrypted_read_keys'] += 1
                    except (ValueError, TypeError):
                        logger.warning(f"Could not convert device_number to int: {device_number}")
            
            logger.info(f"Fallback: Successfully decrypted {len(decrypted_mapping)} read keys")
            return decrypted_mapping
            
        except requests.RequestException as e:
            logger.error(f"Fallback decryption also failed: {e}")
            return {}
    
    def should_update_field(self, current_value: Any, new_value: Any, field_name: str) -> bool:
        """
        Determine if a field should be updated.
        
        Key fields (read_key, write_key, channel_id) follow a "set-once" policy by default:
        - They are only populated when the current value is None
        - Once set, they are NOT updated during normal sync operations
        - This preserves manually corrected data and prevents accidental overwrites
        
        To enable key updates (for key rotation or data correction), initialize
        DeviceUpdater with force_update_keys=True.
        
        Args:
            current_value: Current value in database
            new_value: New value from API
            field_name: Name of the field
            
        Returns:
            True if field should be updated
        """
        # Always update if current value is None and new value is not None
        if current_value is None and new_value is not None:
            return True
        
        # For key fields, only update if force_update_keys is enabled
        if field_name in ['read_key', 'write_key', 'channel_id']:
            if self.force_update_keys and new_value is not None and current_value != new_value:
                return True
            return False
        
        # For other fields, update if new value is different and not None
        if new_value is not None and current_value != new_value:
            return True
        
        return False
    
    def update_or_create_device(self, device_data: Dict[str, Any]) -> None:
        """
        Update existing device or create new one
        
        Args:
            device_data: Parsed device data from API
        """
        device_id = device_data.get('device_id')
        if not device_id:
            logger.warning("Device data missing device_id, skipping")
            self.stats['errors'] += 1
            return
        
        try:
            # Check if device exists
            existing_device = self.crud.get_by_device_id(self.session, device_id=device_id)
            
            if existing_device:
                # Update existing device
                update_data = {}
                null_field_updated = False
                key_field_updated = False
                
                for field, new_value in device_data.items():
                    if field in ['device_id', 'device_key']:  # Skip primary/unique keys
                        continue
                    
                    current_value = getattr(existing_device, field, None)
                    
                    if self.should_update_field(current_value, new_value, field):
                        update_data[field] = new_value
                        
                        # Track if we're updating a previously null value
                        if current_value is None and new_value is not None:
                            null_field_updated = True
                            logger.info(f"Updating null field '{field}' for device {device_id}")
                        
                        # Track if we're updating a key field (force update scenario)
                        if field in ['read_key', 'write_key', 'channel_id'] and current_value is not None:
                            key_field_updated = True
                            logger.info(f"Force updating key field '{field}' for device {device_id}")
                
                if update_data:
                    # Update the device
                    for field, value in update_data.items():
                        setattr(existing_device, field, value)
                    
                    existing_device.updated_at = datetime.now(timezone.utc)
                    self.session.add(existing_device)
                    self.session.commit()
                    
                    self.stats['updated_devices'] += 1
                    if null_field_updated:
                        self.stats['null_updates'] += 1
                    if key_field_updated:
                        self.stats['key_updates'] += 1
                    
                    logger.info(f"Updated device: {device_id} ({len(update_data)} fields)")
                else:
                    logger.debug(f"No updates needed for device: {device_id}")
            
            else:
                # Create new device
                new_device = Device(**device_data)
                self.session.add(new_device)
                self.session.commit()
                
                self.stats['new_devices'] += 1
                logger.info(f"Created new device: {device_id}")
        
        except Exception as e:
            logger.error(f"Error updating/creating device {device_id}: {e}")
            self.session.rollback()
            self.stats['errors'] += 1
    
    def get_database_device_count(self) -> int:
        """Get current count of devices in database"""
        try:
            count = self.session.exec(select(func.count(Device.device_key))).one()
            return count
        except Exception as e:
            logger.error(f"Error getting device count: {e}")
            return 0
    
    def update_single_device(self, device_id: str) -> bool:
        """
        Fetch and update a single device from Platform API.
        This is more efficient than fetching all devices when only one needs updating.
        
        Args:
            device_id: The device ID to update
            
        Returns:
            True if device was successfully updated, False otherwise
        """
        logger.info(f"Fetching single device: {device_id}")
        
        try:
            # First get the device from our database to get the device_name
            existing_device = self.crud.get_by_device_id(self.session, device_id=device_id)
            if not existing_device:
                logger.warning(f"Device {device_id} not found in database")
                return False
            
            # Fetch from Platform API - use device name for filtering if available
            params = {
                'tenant': DEFAULT_TENANT,
                'detailLevel': 'summary',
                'limit': 100  # Fetch a reasonable batch to find our device
            }
            
            response = requests.get(DEVICES_ENDPOINT, params=params, headers=self.headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('success'):
                logger.error(f"API returned unsuccessful response: {data.get('message')}")
                return False
            
            # Find the specific device in the response
            api_device = None
            for device in data.get('devices', []):
                if device.get('_id') == device_id:
                    api_device = device
                    break
            
            # If not found in first batch, we need to paginate
            if not api_device:
                skip = 100
                while True:
                    params['skip'] = skip
                    response = requests.get(DEVICES_ENDPOINT, params=params, headers=self.headers, timeout=30)
                    response.raise_for_status()
                    data = response.json()
                    
                    if not data.get('success') or not data.get('devices'):
                        break
                    
                    for device in data.get('devices', []):
                        if device.get('_id') == device_id:
                            api_device = device
                            break
                    
                    if api_device or not data.get('meta', {}).get('nextPage'):
                        break
                    
                    skip += 100
            
            if not api_device:
                logger.warning(f"Device {device_id} not found in Platform API")
                return False
            
            # Prepare for decryption if needed
            encrypted_read_key = api_device.get('readKey')
            encrypted_write_key = api_device.get('writeKey')
            device_number = api_device.get('device_number')
            
            decrypted_keys_mapping = {}
            if device_number and (encrypted_read_key or encrypted_write_key):
                devices_to_decrypt = [{
                    'device_number': device_number,
                    'encrypted_read_key': encrypted_read_key,
                    'encrypted_write_key': encrypted_write_key
                }]
                decrypted_keys_mapping = self.decrypt_keys(devices_to_decrypt)
            
            # Parse and update the device
            device_data = self.parse_device_from_api(api_device)
            
            # Apply decrypted keys if available
            if device_number and device_number in decrypted_keys_mapping:
                decrypted_keys = decrypted_keys_mapping[device_number]
                if 'read_key' in decrypted_keys:
                    device_data['read_key'] = decrypted_keys['read_key']
                if 'write_key' in decrypted_keys:
                    device_data['write_key'] = decrypted_keys['write_key']
            
            # Update the device in database
            self.update_or_create_device(device_data)
            
            logger.info(f"Successfully updated device {device_id}")
            return True
            
        except requests.RequestException as e:
            logger.error(f"Error fetching device {device_id} from Platform API: {e}")
            return False
        except Exception as e:
            logger.error(f"Error updating device {device_id}: {e}")
            return False

    def get_devices_missing_keys(self) -> List[Device]:
        """Get AirQo network devices missing read_key, write_key, or channel_id"""
        try:
            statement = select(Device).where(
                and_(
                    Device.network == "airqo",
                    or_(
                        Device.read_key.is_(None),
                        Device.write_key.is_(None),
                        Device.channel_id.is_(None)
                    )
                )
            )
            devices = self.session.exec(statement).all()
            return devices
        except Exception as e:
            logger.error(f"Error querying devices with missing keys: {e}")
            return []
    
    def create_missing_keys_csv(self, devices_missing_keys: List[Device]) -> str:
        """Create CSV file with devices missing keys"""
        if not devices_missing_keys:
            logger.info("No devices missing keys - skipping CSV creation")
            return ""
        
        csv_filename = Path(__file__).parent / f"devices_missing_keys_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        
        try:
            with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ['device_name', 'device_id', 'network', 'channel_id', 'read_key_missing', 'write_key_missing', 'channel_id_missing']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                writer.writeheader()
                for device in devices_missing_keys:
                    writer.writerow({
                        'device_name': device.device_name or '',
                        'device_id': device.device_id or '',
                        'network': device.network or '',
                        'channel_id': device.channel_id or '',
                        'read_key_missing': 'Yes' if device.read_key is None else 'No',
                        'write_key_missing': 'Yes' if device.write_key is None else 'No',
                        'channel_id_missing': 'Yes' if device.channel_id is None else 'No'
                    })
            
            logger.info(f"Created CSV report: {csv_filename}")
            self.stats['devices_missing_keys'] = len(devices_missing_keys)
            return str(csv_filename)
            
        except Exception as e:
            logger.error(f"Error creating CSV file: {e}")
            return ""
    
    def create_server_fetch_failures_csv(self, api_devices: List[Dict[str, Any]], processed_device_ids: set) -> str:
        """Create CSV of devices that couldn't be fetched/processed from server"""
        
        # Find devices from API that weren't successfully processed
        failed_devices = []
        for api_device in api_devices:
            device_id = api_device.get('_id')
            if device_id and device_id not in processed_device_ids:
                failed_devices.append(api_device)
        
        if not failed_devices:
            logger.info("All devices from server were processed successfully")
            return ""
        
        csv_filename = Path(__file__).parent / f"server_fetch_failures_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        
        try:
            with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ['device_name', 'device_id', 'network', 'has_read_key', 'has_write_key', 'has_channel_id', 'failure_reason']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                writer.writeheader()
                for device in failed_devices:
                    writer.writerow({
                        'device_name': device.get('name', ''),
                        'device_id': device.get('_id', ''),
                        'network': device.get('network', ''),
                        'has_read_key': 'Yes' if device.get('readKey') else 'No',
                        'has_write_key': 'Yes' if device.get('writeKey') else 'No',
                        'has_channel_id': 'Yes' if device.get('device_number') else 'No',
                        'failure_reason': 'Processing failed or incomplete data'
                    })
            
            logger.info(f"Created server fetch failures CSV: {csv_filename}")
            return str(csv_filename)
            
        except Exception as e:
            logger.error(f"Error creating server failures CSV: {e}")
            return ""
    
    def process_devices_in_batches(self, api_devices: List[Dict[str, Any]], decrypted_keys_mapping: Dict[str, Dict[str, str]]) -> set:
        """Process devices in batches of specified size"""
        total_devices = len(api_devices)
        processed_device_ids = set()
        
        for i in range(0, total_devices, BATCH_SIZE):
            batch_end = min(i + BATCH_SIZE, total_devices)
            batch = api_devices[i:batch_end]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (total_devices + BATCH_SIZE - 1) // BATCH_SIZE
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} devices)")
            
            for api_device in batch:
                try:
                    device_data = self.parse_device_from_api(api_device)
                    device_id = device_data.get('device_id')
                    
                    if not device_id:
                        continue
                    
                    # Replace encrypted keys with decrypted ones if available
                    channel_id = device_data.get('channel_id')
                    if channel_id and channel_id in decrypted_keys_mapping:
                        decrypted_keys = decrypted_keys_mapping[channel_id]
                        
                        if 'read_key' in decrypted_keys:
                            device_data['read_key'] = decrypted_keys['read_key']
                            logger.debug(f"Using decrypted read_key for device {device_id}")
                        
                        if 'write_key' in decrypted_keys:
                            device_data['write_key'] = decrypted_keys['write_key']
                            logger.debug(f"Using decrypted write_key for device {device_id}")
                    
                    self.update_or_create_device(device_data)
                    processed_device_ids.add(device_id)
                    
                except Exception as e:
                    logger.error(f"Error processing device {api_device.get('_id', 'unknown')}: {e}")
                    self.stats['errors'] += 1
            
            self.stats['batches_processed'] = batch_num
            logger.info(f"Completed batch {batch_num}/{total_batches}")
            
            # Commit after each batch
            try:
                self.session.commit()
                logger.debug(f"Committed batch {batch_num}")
            except Exception as e:
                logger.error(f"Error committing batch {batch_num}: {e}")
                self.session.rollback()
                self.stats['errors'] += 1
        
        return processed_device_ids
    
    def run(self) -> Dict[str, Any]:
        """
        Main execution method
        
        Returns:
            Dictionary with execution statistics
        """
        logger.info("=" * 80)
        logger.info("Starting device update job")
        logger.info("=" * 80)
        
        try:
            # Get current database count
            db_count_before = self.get_database_device_count()
            logger.info(f"Current devices in database: {db_count_before}")
            
            # Fetch devices from platform
            api_devices = self.fetch_devices_from_platform()
            
            logger.info(f"Platform devices: {len(api_devices)}, Database devices: {db_count_before}")
            
            # Check if counts match
            if len(api_devices) == db_count_before:
                logger.info("Device counts match - focusing on updating null values")
            else:
                logger.info(f"Device count mismatch - will sync (Diff: {len(api_devices) - db_count_before})")
            
            # Collect devices with encrypted keys for bulk decryption
            devices_to_decrypt = []
            for api_device in api_devices:
                encrypted_read_key = api_device.get('readKey')
                encrypted_write_key = api_device.get('writeKey')
                device_number = api_device.get('device_number')
                
                if device_number and (encrypted_read_key or encrypted_write_key):
                    decrypt_item = {'device_number': device_number}
                    
                    if encrypted_read_key:
                        decrypt_item['encrypted_read_key'] = encrypted_read_key
                    
                    if encrypted_write_key:
                        decrypt_item['encrypted_write_key'] = encrypted_write_key
                    
                    devices_to_decrypt.append(decrypt_item)
            
            # Decrypt all keys in bulk
            decrypted_keys_mapping = self.decrypt_keys(devices_to_decrypt)
            
            # Process devices in batches
            logger.info("Processing devices in batches...")
            processed_device_ids = self.process_devices_in_batches(api_devices, decrypted_keys_mapping)
            
            # Get final count
            db_count_after = self.get_database_device_count()
            
            # Check for devices missing keys and create CSV report
            logger.info("Checking for AirQo devices missing keys...")
            devices_missing_keys = self.get_devices_missing_keys()
            missing_keys_csv = self.create_missing_keys_csv(devices_missing_keys)
            
            # Create CSV for devices that couldn't be fetched/processed from server
            logger.info("Checking for server fetch failures...")
            server_failures_csv = self.create_server_fetch_failures_csv(api_devices, processed_device_ids)
            
            # Prepare results
            self.stats['db_count_before'] = db_count_before
            self.stats['db_count_after'] = db_count_after
            self.stats['missing_keys_csv'] = missing_keys_csv
            self.stats['server_failures_csv'] = server_failures_csv
            self.stats['success'] = True
            
            logger.info("=" * 80)
            logger.info("Device update job completed successfully")
            logger.info("Statistics:")
            logger.info(f"  - Devices fetched from API: {self.stats['total_fetched']}")
            logger.info(f"  - Database count before: {db_count_before}")
            logger.info(f"  - Database count after: {db_count_after}")
            logger.info(f"  - New devices created: {self.stats['new_devices']}")
            logger.info(f"  - Devices updated: {self.stats['updated_devices']}")
            logger.info(f"  - Null values filled: {self.stats['null_updates']}")
            logger.info(f"  - Key fields force-updated: {self.stats['key_updates']}")
            logger.info(f"  - Batches processed: {self.stats['batches_processed']}")
            logger.info(f"  - Read keys decrypted: {self.stats['decrypted_read_keys']}")
            logger.info(f"  - Write keys decrypted: {self.stats['decrypted_write_keys']}")
            logger.info(f"  - AirQo devices missing keys: {self.stats['devices_missing_keys']}")
            logger.info(f"  - Missing keys CSV: {missing_keys_csv if missing_keys_csv else 'None'}")
            logger.info(f"  - Server failures CSV: {server_failures_csv if server_failures_csv else 'None'}")
            logger.info(f"  - Force update keys enabled: {self.force_update_keys}")
            logger.info(f"  - Errors: {self.stats['errors']}")
            logger.info("=" * 80)
            
            return self.stats
            
        except Exception as e:
            logger.error(f"Device update job failed: {e}", exc_info=True)
            self.stats['success'] = False
            self.stats['error'] = str(e)
            return self.stats


def main():
    """Main entry point for the cronjob"""
    session = SessionLocal()
    try:
        updater = DeviceUpdater(session)
        results = updater.run()
        
        # Exit with error code if job failed
        if not results.get('success'):
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Fatal error in device update job: {e}", exc_info=True)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
