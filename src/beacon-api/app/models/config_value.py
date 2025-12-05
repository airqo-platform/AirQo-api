from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone
import uuid as uuid_pkg


class ConfigValuesBase(SQLModel):
    device_id: str = Field(foreign_key="dim_device.device_id")
    config1: Optional[str] = Field(default=None, max_length=100)
    config2: Optional[str] = Field(default=None, max_length=100)
    config3: Optional[str] = Field(default=None, max_length=100)
    config4: Optional[str] = Field(default=None, max_length=100)
    config5: Optional[str] = Field(default=None, max_length=100)
    config6: Optional[str] = Field(default=None, max_length=100)
    config7: Optional[str] = Field(default=None, max_length=100)
    config8: Optional[str] = Field(default=None, max_length=100)
    config9: Optional[str] = Field(default=None, max_length=100)
    config10: Optional[str] = Field(default=None, max_length=100)
    config_updated: bool = Field(default=False)


class ConfigValues(ConfigValuesBase, table=True):
    __tablename__ = "config_values"
    
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConfigValuesCreate(ConfigValuesBase):
    pass


class ConfigValuesUpdate(SQLModel):
    device_id: Optional[str] = None
    config1: Optional[str] = None
    config2: Optional[str] = None
    config3: Optional[str] = None
    config4: Optional[str] = None
    config5: Optional[str] = None
    config6: Optional[str] = None
    config7: Optional[str] = None
    config8: Optional[str] = None
    config9: Optional[str] = None
    config10: Optional[str] = None
    config_updated: Optional[bool] = None


class ConfigValuesRead(ConfigValuesBase):
    id: uuid_pkg.UUID
    created_at: datetime
