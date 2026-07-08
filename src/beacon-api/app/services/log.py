import os
import hashlib
import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operations import SessionLog
from app.repositories.operations import session_log_repo, device_session_repo
from app.schemas.operations import SessionLogCreate

logger = logging.getLogger(__name__)

# Directory inside the workspace for mock object storage
STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "logs"))

class LogService:
    def __init__(self) -> None:
        # Create storage directory if it doesn't exist
        os.makedirs(STORAGE_DIR, exist_ok=True)
        logger.info(f"Log Object Storage Mock initialized at: {STORAGE_DIR}")

    async def store_log(
        self, db: AsyncSession, session_id: UUID, log_type: str, content: bytes
    ) -> SessionLog:
        # Verify session exists
        session = await device_session_repo.get(db, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found."
            )

        # Generate unique file path inside mock object storage
        log_id = uuid4()
        filename = f"{session_id}_{log_type}_{log_id}.log"
        file_path = os.path.join(STORAGE_DIR, filename)

        # Compute file properties
        size = len(content)
        checksum = hashlib.sha256(content).hexdigest()

        # Write to mock object storage (files)
        try:
            with open(file_path, "wb") as f:
                f.write(content)
        except IOError as e:
            logger.error(f"Failed to write log file to storage: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store log file in object storage."
            )

        # Store reference in database
        log_in = {
            "id": log_id,
            "session_id": session_id,
            "file_path": file_path,
            "log_type": log_type,
            "size": size,
            "checksum": checksum,
            "created_at": datetime.now(timezone.utc)
        }

        db_log = await session_log_repo.create(db, obj_in=log_in)
        logger.info(f"Stored log reference {db_log.id} for session {session_id} (Size: {size} bytes)")
        return db_log

    async def get_log_reference(self, db: AsyncSession, log_id: UUID) -> SessionLog:
        ref = await session_log_repo.get(db, log_id)
        if not ref:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Log reference with ID {log_id} not found."
            )
        return ref

    async def get_session_logs(self, db: AsyncSession, session_id: UUID) -> List[SessionLog]:
        return await session_log_repo.get_by_session(db, session_id)

    async def read_log_content(self, db: AsyncSession, log_id: UUID) -> str:
        ref = await self.get_log_reference(db, log_id)
        
        # Read from local mock storage
        if not os.path.exists(ref.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Actual log file not found in storage."
            )

        try:
            with open(ref.file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except IOError as e:
            logger.error(f"Failed to read log file: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve log content from storage."
            )

log_service = LogService()
