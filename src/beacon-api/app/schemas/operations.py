from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID

# DeviceSession Schemas
class DeviceSessionBase(BaseModel):
    device_id: Optional[str] = None
    session_type: str = Field(..., description="LOCAL, REMOTE, SHARED, PROVISIONING, FLASHING, DEBUGGING")
    meta_data: Optional[dict] = Field(default=None, description="Metadata JSONB")

class DeviceSessionCreate(DeviceSessionBase):
    pass

class DeviceSessionUpdate(BaseModel):
    status: Optional[str] = None # ACTIVE, CLOSED, FAILED, ABANDONED
    controller_user_id: Optional[str] = None
    ended_at: Optional[datetime] = None
    meta_data: Optional[dict] = None

class DeviceSessionResponse(DeviceSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[str] = None
    controller_user_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str

# DeviceJob Schemas
class DeviceJobBase(BaseModel):
    session_id: UUID
    device_id: Optional[str] = None
    firmware_id: Optional[UUID] = None
    job_type: str = Field(..., description="FLASH_FIRMWARE, CONFIGURE_DEVICE, RESTART_DEVICE, etc.")
    meta_data: Optional[dict] = None

class DeviceJobCreate(DeviceJobBase):
    pass

class DeviceJobUpdate(BaseModel):
    status: Optional[str] = None  # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    progress: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[dict] = None
    meta_data: Optional[dict] = None

class DeviceJobResponse(DeviceJobBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    progress: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    requested_by: str
    result: Optional[dict] = None

class DeviceJobCancelResponse(BaseModel):
    job_id: UUID
    status: str
    message: str

# SessionLog Schemas
class SessionLogBase(BaseModel):
    session_id: UUID
    log_type: str = Field(..., description="SERIAL_LOG, FLASH_LOG, AGENT_LOG, DEBUG_LOG")

class SessionLogCreate(SessionLogBase):
    file_path: str
    size: int
    checksum: str

class SessionLogResponse(SessionLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_path: str
    size: int
    checksum: str
    created_at: datetime

# Command Schemas
class CommandBase(BaseModel):
    name: str
    description: Optional[str] = None
    command_template: str
    parameter_schema: Optional[dict] = None
    supported_boards: Optional[List[str]] = None
    dangerous: bool = False
    requires_confirmation: bool = False
    enabled: bool = True

class CommandCreate(CommandBase):
    pass

class CommandResponse(CommandBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime

class CommandExecuteRequest(BaseModel):
    device_id: str
    parameters: Optional[dict] = None

class CommandExecuteResponse(BaseModel):
    job_id: UUID
    status: str
    message: str
