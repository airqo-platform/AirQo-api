import logging
from datetime import datetime, timezone
from typing import List, Optional, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operations import DeviceSession
from app.repositories.operations import device_session_repo, device_repo
from app.schemas.operations import DeviceSessionCreate, DeviceSessionUpdate
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

class SessionService:
    async def create_session(self, db: AsyncSession, obj_in: DeviceSessionCreate, user_id: str) -> DeviceSession:
        # If device_id is provided, verify device exists
        if obj_in.device_id:
            device = await device_repo.get_by_device_id(db, obj_in.device_id)
            if not device:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Device with ID {obj_in.device_id} not found."
                )

            # Check if there is an active session for this device
            existing_active = await device_session_repo.get_active_by_device(db, obj_in.device_id)
            if existing_active:
                logger.info(f"Join existing active session {existing_active.id} for device {obj_in.device_id}")
                # Return the existing session instead of creating a new one if it's already active
                return existing_active

        # Create session in DB
        db_data = obj_in.model_dump()
        db_data.update({
            "id": None, # Generate automatically
            "user_id": user_id,
            "status": "ACTIVE",
            "started_at": datetime.now(timezone.utc),
            "ended_at": None,
            "controller_user_id": user_id  # The creator is the default controller
        })
        
        session = await device_session_repo.create(db, obj_in=db_data)

        # Track session in Redis
        await redis_service.track_session_start(
            str(session.id),
            {
                "session_id": str(session.id),
                "device_id": session.device_id,
                "session_type": session.session_type,
                "user_id": session.user_id,
                "status": session.status,
                "started_at": session.started_at.isoformat()
            }
        )

        # Creator is also the active controller in Redis
        await redis_service.acquire_controller_lock(str(session.id), user_id)

        logger.info(f"Created session {session.id} for user {user_id} and device {session.device_id}")
        return session

    async def get_session(self, db: AsyncSession, session_id: UUID) -> DeviceSession:
        session = await device_session_repo.get(db, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session with ID {session_id} not found."
            )
        return session

    async def get_sessions(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[DeviceSession]:
        return await device_session_repo.get_multi(db, skip=skip, limit=limit)

    async def end_session(self, db: AsyncSession, session_id: UUID, user_id: str, status_value: str = "CLOSED") -> DeviceSession:
        session = await self.get_session(db, session_id)
        if session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Session {session_id} is already in state {session.status}."
            )

        # End session in DB
        update_data = {
            "status": status_value,
            "ended_at": datetime.now(timezone.utc),
            "controller_user_id": None
        }
        updated_session = await device_session_repo.update(db, db_obj=session, obj_in=update_data)

        # Track in Redis
        await redis_service.track_session_end(str(session_id))

        # Notify observers
        await redis_service.publish_to_session(str(session_id), {
            "event": "session_ended",
            "status": status_value,
            "ended_at": update_data["ended_at"].isoformat()
        })

        logger.info(f"Ended session {session_id} with status {status_value}")
        return updated_session

    async def acquire_control(self, db: AsyncSession, session_id: UUID, user_id: str) -> bool:
        session = await self.get_session(db, session_id)
        if session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot control an inactive session."
            )

        # Try to acquire lock in Redis
        acquired = await redis_service.acquire_controller_lock(str(session_id), user_id)
        if acquired:
            # Update DB
            await device_session_repo.update(db, db_obj=session, obj_in={"controller_user_id": user_id})
            logger.info(f"User {user_id} acquired control lock for session {session_id}")
            return True
        return False

    async def release_control(self, db: AsyncSession, session_id: UUID, user_id: str) -> bool:
        session = await self.get_session(db, session_id)
        if session.status != "ACTIVE":
            return False

        released = await redis_service.release_controller_lock(str(session_id), user_id)
        if released:
            # Update DB
            await device_session_repo.update(db, db_obj=session, obj_in={"controller_user_id": None})
            logger.info(f"User {user_id} released control lock for session {session_id}")
            return True
        return False

    async def join_session(self, session_id: UUID, user_id: str) -> None:
        # Just register in Redis and publish event
        await redis_service.add_session_observer(str(session_id), user_id)
        logger.info(f"User {user_id} joined session {session_id} as observer.")

    async def leave_session(self, session_id: UUID, user_id: str) -> None:
        await redis_service.remove_session_observer(str(session_id), user_id)
        logger.info(f"User {user_id} left session {session_id}.")

session_service = SessionService()
