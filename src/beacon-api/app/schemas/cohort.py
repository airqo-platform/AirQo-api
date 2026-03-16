from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
from app.schemas.device import MetaData

class CohortDevice(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    long_name: Optional[str] = None
    description: Optional[str] = None
    device_number: Optional[int] = None
    isActive: Optional[bool] = None
    isOnline: Optional[bool] = None
    rawOnlineStatus: Optional[bool] = None
    lastRawData: Optional[str] = None
    lastActive: Optional[str] = None
    status: Optional[str] = None
    network: Optional[str] = None
    createdAt: Optional[str] = None
    uptime: Optional[float] = None
    data_completeness: Optional[float] = None
    sensor_error_margin: Optional[float] = None
    data: List[Dict[str, Any]] = []

class Cohort(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    network: Optional[str] = None
    createdAt: Optional[str] = None
    numberOfDevices: Optional[int] = None
    devices: List[CohortDevice] = []
    groups: List[Any] = []
    cohort_tags: List[Any] = []
    cohort_codes: List[str] = []
    visibility: Optional[bool] = None
    uptime: Optional[float] = None
    data_completeness: Optional[float] = None
    sensor_error_margin: Optional[float] = None
    data: List[Dict[str, Any]] = []

class CohortResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    cohorts: List[Cohort] = []
    cohort: Optional[Cohort] = None

class SingleCohortResponse(BaseModel):
    success: bool
    message: str
    cohort: Optional[Cohort] = None


# --- Summary Performance Models ---

class SummaryDataEntry(BaseModel):
    date: str
    uptime: float = 0.0
    error_margin: float = 0.0

class SummaryDeviceEntry(BaseModel):
    device_name: str
    device_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_active: Optional[str] = None
    uptime: float = 0.0
    error_margin: float = 0.0

class SummaryCohortEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    network: Optional[str] = None
    numberOfDevices: Optional[int] = None
    cohort_tags: List[Any] = []
    uptime: float = 0.0
    error_margin: float = 0.0
    devices: List[SummaryDeviceEntry] = []
    data: List[SummaryDataEntry] = []

class SummaryCohortResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    cohorts: List[SummaryCohortEntry] = []

