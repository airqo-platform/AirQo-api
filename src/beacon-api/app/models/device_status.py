from sqlmodel import Field, SQLModel
from sqlalchemy import Column, Index, UniqueConstraint
from sqlalchemy.types import DateTime
from typing import Optional
from datetime import datetime, timezone


class DeviceStatusBase(SQLModel):
    device_key: int = Field(foreign_key="dim_device.device_key", index=True)
    timestamp: datetime = Field(sa_column=Column(DateTime(timezone=True), index=True))
    is_online: Optional[bool] = None
    device_status: Optional[str] = None
    recorded_at: datetime = Field(sa_column=Column(DateTime(timezone=True)), default_factory=lambda: datetime.now(timezone.utc))


class DeviceStatus(DeviceStatusBase, table=True):
    __tablename__ = "fact_device_status"
    __table_args__ = (
        Index(
            "ix_fact_device_status_device_key_timestamp",
            "device_key",
            "timestamp",
        ),
        # Uncomment to enforce one status row per device per timestamp
        # UniqueConstraint(
        #     "device_key",
        #     "timestamp",
        #     name="uq_fact_device_status_device_key_timestamp",
        # ),
    )
    
    status_key: Optional[int] = Field(default=None, primary_key=True)


class DeviceStatusCreate(DeviceStatusBase):
    pass


class DeviceStatusRead(DeviceStatusBase):
    status_key: int