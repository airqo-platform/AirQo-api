"""
Cronjob to fetch data from ThingSpeak and update performance tables
This script fetches device data from ThingSpeak and calculates performance metrics
for both devices and airqlouds, storing them in fact_device_performance and fact_airqloud_performance.
"""
import sys
import os
from pathlib import Path

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import requests
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlmodel import Session, select, and_
from app.configs.database import SessionLocal
from app.models.device import Device
from app.models.airqloud import AirQloud, AirQloudDevice
from app.models.performance import (
    DevicePerformance, DevicePerformanceCreate,
    AirQloudPerformance, AirQloudPerformanceCreate
)
from app.crud.performance import device_performance, airqloud_performance
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ThingSpeak configuration
THINGSPEAK_BASE_URL = os.getenv("THINGSPEAK_API_BASE_URL", "https://api.thingspeak.com")
MAX_RECORDS_PER_REQUEST = 8000


class ThingSpeakDataFetcher:
    """Fetch data from ThingSpeak and update performance metrics"""
    
    def __init__(self, session: Session):
        self.session = session
        self.stats = {
            'devices_processed': 0,
            'device_records_fetched': 0,
            'device_performance_created': 0,
            'airqlouds_processed': 0,
            'airqloud_performance_created': 0,
            'errors': 0,
            'api_requests': 0
        }
    
    def fetch_device_data_from_thingspeak(
        self,
        channel_id: int,
        api_key: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """
        Fetch all data from ThingSpeak for a given channel and date range.
        Handles pagination if data exceeds 8000 records.
        
        Args:
            channel_id: ThingSpeak channel ID
            api_key: ThingSpeak read API key
            start_date: Start date for data fetch
            end_date: End date for data fetch
            
        Returns:
            List of feed entries from ThingSpeak
        """
        all_feeds = []
        current_start = start_date
        current_end = end_date
        
        try:
            while True:
                url = (
                    f"{THINGSPEAK_BASE_URL}/channels/{channel_id}/feeds.json?"
                    f"start={current_start.strftime('%Y-%m-%dT%H:%M:%SZ')}&"
                    f"end={current_end.strftime('%Y-%m-%dT%H:%M:%SZ')}&"
                    f"api_key={api_key}&results={MAX_RECORDS_PER_REQUEST}"
                )
                
                logger.info(f"Fetching data from ThingSpeak for channel {channel_id}: "
                           f"{current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')}")
                
                self.stats['api_requests'] += 1
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                feeds = data.get('feeds', [])
                
                if not feeds:
                    logger.info(f"No more data found for channel {channel_id}")
                    break
                
                all_feeds.extend(feeds)
                logger.info(f"Fetched {len(feeds)} records for channel {channel_id}")
                
                # If we got less than MAX_RECORDS_PER_REQUEST, we've fetched all data
                if len(feeds) < MAX_RECORDS_PER_REQUEST:
                    break
                
                # Get the timestamp of the earliest record in this batch
                # and use it as the end date for the next request
                earliest_record = feeds[-1]  # Feeds are typically ordered newest to oldest
                earliest_timestamp = earliest_record.get('created_at')
                
                if not earliest_timestamp:
                    logger.warning(f"No timestamp found in record, stopping pagination")
                    break
                
                # Parse the timestamp and set it as the new end date
                # Subtract 1 second to avoid fetching the same record again
                current_end = datetime.fromisoformat(earliest_timestamp.replace('Z', '+00:00'))
                current_end = current_end - timedelta(seconds=1)
                
                # Safety check: if we've moved past the start date, stop
                if current_end <= current_start:
                    break
                
                logger.info(f"Continuing pagination, next batch ends at {current_end.strftime('%Y-%m-%d %H:%M:%S')}")
            
            self.stats['device_records_fetched'] += len(all_feeds)
            logger.info(f"Total records fetched for channel {channel_id}: {len(all_feeds)}")
            return all_feeds
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching data from ThingSpeak for channel {channel_id}: {str(e)}")
            self.stats['errors'] += 1
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching ThingSpeak data for channel {channel_id}: {str(e)}")
            self.stats['errors'] += 1
            return []
    
    def calculate_device_performance_hourly(
        self,
        feeds: List[Dict[str, Any]],
        device_id: str
    ) -> List[DevicePerformanceCreate]:
        """
        Calculate hourly performance metrics from ThingSpeak feed data
        
        Device performance is aggregated hourly:
        - freq: Number of data points in each hour
        - error_margin: Average absolute difference between field1 and field3 for that hour
        - timestamp: The specific hour
        
        Args:
            feeds: List of feed entries from ThingSpeak
            device_id: Device identifier
            
        Returns:
            List of DevicePerformanceCreate objects (one per hour)
        """
        if not feeds:
            return []
        
        try:
            from collections import defaultdict
            
            # Group feeds by hour
            hourly_data = defaultdict(list)
            
            for feed in feeds:
                created_at = feed.get('created_at')
                if not created_at:
                    continue
                
                # Parse timestamp and truncate to hour
                timestamp = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                hour_key = timestamp.replace(minute=0, second=0, microsecond=0)
                
                # Get field1 and field3 values for error margin calculation
                field1 = feed.get('field1')
                field3 = feed.get('field3')
                
                hourly_data[hour_key].append({
                    'field1': field1,
                    'field3': field3,
                    'timestamp': timestamp
                })
            
            # Calculate performance for each hour
            performance_records = []
            
            for hour, data_points in hourly_data.items():
                # Frequency: number of data points in this hour
                freq = len(data_points)
                
                # Error margin: average absolute difference between field1 and field3
                error_margins = []
                for point in data_points:
                    try:
                        field1_val = float(point['field1']) if point['field1'] else None
                        field3_val = float(point['field3']) if point['field3'] else None
                        
                        if field1_val is not None and field3_val is not None:
                            error_margins.append(abs(field1_val - field3_val))
                    except (ValueError, TypeError):
                        # Skip if values can't be converted to float
                        continue
                
                # Calculate average error margin for this hour
                avg_error_margin = sum(error_margins) / len(error_margins) if error_margins else 0
                
                performance_records.append(DevicePerformanceCreate(
                    device_id=device_id,
                    freq=freq,
                    error_margin=round(avg_error_margin, 2),
                    timestamp=hour
                ))
            
            logger.info(f"Calculated {len(performance_records)} hourly performance records for device {device_id}")
            return performance_records
            
        except Exception as e:
            logger.error(f"Error calculating hourly performance for device {device_id}: {str(e)}")
            self.stats['errors'] += 1
            return []
    
    def calculate_airqloud_performance_daily(
        self,
        airqloud_id: str,
        device_performances: List[DevicePerformance],
        target_date: datetime
    ) -> Optional[AirQloudPerformanceCreate]:
        """
        Calculate daily AirQloud performance based on device performances
        
        AirQloud performance is aggregated daily:
        - error_margin: Daily average of error margins from all devices in the airqloud
        - freq: Average uptime (unique hourly entries per day) across all devices
                Max is 24 (one entry per hour for 24 hours)
        - timestamp: The specific day
        
        Args:
            airqloud_id: AirQloud identifier
            device_performances: List of device performance records for this airqloud
            target_date: The date to calculate performance for
            
        Returns:
            AirQloudPerformanceCreate object or None if calculation fails
        """
        if not device_performances:
            return None
        
        try:
            from collections import defaultdict
            
            # Set timestamp to the start of the target day
            day_timestamp = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Group performance records by device
            device_data = defaultdict(list)
            
            for perf in device_performances:
                # Only include records from the target date
                if perf.timestamp.date() == target_date.date():
                    device_data[perf.device_id].append(perf)
            
            if not device_data:
                logger.debug(f"No performance data for airqloud {airqloud_id} on {target_date.date()}")
                return None
            
            # Calculate metrics per device
            device_uptimes = []
            all_error_margins = []
            
            for device_id, performances in device_data.items():
                # Count unique hourly entries for this device (uptime)
                unique_hours = len(set(p.timestamp.replace(minute=0, second=0, microsecond=0) 
                                      for p in performances))
                device_uptimes.append(unique_hours)
                
                # Collect error margins
                all_error_margins.extend([p.error_margin for p in performances if p.error_margin is not None])
            
            # Calculate average uptime across all devices (max is 24)
            avg_uptime = sum(device_uptimes) / len(device_uptimes) if device_uptimes else 0
            
            # Calculate average error margin for the day
            avg_error_margin = sum(all_error_margins) / len(all_error_margins) if all_error_margins else 0
            
            return AirQloudPerformanceCreate(
                airqloud_id=airqloud_id,
                freq=int(round(avg_uptime)),  # freq represents uptime (0-24)
                error_margin=round(avg_error_margin, 2),
                timestamp=day_timestamp
            )
            
        except Exception as e:
            logger.error(f"Error calculating daily performance for airqloud {airqloud_id}: {str(e)}")
            self.stats['errors'] += 1
            return None
    
    def process_device(
        self,
        device: Device,
        start_date: datetime,
        end_date: datetime
    ) -> List[DevicePerformance]:
        """
        Process a single device: fetch data and create hourly performance records
        
        Args:
            device: Device object
            start_date: Start date for data fetch
            end_date: End date for data fetch
            
        Returns:
            List of created DevicePerformance objects
        """
        # Skip devices without ThingSpeak credentials
        if not device.channel_id or not device.read_key:
            logger.debug(f"Skipping device {device.device_id}: missing channel_id or read_key")
            return []
        
        try:
            # Fetch data from ThingSpeak
            feeds = self.fetch_device_data_from_thingspeak(
                channel_id=device.channel_id,
                api_key=device.read_key,
                start_date=start_date,
                end_date=end_date
            )
            
            if not feeds:
                logger.warning(f"No data fetched for device {device.device_id}")
                return []
            
            # Calculate hourly performance metrics
            performance_data_list = self.calculate_device_performance_hourly(feeds, device.device_id)
            
            if not performance_data_list:
                return []
            
            # Create performance records in database
            created_records = []
            for performance_data in performance_data_list:
                performance_record = device_performance.create(self.session, obj_in=performance_data)
                created_records.append(performance_record)
                self.stats['device_performance_created'] += 1
            
            logger.info(f"Created {len(created_records)} hourly performance records for device {device.device_id}")
            
            return created_records
            
        except Exception as e:
            logger.error(f"Error processing device {device.device_id}: {str(e)}")
            self.stats['errors'] += 1
            return []
    
    def process_airqloud(
        self,
        airqloud: AirQloud,
        start_date: datetime,
        end_date: datetime
    ) -> List[AirQloudPerformance]:
        """
        Process a single airqloud: ensure device performance exists, then calculate daily airqloud performance
        
        This method:
        1. Gets all devices in the airqloud
        2. Checks if device performance data exists for the date range
        3. If missing, fetches from ThingSpeak for those devices
        4. Calculates daily airqloud performance from device performance
        
        Args:
            airqloud: AirQloud object
            start_date: Start date for performance data
            end_date: End date for performance data
            
        Returns:
            List of created AirQloudPerformance objects (one per day)
        """
        try:
            # Get all devices in this airqloud
            airqloud_devices = self.session.exec(
                select(AirQloudDevice).where(AirQloudDevice.cohort_id == airqloud.id)
            ).all()
            
            if not airqloud_devices:
                logger.warning(f"No devices found for airqloud {airqloud.id}")
                return []
            
            device_ids = [ad.id for ad in airqloud_devices]
            logger.info(f"Airqloud {airqloud.id} has {len(device_ids)} devices: {device_ids[:5]}...")  # Show first 5
            
            # Check existing device performance data
            existing_device_performances = self.session.exec(
                select(DevicePerformance).where(
                    and_(
                        DevicePerformance.device_id.in_(device_ids),
                        DevicePerformance.timestamp >= start_date,
                        DevicePerformance.timestamp <= end_date
                    )
                )
            ).all()
            
            logger.info(f"Found {len(existing_device_performances)} existing device performance records for airqloud devices")
            
            # Calculate expected hourly records count
            hours_in_range = int((end_date - start_date).total_seconds() / 3600) + 1
            expected_records = len(device_ids) * hours_in_range
            
            logger.info(f"Found {len(existing_device_performances)}/{expected_records} device performance records")
            
            # If device performance data is missing, fetch from ThingSpeak
            if len(existing_device_performances) < expected_records:
                logger.info(f"Device performance data incomplete ({len(existing_device_performances)}/{expected_records}). "
                           f"Fetching from ThingSpeak for airqloud {airqloud.id}")
                
                # Get Device objects for fetching (these have ThingSpeak credentials)
                devices = self.session.exec(
                    select(Device).where(Device.device_id.in_(device_ids))
                ).all()
                
                logger.info(f"Found {len(devices)} devices with ThingSpeak credentials out of {len(device_ids)} airqloud devices")
                
                if not devices:
                    logger.warning(f"No devices found in dim_device table for airqloud {airqloud.id}. "
                                 f"Device IDs from airqloud: {device_ids[:5]}")
                    logger.warning("Cannot fetch from ThingSpeak - devices missing channel_id/read_key")
                    return []
                
                # Fetch device performance for each device
                for device in devices:
                    # Check if this specific device is missing data
                    device_existing = [p for p in existing_device_performances if p.device_id == device.device_id]
                    if len(device_existing) < hours_in_range:
                        logger.info(f"Fetching ThingSpeak data for device {device.device_id}")
                        self.process_device(device, start_date, end_date)
                
                # Commit device performance records
                self.session.commit()
                
                # Re-fetch device performance after ThingSpeak fetch
                existing_device_performances = self.session.exec(
                    select(DevicePerformance).where(
                        and_(
                            DevicePerformance.device_id.in_(device_ids),
                            DevicePerformance.timestamp >= start_date,
                            DevicePerformance.timestamp <= end_date
                        )
                    )
                ).all()
                logger.info(f"After ThingSpeak fetch: {len(existing_device_performances)} device performance records")
            
            if not existing_device_performances:
                logger.warning(f"No device performance data available for airqloud {airqloud.id} (devices may not have ThingSpeak data)")
                return []
            
            # Group by date and calculate daily performance
            dates = set(p.timestamp.date() for p in existing_device_performances)
            created_records = []
            
            for date in sorted(dates):
                target_datetime = datetime.combine(date, datetime.min.time())
                
                # Calculate daily airqloud performance
                performance_data = self.calculate_airqloud_performance_daily(
                    airqloud.id, 
                    existing_device_performances,
                    target_datetime
                )
                
                if not performance_data:
                    continue
                
                # Create performance record in database
                performance_record = airqloud_performance.create(self.session, obj_in=performance_data)
                created_records.append(performance_record)
                self.stats['airqloud_performance_created'] += 1
            
            logger.info(f"Created {len(created_records)} daily performance records for airqloud {airqloud.id}")
            return created_records
            
        except Exception as e:
            logger.error(f"Error processing airqloud {airqloud.id}: {str(e)}")
            self.stats['errors'] += 1
            return []
    
    def run(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        device_ids: Optional[List[str]] = None,
        airqloud_ids: Optional[List[str]] = None
    ):
        """
        Main execution method to fetch ThingSpeak data and update performance tables
        
        Args:
            start_date: Start date for data fetch (defaults to 24 hours ago)
            end_date: End date for data fetch (defaults to now)
            device_ids: Optional list of specific device IDs to process
            airqloud_ids: Optional list of specific airqloud IDs to process
        """
        # Default date range: last 24 hours
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=1)
        
        logger.info(f"Starting ThingSpeak data fetch job")
        logger.info(f"Date range: {start_date.strftime('%Y-%m-%d %H:%M:%S')} to {end_date.strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # Fetch devices to process
            if device_ids:
                devices = self.session.exec(
                    select(Device).where(Device.device_id.in_(device_ids))
                ).all()
            else:
                # Get all active devices with ThingSpeak credentials
                devices = self.session.exec(
                    select(Device).where(
                        and_(
                            Device.is_active == True,
                            Device.channel_id.isnot(None),
                            Device.read_key.isnot(None)
                        )
                    )
                ).all()
            
            logger.info(f"Found {len(devices)} devices to process")
            
            # Process each device
            for device in devices:
                self.process_device(device, start_date, end_date)
                self.stats['devices_processed'] += 1
            
            # Commit device performance records
            self.session.commit()
            logger.info(f"Committed {self.stats['device_performance_created']} device performance records")
            
            # Process airqlouds
            if airqloud_ids:
                airqlouds = self.session.exec(
                    select(AirQloud).where(AirQloud.id.in_(airqloud_ids))
                ).all()
            else:
                # Get all active airqlouds
                airqlouds = self.session.exec(
                    select(AirQloud).where(AirQloud.is_active == True)
                ).all()
            
            logger.info(f"Found {len(airqlouds)} airqlouds to process")
            
            # Process each airqloud
            for airqloud in airqlouds:
                self.process_airqloud(airqloud, start_date, end_date)
                self.stats['airqlouds_processed'] += 1
            
            # Commit airqloud performance records
            self.session.commit()
            logger.info(f"Committed {self.stats['airqloud_performance_created']} airqloud performance records")
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            logger.error(f"Fatal error in ThingSpeak data fetch job: {str(e)}")
            self.session.rollback()
            raise
    
    def print_summary(self):
        """Print job execution summary"""
        logger.info("=" * 80)
        logger.info("ThingSpeak Data Fetch Job Summary")
        logger.info("=" * 80)
        logger.info(f"Devices processed: {self.stats['devices_processed']}")
        logger.info(f"Device records fetched: {self.stats['device_records_fetched']}")
        logger.info(f"Device performance records created: {self.stats['device_performance_created']}")
        logger.info(f"AirQlouds processed: {self.stats['airqlouds_processed']}")
        logger.info(f"AirQloud performance records created: {self.stats['airqloud_performance_created']}")
        logger.info(f"API requests made: {self.stats['api_requests']}")
        logger.info(f"Errors encountered: {self.stats['errors']}")
        logger.info("=" * 80)


def main():
    """Main entry point for the cronjob"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fetch ThingSpeak data and update performance tables')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, default=1, help='Number of days to fetch (default: 1)')
    parser.add_argument('--device-ids', type=str, nargs='+', help='Specific device IDs to process')
    parser.add_argument('--airqloud-ids', type=str, nargs='+', help='Specific airqloud IDs to process')
    
    args = parser.parse_args()
    
    # Parse dates
    start_date = None
    end_date = None
    
    if args.end_date:
        end_date = datetime.strptime(args.end_date, '%Y-%m-%d')
    else:
        end_date = datetime.utcnow()
    
    if args.start_date:
        start_date = datetime.strptime(args.start_date, '%Y-%m-%d')
    else:
        start_date = end_date - timedelta(days=args.days)
    
    # Create session and run job
    with SessionLocal() as session:
        fetcher = ThingSpeakDataFetcher(session)
        fetcher.run(
            start_date=start_date,
            end_date=end_date,
            device_ids=args.device_ids,
            airqloud_ids=args.airqloud_ids
        )


if __name__ == "__main__":
    main()
