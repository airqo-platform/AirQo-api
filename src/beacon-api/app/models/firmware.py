from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone
from enum import Enum
import uuid as uuid_pkg


class FirmwareType(str, Enum):
    """Firmware type enumeration"""
    stable = "stable"
    beta = "beta"
    deprecated = "deprecated"
    legacy = "legacy"


class FirmwareBase(SQLModel):
    firmware_version: str = Field(max_length=100, unique=True, index=True)
    firmware_string: str = Field(max_length=100)
    firmware_string_hex: Optional[str] = Field(default=None, max_length=100)
    firmware_string_bootloader: Optional[str] = Field(default=None, max_length=100)
    firmware_type: Optional[FirmwareType] = Field(default=FirmwareType.beta)
    description: Optional[str] = Field(default=None, max_length=255)
    crc32: Optional[str] = Field(default=None, max_length=100)  # firmware CRC32 checksum
    firmware_bin_size: Optional[int] = Field(default=None)  # firmware binary size in bytes
    change1: Optional[str] = Field(default=None, max_length=255)
    change2: Optional[str] = Field(default=None, max_length=255)
    change3: Optional[str] = Field(default=None, max_length=255)
    change4: Optional[str] = Field(default=None, max_length=255)
    change5: Optional[str] = Field(default=None, max_length=255)
    change6: Optional[str] = Field(default=None, max_length=255)
    change7: Optional[str] = Field(default=None, max_length=255)
    change8: Optional[str] = Field(default=None, max_length=255)
    change9: Optional[str] = Field(default=None, max_length=255)
    change10: Optional[str] = Field(default=None, max_length=255)


class Firmware(FirmwareBase, table=True):
    __tablename__ = "dim_firmware"
    
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)})


class FirmwareCreate(FirmwareBase):
    pass


class FirmwareUpdate(SQLModel):
    firmware_version: Optional[str] = None
    firmware_string: Optional[str] = None
    firmware_string_hex: Optional[str] = None
    firmware_string_bootloader: Optional[str] = None
    firmware_type: Optional[FirmwareType] = None
    description: Optional[str] = None
    crc32: Optional[str] = None
    firmware_bin_size: Optional[int] = None
    change1: Optional[str] = None
    change2: Optional[str] = None
    change3: Optional[str] = None
    change4: Optional[str] = None
    change5: Optional[str] = None
    change6: Optional[str] = None
    change7: Optional[str] = None
    change8: Optional[str] = None
    change9: Optional[str] = None
    change10: Optional[str] = None


class FirmwareRead(FirmwareBase):
    id: uuid_pkg.UUID
    created_at: datetime
    updated_at: Optional[datetime]
