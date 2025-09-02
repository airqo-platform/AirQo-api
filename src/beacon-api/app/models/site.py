from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, timezone


class SiteBase(SQLModel):
    site_id: str = Field(index=True)
    site_name: str = Field(index=True)
    location_name: Optional[str] = None
    search_name: Optional[str] = None
    village: Optional[str] = None
    town: Optional[str] = None
    city: Optional[str] = Field(default=None, index=True)
    district: Optional[str] = Field(default=None, index=True)
    country: Optional[str] = "Uganda"
    data_provider: Optional[str] = None
    site_category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class Site(SiteBase, table=True):
    __tablename__ = "dim_site"
    
    site_key: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)})


class SiteCreate(SiteBase):
    pass


class SiteUpdate(SQLModel):
    site_name: Optional[str] = None
    location_name: Optional[str] = None
    search_name: Optional[str] = None
    village: Optional[str] = None
    town: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    country: Optional[str] = None
    data_provider: Optional[str] = None
    site_category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class SiteRead(SiteBase):
    site_key: int
    created_at: datetime
    updated_at: Optional[datetime]
    device_count: Optional[int] = 0