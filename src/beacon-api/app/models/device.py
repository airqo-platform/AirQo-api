from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Enum as SQLAlchemyEnum
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid as uuid_pkg


class FirmwareDownloadState(str, Enum):
    """Firmware download state enumeration"""
    updated = "updated"
    pending = "pending"
    failed = "failed"

class DeviceBase(SQLModel):
    device_id: str = Field(index=True, unique=True)
    device_name: str
    site_id: Optional[str] = Field(default=None, index=True)
    network: Optional[str] = Field(default=None, index=True)
    category: Optional[str] = None
    is_active: bool = Field(default=False)
    status: Optional[str] = Field(default="unknown", index=True)
    is_online: bool = Field(default=False)
    mount_type: Optional[str] = None
    power_type: Optional[str] = None
    height: Optional[float] = None
    next_maintenance: Optional[datetime] = None
    first_seen: Optional[datetime] = Field(default_factory=datetime.utcnow)
    last_updated: Optional[datetime] = Field(default_factory=datetime.utcnow)
    
    # New fields
    read_key: Optional[str] = Field(default=None, unique=True, max_length=100)
    channel_id: Optional[int] = Field(default=None, unique=True)
    write_key: Optional[str] = Field(default=None, unique=True, max_length=100)
    network_id: Optional[str] = Field(default=None, max_length=100)
    current_firmware: Optional[str] = Field(default=None, foreign_key="dim_firmware.firmware_version", max_length=100)
    previous_firmware: Optional[str] = Field(default=None, foreign_key="dim_firmware.firmware_version", max_length=100)
    target_firmware: Optional[str] = Field(default=None, foreign_key="dim_firmware.firmware_version", max_length=100)
    file_upload_state: bool = Field(default=False)
    firmware_download_state: Optional[FirmwareDownloadState] = Field(
        default=FirmwareDownloadState.updated,
        sa_column=Column(SQLAlchemyEnum(FirmwareDownloadState))
    )

class Device(DeviceBase, table=True):
    __tablename__ = "dim_device"
    
    device_key: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(SQLModel):
    device_name: Optional[str] = None
    site_id: Optional[str] = None
    network: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None
    is_online: Optional[bool] = None
    mount_type: Optional[str] = None
    power_type: Optional[str] = None
    height: Optional[float] = None
    next_maintenance: Optional[datetime] = None
    read_key: Optional[str] = None
    channel_id: Optional[int] = None
    write_key: Optional[str] = None
    network_id: Optional[str] = None
    current_firmware: Optional[str] = None
    previous_firmware: Optional[str] = None
    target_firmware: Optional[str] = None
    file_upload_state: Optional[bool] = None
    firmware_download_state: Optional[FirmwareDownloadState] = None

class DeviceFirmwareUpdate(SQLModel):
    """Schema for updating device firmware versions and network_id only.
    
    Firmware fields should be firmware version strings (e.g., "lcv42.74")
    """
    network_id: Optional[str] = None
    current_firmware: Optional[str] = None
    previous_firmware: Optional[str] = None
    target_firmware: Optional[str] = None

class DeviceRead(DeviceBase):
    device_key: int
    created_at: datetime
    updated_at: Optional[datetime]