from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class WebRTCSessionCreate(BaseModel):
    invitees: Optional[List[str]] = None

class WebRTCSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    host_id: str
    controller_id: Optional[str] = None
    status: str
    created_at: datetime
    closed_at: Optional[datetime] = None

class WebRTCSessionInvitationCreate(BaseModel):
    invitee_id: str

class WebRTCSessionInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    inviter_id: str
    invitee_id: str
    created_at: datetime
    status: str

class WebRTCSessionMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    user_id: str
    role: str
    can_control: bool
    joined_at: datetime
    left_at: Optional[datetime] = None
    connected: bool
    connected_at: Optional[datetime] = None
    disconnected_at: Optional[datetime] = None

class WebRTCAuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: Optional[UUID] = None
    user_id: str
    action: str
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None

class GrantControlRequest(BaseModel):
    participant_id: str

class RevokeControlRequest(BaseModel):
    controller_id: str
