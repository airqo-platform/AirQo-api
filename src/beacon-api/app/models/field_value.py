from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone
import uuid as uuid_pkg


class FieldValuesBase(SQLModel):
    device_id: str = Field(foreign_key="dim_device.device_id")
    field1: Optional[str] = Field(default=None, max_length=100)
    field2: Optional[str] = Field(default=None, max_length=100)
    field3: Optional[str] = Field(default=None, max_length=100)
    field4: Optional[str] = Field(default=None, max_length=100)
    field5: Optional[str] = Field(default=None, max_length=100)
    field6: Optional[str] = Field(default=None, max_length=100)
    field7: Optional[str] = Field(default=None, max_length=100)
    field8: Optional[str] = Field(default=None, max_length=100)
    field9: Optional[str] = Field(default=None, max_length=100)
    field10: Optional[str] = Field(default=None, max_length=100)
    field11: Optional[str] = Field(default=None, max_length=100)
    field12: Optional[str] = Field(default=None, max_length=100)
    field13: Optional[str] = Field(default=None, max_length=100)
    field14: Optional[str] = Field(default=None, max_length=100)
    field15: Optional[str] = Field(default=None, max_length=100)


class FieldValues(FieldValuesBase, table=True):
    __tablename__ = "field_values"
    
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    entry_id: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FieldValuesCreate(FieldValuesBase):
    pass


class FieldValuesUpdate(SQLModel):
    device_id: Optional[str] = None
    field1: Optional[str] = None
    field2: Optional[str] = None
    field3: Optional[str] = None
    field4: Optional[str] = None
    field5: Optional[str] = None
    field6: Optional[str] = None
    field7: Optional[str] = None
    field8: Optional[str] = None
    field9: Optional[str] = None
    field10: Optional[str] = None
    field11: Optional[str] = None
    field12: Optional[str] = None
    field13: Optional[str] = None
    field14: Optional[str] = None
    field15: Optional[str] = None


class FieldValuesRead(FieldValuesBase):
    id: uuid_pkg.UUID
    entry_id: Optional[int]
    created_at: datetime
