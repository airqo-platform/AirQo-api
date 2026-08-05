import logging
import json
from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.models.webrtc import WebRTCSession, WebRTCSessionMember
from app.services.redis_service import redis_service
from app.services.webrtc.audit_service import audit_service

logger = logging.getLogger(__name__)

class WebRTCPermissionService:
    async def grant_control(
        self,
        db: AsyncSession,
        session_id: UUID,
        host_id: str,
        participant_id: str
    ) -> bool:
        session = await db.get(WebRTCSession, session_id)
        if not session or session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active session not found."
            )

        # Host check
        if session.host_id != host_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session host can grant control."
            )

        # Verify participant is an active connected member
        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.user_id == participant_id,
                WebRTCSessionMember.left_at.is_(None)
            )
        )
        member = (await db.execute(query)).scalar_one_or_none()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target participant is not an active member of this session."
            )

        # Update Session and Member
        session.controller_id = participant_id
        member.can_control = True
        await db.commit()

        # Track in Redis
        redis_key = f"webrtc:session:controller:{session_id}"
        await redis_service.client.set(redis_key, participant_id)

        # Publish signaling event to the session channel
        channel = f"webrtc:session:channel:{session_id}"
        await redis_service.client.publish(
            channel,
            json.dumps({
                "type": "grantControl",
                "session_id": str(session_id),
                "controller_id": participant_id,
                "granted_by": host_id
            })
        )

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=host_id,
            action="GRANT_CONTROL",
            details={"controller_id": participant_id}
        )

        logger.info(f"Control granted to {participant_id} in session {session_id} by {host_id}")
        return True

    async def revoke_control(
        self,
        db: AsyncSession,
        session_id: UUID,
        host_id: str,
        controller_id: str
    ) -> bool:
        session = await db.get(WebRTCSession, session_id)
        if not session or session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active session not found."
            )

        # Host or system can revoke control
        if session.host_id != host_id and host_id != "SYSTEM":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session host or system can revoke control."
            )

        if session.controller_id != controller_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target user is not the current controller."
            )

        # Update Session and Member
        session.controller_id = None
        
        # Reset can_control on the member
        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.user_id == controller_id,
                WebRTCSessionMember.left_at.is_(None)
            )
        )
        member = (await db.execute(query)).scalar_one_or_none()
        if member:
            member.can_control = False

        await db.commit()

        # Update Redis
        redis_key = f"webrtc:session:controller:{session_id}"
        await redis_service.client.delete(redis_key)

        # Publish signaling event to the session channel
        channel = f"webrtc:session:channel:{session_id}"
        await redis_service.client.publish(
            channel,
            json.dumps({
                "type": "revokeControl",
                "session_id": str(session_id),
                "controller_id": controller_id,
                "revoked_by": host_id
            })
        )

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=host_id,
            action="REVOKE_CONTROL",
            details={"controller_id": controller_id}
        )

        logger.info(f"Control revoked from {controller_id} in session {session_id} by {host_id}")
        return True

    async def get_controller(self, session_id: UUID) -> Optional[str]:
        redis_key = f"webrtc:session:controller:{session_id}"
        return await redis_service.client.get(redis_key)

permission_service = WebRTCPermissionService()
