from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone
import uuid as uuid_pkg


class MetadataValuesBase(SQLModel):
    device_id: str = Field(foreign_key="dim_device.device_id")
    metadata1: Optional[str] = Field(default=None, max_length=100)
    metadata2: Optional[str] = Field(default=None, max_length=100)
    metadata3: Optional[str] = Field(default=None, max_length=100)
    metadata4: Optional[str] = Field(default=None, max_length=100)
    metadata5: Optional[str] = Field(default=None, max_length=100)
    metadata6: Optional[str] = Field(default=None, max_length=100)
    metadata7: Optional[str] = Field(default=None, max_length=100)
    metadata8: Optional[str] = Field(default=None, max_length=100)
    metadata9: Optional[str] = Field(default=None, max_length=100)
    metadata10: Optional[str] = Field(default=None, max_length=100)
    metadata11: Optional[str] = Field(default=None, max_length=100)
    metadata12: Optional[str] = Field(default=None, max_length=100)
    metadata13: Optional[str] = Field(default=None, max_length=100)
    metadata14: Optional[str] = Field(default=None, max_length=100)
    metadata15: Optional[str] = Field(default=None, max_length=100)


class MetadataValues(MetadataValuesBase, table=True):
    __tablename__ = "metadata_values"
    
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MetadataValuesCreate(MetadataValuesBase):
    pass


class MetadataValuesUpdate(SQLModel):
    device_id: Optional[str] = None
    metadata1: Optional[str] = None
    metadata2: Optional[str] = None
    metadata3: Optional[str] = None
    metadata4: Optional[str] = None
    metadata5: Optional[str] = None
    metadata6: Optional[str] = None
    metadata7: Optional[str] = None
    metadata8: Optional[str] = None
    metadata9: Optional[str] = None
    metadata10: Optional[str] = None
    metadata11: Optional[str] = None
    metadata12: Optional[str] = None
    metadata13: Optional[str] = None
    metadata14: Optional[str] = None
    metadata15: Optional[str] = None


class MetadataValuesRead(MetadataValuesBase):
    id: uuid_pkg.UUID
    created_at: datetime
