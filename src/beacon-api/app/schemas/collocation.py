from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
from app.schemas.device import MetaData

class SiteDeviceEntry(BaseModel):
    device_name: str
    device_id: Optional[str] = None
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_active: Optional[str] = None
    uptime: float = 0.0
    error_margin: float = 0.0

class SiteDataEntry(BaseModel):
    date: str
    uptime: float = 0.0
    error_margin: float = 0.0

class SiteEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    formatted_name: Optional[str] = None
    parish: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    country: Optional[str] = None
    approximate_latitude: Optional[float] = None
    approximate_longitude: Optional[float] = None
    network: Optional[str] = None
    numberOfDevices: int = 0
    uptime: float = 0.0
    error_margin: float = 0.0
    devices: List[SiteDeviceEntry] = []
    data: List[SiteDataEntry] = []

class CollocationSitesResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    sites: List[SiteEntry] = []

class InlabDeviceData(BaseModel):
    date: str
    uptime: float = 0.0
    error_margin: float = 0.0
    correlation: Optional[float] = None

class InlabDevice(BaseModel):
    name: str
    category: Optional[str] = None
    network_id: Optional[str] = None
    firmware: Optional[str] = None
    uptime: float = 0.0
    error_margin: float = 0.0
    correlation: Optional[float] = None
    daily: List[InlabDeviceData] = []

class InlabResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    devices: List[InlabDevice] = []

class CollocationDeviceData(BaseModel):
    device_name: str
    category: str
    data: List[Dict[str, Any]]

class CollocationSiteDetailsResponse(BaseModel):
    success: bool
    message: str
    data: List[CollocationDeviceData]
