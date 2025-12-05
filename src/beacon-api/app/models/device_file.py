from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone
import uuid as uuid_pkg


class DeviceFilesBase(SQLModel):
    device_id: str = Field(foreign_key="dim_device.device_id")
    file: str = Field(max_length=100)


class DeviceFiles(DeviceFilesBase, table=True):
    __tablename__ = "device_files"
    
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DeviceFilesCreate(DeviceFilesBase):
    pass


class DeviceFilesUpdate(SQLModel):
    device_id: Optional[str] = None
    file: Optional[str] = None


class DeviceFilesRead(DeviceFilesBase):
    id: uuid_pkg.UUID
    created_at: datetime
