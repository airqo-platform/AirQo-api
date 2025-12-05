from typing import List, Tuple
from sqlmodel import Session, select, and_, or_
from datetime import date, datetime, timedelta, timezone
from app.crud.base import CRUDBase
from app.models.fetch_log import (
    DeviceFetchLog, DeviceFetchLogCreate, DeviceFetchLogUpdate,
    AirQloudFetchLog, AirQloudFetchLogCreate, AirQloudFetchLogUpdate
)
import logging

logger = logging.getLogger(__name__)


class CRUDDeviceFetchLog(CRUDBase[DeviceFetchLog, DeviceFetchLogCreate, DeviceFetchLogUpdate]):
    def get_missing_date_ranges(
        self, 
        db: Session, 
        device_id: str,
        start_date: date,
        end_date: date,
        include_incomplete: bool = True
    ) -> List[Tuple[date, date]]:
        """
        Get date ranges that need to be fetched for a device.
        
        Args:
            db: Database session
            device_id: Device ID
            start_date: Requested start date
            end_date: Requested end date
            include_incomplete: If True, also refetch incomplete ranges
            
        Returns:
            List of (start_date, end_date) tuples that need to be fetched
        """
        try:
            # Get all fetch logs for this device that overlap with the requested range
            statement = select(DeviceFetchLog).where(
                and_(
                    DeviceFetchLog.device_id == device_id,
                    or_(
                        # Log starts before end_date and ends after start_date (overlaps)
                        and_(
                            DeviceFetchLog.start_date <= end_date,
                            DeviceFetchLog.end_date >= start_date
                        )
                    )
                )
            ).order_by(DeviceFetchLog.start_date)
            
            logs = db.exec(statement).all()
            
            if not logs:
                # No existing logs, return the full range
                return [(start_date, end_date)]
            
            # Filter out incomplete logs if needed
            if not include_incomplete:
                logs = [log for log in logs if log.complete]
            
            # Find gaps in coverage
            missing_ranges = []
            current_start = start_date
            
            for log in logs:
                # If there's a gap before this log
                if current_start < log.start_date:
                    gap_end = log.start_date - timedelta(days=1)
                    if gap_end <= end_date:
                        missing_ranges.append((current_start, min(gap_end, end_date)))
                
                # Move current_start past this log
                current_start = max(current_start, log.end_date + timedelta(days=1))
                
                # If we've covered the entire range, break
                if current_start > end_date:
                    break
            
            # Check if there's a gap at the end
            if current_start <= end_date:
                missing_ranges.append((current_start, end_date))
            
            logger.info(f"Device {device_id}: Found {len(missing_ranges)} missing date ranges in {start_date} to {end_date}")
            return missing_ranges
            
        except Exception as e:
            logger.error(f"Error getting missing date ranges for device {device_id}: {str(e)}")
            # On error, return the full range to be safe
            return [(start_date, end_date)]
    
    def create_or_extend_log(
        self,
        db: Session,
        device_id: str,
        start_date: date,
        end_date: date,
        complete: bool = False
    ) -> DeviceFetchLog:
        """
        Create a new fetch log or extend an existing one if ranges overlap.
        
        Args:
            db: Database session
            device_id: Device ID
            start_date: Start date of the fetch
            end_date: End date of the fetch
            complete: Whether the fetch is complete
            
        Returns:
            Created or updated DeviceFetchLog
        """
        try:
            # Check for overlapping or adjacent logs
            statement = select(DeviceFetchLog).where(
                and_(
                    DeviceFetchLog.device_id == device_id,
                    or_(
                        # Overlaps or adjacent
                        and_(
                            DeviceFetchLog.start_date <= end_date + timedelta(days=1),
                            DeviceFetchLog.end_date >= start_date - timedelta(days=1)
                        )
                    )
                )
            )
            
            overlapping_logs = db.exec(statement).all()
            
            if not overlapping_logs:
                # No overlap, create new log
                log_data = DeviceFetchLogCreate(
                    device_id=device_id,
                    start_date=start_date,
                    end_date=end_date,
                    complete=complete
                )
                return self.create(db, obj_in=log_data)
            
            # Merge all overlapping logs
            merged_start = min(start_date, *[log.start_date for log in overlapping_logs])
            merged_end = max(end_date, *[log.end_date for log in overlapping_logs])
            merged_complete = complete and all(log.complete for log in overlapping_logs)
            
            # Keep the first log, delete others
            primary_log = overlapping_logs[0]
            for log in overlapping_logs[1:]:
                db.delete(log)
            
            # Update the primary log
            primary_log.start_date = merged_start
            primary_log.end_date = merged_end
            primary_log.complete = merged_complete
            primary_log.updated_at = datetime.now(timezone.utc)
            
            db.add(primary_log)
            db.commit()
            db.refresh(primary_log)
            
            logger.info(f"Merged {len(overlapping_logs)} logs for device {device_id} into range {merged_start} to {merged_end}")
            return primary_log
            
        except Exception as e:
            logger.error(f"Error creating/extending fetch log for device {device_id}: {str(e)}")
            db.rollback()
            raise


