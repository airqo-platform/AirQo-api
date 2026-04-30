from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
from app.schemas.device import MetaData


class SiteDevice(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: Optional[str] = None
    long_name: Optional[str] = None
    network: Optional[str] = None
    status: Optional[str] = None
    isActive: Optional[bool] = None
    isOnline: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    createdAt: Optional[str] = None


class Site(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    network: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    district: Optional[str] = None
    region: Optional[str] = None
    data_provider: Optional[str] = None
    description: Optional[str] = None
    generated_name: Optional[str] = None
    site_tags: List[Any] = []
    site_codes: List[str] = []
    createdAt: Optional[str] = None
    devices: List[SiteDevice] = []


class SiteResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    sites: List[Site] = []


class SingleSiteResponse(BaseModel):
    success: bool
    message: str
    site: Optional[Site] = None


class SiteSyncResponse(BaseModel):
    success: bool
    message: str
    cohorts_synced: Optional[int] = None
    sites_synced: Optional[int] = None
    sites_new: Optional[int] = None
    sites_updated: Optional[int] = None
    sites_unchanged: Optional[int] = None
    devices_backfilled: Optional[int] = None


# --- Local sync table read schemas ---

class SyncedSiteDevice(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    is_active: bool = False


class SyncedSite(BaseModel):
    site_id: str
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    network: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    district: Optional[str] = None
    region: Optional[str] = None
    data_provider: Optional[str] = None
    description: Optional[str] = None
    generated_name: Optional[str] = None
    site_tags: List[Any] = []
    site_codes: List[str] = []
    number_of_devices: int = 0
    devices: List[SyncedSiteDevice] = []


class SyncedSiteResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    sites: List[SyncedSite] = []


class SingleSyncedSiteResponse(BaseModel):
    success: bool
    message: str
    site: Optional[SyncedSite] = None
