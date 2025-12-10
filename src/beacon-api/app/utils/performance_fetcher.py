"""
Helper functions for on-demand performance data fetching
These functions are used by API endpoints to fetch missing data before returning results
"""
import logging
from typing import List
from datetime import datetime
from sqlmodel import Session, select

from app.models.device import Device
from app.models.airqloud import AirQloud
from app.crud.fetch_log import device_fetch_log, airqloud_fetch_log
from cronjobs.performance_jobs.fetch_thingspeak_data_v2 import EnhancedThingSpeakDataFetcher

logger = logging.getLogger(__name__)


def ensure_device_performance_data(
    db: Session,
    device_id: str,
    start_date: datetime,
    end_date: datetime
) -> bool:
    """
    Ensure device performance data exists for the requested date range.
    Fetches missing data if needed.
    
    Args:
        db: Database session
        device_id: Device ID to fetch data for
        start_date: Start of requested date range
        end_date: End of requested date range
        
    Returns:
        True if data is now available, False if fetch failed
    """
    try:
        # Convert to dates for fetch log check
        start_dt = start_date.date()
        end_dt = end_date.date()
        
        # Check if we need to fetch any data
        missing_ranges = device_fetch_log.get_missing_date_ranges(
            db,
            device_id=device_id,
            start_date=start_dt,
            end_date=end_dt,
            include_incomplete=True  # Refetch incomplete ranges
        )
        
        if not missing_ranges:
            logger.info(f"Device {device_id}: All data already available for {start_dt} to {end_dt}")
            return True
        
        logger.info(f"Device {device_id}: Fetching {len(missing_ranges)} missing date range(s)")
        
        # Get device
        device = db.exec(select(Device).where(Device.device_id == device_id)).first()
        if not device:
            logger.error(f"Device {device_id} not found")
            return False
        
        # Fetch missing data
        fetcher = EnhancedThingSpeakDataFetcher(db)
        success = fetcher.process_device_with_fetch_log(device, start_date, end_date)
        
        # Commit regardless of success status - partial data/logs may have been created
        db.commit()
        
        if success:
            logger.info(f"Device {device_id}: Successfully fetched missing data")
            return True
        else:
            logger.warning(f"Device {device_id}: Partial or no data fetched (but fetch logs updated)")
            return True  # Return True because we updated fetch logs
            
    except Exception as e:
        logger.error(f"Error ensuring device performance data for {device_id}: {str(e)}")
        db.rollback()
        return False


def ensure_airqloud_performance_data(
    db: Session,
    airqloud_id: str,
    start_date: datetime,
    end_date: datetime
) -> bool:
    """
    Ensure airqloud performance data exists for the requested date range.
    Calculates missing data if needed.
    
    Args:
        db: Database session
        airqloud_id: AirQloud ID to fetch data for
        start_date: Start of requested date range
        end_date: End of requested date range
        
    Returns:
        True if data is now available, False if calculation failed
    """
    try:
        # Convert to dates for fetch log check
        start_dt = start_date.date()
        end_dt = end_date.date()
        
        # Check if we need to calculate any data
        missing_ranges = airqloud_fetch_log.get_missing_date_ranges(
            db,
            airqloud_id=airqloud_id,
            start_date=start_dt,
            end_date=end_dt,
            include_incomplete=True
        )
        
        if not missing_ranges:
            logger.info(f"AirQloud {airqloud_id}: All data already available for {start_dt} to {end_dt}")
            return True
        
        logger.info(f"AirQloud {airqloud_id}: Calculating {len(missing_ranges)} missing date range(s)")
        
        # Get airqloud
        airqloud = db.exec(select(AirQloud).where(AirQloud.id == airqloud_id)).first()
        if not airqloud:
            logger.error(f"AirQloud {airqloud_id} not found")
            return False
        
        # Calculate missing data
        fetcher = EnhancedThingSpeakDataFetcher(db)
        success = fetcher.process_airqloud_with_fetch_log(airqloud, start_date, end_date)
        
        # Commit regardless of success status - partial data/logs may have been created
        db.commit()
        
        if success:
            logger.info(f"AirQloud {airqloud_id}: Successfully calculated missing data")
            return True
        else:
            logger.warning(f"AirQloud {airqloud_id}: Partial or no data calculated (but fetch logs updated)")
            return True  # Return True because we updated fetch logs
            
    except Exception as e:
        logger.error(f"Error ensuring airqloud performance data for {airqloud_id}: {str(e)}")
        db.rollback()
        return False


def ensure_multiple_devices_performance_data(
    db: Session,
    device_ids: List[str],
    start_date: datetime,
    end_date: datetime
) -> dict:
    """
    Ensure performance data exists for multiple devices.
    
    Args:
        db: Database session
        device_ids: List of device IDs
        start_date: Start of requested date range
        end_date: End of requested date range
        
    Returns:
        Dictionary with success/failure counts
    """
    results = {
        'total': len(device_ids),
        'success': 0,
        'failed': 0,
        'skipped': 0
    }
    
    for device_id in device_ids:
        try:
            success = ensure_device_performance_data(db, device_id, start_date, end_date)
            if success:
                results['success'] += 1
            else:
                results['failed'] += 1
        except Exception as e:
            logger.error(f"Error processing device {device_id}: {str(e)}")
            results['failed'] += 1
    
    logger.info(f"Batch fetch complete: {results['success']}/{results['total']} successful")
    return results


def ensure_multiple_airqlouds_performance_data(
    db: Session,
    airqloud_ids: List[str],
    start_date: datetime,
    end_date: datetime
) -> dict:
    """
    Ensure performance data exists for multiple airqlouds.
    
    Args:
        db: Database session
        airqloud_ids: List of airqloud IDs
        start_date: Start of requested date range
        end_date: End of requested date range
        
    Returns:
        Dictionary with success/failure counts
    """
    results = {
        'total': len(airqloud_ids),
        'success': 0,
        'failed': 0,
        'skipped': 0
    }
    
    for airqloud_id in airqloud_ids:
        try:
            success = ensure_airqloud_performance_data(db, airqloud_id, start_date, end_date)
            if success:
                results['success'] += 1
            else:
                results['failed'] += 1
        except Exception as e:
            logger.error(f"Error processing airqloud {airqloud_id}: {str(e)}")
            results['failed'] += 1
    
    logger.info(f"Batch calculation complete: {results['success']}/{results['total']} successful")
    return results
