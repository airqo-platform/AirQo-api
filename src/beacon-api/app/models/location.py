from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone


class LocationBase(SQLModel):
    device_key: int = Field(foreign_key="dim_device.device_key", index=True)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    site_id: Optional[str] = None
    site_name: Optional[str] = None
    location_name: Optional[str] = None
    search_name: Optional[str] = None
    village: Optional[str] = None
    town: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    country: Optional[str] = "Uganda"
    admin_level_country: Optional[str] = None
    admin_level_city: Optional[str] = None
    admin_level_division: Optional[str] = None
    site_category: Optional[str] = None
    data_provider: Optional[str] = None
    mount_type: Optional[str] = None
    power_type: Optional[str] = None
    deployment_date: Optional[datetime] = None
    effective_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    effective_to: Optional[datetime] = None
    is_active: bool = True
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Location(LocationBase, table=True):
    __tablename__ = "dim_location"
    
    location_key: Optional[int] = Field(default=None, primary_key=True)


class LocationCreate(LocationBase):
    pass


class LocationRead(LocationBase):
    location_key: int