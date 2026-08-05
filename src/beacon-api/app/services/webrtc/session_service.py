import logging
import json
from uuid import UUID
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.models.webrtc import WebRTCSession, WebRTCSessionMember
from app.services.redis_service import redis_service
from app.services.webrtc.audit_service import audit_service
from app.services.webrtc.invitation_service import invitation_service

logger = logging.getLogger(__name__)

class WebRTCSessionService:
    async def create_session(
        self,
        db: AsyncSession,
        host_id: str,
        invitees: list[str] = None
    ) -> WebRTCSession:
        # Create session DB record
        session = WebRTCSession(
            host_id=host_id,
            status="ACTIVE",
            created_at=datetime.now(timezone.utc)
        )
        db.add(session)
        await db.flush()  # populate ID

        # Host automatically joins as member
        host_member = WebRTCSessionMember(
            session_id=session.id,
            user_id=host_id,
            role="Host",
            can_control=True,
            joined_at=datetime.now(timezone.utc),
            connected=False  # Connection will be established via WebSocket
        )
        db.add(host_member)
        await db.commit()
        await db.refresh(session)

        # Handle initial invitations if any
        if invitees:
            for invitee in invitees:
                try:
                    await invitation_service.invite_participant(
                        db=db,
                        session_id=session.id,
                        inviter_id=host_id,
                        invitee_id=invitee
                    )
                except Exception as ex:
                    logger.error(f"Failed to invite {invitee} during session creation: {ex}")

        # Track session in Redis
        metadata = {
            "session_id": str(session.id),
            "host_id": host_id,
            "status": "ACTIVE",
            "created_at": session.created_at.isoformat()
        }
        await redis_service.client.hset("webrtc:active_sessions", str(session.id), json.dumps(metadata))

        await audit_service.log_action(
            db=db,
            session_id=session.id,
            user_id=host_id,
            action="CREATE_SESSION",
            details={"invitees_count": len(invitees) if invitees else 0}
        )

        logger.info(f"WebRTC session {session.id} created by host {host_id}")
        return session

    async def close_session(
        self,
        db: AsyncSession,
        session_id: UUID,
        user_id: str
    ) -> WebRTCSession:
        session = await db.get(WebRTCSession, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found."
            )

        if session.status != "ACTIVE":
            return session

        # Host or SYSTEM can close
        if session.host_id != user_id and user_id != "SYSTEM":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session host can close this session."
            )

        # Update DB record
        session.status = "CLOSED"
        session.closed_at = datetime.now(timezone.utc)
        session.controller_id = None
        
        # Mark all members as left
        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.left_at.is_(None)
            )
        )
        active_members = (await db.execute(query)).scalars().all()
        now = datetime.now(timezone.utc)
        for member in active_members:
            member.left_at = now
            member.connected = False
            member.disconnected_at = now

        await db.commit()

        # Clean Redis
        await redis_service.client.hdel("webrtc:active_sessions", str(session_id))
        await redis_service.client.delete(f"webrtc:session:controller:{session_id}")
        await redis_service.client.delete(f"webrtc:session:presence:{session_id}")

        # Publish sessionClosed to signaling ws channel
        channel = f"webrtc:session:channel:{session_id}"
        await redis_service.client.publish(
            channel,
            json.dumps({
                "type": "sessionClosed",
                "session_id": str(session_id),
                "closed_by": user_id
            })
        )

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=user_id,
            action="CLOSE_SESSION"
        )

        logger.info(f"WebRTC session {session_id} closed by {user_id}")
        return session

    async def get_session(self, db: AsyncSession, session_id: UUID) -> WebRTCSession:
        session = await db.get(WebRTCSession, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found."
            )
        return session

    async def list_active_sessions(self, db: AsyncSession) -> list[WebRTCSession]:
        query = select(WebRTCSession).where(WebRTCSession.status == "ACTIVE")
        return list((await db.execute(query)).scalars().all())

    async def expire_inactive_sessions(self, db: AsyncSession, max_age_hours: int = 24) -> int:
        threshold = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        query = select(WebRTCSession).where(
            and_(
                WebRTCSession.status == "ACTIVE",
                WebRTCSession.created_at < threshold
            )
        )
        expired_sessions = (await db.execute(query)).scalars().all()
        
        count = 0
        for session in expired_sessions:
            try:
                await self.close_session(db, session.id, "SYSTEM")
                count += 1
            except Exception as e:
                logger.error(f"Failed to auto-expire session {session.id}: {e}")
        return count

session_service = WebRTCSessionService()
