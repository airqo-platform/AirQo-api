from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone


class DeviceStatusBase(SQLModel):
    device_key: int = Field(foreign_key="dim_device.device_key", index=True)
    timestamp: datetime = Field(index=True)
    is_online: Optional[bool] = None
    device_status: Optional[str] = None
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DeviceStatus(DeviceStatusBase, table=True):
    __tablename__ = "fact_device_status"
    
    status_key: Optional[int] = Field(default=None, primary_key=True)


class DeviceStatusCreate(DeviceStatusBase):
    pass


class DeviceStatusRead(DeviceStatusBase):
    status_key: int