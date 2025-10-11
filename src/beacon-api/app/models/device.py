from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime


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


class DeviceRead(DeviceBase):
    device_key: int
    created_at: datetime
    updated_at: Optional[datetime]