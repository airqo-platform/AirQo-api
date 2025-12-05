from sqlmodel import Field, SQLModel, Column, String
from typing import Optional, Dict
from datetime import datetime, timezone


class CategoryBase(SQLModel):
    name: str = Field(primary_key=True, max_length=100)
    description: Optional[str] = Field(default=None, max_length=100)


class Category(CategoryBase, table=True):
    __tablename__ = "dim_category"
    
    # Field columns (15 fields)
    field1: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field2: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field3: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field4: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field5: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field6: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field7: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field8: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field9: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field10: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field11: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field12: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field13: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field14: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    field15: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    
    # Metadata columns (15 metadata fields)
    metadata1: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata2: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata3: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata4: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata5: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata6: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata7: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata8: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata9: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata10: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata11: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata12: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata13: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata14: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    metadata15: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    
    # Config columns (10 config fields)
    config1: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config2: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config3: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config4: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config5: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config6: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config7: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config8: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config9: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    config10: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)})


class CategoryCreate(CategoryBase):
    fields: Optional[Dict[str, Optional[str]]] = None
    configs: Optional[Dict[str, Optional[str]]] = None
    metadata: Optional[Dict[str, Optional[str]]] = None


class CategoryUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    fields: Optional[Dict[str, Optional[str]]] = None
    configs: Optional[Dict[str, Optional[str]]] = None
    metadata: Optional[Dict[str, Optional[str]]] = None


class CategoryRead(CategoryBase):
    created_at: datetime
    updated_at: Optional[datetime]
    fields: Optional[Dict[str, Optional[str]]] = None
    configs: Optional[Dict[str, Optional[str]]] = None
    metadata: Optional[Dict[str, Optional[str]]] = None

    class Config:
        from_attributes = True


class DeviceConfigSummary(SQLModel):
    name: str
    device_id: str
    device_key: str
    config_updated: bool = False
    recent_config: Dict[str, Optional[str]] = {}


class CategoryDevicesPagination(SQLModel):
    """Pagination metadata for devices in a category"""
    total: int = 0
    skip: int = 0
    limit: Optional[int] = None
    returned: int = 0
    pages: int = 0
    current_page: int = 1
    has_next: bool = False
    has_previous: bool = False


class CategoryWithDevices(CategoryRead):
    device_count: int = 0
    devices: list[DeviceConfigSummary] = []
    pagination: Optional[CategoryDevicesPagination] = None
