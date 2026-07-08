import logging
import json
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.models.webrtc import WebRTCSessionMember
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

class WebRTCSignalingService:
    async def route_signaling_message(
        self,
        db: AsyncSession,
        session_id: UUID,
        sender_id: str,
        message: dict
    ) -> None:
        """
        Routes a signaling message (offer, answer, iceCandidate) to a target user.
        Ensures both sender and target are valid session members.
        """
        msg_type = message.get("type")
        target_user_id = message.get("target_user_id")
        payload = message.get("payload")

        if msg_type not in ["offer", "answer", "iceCandidate"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported signaling message type: {msg_type}"
            )

        if not target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing target_user_id in signaling message."
            )

        # Validate that sender and target are active connected members of this session
        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.user_id.in_([sender_id, target_user_id]),
                WebRTCSessionMember.left_at.is_(None)
            )
        )
        members = (await db.execute(query)).scalars().all()
        member_ids = {m.user_id for m in members}

        if sender_id not in member_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sender is not an active member of this session."
            )

        if target_user_id not in member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target user is not an active member of this session."
            )

        # Publish the message to target user's Redis channel
        target_channel = f"webrtc:session:{session_id}:user:{target_user_id}"
        await redis_service.client.publish(
            target_channel,
            json.dumps({
                "type": msg_type,
                "sender_id": sender_id,
                "payload": payload
            })
        )

        logger.debug(f"Routed signaling {msg_type} from {sender_id} to {target_user_id} in session {session_id}")

signaling_service = WebRTCSignalingService()
