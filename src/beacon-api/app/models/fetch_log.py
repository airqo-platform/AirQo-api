from sqlmodel import Field, SQLModel, UniqueConstraint
from typing import Optional
from datetime import datetime, date, timezone


class DeviceFetchLogBase(SQLModel):
    """Base model for Device Fetch Log"""
    device_id: str = Field(foreign_key="dim_device.device_id")
    start_date: date = Field(description="Start date for the fetch period")
    end_date: date = Field(description="End date for the fetch period")
    complete: bool = Field(default=False, description="True if fetch is complete (not including current day)")


class DeviceFetchLog(DeviceFetchLogBase, table=True):
    """Device Fetch Log database model - tracks which data has been fetched"""
    __tablename__ = "fetch_log_device"
    
    log_id: Optional[int] = Field(default=None, primary_key=True)
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        UniqueConstraint('device_id', 'start_date', 'end_date', name='uq_device_fetch_log'),
    )


class DeviceFetchLogCreate(DeviceFetchLogBase):
    """Schema for creating Device Fetch Log"""
    pass


class DeviceFetchLogUpdate(SQLModel):
    """Schema for updating Device Fetch Log"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    complete: Optional[bool] = None


class DeviceFetchLogRead(DeviceFetchLogBase):
    """Schema for reading Device Fetch Log"""
    log_id: int
    created_at: datetime
    updated_at: datetime


class AirQloudFetchLogBase(SQLModel):
    """Base model for AirQloud Fetch Log"""
    airqloud_id: str = Field(foreign_key="dim_airqloud.id")
    start_date: date = Field(description="Start date for the fetch period")
    end_date: date = Field(description="End date for the fetch period")
    complete: bool = Field(default=False, description="True if fetch is complete (not including current day)")


class AirQloudFetchLog(AirQloudFetchLogBase, table=True):
    """AirQloud Fetch Log database model - tracks which data has been fetched"""
    __tablename__ = "fetch_log_airqloud"
    
    log_id: Optional[int] = Field(default=None, primary_key=True)
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        UniqueConstraint('airqloud_id', 'start_date', 'end_date', name='uq_airqloud_fetch_log'),
    )


class AirQloudFetchLogCreate(AirQloudFetchLogBase):
    """Schema for creating AirQloud Fetch Log"""
    pass


class AirQloudFetchLogUpdate(SQLModel):
    """Schema for updating AirQloud Fetch Log"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    complete: Optional[bool] = None


class AirQloudFetchLogRead(AirQloudFetchLogBase):
    """Schema for reading AirQloud Fetch Log"""
    log_id: int
    created_at: datetime
    updated_at: datetime