class CRUDAirQloudFetchLog(CRUDBase[AirQloudFetchLog, AirQloudFetchLogCreate, AirQloudFetchLogUpdate]):
    def get_missing_date_ranges(
        self, 
        db: Session, 
        airqloud_id: str,
        start_date: date,
        end_date: date,
        include_incomplete: bool = True
    ) -> List[Tuple[date, date]]:
        """
        Get date ranges that need to be fetched for an airqloud.
        
        Args:
            db: Database session
            airqloud_id: AirQloud ID
            start_date: Requested start date
            end_date: Requested end date
            include_incomplete: If True, also refetch incomplete ranges
            
        Returns:
            List of (start_date, end_date) tuples that need to be fetched
        """
        try:
            # Get all fetch logs for this airqloud that overlap with the requested range
            statement = select(AirQloudFetchLog).where(
                and_(
                    AirQloudFetchLog.airqloud_id == airqloud_id,
                    or_(
                        # Log starts before end_date and ends after start_date (overlaps)
                        and_(
                            AirQloudFetchLog.start_date <= end_date,
                            AirQloudFetchLog.end_date >= start_date
                        )
                    )
                )
            ).order_by(AirQloudFetchLog.start_date)
            
            logs = db.exec(statement).all()
            
            if not logs:
                # No existing logs, return the full range
                return [(start_date, end_date)]
            
            # Filter out incomplete logs if needed
            if not include_incomplete:
                logs = [log for log in logs if log.complete]
            
            # Find gaps in coverage
            missing_ranges = []
            current_start = start_date
            
            for log in logs:
                # If there's a gap before this log
                if current_start < log.start_date:
                    gap_end = log.start_date - timedelta(days=1)
                    if gap_end <= end_date:
                        missing_ranges.append((current_start, min(gap_end, end_date)))
                
                # Move current_start past this log
                current_start = max(current_start, log.end_date + timedelta(days=1))
                
                # If we've covered the entire range, break
                if current_start > end_date:
                    break
            
            # Check if there's a gap at the end
            if current_start <= end_date:
                missing_ranges.append((current_start, end_date))
            
            logger.info(f"AirQloud {airqloud_id}: Found {len(missing_ranges)} missing date ranges in {start_date} to {end_date}")
            return missing_ranges
            
        except Exception as e:
            logger.error(f"Error getting missing date ranges for airqloud {airqloud_id}: {str(e)}")
            # On error, return the full range to be safe
            return [(start_date, end_date)]
    
    def create_or_extend_log(
        self,
        db: Session,
        airqloud_id: str,
        start_date: date,
        end_date: date,
        complete: bool = False
    ) -> AirQloudFetchLog:
        """
        Create a new fetch log or extend an existing one if ranges overlap.
        
        Args:
            db: Database session
            airqloud_id: AirQloud ID
            start_date: Start date of the fetch
            end_date: End date of the fetch
            complete: Whether the fetch is complete
            
        Returns:
            Created or updated AirQloudFetchLog
        """
        try:
            # Check for overlapping or adjacent logs
            statement = select(AirQloudFetchLog).where(
                and_(
                    AirQloudFetchLog.airqloud_id == airqloud_id,
                    or_(
                        # Overlaps or adjacent
                        and_(
                            AirQloudFetchLog.start_date <= end_date + timedelta(days=1),
                            AirQloudFetchLog.end_date >= start_date - timedelta(days=1)
                        )
                    )
                )
            )
            
            overlapping_logs = db.exec(statement).all()
            
            if not overlapping_logs:
                # No overlap, create new log
                log_data = AirQloudFetchLogCreate(
                    airqloud_id=airqloud_id,
                    start_date=start_date,
                    end_date=end_date,
                    complete=complete
                )
                return self.create(db, obj_in=log_data)
            
            # Merge all overlapping logs
            merged_start = min(start_date, *[log.start_date for log in overlapping_logs])
            merged_end = max(end_date, *[log.end_date for log in overlapping_logs])
            merged_complete = complete and all(log.complete for log in overlapping_logs)
            
            # Keep the first log, delete others
            primary_log = overlapping_logs[0]
            for log in overlapping_logs[1:]:
                db.delete(log)
            
            # Update the primary log
            primary_log.start_date = merged_start
            primary_log.end_date = merged_end
            primary_log.complete = merged_complete
            primary_log.updated_at = datetime.now(timezone.utc)
            
            db.add(primary_log)
            db.commit()
            db.refresh(primary_log)
            
            logger.info(f"Merged {len(overlapping_logs)} logs for airqloud {airqloud_id} into range {merged_start} to {merged_end}")
            return primary_log
            
        except Exception as e:
            logger.error(f"Error creating/extending fetch log for airqloud {airqloud_id}: {str(e)}")
            db.rollback()
            raise


# Create instances
device_fetch_log = CRUDDeviceFetchLog(DeviceFetchLog)
airqloud_fetch_log = CRUDAirQloudFetchLog(AirQloudFetchLog)
