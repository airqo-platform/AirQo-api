from sqlmodel import Field, SQLModel
from typing import Optional, List
from datetime import datetime, timezone


class MaintenanceRecordBase(SQLModel):
    device_key: int = Field(index=True)
    maintenance_type: str = Field(index=True)
    description: str
    performed_by: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    status: str = Field(default="scheduled", index=True)
    cost: Optional[float] = None
    notes: Optional[str] = None
    next_maintenance_date: Optional[datetime] = None


class MaintenanceRecord(MaintenanceRecordBase, table=True):
    __tablename__ = "maintenance_records"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)})


class MaintenanceRecordCreate(MaintenanceRecordBase):
    pass


class MaintenanceRecordUpdate(SQLModel):
    description: Optional[str] = None
    performed_by: Optional[str] = None
    completion_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceRecordRead(MaintenanceRecordBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]


# --- Performance Stats Request Models ---

class RangeFilter(SQLModel):
    min: Optional[float] = None
    max: Optional[float] = None


class MaintenanceFilter(SQLModel):
    uptime: Optional[RangeFilter] = None
    error_margin: Optional[RangeFilter] = None
    country: Optional[str] = None
    search: Optional[str] = None



class SortConfig(SQLModel):
    field: str  # 'uptime', 'error_margin', 'frequency', 'name'
    order: str = 'asc'  # 'asc', 'desc'


class MaintenanceStatsRequest(SQLModel):
    period_days: int = 14  # Default lookback
    filters: Optional[MaintenanceFilter] = None
    sort: Optional[SortConfig] = None
    page: int = 1
    page_size: int = 20


# --- Performance Stats Response Models ---

class AirQloudMaintenanceStats(SQLModel):
    id: str
    name: str
    country: Optional[str] = None
    device_count: int
    avg_uptime: float
    avg_error_margin: float


class DeviceMaintenanceStats(SQLModel):
    device_id: str
    device_name: str
    airqlouds: List[str] = [] # List of active airqloud names
    avg_uptime: float
    avg_error_margin: float
    avg_battery: Optional[float]


class PaginatedAirQloudResponse(SQLModel):
    total: int
    page: int
    page_size: int
    items: List[AirQloudMaintenanceStats]


class PaginatedDeviceResponse(SQLModel):
    total: int
    page: int
    page_size: int
    items: List[DeviceMaintenanceStats]
