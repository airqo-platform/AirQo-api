from sqlmodel import Field, SQLModel, UniqueConstraint
from typing import Optional
from datetime import datetime


class DevicePerformanceBase(SQLModel):
    """Base model for Device Performance"""
    device_id: str = Field(foreign_key="dim_device.device_id")
    freq: Optional[int] = Field(default=None)
    error_margin: Optional[float] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DevicePerformance(DevicePerformanceBase, table=True):
    """Device Performance database model"""
    __tablename__ = "fact_device_performance"
    
    performance_key: Optional[int] = Field(default=None, primary_key=True)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('device_id', 'timestamp', name='uq_device_performance_id_timestamp'),
    )


class DevicePerformanceCreate(DevicePerformanceBase):
    """Schema for creating Device Performance"""
    pass


class DevicePerformanceRead(DevicePerformanceBase):
    """Schema for reading Device Performance"""
    performance_key: int
    created_at: Optional[datetime] = None


class AirQloudPerformanceBase(SQLModel):
    """Base model for AirQloud Performance"""
    airqloud_id: str = Field(foreign_key="dim_airqloud.id")
    freq: Optional[int] = Field(default=None)
    error_margin: Optional[float] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AirQloudPerformance(AirQloudPerformanceBase, table=True):
    """AirQloud Performance database model"""
    __tablename__ = "fact_airqloud_performance"
    
    performance_key: Optional[int] = Field(default=None, primary_key=True)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('airqloud_id', 'timestamp', name='uq_airqloud_performance_id_timestamp'),
    )


class AirQloudPerformanceCreate(AirQloudPerformanceBase):
    """Schema for creating AirQloud Performance"""
    pass


class AirQloudPerformanceRead(AirQloudPerformanceBase):
    """Schema for reading AirQloud Performance"""
    performance_key: int
    created_at: Optional[datetime] = None


class PerformanceQueryRequest(SQLModel):
    """Request schema for querying performance data"""
    start: datetime = Field(description="Start datetime in ISO format (e.g., 2024-06-01T00:00:00Z)")
    end: datetime = Field(description="End datetime in ISO format (e.g., 2024-06-30T23:59:59Z)")
    ids: list[str] = Field(description="List of device IDs or airqloud IDs depending on the type")


class PerformanceResponse(SQLModel):
    """Unified response schema for performance data (works for both device and airqloud)"""
    id: str = Field(description="Device ID or AirQloud ID")
    freq: Optional[int] = Field(default=None)
    error_margin: Optional[float] = Field(default=None)
    timestamp: datetime
    performance_key: Optional[int] = Field(default=None)
    created_at: Optional[datetime] = None


class GroupedPerformanceResponse(SQLModel):
    """Grouped response schema with arrays for timestamps, freq, and error_margin"""
    id: str = Field(description="Device ID or AirQloud ID")
    name: Optional[str] = Field(default=None, description="Device name or AirQloud name")
    freq: list[Optional[int]] = Field(default_factory=list, description="List of frequency values")
    error_margin: list[Optional[float]] = Field(default_factory=list, description="List of error margin values")
    timestamp: list[datetime] = Field(default_factory=list, description="List of timestamps")
