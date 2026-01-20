"""
Background task utilities for async data fetching and computation.
These tasks run after the response is sent to the client.

Uses in-memory locks to prevent duplicate fetches for the same resources.
"""
import logging
from typing import List, Set, Optional
from datetime import datetime
import threading

from app.configs.database import SessionLocal

logger = logging.getLogger(__name__)

# Thread-safe sets to track what's currently being processed
# This prevents duplicate background tasks for the same resources
_active_device_fetches: Set[str] = set()
_active_airqloud_fetches: Set[str] = set()
_lock = threading.Lock()

# Track if a bulk device key update is already running
_device_keys_update_running: bool = False
# Track when the last device keys update was triggered (for throttling)
_last_device_keys_update: Optional[datetime] = None
# Minimum interval between device key update attempts (5 minutes)
_DEVICE_KEYS_UPDATE_THROTTLE_SECONDS = 300


def _get_fetch_key(resource_id: str, start_date: datetime, end_date: datetime) -> str:
    """Generate a unique key for a fetch operation"""
    return f"{resource_id}:{start_date.date()}:{end_date.date()}"


def fetch_missing_device_performance_background(
    device_ids: List[str],
    start_date: datetime,
    end_date: datetime
):
    """
    Background task to fetch missing performance data for devices.
    Creates its own database session since this runs after the response.
    
    Uses locking to prevent duplicate fetches for the same devices.
    
    Args:
        device_ids: List of device IDs to fetch data for
        start_date: Start of date range
        end_date: End of date range
    """
    if not device_ids:
        return
    
    # Filter out devices that are already being fetched
    devices_to_fetch = []
    with _lock:
        for device_id in device_ids:
            key = _get_fetch_key(device_id, start_date, end_date)
            if key not in _active_device_fetches:
                _active_device_fetches.add(key)
                devices_to_fetch.append((device_id, key))
    
    if not devices_to_fetch:
        logger.info(f"[Background] All {len(device_ids)} devices already being fetched, skipping")
        return
        
    logger.info(f"[Background] Starting fetch for {len(devices_to_fetch)}/{len(device_ids)} devices: {start_date.date()} to {end_date.date()}")
    
    try:
        with SessionLocal() as db:
            from app.utils.performance_fetcher import ensure_multiple_devices_performance_data
            
            results = ensure_multiple_devices_performance_data(
                db,
                device_ids=[d[0] for d in devices_to_fetch],
                start_date=start_date,
                end_date=end_date
            )
            
            logger.info(f"[Background] Device fetch complete: {results['success']}/{results['total']} successful")
            
    except Exception as e:
        logger.error(f"[Background] Error fetching device performance data: {str(e)}")
    finally:
        # Always release the locks
        with _lock:
            for _, key in devices_to_fetch:
                _active_device_fetches.discard(key)


def fetch_missing_airqloud_performance_background(
    airqloud_ids: List[str],
    start_date: datetime,
    end_date: datetime
):
    """
    Background task to fetch/compute missing performance data for airqlouds.
    Creates its own database session since this runs after the response.
    Only processes active airqlouds - inactive ones are skipped.
    
    Uses locking to prevent duplicate fetches for the same airqlouds.
    
    Args:
        airqloud_ids: List of airqloud IDs to compute data for
        start_date: Start of date range  
        end_date: End of date range
    """
    if not airqloud_ids:
        return
    
    # Filter to only active airqlouds first
    try:
        with SessionLocal() as db:
            from app.models.airqloud import AirQloud
            from sqlmodel import select
            
            active_airqlouds = db.exec(
                select(AirQloud).where(
                    AirQloud.id.in_(airqloud_ids),
                    AirQloud.is_active == True
                )
            ).all()
            active_ids = [aq.id for aq in active_airqlouds]
            
            skipped_count = len(airqloud_ids) - len(active_ids)
            if skipped_count > 0:
                logger.info(f"[Background] Skipping {skipped_count} inactive airqlouds")
            
            if not active_ids:
                logger.info(f"[Background] No active airqlouds to process")
                return
                
            airqloud_ids = active_ids
    except Exception as e:
        logger.error(f"[Background] Error filtering active airqlouds: {str(e)}")
        return
    
    # Filter out airqlouds that are already being processed
    airqlouds_to_fetch = []
    with _lock:
        for airqloud_id in airqloud_ids:
            key = _get_fetch_key(airqloud_id, start_date, end_date)
            if key not in _active_airqloud_fetches:
                _active_airqloud_fetches.add(key)
                airqlouds_to_fetch.append((airqloud_id, key))
    
    if not airqlouds_to_fetch:
        logger.info(f"[Background] All {len(airqloud_ids)} airqlouds already being processed, skipping")
        return
        
    logger.info(f"[Background] Starting computation for {len(airqlouds_to_fetch)}/{len(airqloud_ids)} airqlouds: {start_date.date()} to {end_date.date()}")
    
    try:
        with SessionLocal() as db:
            from app.utils.performance_fetcher import ensure_multiple_airqlouds_performance_data
            
            results = ensure_multiple_airqlouds_performance_data(
                db,
                airqloud_ids=[a[0] for a in airqlouds_to_fetch],
                start_date=start_date,
                end_date=end_date
            )
            
            logger.info(f"[Background] Airqloud computation complete: {results['success']}/{results['total']} successful")
            
    except Exception as e:
        logger.error(f"[Background] Error computing airqloud performance data: {str(e)}")
    finally:
        # Always release the locks
        with _lock:
            for _, key in airqlouds_to_fetch:
                _active_airqloud_fetches.discard(key)


