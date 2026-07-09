import logging
import json
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.models.webrtc import WebRTCSession, WebRTCSessionMember
from app.services.redis_service import redis_service
from app.services.webrtc.audit_service import audit_service
from app.services.webrtc.invitation_service import invitation_service
from app.services.webrtc.permission_service import permission_service

logger = logging.getLogger(__name__)

class WebRTCParticipantService:
    async def join_session(
        self,
        db: AsyncSession,
        session_id: UUID,
        user_id: str
    ) -> WebRTCSessionMember:
        session = await db.get(WebRTCSession, session_id)
        if not session or session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active session not found."
            )

        # Allow host to join. For other users, check if they are invited.
        role = "Viewer"
        can_control = False
        if session.host_id == user_id:
            role = "Host"
            can_control = True
        else:
            # Check invitation
            invited = await invitation_service.is_invited(db, session_id, user_id)
            if not invited:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not invited to this session."
                )
            role = "Participant"

        # Check if member already exists
        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.user_id == user_id
            )
        )
        member = (await db.execute(query)).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if not member:
            member = WebRTCSessionMember(
                session_id=session_id,
                user_id=user_id,
                role=role,
                can_control=can_control,
                joined_at=now,
                connected=True,
                connected_at=now
            )
            db.add(member)
        else:
            member.left_at = None
            member.connected = True
            member.connected_at = now
            member.disconnected_at = None

        await db.commit()
        await db.refresh(member)

        # Track session presence in Redis set
        redis_key = f"webrtc:session:presence:{session_id}"
        await redis_service.client.sadd(redis_key, user_id)

        # Publish peerJoined to session channel
        channel = f"webrtc:session:channel:{session_id}"
        await redis_service.client.publish(
            channel,
            json.dumps({
                "type": "peerJoined",
                "session_id": str(session_id),
                "user_id": user_id,
                "role": role
            })
        )

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=user_id,
            action="JOIN_SESSION",
            details={"role": role}
        )

        logger.info(f"User {user_id} joined WebRTC session {session_id} as {role}")
        return member

    async def leave_session(
        self,
        db: AsyncSession,
        session_id: UUID,
        user_id: str
    ) -> None:
        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.user_id == user_id,
                WebRTCSessionMember.left_at.is_(None)
            )
        )
        member = (await db.execute(query)).scalar_one_or_none()
        if not member:
            return

        now = datetime.now(timezone.utc)
        member.left_at = now
        member.connected = False
        member.disconnected_at = now
        
        # If user was the controller, revoke control
        session = await db.get(WebRTCSession, session_id)
        if session and session.controller_id == user_id:
            session.controller_id = None
            member.can_control = False
            
            # Update Redis controller
            redis_key_ctrl = f"webrtc:session:controller:{session_id}"
            await redis_service.client.delete(redis_key_ctrl)
            
            # Publish revokeControl
            channel = f"webrtc:session:channel:{session_id}"
            await redis_service.client.publish(
                channel,
                json.dumps({
                    "type": "revokeControl",
                    "session_id": str(session_id),
                    "controller_id": user_id,
                    "revoked_by": "SYSTEM"
                })
            )

        await db.commit()

        # Remove from Redis presence
        redis_key_pres = f"webrtc:session:presence:{session_id}"
        await redis_service.client.srem(redis_key_pres, user_id)

        # Publish peerLeft
        channel = f"webrtc:session:channel:{session_id}"
        await redis_service.client.publish(
            channel,
            json.dumps({
                "type": "peerLeft",
                "session_id": str(session_id),
                "user_id": user_id
            })
        )

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=user_id,
            action="LEAVE_SESSION"
        )
        logger.info(f"User {user_id} left WebRTC session {session_id}")

        # Check if the session is abandoned (e.g. host leaves, or no active connected participants left)
        if session and session.status == "ACTIVE":
            # If host left, or no connected observers/members left, close the session
            # We check how many connected members are currently left in Redis
            connected_count = await redis_service.client.scard(redis_key_pres)
            
            # Abandoned scenarios:
            # 1. Host leaves: The backend closes abandoned sessions.
            # 2. No connected members left.
            if user_id == session.host_id or connected_count == 0:
                logger.info(f"WebRTC session {session_id} is abandoned (Host left or 0 connected). Closing session.")
                # To avoid circular dependency, we import session_service dynamically or close it directly here
                from app.services.webrtc.session_service import session_service
                try:
                    await session_service.close_session(db, session_id, "SYSTEM")
                except Exception as e:
                    logger.error(f"Failed to auto-close abandoned session {session_id}: {e}")

    async def remove_participant(
        self,
        db: AsyncSession,
        session_id: UUID,
        host_id: str,
        participant_id: str
    ) -> None:
        session = await db.get(WebRTCSession, session_id)
        if not session or session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active session not found."
            )

        if session.host_id != host_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session host can remove participants."
            )

        if participant_id == host_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Host cannot be removed from their own session."
            )

        # Query member
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
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active participant not found in this session."
            )

        # Mark left/disconnected
        now = datetime.now(timezone.utc)
        member.left_at = now
        member.connected = False
        member.disconnected_at = now
        
        if session.controller_id == participant_id:
            session.controller_id = None
            member.can_control = False
            # Update Redis controller
            redis_key_ctrl = f"webrtc:session:controller:{session_id}"
            await redis_service.client.delete(redis_key_ctrl)

        await db.commit()

        # Remove from Redis presence
        redis_key_pres = f"webrtc:session:presence:{session_id}"
        await redis_service.client.srem(redis_key_pres, participant_id)

        # Publish removeParticipant event to signaling ws connection to force close it
        target_channel = f"webrtc:session:{session_id}:user:{participant_id}"
        await redis_service.client.publish(
            target_channel,
            json.dumps({
                "type": "removeParticipant",
                "session_id": str(session_id),
                "user_id": participant_id,
                "removed_by": host_id
            })
        )

        # Publish peerLeft
        channel = f"webrtc:session:channel:{session_id}"
        await redis_service.client.publish(
            channel,
            json.dumps({
                "type": "peerLeft",
                "session_id": str(session_id),
                "user_id": participant_id
            })
        )

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=host_id,
            action="REMOVE_PARTICIPANT",
            details={"removed_user_id": participant_id}
        )
        logger.info(f"Participant {participant_id} removed from session {session_id} by host {host_id}")

    async def get_active_members(self, db: AsyncSession, session_id: UUID) -> list[WebRTCSessionMember]:
        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.left_at.is_(None)
            )
        )
        return list((await db.execute(query)).scalars().all())

participant_service = WebRTCParticipantService()
