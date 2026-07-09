import logging
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.models.webrtc import WebRTCSessionInvitation, WebRTCSession
from app.services.webrtc.audit_service import audit_service

logger = logging.getLogger(__name__)

class WebRTCInvitationService:
    async def invite_participant(
        self,
        db: AsyncSession,
        session_id: UUID,
        inviter_id: str,
        invitee_id: str
    ) -> WebRTCSessionInvitation:
        # Check if session exists and is active
        session = await db.get(WebRTCSession, session_id)
        if not session or session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active session not found."
            )

        # Check if inviter is host
        if session.host_id != inviter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session host can invite participants."
            )

        # Check if invitee is already invited/pending
        query = select(WebRTCSessionInvitation).where(
            and_(
                WebRTCSessionInvitation.session_id == session_id,
                WebRTCSessionInvitation.invitee_id == invitee_id,
                WebRTCSessionInvitation.status == "PENDING"
            )
        )
        existing = (await db.execute(query)).scalar_one_or_none()
        if existing:
            return existing

        invitation = WebRTCSessionInvitation(
            session_id=session_id,
            inviter_id=inviter_id,
            invitee_id=invitee_id,
            status="PENDING"
        )
        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=inviter_id,
            action="INVITE_PARTICIPANT",
            details={"invitee_id": invitee_id, "invitation_id": str(invitation.id)}
        )

        logger.info(f"User {invitee_id} invited to session {session_id} by {inviter_id}")
        return invitation

    async def revoke_invitation(
        self,
        db: AsyncSession,
        session_id: UUID,
        inviter_id: str,
        invitee_id: str
    ) -> None:
        session = await db.get(WebRTCSession, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found."
            )

        if session.host_id != inviter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session host can revoke invitations."
            )

        query = select(WebRTCSessionInvitation).where(
            and_(
                WebRTCSessionInvitation.session_id == session_id,
                WebRTCSessionInvitation.invitee_id == invitee_id,
                WebRTCSessionInvitation.status == "PENDING"
            )
        )
        invitation = (await db.execute(query)).scalar_one_or_none()
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pending invitation found for this user."
            )

        invitation.status = "CANCELLED"
        await db.commit()

        await audit_service.log_action(
            db=db,
            session_id=session_id,
            user_id=inviter_id,
            action="REVOKE_INVITATION",
            details={"invitee_id": invitee_id, "invitation_id": str(invitation.id)}
        )
        logger.info(f"Invitation revoked for {invitee_id} in session {session_id}")

    async def is_invited(self, db: AsyncSession, session_id: UUID, user_id: str) -> bool:
        query = select(WebRTCSessionInvitation).where(
            and_(
                WebRTCSessionInvitation.session_id == session_id,
                WebRTCSessionInvitation.invitee_id == user_id,
                WebRTCSessionInvitation.status == "PENDING"
            )
        )
        inv = (await db.execute(query)).scalar_one_or_none()
        return inv is not None

invitation_service = WebRTCInvitationService()
