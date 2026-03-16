from typing import Optional
from datetime import datetime
import uuid as uuid_pkg
from app.models.firmware import FirmwareBase, FirmwareType

class FirmwareCreate(FirmwareBase):
    pass

class FirmwareUpdate(FirmwareBase):
    firmware_version: Optional[str] = None
    firmware_string: Optional[str] = None
    firmware_type: Optional[FirmwareType] = None

class FirmwareRead(FirmwareBase):
    id: uuid_pkg.UUID
    created_at: datetime
    updated_at: Optional[datetime]
