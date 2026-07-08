import logging
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_async_db
from app.api.v1.operations import get_current_user_id
from app.schemas.webrtc import (
    WebRTCSessionCreate, WebRTCSessionResponse,
    WebRTCSessionInvitationCreate, WebRTCSessionInvitationResponse,
    WebRTCSessionMemberResponse
)
from app.services.webrtc.session_service import session_service
from app.services.webrtc.participant_service import participant_service
from app.services.webrtc.invitation_service import invitation_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/sessions", response_model=WebRTCSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    obj_in: WebRTCSessionCreate,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create a new WebRTC collaborative session."""
    return await session_service.create_session(db, user_id, obj_in.invitees)

@router.post("/sessions/{id}/join", response_model=WebRTCSessionMemberResponse)
async def join_session(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Authenticate and join a WebRTC session."""
    return await participant_service.join_session(db, id, user_id)

@router.delete("/sessions/{id}", response_model=WebRTCSessionResponse)
async def close_session(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Close/end an active WebRTC session."""
    return await session_service.close_session(db, id, user_id)

@router.get("/sessions/{id}", response_model=WebRTCSessionResponse)
async def get_session(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Retrieve details of a specific WebRTC session."""
    return await session_service.get_session(db, id)

@router.get("/sessions", response_model=list[WebRTCSessionResponse])
async def list_active_sessions(
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all active WebRTC sessions."""
    return await session_service.list_active_sessions(db)

@router.post("/sessions/{id}/invite", response_model=WebRTCSessionInvitationResponse, status_code=status.HTTP_201_CREATED)
async def invite_participant(
    id: UUID,
    obj_in: WebRTCSessionInvitationCreate,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Invite a user to a WebRTC session."""
    return await invitation_service.invite_participant(db, id, user_id, obj_in.invitee_id)
