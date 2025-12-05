from typing import List
from sqlmodel import Session, select, and_
from datetime import datetime
from app.crud.base import CRUDBase
from app.models.performance import (
    DevicePerformance, DevicePerformanceCreate, DevicePerformanceRead,
    AirQloudPerformance, AirQloudPerformanceCreate, AirQloudPerformanceRead
)
import logging

logger = logging.getLogger(__name__)


class CRUDDevicePerformance(CRUDBase[DevicePerformance, DevicePerformanceCreate, DevicePerformanceRead]):
    def get_performance_by_devices(
        self, 
        db: Session, 
        *, 
        device_ids: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> List[DevicePerformance]:
        """
        Get performance data for multiple devices within a date range
        """
        try:
            statement = select(DevicePerformance).where(
                and_(
                    DevicePerformance.device_id.in_(device_ids),
                    DevicePerformance.timestamp >= start_date,
                    DevicePerformance.timestamp <= end_date
                )
            ).order_by(DevicePerformance.timestamp.desc())
            
            results = db.exec(statement).all()
            logger.info(f"Retrieved {len(results)} device performance records for {len(device_ids)} devices")
            return results
        except Exception as e:
            logger.error(f"Error retrieving device performance data: {str(e)}")
            raise

    def get_performance_by_device(
        self,
        db: Session,
        *,
        device_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[DevicePerformance]:
        """
        Get performance data for a single device within a date range
        """
        try:
            statement = select(DevicePerformance).where(
                and_(
                    DevicePerformance.device_id == device_id,
                    DevicePerformance.timestamp >= start_date,
                    DevicePerformance.timestamp <= end_date
                )
            ).order_by(DevicePerformance.timestamp.desc())
            
            results = db.exec(statement).all()
            logger.info(f"Retrieved {len(results)} performance records for device {device_id}")
            return results
        except Exception as e:
            logger.error(f"Error retrieving performance data for device {device_id}: {str(e)}")
            raise


class CRUDAirQloudPerformance(CRUDBase[AirQloudPerformance, AirQloudPerformanceCreate, AirQloudPerformanceRead]):
    def get_performance_by_airqlouds(
        self,
        db: Session,
        *,
        airqloud_ids: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> List[AirQloudPerformance]:
        """
        Get performance data for multiple airqlouds within a date range
        """
        try:
            # Normalize dates to midnight for airqloud queries (daily granularity)
            # Database stores airqloud performance at 00:00:00 for each day
            start_normalized = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_normalized = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            logger.info(f"CRUD: Querying airqloud performance for IDs: {airqloud_ids}")
            logger.info(f"CRUD: Original range: {start_date} to {end_date}")
            logger.info(f"CRUD: Normalized range: {start_normalized} to {end_normalized}")
            
            statement = select(AirQloudPerformance).where(
                and_(
                    AirQloudPerformance.airqloud_id.in_(airqloud_ids),
                    AirQloudPerformance.timestamp >= start_normalized,
                    AirQloudPerformance.timestamp <= end_normalized
                )
            ).order_by(AirQloudPerformance.timestamp.desc())
            
            results = db.exec(statement).all()
            logger.info(f"CRUD: Retrieved {len(results)} airqloud performance records for {len(airqloud_ids)} airqlouds")
            
            if results:
                logger.info(f"CRUD: Sample record: airqloud_id={results[0].airqloud_id}, "
                          f"timestamp={results[0].timestamp}, freq={results[0].freq}")
            
            return results
        except Exception as e:
            logger.error(f"Error retrieving airqloud performance data: {str(e)}")
            raise

    def get_performance_by_airqloud(
        self,
        db: Session,
        *,
        airqloud_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[AirQloudPerformance]:
        """
        Get performance data for a single airqloud within a date range
        """
        try:
            statement = select(AirQloudPerformance).where(
                and_(
                    AirQloudPerformance.airqloud_id == airqloud_id,
                    AirQloudPerformance.timestamp >= start_date,
                    AirQloudPerformance.timestamp <= end_date
                )
            ).order_by(AirQloudPerformance.timestamp.desc())
            
            results = db.exec(statement).all()
            logger.info(f"Retrieved {len(results)} performance records for airqloud {airqloud_id}")
            return results
        except Exception as e:
            logger.error(f"Error retrieving performance data for airqloud {airqloud_id}: {str(e)}")
            raise


# Create instances
device_performance = CRUDDevicePerformance(DevicePerformance)
airqloud_performance = CRUDAirQloudPerformance(AirQloudPerformance)
