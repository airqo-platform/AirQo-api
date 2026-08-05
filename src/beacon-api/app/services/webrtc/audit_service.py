import logging
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.webrtc import WebRTCAuditLog

logger = logging.getLogger(__name__)

class WebRTCAuditService:
    async def log_action(
        self,
        db: AsyncSession,
        session_id: Optional[UUID],
        user_id: str,
        action: str,
        details: Optional[Dict[str, Any]] = None
    ) -> WebRTCAuditLog:
        audit_log = WebRTCAuditLog(
            session_id=session_id,
            user_id=user_id,
            action=action,
            details=details
        )
        db.add(audit_log)
        await db.commit()
        await db.refresh(audit_log)
        logger.info(f"Audit log saved: Action={action}, User={user_id}, Session={session_id}")
        return audit_log

audit_service = WebRTCAuditService()
