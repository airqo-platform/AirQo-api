from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# --- Request Models ---

class RangeFilter(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None


class MaintenanceFilter(BaseModel):
    uptime: Optional[RangeFilter] = None
    error_margin: Optional[RangeFilter] = None
    country: Optional[str] = None
    search: Optional[str] = None


class SortConfig(BaseModel):
    field: str = "name"  # 'uptime', 'error_margin', 'name'
    order: str = "asc"   # 'asc', 'desc'


class MaintenanceStatsRequest(BaseModel):
    entity_type: str = Field(default="cohort", description="'cohort' or 'device'")
    tags: Optional[List[str]] = Field(default=None, description="Cohort tags to filter by")
    period_days: int = Field(default=14, ge=1, le=90)
    filters: Optional[MaintenanceFilter] = None
    sort: Optional[SortConfig] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class RouteRequest(BaseModel):
    device_names: List[str] = Field(..., description="List of device names to include in route")
    tags: Optional[List[str]] = Field(default=None, description="Cohort tags to filter by")
    start_lat: float = Field(default=0.3476, description="Starting Latitude (default: Kampala)")
    start_lon: float = Field(default=32.5825, description="Starting Longitude (default: Kampala)")


# --- Response Models ---

class CohortMaintenanceStats(BaseModel):
    id: str
    name: str
    country: Optional[str] = None
    device_count: int = 0
    avg_uptime: float = 0.0
    avg_data_completeness: float = 0.0
    avg_error_margin: float = 0.0


class DeviceMaintenanceStats(BaseModel):
    device_name: str
    cohorts: List[str] = []
    uptime: float = 0.0
    data_completeness: float = 0.0
    sensor_error_margin: float = 0.0


class PaginatedStatsResponse(BaseModel):
    success: bool = True
    entity_type: str = "cohort"
    total: int
    page: int
    page_size: int
    items: List[Any] = []  # CohortMaintenanceStats or DeviceMaintenanceStats


class RouteStop(BaseModel):
    device_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_from_last_km: float = 0.0
    criticality_score: float = 0.0
    uptime: float = 0.0


class RouteResponse(BaseModel):
    success: bool = True
    route: List[RouteStop] = []
    total_distance_km: float = 0.0


class MapViewDeviceEntry(BaseModel):
    device_id: str
    device_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_active: Optional[str] = None
    uptime: float = 0.0
    data_completeness: float = 0.0
    error_margin: float = 0.0
    cohorts: List[str] = []


class MapViewResponse(BaseModel):
    success: bool = True
    data: List[MapViewDeviceEntry] = []
