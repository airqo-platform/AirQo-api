from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict, Union
from app.schemas.device import MetaData

class SiteDeviceEntry(BaseModel):
    device_name: str
    device_id: Optional[str] = None
    category: Optional[str] = None
    status: Optional[Union[str, float, int, bool]] = None
    deployment_status: Optional[str] = None
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
    device_id: Optional[str] = None
    name: str
    device_name: Optional[str] = None
    is_active: Optional[bool] = True
    category: Optional[str] = None
    network_id: Optional[str] = None
    firmware: Optional[str] = None
    uptime: float = 0.0
    data_completeness: float = 0.0
    error_margin: float = 0.0
    correlation: Optional[float] = None
    averages: Dict[str, Any] = {}
    data: List[Dict[str, Any]] = []
    daily: List[InlabDeviceData] = []

class InlabResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    devices: List[InlabDevice] = []

class CollocationDeviceData(BaseModel):
    device_name: str
    device_id: Optional[str] = None
    category: str
    data: List[Dict[str, Any]]

class CollocationSiteInfo(BaseModel):
    site_id: str
    name: Optional[str] = None
    generated_name: Optional[str] = None
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
    number_of_devices: int = 0

class CollocationSiteDetailsResponse(BaseModel):
    success: bool
    message: str
    site: Optional[CollocationSiteInfo] = None
    data: List[CollocationDeviceData]


# ── Inlab Batch schemas ────────────────────────────────────────────

class InlabBatchCreate(BaseModel):
    name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    device_ids: List[str] = []

class InlabBatchUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class InlabBatchDeviceAdd(BaseModel):
    device_ids: List[str]

class InlabBatchDeviceUpdate(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class InlabBatchDeviceEntry(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    firmware_version: Optional[str] = None
    category: Optional[str] = None
    network_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    # Performance fields (populated on detail view)
    uptime: Optional[float] = None
    error_margin: Optional[float] = None
    data: Optional[List[Dict[str, Any]]] = None

class InlabBatchEntry(BaseModel):
    id: str
    name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    device_count: int = 0
    devices: List[InlabBatchDeviceEntry] = []
    created_at: Optional[str] = None

class InlabBatchListResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    batches: List[InlabBatchEntry] = []

class InlabBatchDetailResponse(BaseModel):
    success: bool
    message: str
    batch: Optional[InlabBatchEntry] = None

