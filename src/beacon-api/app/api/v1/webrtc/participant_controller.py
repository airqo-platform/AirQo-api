import logging
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_async_db
from app.api.v1.operations import get_current_user_id
from app.schemas.webrtc import WebRTCSessionMemberResponse, GrantControlRequest, RevokeControlRequest
from app.services.webrtc.participant_service import participant_service
from app.services.webrtc.permission_service import permission_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/sessions/{id}/participants", response_model=List[WebRTCSessionMemberResponse])
async def list_participants(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """List active participants of a WebRTC session."""
    return await participant_service.get_active_members(db, id)

@router.delete("/sessions/{id}/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    id: UUID,
    participant_id: str,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Remove a participant from the WebRTC session (Host only)."""
    await participant_service.remove_participant(db, id, user_id, participant_id)

@router.post("/sessions/{id}/control/grant")
async def grant_control(
    id: UUID,
    req: GrantControlRequest,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Grant control to a participant (Host only)."""
    success = await permission_service.grant_control(db, id, user_id, req.participant_id)
    return {"success": success}

@router.post("/sessions/{id}/control/revoke")
async def revoke_control(
    id: UUID,
    req: RevokeControlRequest,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Revoke control from a participant (Host only)."""
    success = await permission_service.revoke_control(db, id, user_id, req.controller_id)
    return {"success": success}
