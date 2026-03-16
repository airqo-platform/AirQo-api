from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Union, Dict, Any

class DeviceBase(BaseModel):
    device_id: str
    network_id: Optional[str] = None
    current_firmware: Optional[str] = None
    previous_firmware: Optional[str] = None
    file_upload_state: Optional[bool] = False
    firmware_download_state: Optional[str] = None

class DeviceBeaconData(BaseModel):
    network_id: Optional[str] = None
    current_firmware: Optional[str] = None
    previous_firmware: Optional[str] = None
    file_upload_state: Optional[bool] = False
    firmware_download_state: Optional[str] = None

class DeviceCategory(BaseModel):
    level: str
    category: str
    description: Optional[str] = None

class DeviceDetail(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str = Field(alias="_id")
    beacon_data: Optional[DeviceBeaconData] = None
    category_hierarchy: List[DeviceCategory] = []

class MetaData(BaseModel):
    total: Optional[int] = None
    totalResults: Optional[int] = None
    limit: Optional[int] = None
    skip: Optional[int] = None
    page: Optional[int] = None
    totalPages: Optional[int] = None
    detailLevel: Optional[str] = None
    usedCache: Optional[bool] = None
    nextPage: Optional[str] = None

class DeviceMetadataResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    beacon_data: Dict[str, Any]

class DeviceConfigDataResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    beacon_data: Dict[str, Any]

class DevicePerformance(BaseModel):
    device_name: str
    uptime: float
    data_completeness: float
    sensor_error_margin: float
    raw_data: List[Dict[str, Any]] = []

class DevicePerformanceResponse(BaseModel):
    success: bool
    message: str
    data: List[DevicePerformance] = []

class DeviceFilesResponse(BaseModel):
    success: bool
    message: str
    data: List[Any] = []

class DeviceUpsertResponse(BaseModel):
    success: bool
    message: str


class KeyValuePayload(BaseModel):
    values: Dict[str, Any]

class DeviceResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    devices: List[DeviceDetail] = []

class SingleDeviceResponse(BaseModel):
    success: bool
    message: str
    data: Optional[DeviceDetail] = None
