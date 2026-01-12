from sqlmodel import Field, SQLModel
from typing import Optional, List
from datetime import datetime
from pydantic import ConfigDict


class AirQloudBase(SQLModel):
    """Base model for AirQloud"""
    name: Optional[str] = Field(default=None, index=True)
    country: Optional[str] = Field(default=None, index=True)
    network: Optional[str] = Field(default=None, index=True)
    visibility: Optional[bool] = Field(default=None, index=True)
    is_active: Optional[bool] = Field(default=False, index=True)
    number_of_devices: Optional[int] = Field(default=None)


class AirQloud(AirQloudBase, table=True):
    """AirQloud database model"""
    __tablename__ = "dim_airqloud"
    
    id: str = Field(
        primary_key=True,
        index=True,
        nullable=False,
    )
    created_at: Optional[datetime] = Field(default=None)


class AirQloudCreate(SQLModel):
    """Schema for creating an AirQloud"""
    name: str
    country: Optional[str] = None
    visibility: Optional[bool] = None
    is_active: Optional[bool] = False
    number_of_devices: Optional[int] = None


class AirQloudUpdate(SQLModel):
    """Schema for updating an AirQloud - only country and is_active can be edited manually"""
    country: Optional[str] = None
    is_active: Optional[bool] = None


class AirQloudRead(AirQloudBase):
    """Schema for reading an AirQloud"""
    id: str
    created_at: Optional[datetime] = None


class AirQloudWithDeviceCount(AirQloudRead):
    """Schema for reading an AirQloud with device count"""
    number_of_devices: Optional[int] = None  # Override to allow None
    device_count: int = 0
    
    model_config = ConfigDict(extra="ignore")


class AirQloudWithPerformance(AirQloudRead):
    """Schema for reading an AirQloud with device count and performance data"""
    number_of_devices: Optional[int] = None  # Override to allow None
    device_count: int = 0
    freq: List = []  # Array of frequency values for the airqloud
    error_margin: List = []  # Array of error margin values for the airqloud
    timestamp: List = []  # Array of timestamps for the airqloud
    device_performance: List[dict] = []  # Performance data for individual devices
    
    model_config = ConfigDict(extra="ignore")


class AirQloudDeviceBase(SQLModel):
    """Base model for AirQloud-Device relationship"""
    name: Optional[str] = Field(default=None, index=True)
    long_name: Optional[str] = Field(default=None)
    device_number: Optional[int] = Field(default=None)
    is_active: Optional[bool] = Field(default=None, index=True)
    is_online: Optional[bool] = Field(default=None, index=True)
    last_active: Optional[datetime] = Field(default=None)
    status: Optional[str] = Field(default=None, index=True)
    network: Optional[str] = Field(default=None, index=True)
    raw_online_status: Optional[str] = Field(default=None)
    last_raw_data: Optional[datetime] = Field(default=None)


class AirQloudDevice(AirQloudDeviceBase, table=True):
    """AirQloud-Device junction table model - allows same device in multiple cohorts"""
    __tablename__ = "dim_airqloud_device"
    
    # Composite primary key: device can belong to multiple cohorts
    id: str = Field(primary_key=True, index=True, nullable=False)
    cohort_id: str = Field(primary_key=True, foreign_key="dim_airqloud.id", nullable=False)
    created_at: Optional[datetime] = Field(default=None)


class AirQloudDeviceCreate(SQLModel):
    """Schema for adding a device to an AirQloud"""
    id: str
    cohort_id: Optional[str] = None
    name: Optional[str] = None
    long_name: Optional[str] = None
    device_number: Optional[int] = None
    is_active: Optional[bool] = None
    is_online: Optional[bool] = None
    last_active: Optional[datetime] = None
    status: Optional[str] = None
    network: Optional[str] = None


class AirQloudDeviceRead(SQLModel):
    """Schema for reading an AirQloud-Device relationship"""
    id: str
    cohort_id: Optional[str] = None
    name: Optional[str] = None
    long_name: Optional[str] = None
    device_number: Optional[int] = None
    is_active: Optional[bool] = None
    is_online: Optional[bool] = None
    last_active: Optional[datetime] = None
    status: Optional[str] = None
    network: Optional[str] = None
    created_at: Optional[datetime] = None


class AirQloudDeviceUpdate(SQLModel):
    """Schema for updating an AirQloud-Device relationship"""
    cohort_id: Optional[str] = None
    name: Optional[str] = None
    long_name: Optional[str] = None
    device_number: Optional[int] = None
    is_active: Optional[bool] = None
    is_online: Optional[bool] = None
    last_active: Optional[datetime] = None
    status: Optional[str] = None
    network: Optional[str] = None


class AirQloudSingleBulkCreateResponse(SQLModel):
    """Response schema for single AirQloud creation with devices from CSV"""
    airqloud: Optional[AirQloudRead] = None
    devices_added: List[dict] = []
    device_errors: List[dict] = []
    summary: dict
