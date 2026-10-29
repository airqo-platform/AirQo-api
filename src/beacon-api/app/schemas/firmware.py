from typing import Optional
from datetime import datetime
import uuid as uuid_pkg
from app.models.firmware import FirmwareBase, FirmwareType

from app.schemas.vendor import VendorResponse

class FirmwareCreate(FirmwareBase):
    pass

class FirmwareUpdate(FirmwareBase):
    firmware_version: Optional[str] = None
    firmware_string: Optional[str] = None
    firmware_type: Optional[FirmwareType] = None
    vendor_id: Optional[uuid_pkg.UUID] = None

class FirmwareRead(FirmwareBase):
    id: uuid_pkg.UUID
    vendor: Optional[VendorResponse] = None
    created_at: datetime
    updated_at: Optional[datetime]
