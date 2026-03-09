from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone
import uuid as uuid_pkg
from enum import Enum

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
    __tablename__ = "sync_firmware"
    
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(
        default=None, 
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)}
    )
