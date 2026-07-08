import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import PlainTextResponse

from app.db.session import get_async_db
from app.schemas.operations import (
    DeviceSessionCreate, DeviceSessionResponse, DeviceSessionUpdate,
    DeviceJobCreate, DeviceJobResponse, DeviceJobCancelResponse,
    CommandCreate, CommandResponse, CommandExecuteRequest,
    SessionLogResponse
)
from app.services.session import session_service
from app.repositories.operations import device_session_repo
from app.services.job import job_service
from app.services.command import command_service
from app.services.log import log_service
from app.websockets.routing import decode_jwt_user_id

logger = logging.getLogger(__name__)

router = APIRouter()

def get_current_user_id(authorization: str = Header(...)) -> str:
    """Dependency to extract user ID from JWT token in Authorization header."""
    if not authorization.startswith("JWT "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'JWT <token>'"
        )
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Missing token."
        )
    token = parts[1]
    user_id = decode_jwt_user_id(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token."
        )
    return user_id


# ==========================================
# Sessions Endpoints
# ==========================================

@router.post("/sessions", response_model=DeviceSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    obj_in: DeviceSessionCreate,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create a new user interaction session with a device."""
    return await session_service.create_session(db, obj_in, user_id)
@router.get("/devices/{device_id}/active-session", response_model=Optional[DeviceSessionResponse])
async def get_device_active_session(
    device_id: str,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Retrieve the current active session for a device, if any."""
    return await device_session_repo.get_active_by_device(db, device_id)



@router.get("/sessions/{id}", response_model=DeviceSessionResponse)
async def get_session(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Retrieve details of a specific device session."""
    return await session_service.get_session(db, id)


@router.get("/sessions", response_model=List[DeviceSessionResponse])
async def list_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all device sessions."""
    return await session_service.get_sessions(db, skip=skip, limit=limit)


@router.delete("/sessions/{id}", response_model=DeviceSessionResponse)
async def end_session(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """End an active session, transitioning it to CLOSED status."""
    return await session_service.end_session(db, id, user_id, status_value="CLOSED")


# ==========================================
# Jobs Endpoints
# ==========================================

@router.post("/jobs", response_model=DeviceJobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    obj_in: DeviceJobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Queue a new operations job for a device in an active session."""
    return await job_service.create_job(db, obj_in, user_id, background_tasks)


@router.get("/jobs/{id}", response_model=DeviceJobResponse)
async def get_job(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Retrieve details and progress of a device job."""
    return await job_service.get_job(db, id)


@router.get("/sessions/{id}/jobs", response_model=List[DeviceJobResponse])
async def list_session_jobs(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all jobs associated with a specific session."""
    return await job_service.get_session_jobs(db, id)


@router.post("/jobs/{id}/cancel", response_model=DeviceJobResponse)
async def cancel_job(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Request cancellation of a queued or running job."""
    return await job_service.cancel_job(db, id)


# ==========================================
# Commands Endpoints
# ==========================================

@router.post("/commands", response_model=CommandResponse, status_code=status.HTTP_201_CREATED)
async def define_command(
    obj_in: CommandCreate,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Define a new command supported by device agents (Admin/Ops utility)."""
    return await command_service.create_command(db, obj_in)


@router.get("/commands", response_model=List[CommandResponse])
async def list_commands(
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all available command definitions."""
    return await command_service.get_commands(db)


@router.get("/commands/{id}", response_model=CommandResponse)
async def get_command(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get details of a command definition."""
    return await command_service.get_command(db, id)


@router.post("/commands/{id}/execute", response_model=DeviceJobResponse)
async def execute_command(
    id: UUID,
    req: CommandExecuteRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Execute a command template on a remote device inside an active session."""
    return await command_service.execute_command(db, id, req, user_id, background_tasks)


# ==========================================
# Logs Endpoints
# ==========================================

@router.get("/sessions/{id}/logs", response_model=List[SessionLogResponse])
async def list_session_logs(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Retrieve log file metadata references for a specific session."""
    return await log_service.get_session_logs(db, id)


@router.get("/logs/{id}", response_class=PlainTextResponse)
async def get_log_content(
    id: UUID,
    db: AsyncSession = Depends(get_async_db),
    user_id: str = Depends(get_current_user_id)
):
    """Fetch the actual plain-text log contents from object storage mock."""
    return await log_service.read_log_content(db, id)
