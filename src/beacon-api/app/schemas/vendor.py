from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class VendorBase(BaseModel):
    name: str
    description: Optional[str] = None


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class VendorResponse(VendorBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VendorListResponse(BaseModel):
    vendors: List[VendorResponse]
    total: int
    page: int = 1
    page_size: int = 100
    has_next: bool = False
