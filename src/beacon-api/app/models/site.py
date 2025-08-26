from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime


class SiteBase(SQLModel):
    site_name: str = Field(index=True, unique=True)
    site_code: Optional[str] = Field(default=None, index=True)
    description: Optional[str] = None
    region: Optional[str] = Field(default=None, index=True)
    district: Optional[str] = Field(default=None, index=True)
    county: Optional[str] = None
    parish: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    site_type: str = Field(default="urban")
    status: str = Field(default="active", index=True)


class Site(SiteBase, table=True):
    __tablename__ = "sites"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})


class SiteCreate(SiteBase):
    id: str


class SiteUpdate(SQLModel):
    site_name: Optional[str] = None
    description: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class SiteRead(SiteBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime]
    device_count: Optional[int] = 0