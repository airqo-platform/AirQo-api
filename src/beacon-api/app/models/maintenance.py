from sqlmodel import Field, SQLModel
from typing import Optional
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