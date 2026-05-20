from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
from app.schemas.device import MetaData
from app.schemas.site import SiteDevice


class GridSite(BaseModel):
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


class Grid(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: Optional[str] = None
    visibility: Optional[bool] = None
    admin_level: Optional[str] = None
    network: Optional[str] = None
    long_name: Optional[str] = None
    flag_url: Optional[str] = None
    createdAt: Optional[str] = None
    numberOfSites: Optional[int] = None
    sites: List[GridSite] = []


class GridResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    grids: List[Grid] = []
    grid: Optional[Grid] = None


class SingleGridResponse(BaseModel):
    success: bool
    message: str
    grid: Optional[Grid] = None


class GridSyncResponse(BaseModel):
    success: bool
    message: str
    grids_synced: Optional[int] = None
    grids_new: Optional[int] = None
    grids_updated: Optional[int] = None
    grids_unchanged: Optional[int] = None
    sites_backfilled: Optional[int] = None


# --- Local sync table read schemas ---

class SyncedGridSiteDevice(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool = False
    uptime: Optional[float] = None
    data_completeness: Optional[float] = None
    averages: Optional[Dict[str, Any]] = None
    data: List[Dict[str, Any]] = []


class SyncedGridSite(BaseModel):
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
    devices: List[SyncedGridSiteDevice] = []


class SyncedGrid(BaseModel):
    grid_id: str
    name: Optional[str] = None
    visibility: Optional[bool] = None
    admin_level: Optional[str] = None
    network: Optional[str] = None
    long_name: Optional[str] = None
    flag_url: Optional[str] = None
    number_of_sites: int = 0
    sites: List[SyncedGridSite] = []
    uptime: Optional[float] = None
    data_completeness: Optional[float] = None
    averages: Optional[Dict[str, Any]] = None
    data: List[Dict[str, Any]] = []


class SyncedGridResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    grids: List[SyncedGrid] = []


class SingleSyncedGridResponse(BaseModel):
    success: bool
    message: str
    grid: Optional[SyncedGrid] = None
