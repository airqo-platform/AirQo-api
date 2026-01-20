"""
Enhanced cronjob to fetch data from ThingSpeak with fetch log tracking
This prevents repetitive data retrieval and recalculation by tracking what's already been processed
"""
import sys
import os
from pathlib import Path

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import math
import requests
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, date, timezone
from sqlmodel import Session, select, and_
from app.configs.database import SessionLocal
from app.models.device import Device
from app.models.airqloud import AirQloud, AirQloudDevice
from app.models.performance import (
    DevicePerformance, DevicePerformanceCreate,
    AirQloudPerformanceCreate
)
from app.crud.performance import device_performance, airqloud_performance
from app.crud.fetch_log import device_fetch_log, airqloud_fetch_log
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
REQUEST_TIMEOUT = 30  # seconds - ThingSpeak should respond faster than this


class EnhancedThingSpeakDataFetcher:
    """Fetch data from ThingSpeak with intelligent caching via fetch logs"""
    
    def __init__(self, session: Session):
        self.session = session
        self.stats = {
            'devices_processed': 0,
            'devices_skipped': 0,
            'device_records_fetched': 0,
            'device_performance_created': 0,
            'airqlouds_processed': 0,
            'airqlouds_skipped': 0,
            'airqloud_performance_created': 0,
            'errors': 0,
            'api_requests': 0,
            'fetch_logs_created': 0
        }
    
    def get_last_entry_timestamp(self, channel_id: int, api_key: str) -> Optional[datetime]:
        """Fetch the timestamp of the last entry in the channel"""
        url = f"{THINGSPEAK_BASE_URL}/channels/{channel_id}/feeds/last.json?api_key={api_key}"
        try:
            self.stats['api_requests'] += 1
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            created_at = data.get('created_at')
            if created_at:
                return datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            return None
        except Exception as e:
            logger.warning(f"Failed to get last entry for channel {channel_id}: {str(e)}")
            return None

    def fetch_device_data_from_thingspeak(
        self,
        channel_id: int,
        api_key: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """
        Fetch all data from ThingSpeak for a given channel and date range.
        Handles pagination by fetching in batches of 8000 records, moving forward in time.
        
        Strategy:
        1. Request data from start_date to end_date with results=8000
        2. If we get exactly 8000 records, there's likely more data
        3. Get the timestamp of the LAST record (newest in batch)
        4. Set new start_date to 1 second after that timestamp
        5. Repeat until we get fewer than 8000 records or reach end_date
        """
        all_feeds = []
        
        # Ensure datetimes are timezone-aware (UTC)
        if start_date.tzinfo is None:
            current_start = start_date.replace(tzinfo=timezone.utc)
        else:
            current_start = start_date
            
        if end_date.tzinfo is None:
            current_end = end_date.replace(tzinfo=timezone.utc)
        else:
            current_end = end_date
        
        try:
            batch_count = 0
            initial_window_days = 3  # Start with 3-day windows to avoid timeout on first request
            
            while current_start < current_end:
                batch_count += 1
                
                # For first few batches, use smaller window; then use full range
                if batch_count <= 2:
                    batch_end = min(
                        current_start + timedelta(days=initial_window_days),
                        current_end
                    )
                else:
                    batch_end = current_end
                
                url = (
                    f"{THINGSPEAK_BASE_URL}/channels/{channel_id}/feeds.json?"
                    f"start={current_start.strftime('%Y-%m-%dT%H:%M:%SZ')}&"
                    f"end={batch_end.strftime('%Y-%m-%dT%H:%M:%SZ')}&"
                    f"api_key={api_key}&results={MAX_RECORDS_PER_REQUEST}"
                )
                
                logger.info(f"Fetching batch {batch_count} from ThingSpeak for channel {channel_id}: "
                           f"{current_start.strftime('%Y-%m-%d %H:%M:%S')} to {batch_end.strftime('%Y-%m-%d %H:%M:%S')} "
                           f"(timeout in {REQUEST_TIMEOUT}s)")
                
                self.stats['api_requests'] += 1
                
                try:
                    response = requests.get(url, timeout=REQUEST_TIMEOUT)
                    response.raise_for_status()
                except requests.exceptions.Timeout:
                    logger.error(f"Request timed out after {REQUEST_TIMEOUT}s for channel {channel_id}. "
                               f"Range: {current_start.strftime('%Y-%m-%d')} to {batch_end.strftime('%Y-%m-%d')}")
                    self.stats['errors'] += 1
                    # Skip this window and try next one
                    if batch_end < current_end:
                        current_start = batch_end + timedelta(seconds=1)
                        logger.warning(f"Skipping timeout range, continuing from {current_start.strftime('%Y-%m-%d')}")
                        continue
                    else:
                        break
                
                data = response.json()
                feeds = data.get('feeds', [])
                
                if not feeds:
                    logger.info(f"No data found for channel {channel_id} in batch {batch_count}")
                    # If using small window and no data, try next window
                    if batch_count <= 2 and batch_end < current_end:
                        current_start = batch_end + timedelta(seconds=1)
                        continue
                    else:
                        break
                
                records_in_batch = len(feeds)
                all_feeds.extend(feeds)
                logger.info(f"Fetched {records_in_batch} records for channel {channel_id} in batch {batch_count}")
                
                # If we got less than MAX_RECORDS_PER_REQUEST, we've fetched all data in this window
                if records_in_batch < MAX_RECORDS_PER_REQUEST:
                    logger.info(f"Batch {batch_count} had {records_in_batch} records (less than {MAX_RECORDS_PER_REQUEST})")
                    
                    # If we haven't reached current_end yet, continue from where we left off
                    if batch_end < current_end:
                        current_start = batch_end + timedelta(seconds=1)
                        logger.info(f"Moving to next window from {current_start.strftime('%Y-%m-%d %H:%M:%S')}")
                        continue
                    else:
                        # Reached end with all data
                        break
                
                # We got exactly 8000 records - there's likely more data
                # Get the timestamp of the LAST record (newest) and continue from there
                last_record = feeds[-1]  # Last record is the newest in chronological order
                last_timestamp = last_record.get('created_at')
                
                if not last_timestamp:
                    logger.warning(f"No timestamp found in last record, stopping pagination")
                    break
                
                # Parse the timestamp and move forward 1 second
                new_start = datetime.fromisoformat(last_timestamp.replace('Z', '+00:00'))
                new_start = new_start + timedelta(seconds=1)
                
                # Check if we've reached or passed the end date
                if new_start >= current_end:
                    logger.info(f"Reached end date boundary, pagination complete")
                    break
                
                current_start = new_start
                logger.info(f"Got {MAX_RECORDS_PER_REQUEST} records - continuing pagination from {current_start.strftime('%Y-%m-%d %H:%M:%S')}")
            
            self.stats['device_records_fetched'] += len(all_feeds)
            logger.info(f"Total records fetched for channel {channel_id}: {len(all_feeds)} across {batch_count} batch(es)")
            return all_feeds
            
        except requests.exceptions.Timeout:
            logger.error(f"Timeout ({REQUEST_TIMEOUT}s) fetching data from ThingSpeak for channel {channel_id}")
            self.stats['errors'] += 1
            return all_feeds  # Return what we got so far
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching data from ThingSpeak for channel {channel_id}: {str(e)}")
            self.stats['errors'] += 1
            return all_feeds  # Return what we got so far
        except Exception as e:
            logger.error(f"Unexpected error fetching ThingSpeak data for channel {channel_id}: {str(e)}", exc_info=True)
            self.stats['errors'] += 1
            return all_feeds  # Return what we got so far
    
    def calculate_device_performance_hourly(
        self,
        feeds: List[Dict[str, Any]],
        device_id: str
    ) -> List[DevicePerformanceCreate]:
        """Calculate hourly performance metrics from ThingSpeak feed data"""
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
                
                timestamp = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                hour_key = timestamp.replace(minute=0, second=0, microsecond=0)
                
                field1 = feed.get('field1')
                field3 = feed.get('field3')
                field7 = feed.get('field7')
                
                hourly_data[hour_key].append({
                    'field1': field1,
                    'field3': field3,
                    'field7': field7,
                    'timestamp': timestamp
                })
            
            # Calculate performance for each hour
            performance_records = []
            
            for hour, data_points in hourly_data.items():
                freq = len(data_points)
                
                error_margins = []
                sum_s1 = 0.0
                sum_s2 = 0.0
                sum_sq_s1 = 0.0
                sum_sq_s2 = 0.0
                sum_prod = 0.0
                battery_values = []
                
                for point in data_points:
                    try:
                        field1_val = float(point['field1']) if point['field1'] else None
                        field3_val = float(point['field3']) if point['field3'] else None
                        field7_val = float(point['field7']) if point.get('field7') else None
                        
                        if field1_val is not None:
                            sum_s1 += field1_val
                            sum_sq_s1 += field1_val ** 2
                            
                        if field3_val is not None:
                            sum_s2 += field3_val
                            sum_sq_s2 += field3_val ** 2
                        
                        if field1_val is not None and field3_val is not None:
                            error_margins.append(abs(field1_val - field3_val))
                            sum_prod += field1_val * field3_val
                            
                        if field7_val is not None:
                            battery_values.append(field7_val)
                            
                    except (ValueError, TypeError):
                        continue
                
                avg_error_margin = sum(error_margins) / len(error_margins) if error_margins else 0
                avg_battery = sum(battery_values) / len(battery_values) if battery_values else None
                
                performance_records.append(DevicePerformanceCreate(
                    device_id=device_id,
                    freq=freq,
                    error_margin=round(avg_error_margin, 2),
                    timestamp=hour,
                    sum_s1=round(sum_s1, 2),
                    sum_s2=round(sum_s2, 2),
                    sum_sq_s1=round(sum_sq_s1, 2),
                    sum_sq_s2=round(sum_sq_s2, 2),
                    sum_product=round(sum_prod, 2),
                    avg_battery=round(avg_battery, 2) if avg_battery is not None else None
                ))
            
            logger.info(f"Calculated {len(performance_records)} hourly performance records for device {device_id}")
            return performance_records
            
        except Exception as e:
            logger.error(f"Error calculating hourly performance for device {device_id}: {str(e)}")
            self.stats['errors'] += 1
            return []
    
    def process_device_with_fetch_log(
        self,
        device: Device,
        start_date: datetime,
        end_date: datetime
    ) -> bool:
        """
        Process a single device with fetch log tracking
        
        Returns:
            True if data was fetched/updated, False if skipped
        """
        # Skip devices without ThingSpeak credentials
        if not device.channel_id or not device.read_key:
            logger.debug(f"Skipping device {device.device_id}: missing channel_id or read_key")
            return False
        
        try:
            # Check if we need to shift the window due to missing data
            # Logic: If requested period might be empty, check last entry and shift back
            current_start_dt = start_date
            current_end_dt = end_date

            # Validate dates are timezone aware
            if current_start_dt.tzinfo is None:
                current_start_dt = current_start_dt.replace(tzinfo=timezone.utc)
            if current_end_dt.tzinfo is None:
                current_end_dt = current_end_dt.replace(tzinfo=timezone.utc)
            
            # Check fetch log first to see if we already marked this range as complete (even if empty)
            start_date_d = current_start_dt.date()
            end_date_d = current_end_dt.date()
            
            initial_missing = device_fetch_log.get_missing_date_ranges(
                self.session,
                device_id=device.device_id,
                start_date=start_date_d,
                end_date=end_date_d,
                include_incomplete=True
            )
            
            # If fetch log implies we need to fetch, BUT we suspect the device is dead/offline,
            # we should verify the last entry timestamp.
            # We suspect if:
            # 1. We are about to fetch "today" or "recent past" but device.last_updated is old (if available)
            # 2. Or simply as a robust check if we find NO data after a simple fetch attempt (but that's expensive to try first).
            # Strategy: Query last.json IF we have a missing range.
            
            # If we have missing ranges and we want to ensure we get data:
            if initial_missing:
                # Check actual last entry
                last_entry_ts = self.get_last_entry_timestamp(device.channel_id, device.read_key)
                
                if last_entry_ts:
                    # If last entry is significantly older than end_date (e.g. more than 1 day gap)
                    # And last entry is BEFORE the requested end_date
                    if last_entry_ts < current_end_dt:
                        # Calculate gap
                        # We want to maintain the same duration (end_date - start_date)
                        duration = current_end_dt - current_start_dt
                        
                        # New end is the last entry timestamp (rounded up to end of day or just use timestamp)
                        # Let's align to the date of last entry?
                        # User said: "push the start date so we have a same total number of days"
                        
                        # Logic: Shift the window so that new_end matches last_entry_ts (or slightly after to capture it)
                        # But we must be careful not to shift into the future? No, we are shifting back.
                        
                        # Let's say we requested [Dec 25, Dec 30]. Last entry Dec 20.
                        # Gap = Dec 30 - Dec 20 = 10 days.
                        # New End = Dec 20. New Start = Dec 15.
                        # Wait, user said "missing some day(s) from the end... push the start date so we have a same total number of days"
                        
                        # Only shift if the gap is "significant" to avoid jitter?
                        # Let's compare dates.
                        
                        last_entry_date = last_entry_ts.date()
                        # If last data is before the requested end date range
                        if last_entry_date < end_date_d:
                            logger.info(f"Device {device.device_id}: Last entry {last_entry_date} is older than requested end {end_date_d}. Shifting window.")
                            
                            shift_delta = current_end_dt - last_entry_ts
                            # We might want to keep the end at last_entry_ts
                            # BUT we should verify if the gap is just missing days vs device dead.
                            # If device is dead, we shift.
                            
                            # Shifted dates
                            current_end_dt = last_entry_ts
                            current_start_dt = current_start_dt - shift_delta
                            
                            # Re-align to timezone
                            if current_start_dt.tzinfo is None:
                                current_start_dt = current_start_dt.replace(tzinfo=timezone.utc)
                            if current_end_dt.tzinfo is None:
                                current_end_dt = current_end_dt.replace(tzinfo=timezone.utc)
                                
                            logger.info(f"Device {device.device_id}: Shifted window to {current_start_dt} - {current_end_dt}")
            
            # Convert to dates for fetch log (using potentially shifted dates)
            start_dt = current_start_dt.date()
            end_dt = current_end_dt.date()
            today = date.today()
            
            # Determine if this fetch will be complete
            is_complete = end_dt < today
            
            # Re-calculate missing ranges for the NEW window
            # Note: We also need to "fill in" the gap we leaped over in the fetch log?
            # User said: "log the dates even those that had no data as well as the ones added"
            # access original requested range: start_date.date() to end_date.date()
            # We should probably log the "skipped" future gap as complete/empty.
            

            
            missing_ranges = device_fetch_log.get_missing_date_ranges(
                self.session,
                device_id=device.device_id,
                start_date=start_dt,
                end_date=end_dt,
                include_incomplete=True
            )
            
            if not missing_ranges:
                logger.info(f"Device {device.device_id}: All data already fetched for {start_dt} to {end_dt}, skipping")
                self.stats['devices_skipped'] += 1
                return False
            
            logger.info(f"Device {device.device_id}: Need to fetch {len(missing_ranges)} date range(s)")
            
            # Track if we successfully processed at least one range
            any_success = False
            
            # Prepare to track the latest timestamp we see across all batches for this device
            max_timestamp_seen = None
            
            # Fetch data for each missing range
            for range_start, range_end in missing_ranges:
                logger.info(f"Device {device.device_id}: Fetching {range_start} to {range_end}")
                
                # Convert dates back to datetime for API call (timezone-aware UTC)
                range_start_dt = datetime.combine(range_start, datetime.min.time()).replace(tzinfo=timezone.utc)
                range_end_dt = datetime.combine(range_end, datetime.max.time()).replace(tzinfo=timezone.utc)
                
                # Fetch data from ThingSpeak
                feeds = self.fetch_device_data_from_thingspeak(
                    channel_id=device.channel_id,
                    api_key=device.read_key,
                    start_date=range_start_dt,
                    end_date=range_end_dt
                )
                
                range_is_complete = is_complete if range_end == end_dt else True
                
                if not feeds:
                    logger.warning(f"No data fetched for device {device.device_id} in range {range_start} to {range_end}")
                    # Log as complete
                    device_fetch_log.create_or_extend_log(
                        self.session,
                        device_id=device.device_id,
                        start_date=range_start,
                        end_date=range_end,
                        complete=range_is_complete
                    )
                    self.session.commit()
                    self.stats['fetch_logs_created'] += 1
                    any_success = True
                    continue
                
                # Check timestamps in feeds for max
                for feed in feeds:
                    ts_str = feed.get('created_at')
                    if ts_str:
                        ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                        if max_timestamp_seen is None or ts > max_timestamp_seen:
                            max_timestamp_seen = ts

                # Calculate hourly performance metrics
                performance_data_list = self.calculate_device_performance_hourly(feeds, device.device_id)
                
                if not performance_data_list:
                    logger.warning(f"No performance metrics calculated for device {device.device_id} in range {range_start} to {range_end}")
                    device_fetch_log.create_or_extend_log(
                        self.session,
                        device_id=device.device_id,
                        start_date=range_start,
                        end_date=range_end,
                        complete=range_is_complete
                    )
                    self.session.commit()
                    self.stats['fetch_logs_created'] += 1
                    any_success = True
                    continue
                
                # Create performance records
                records_created = 0
                for performance_data in performance_data_list:
                    try:
                        device_performance.create(self.session, obj_in=performance_data)
                        records_created += 1
                        self.stats['device_performance_created'] += 1
                    except Exception as e:
                        if 'unique constraint' in str(e).lower() or 'duplicate' in str(e).lower():
                            logger.debug(f"Skipping duplicate performance record for device {device.device_id}")
                            continue
                        else:
                            logger.error(f"Error creating performance record for device {device.device_id}: {str(e)}")
                            raise
                
                # Update fetch log
                device_fetch_log.create_or_extend_log(
                    self.session,
                    device_id=device.device_id,
                    start_date=range_start,
                    end_date=range_end,
                    complete=range_is_complete
                )
                
                self.session.commit()
                self.stats['fetch_logs_created'] += 1
                any_success = True
                
                logger.info(f"Device {device.device_id}: Completed fetch for {range_start} to {range_end} "
                           f"({records_created} records, complete={range_is_complete})")
            
            # If we shifted the window, we should also mark the "gap" (the original requested end) as complete/logged
            # so we don't keep trying to fetch it.
            if end_date_d > end_dt:
                # Gap is from (end_dt + 1 day) to end_date_d
                gap_start = end_dt + timedelta(days=1)
                if gap_start <= end_date_d:
                    logger.info(f"Logging empty gap for device {device.device_id}: {gap_start} to {end_date_d}")
                    device_fetch_log.create_or_extend_log(
                        self.session,
                        device_id=device.device_id,
                        start_date=gap_start,
                        end_date=end_date_d,
                        complete=True
                    )
                    self.session.commit()

            # Update device.last_updated if we found newer data
            if max_timestamp_seen:
                # Validate not in future
                now_utc = datetime.now(timezone.utc)
                if max_timestamp_seen <= now_utc:
                    # Check if newer than current last_updated
                    current_last = device.last_updated
                    if current_last is None or list(current_last.timetuple()) < list(max_timestamp_seen.timetuple()): # Simplified comparison
                        # Ensure timezone awareness match
                        if current_last and current_last.tzinfo is None:
                             current_last = current_last.replace(tzinfo=timezone.utc)
                        
                        if current_last is None or max_timestamp_seen > current_last:
                            logger.info(f"Updating last_updated for device {device.device_id} to {max_timestamp_seen}")
                            device.last_updated = max_timestamp_seen
                            self.session.add(device)
                            self.session.commit()
                else:
                    logger.warning(f"Device {device.device_id} reported future timestamp {max_timestamp_seen}, ignoring update")

            self.stats['devices_processed'] += 1
            return any_success
            
        except Exception as e:
            logger.error(f"Error processing device {device.device_id}: {str(e)}")
            self.stats['errors'] += 1
            return False
    
    def calculate_airqloud_performance_daily(
        self,
        airqloud_id: str,
        device_performances: List[DevicePerformance],
        all_device_ids: List[str],
        target_date: datetime
    ) -> Optional[AirQloudPerformanceCreate]:
        """
        Calculate daily AirQloud performance based on device performances
        
        Args:
            airqloud_id: ID of the AirQloud
            device_performances: All device performance records for the date range
            all_device_ids: Complete list of all device IDs in the AirQloud (including those with no data)
            target_date: The specific date to calculate performance for
            
        Returns:
            AirQloudPerformanceCreate object or None
            
        Frequency calculation:
            - For each device, count unique hours with data (0-24)
            - Average across ALL devices (including those with 0 hours)
            - Formula: sum(unique_hours_per_device) / total_devices
            
        Error margin calculation:
            - Average only where data exists
        """
        if not all_device_ids:
            logger.warning(f"No device IDs provided for airqloud {airqloud_id}")
            return None
        
        try:
            from collections import defaultdict
            
            day_timestamp = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Group performance records by device for the target date
            device_data = defaultdict(list)
            
            for perf in device_performances:
                if perf.timestamp.date() == target_date.date():
                    device_data[perf.device_id].append(perf)
            
            # Calculate metrics considering ALL devices in the AirQloud
            total_devices = len(all_device_ids)
            device_uptimes = []
            all_error_margins = []
            
            for device_id in all_device_ids:
                if device_id in device_data:
                    # Device has data - count unique hours
                    performances = device_data[device_id]
                    unique_hours = len(set(p.timestamp.replace(minute=0, second=0, microsecond=0) 
                                          for p in performances))
                    device_uptimes.append(unique_hours)
                    
                    # Collect error margins from this device (filter out None and NaN values)
                    all_error_margins.extend([
                        p.error_margin for p in performances 
                        if p.error_margin is not None and not math.isnan(p.error_margin)
                    ])
                else:
                    # Device has no data for this day - counts as 0 hours
                    device_uptimes.append(0)
                    logger.debug(f"Device {device_id} has 0 hours of data on {target_date.date()}")
            
            # Frequency: average of unique hours across ALL devices (includes devices with 0 hours)
            avg_uptime = sum(device_uptimes) / total_devices if total_devices > 0 else 0
            
            # Error margin: average only where data exists
            avg_error_margin = sum(all_error_margins) / len(all_error_margins) if all_error_margins else 0
            
            logger.info(f"AirQloud {airqloud_id} on {target_date.date()}: "
                       f"{len([u for u in device_uptimes if u > 0])}/{total_devices} devices with data, "
                       f"avg uptime={avg_uptime:.2f} hours, avg error margin={avg_error_margin:.2f}")
            
            return AirQloudPerformanceCreate(
                airqloud_id=airqloud_id,
                freq=int(round(avg_uptime)),
                error_margin=round(avg_error_margin, 2),
                timestamp=day_timestamp
            )
            
        except Exception as e:
            logger.error(f"Error calculating daily performance for airqloud {airqloud_id}: {str(e)}")
            self.stats['errors'] += 1
            return None
    
    def process_airqloud_with_fetch_log(
        self,
        airqloud: AirQloud,
        start_date: datetime,
        end_date: datetime
    ) -> bool:
        """
        Process a single airqloud with fetch log tracking
        
        Returns:
            True if data was calculated/updated, False if skipped
        """
        try:
            # Convert to dates for fetch log
            start_dt = start_date.date()
            end_dt = end_date.date()
            today = date.today()
            
            # Determine if this fetch will be complete
            is_complete = end_dt < today
            
            # Check fetch log for missing ranges
            missing_ranges = airqloud_fetch_log.get_missing_date_ranges(
                self.session,
                airqloud_id=airqloud.id,
                start_date=start_dt,
                end_date=end_dt,
                include_incomplete=True
            )
            
            if not missing_ranges:
                logger.info(f"AirQloud {airqloud.id}: All data already calculated for {start_dt} to {end_dt}, skipping")
                self.stats['airqlouds_skipped'] += 1
                return False
            
            logger.info(f"AirQloud {airqloud.id}: Need to calculate {len(missing_ranges)} date range(s)")
            
            # Get all devices in this airqloud
            airqloud_devices = self.session.exec(
                select(AirQloudDevice).where(AirQloudDevice.cohort_id == airqloud.id)
            ).all()
            
            if not airqloud_devices:
                logger.warning(f"No devices found for airqloud {airqloud.id}")
                return False
            
            device_ids = [ad.id for ad in airqloud_devices]
            logger.info(f"AirQloud {airqloud.id} has {len(device_ids)} devices")
            
            # Process each missing range
            for range_start, range_end in missing_ranges:
                logger.info(f"AirQloud {airqloud.id}: Calculating {range_start} to {range_end}")
                
                # Convert dates to datetime
                range_start_dt = datetime.combine(range_start, datetime.min.time())
                range_end_dt = datetime.combine(range_end, datetime.max.time())
                
                # Ensure device performance data exists for all devices in this range
                # This will automatically handle device fetch logs
                devices = self.session.exec(
                    select(Device).where(Device.device_id.in_(device_ids))
                ).all()
                
                for device in devices:
                    self.process_device_with_fetch_log(device, range_start_dt, range_end_dt)
                
                # Get device performance data for calculation
                device_performances = self.session.exec(
                    select(DevicePerformance).where(
                        and_(
                            DevicePerformance.device_id.in_(device_ids),
                            DevicePerformance.timestamp >= range_start_dt,
                            DevicePerformance.timestamp <= range_end_dt
                        )
                    )
                ).all()
                
                # Calculate daily airqloud performance for each day in range
                # Even if no device_performances, we still need to calculate (devices with 0 hours affect the average)
                current_date = range_start
                created_count = 0
                
                while current_date <= range_end:
                    target_datetime = datetime.combine(current_date, datetime.min.time())
                    
                    performance_data = self.calculate_airqloud_performance_daily(
                        airqloud.id,
                        device_performances,
                        device_ids,  # Pass all device IDs including those with no data
                        target_datetime
                    )
                    
                    if performance_data:
                        try:
                            airqloud_performance.create(self.session, obj_in=performance_data)
                            self.stats['airqloud_performance_created'] += 1
                            created_count += 1
                        except Exception as e:
                            # Silently skip duplicates
                            if 'unique constraint' in str(e).lower() or 'duplicate' in str(e).lower():
                                logger.debug(f"Skipping duplicate performance record for airqloud {airqloud.id}")
                            else:
                                raise
                    
                    current_date += timedelta(days=1)
                
                logger.info(f"AirQloud {airqloud.id}: Created {created_count} daily performance records")
                
                # Update fetch log for this range
                range_is_complete = is_complete if range_end == end_dt else True
                airqloud_fetch_log.create_or_extend_log(
                    self.session,
                    airqloud_id=airqloud.id,
                    start_date=range_start,
                    end_date=range_end,
                    complete=range_is_complete
                )
                
                # Commit after each range to ensure data is saved
                self.session.commit()
                self.stats['fetch_logs_created'] += 1
                
                logger.info(f"AirQloud {airqloud.id}: Completed calculation for {range_start} to {range_end} "
                           f"({created_count} records, complete={range_is_complete})")
            
            self.stats['airqlouds_processed'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Error processing airqloud {airqloud.id}: {str(e)}")
            self.stats['errors'] += 1
            return False
    
    def run(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        device_ids: Optional[List[str]] = None,
        airqloud_ids: Optional[List[str]] = None
    ):
        """Main execution method with fetch log tracking"""
        # Default date range: last 24 hours
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            start_date = end_date - timedelta(days=1)
        
        logger.info(f"Starting Enhanced ThingSpeak data fetch job with fetch log tracking")
        logger.info(f"Date range: {start_date.strftime('%Y-%m-%d %H:%M:%S')} to {end_date.strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # Fetch devices to process
            if device_ids:
                devices = self.session.exec(
                    select(Device).where(Device.device_id.in_(device_ids))
                ).all()
            else:
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
                self.process_device_with_fetch_log(device, start_date, end_date)
            
            # Commit device performance and fetch logs
            self.session.commit()
            logger.info(f"Committed device performance and fetch logs")
            
            # Process airqlouds
            if airqloud_ids:
                airqlouds = self.session.exec(
                    select(AirQloud).where(AirQloud.id.in_(airqloud_ids))
                ).all()
            else:
                airqlouds = self.session.exec(
                    select(AirQloud).where(AirQloud.is_active == True)
                ).all()
            
            logger.info(f"Found {len(airqlouds)} airqlouds to process")
            
            # Process each airqloud
            for airqloud in airqlouds:
                self.process_airqloud_with_fetch_log(airqloud, start_date, end_date)
            
            # Commit airqloud performance and fetch logs
            self.session.commit()
            logger.info(f"Committed airqloud performance and fetch logs")
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            logger.error(f"Fatal error in Enhanced ThingSpeak data fetch job: {str(e)}")
            self.session.rollback()
            raise
    
    def print_summary(self):
        """Print job execution summary"""
        logger.info("=" * 80)
        logger.info("Enhanced ThingSpeak Data Fetch Job Summary")
        logger.info("=" * 80)
        logger.info(f"Devices processed: {self.stats['devices_processed']}")
        logger.info(f"Devices skipped (already fetched): {self.stats['devices_skipped']}")
        logger.info(f"Device records fetched: {self.stats['device_records_fetched']}")
        logger.info(f"Device performance records created: {self.stats['device_performance_created']}")
        logger.info(f"AirQlouds processed: {self.stats['airqlouds_processed']}")
        logger.info(f"AirQlouds skipped (already calculated): {self.stats['airqlouds_skipped']}")
        logger.info(f"AirQloud performance records created: {self.stats['airqloud_performance_created']}")
        logger.info(f"Fetch logs created/updated: {self.stats['fetch_logs_created']}")
        logger.info(f"API requests made: {self.stats['api_requests']}")
        logger.info(f"Errors encountered: {self.stats['errors']}")
        logger.info("=" * 80)


def main():
    """Main entry point for the enhanced cronjob"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Enhanced ThingSpeak data fetch with fetch log tracking')
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
        end_date = datetime.now(timezone.utc)
    
    if args.start_date:
        start_date = datetime.strptime(args.start_date, '%Y-%m-%d')
    else:
        start_date = end_date - timedelta(days=args.days)
    
    # Create session and run job
    with SessionLocal() as session:
        fetcher = EnhancedThingSpeakDataFetcher(session)
        fetcher.run(
            start_date=start_date,
            end_date=end_date,
            device_ids=args.device_ids,
            airqloud_ids=args.airqloud_ids
        )


if __name__ == "__main__":
    main()