def fetch_single_airqloud_with_devices_background(
    airqloud_id: str,
    device_ids: List[str],
    start_date: datetime,
    end_date: datetime
):
    """
    Background task to fetch missing data for a single airqloud and its devices.
    Creates its own database session since this runs after the response.
    
    Uses locking to prevent duplicate fetches.
    
    Args:
        airqloud_id: The airqloud ID
        device_ids: List of device IDs in the airqloud
        start_date: Start of date range
        end_date: End of date range
    """
    # Check if this airqloud is already being processed
    airqloud_key = _get_fetch_key(airqloud_id, start_date, end_date)
    
    with _lock:
        if airqloud_key in _active_airqloud_fetches:
            logger.info(f"[Background] Airqloud {airqloud_id} already being processed, skipping")
            return
        _active_airqloud_fetches.add(airqloud_key)
    
    logger.info(f"[Background] Starting fetch for airqloud {airqloud_id} with {len(device_ids)} devices")
    
    try:
        with SessionLocal() as db:
            from app.utils.performance_fetcher import (
                ensure_airqloud_performance_data,
                ensure_multiple_devices_performance_data
            )
            
            # First fetch device data (devices have their own locking in the other function)
            if device_ids:
                device_results = ensure_multiple_devices_performance_data(
                    db,
                    device_ids=device_ids,
                    start_date=start_date,
                    end_date=end_date
                )
                logger.info(f"[Background] Device fetch for {airqloud_id}: {device_results['success']}/{device_results['total']} successful")
            
            # Then compute airqloud aggregates
            airqloud_success = ensure_airqloud_performance_data(
                db,
                airqloud_id=airqloud_id,
                start_date=start_date,
                end_date=end_date
            )
            logger.info(f"[Background] Airqloud {airqloud_id} computation: {'success' if airqloud_success else 'failed'}")
            
    except Exception as e:
        logger.error(f"[Background] Error fetching data for airqloud {airqloud_id}: {str(e)}")
    finally:
        # Always release the lock
        with _lock:
            _active_airqloud_fetches.discard(airqloud_key)


def get_active_fetches_count() -> dict:
    """Get the count of currently active background fetches (for monitoring)"""
    with _lock:
        throttle_remaining = None
        if _last_device_keys_update is not None:
            elapsed = (datetime.now() - _last_device_keys_update).total_seconds()
            if elapsed < _DEVICE_KEYS_UPDATE_THROTTLE_SECONDS:
                throttle_remaining = int(_DEVICE_KEYS_UPDATE_THROTTLE_SECONDS - elapsed)
        
        return {
            "active_device_fetches": len(_active_device_fetches),
            "active_airqloud_fetches": len(_active_airqloud_fetches),
            "device_keys_update_running": _device_keys_update_running,
            "device_keys_throttle_remaining_seconds": throttle_remaining,
            "device_sync_running": _device_sync_running,
            "sites_update_running": _sites_update_running
        }


def update_all_null_device_keys_background():
    """
    Background task to update ALL devices that have null read_key, write_key, or channel_id.
    This is triggered when any device is fetched and has null values for any of these fields.
    
    Reuses the DeviceUpdater class from cronjobs/update_devices.py to avoid code duplication.
    
    Uses locking to prevent multiple simultaneous bulk updates and throttling to prevent
    redundant task scheduling from concurrent requests.
    """
    global _device_keys_update_running, _last_device_keys_update
    
    # Check if an update is already running or was recently triggered
    with _lock:
        now = datetime.now()
        
        # Check throttle - skip if last update was triggered recently
        if _last_device_keys_update is not None:
            elapsed = (now - _last_device_keys_update).total_seconds()
            if elapsed < _DEVICE_KEYS_UPDATE_THROTTLE_SECONDS:
                logger.debug(f"[Background] Device key update throttled, {_DEVICE_KEYS_UPDATE_THROTTLE_SECONDS - elapsed:.0f}s remaining")
                return
        
        if _device_keys_update_running:
            logger.info("[Background] Bulk device key update already running, skipping")
            return
        
        _device_keys_update_running = True
        _last_device_keys_update = now
    
    logger.info("[Background] Starting bulk update for all devices with null keys")
    
    try:
        # Import the DeviceUpdater from cronjobs using importlib
        import sys
        import importlib.util
        from pathlib import Path
        
        # Dynamically load the update_devices module from cronjobs directory
        cronjobs_path = Path(__file__).parent.parent.parent / "cronjobs" / "update_devices.py"
        spec = importlib.util.spec_from_file_location("update_devices", cronjobs_path)
        update_devices_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(update_devices_module)
        DeviceUpdater = update_devices_module.DeviceUpdater
        
        with SessionLocal() as db:
            updater = DeviceUpdater(db)
            
            # Run the full update job - this will update all devices with null keys
            results = updater.run()
            
            logger.info("[Background] Bulk device key update completed")
            logger.info(f"[Background] Stats: fetched={results.get('total_fetched', 0)}, "
                       f"updated={results.get('updated_devices', 0)}, "
                       f"null_updates={results.get('null_updates', 0)}, "
                       f"errors={results.get('errors', 0)}")
                
    except Exception as e:
        logger.error(f"[Background] Error in bulk device key update: {str(e)}")
    finally:
        # Always release the lock
        with _lock:
            _device_keys_update_running = False


# Track if a sites update is already running
_sites_update_running: bool = False
# Track when the last sites update was triggered (for throttling)
_last_sites_update: Optional[datetime] = None
# Minimum interval between sites update attempts (5 minutes)
_SITES_UPDATE_THROTTLE_SECONDS = 300

def update_missing_sites_background():
    """
    Background task to update missing sites in dim_site table.
    This is triggered when devices are fetched and potential missing sites are detected.
    
    Reuses the SiteUpdater class from cronjobs/update_sites.py.
    
    Uses locking and throttling.
    """
    global _sites_update_running, _last_sites_update
    
    with _lock:
        now = datetime.now()
        
        # Check throttle
        if _last_sites_update is not None:
            elapsed = (now - _last_sites_update).total_seconds()
            if elapsed < _SITES_UPDATE_THROTTLE_SECONDS:
                logger.debug(f"[Background] Sites update throttled, {_SITES_UPDATE_THROTTLE_SECONDS - elapsed:.0f}s remaining")
                return
        
        if _sites_update_running:
            logger.info("[Background] Sites update already running, skipping")
            return
            
        _sites_update_running = True
        _last_sites_update = now
        
    logger.info("[Background] Starting missing sites update")
    
    try:
        import sys
        import importlib.util
        from pathlib import Path
        
        # Dynamically load the update_sites module
        cronjobs_path = Path(__file__).parent.parent.parent / "cronjobs" / "update_sites.py"
        if not cronjobs_path.exists():
            logger.error(f"[Background] update_sites.py not found at {cronjobs_path}")
            return

        spec = importlib.util.spec_from_file_location("update_sites", cronjobs_path)
        update_sites_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(update_sites_module)
        SiteUpdater = update_sites_module.SiteUpdater
        
        with SessionLocal() as db:
            updater = SiteUpdater(db)
            updater.run()
            
            # Access stats if available
            if hasattr(updater, 'stats'):
                 logger.info(f"[Background] Sites update stats: {updater.stats}")
                 
    except Exception as e:
        logger.error(f"[Background] Error in sites update: {str(e)}")
    finally:
        with _lock:
            _sites_update_running = False


# Track if a device sync is already running
_device_sync_running: bool = False
# Track when the last device sync was triggered
_last_device_sync: Optional[datetime] = None
# Minimum interval between device sync attempts (5 minutes)
_DEVICE_SYNC_THROTTLE_SECONDS = 300

def sync_devices_background():
    """
    Background task to sync devices from Platform API.
    
    Reuses the DeviceUpdater class from cronjobs/update_devices.py.
    
    Uses locking and throttling.
    """
    global _device_sync_running, _last_device_sync
    
    with _lock:
        now = datetime.now()
        
        # Check throttle
        if _last_device_sync is not None:
            elapsed = (now - _last_device_sync).total_seconds()
            if elapsed < _DEVICE_SYNC_THROTTLE_SECONDS:
                logger.debug(f"[Background] Device sync throttled, {_DEVICE_SYNC_THROTTLE_SECONDS - elapsed:.0f}s remaining")
                return
        
        if _device_sync_running:
            logger.info("[Background] Device sync already running, skipping")
            return
            
        _device_sync_running = True
        _last_device_sync = now
        
    logger.info("[Background] Starting device sync")
    
    try:
        import sys
        import importlib.util
        from pathlib import Path
        
        # Dynamically load the update_devices module
        cronjobs_path = Path(__file__).parent.parent.parent / "cronjobs" / "update_devices.py"
        if not cronjobs_path.exists():
            logger.error(f"[Background] update_devices.py not found at {cronjobs_path}")
            return

        spec = importlib.util.spec_from_file_location("update_devices", cronjobs_path)
        update_devices_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(update_devices_module)
        DeviceUpdater = update_devices_module.DeviceUpdater
        
        with SessionLocal() as db:
            updater = DeviceUpdater(db)
            updater.run()
            
            # Access stats if available
            if hasattr(updater, 'stats'):
                 logger.info(f"[Background] Device sync stats: {updater.stats}")
                 
    except Exception as e:
        logger.error(f"[Background] Error in device sync: {str(e)}")
    finally:
        with _lock:
            _device_sync_running = False
