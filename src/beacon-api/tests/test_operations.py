import pytest
import pytest_asyncio
import asyncio
from datetime import datetime, timezone, timedelta
from uuid import uuid4, UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.db.session import AsyncSessionLocal
from app.models.operations import DeviceSession, DeviceJob, SessionLog, Command
from app.models.sync import SyncDevice
from app.models.firmware import Firmware
from app.repositories.operations import device_session_repo, device_repo, command_repo
from app.services.redis_service import redis_service
from app.services.session import session_service
from app.services.job import job_service
from app.services.command import command_service
from app.services.log import log_service
from app.websockets.routing import decode_jwt_user_id
from app.websockets.manager import manager
from app.schemas.operations import (
    DeviceSessionCreate, DeviceJobCreate, CommandCreate, CommandExecuteRequest
)

# Test JWT token for decoding
TEST_JWT = "JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZmM3NDdkZTE0NGE1ODAwMTk0N2FhOWMiLCJlbWFpbCI6ImFkbWluQGFpcnFvLm5ldCJ9.sig"

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(autouse=True)
async def clean_redis():
    yield
    # Reset Redis client connection pool to prevent 'event loop closed' errors between tests
    if redis_service._client is not None:
        await redis_service.close()



@pytest.mark.asyncio
async def test_jwt_decoding():
    """Verify that JWT token payload decoding works and extracts the _id field."""
    # Test valid token
    user_id = decode_jwt_user_id(TEST_JWT.split(" ")[1])
    assert user_id == "5fc747de144a58001947aa9c"

    # Test invalid token format
    assert decode_jwt_user_id("invalid.token") is None


@pytest.mark.asyncio
async def test_redis_presence():
    """Verify that agent online presence and session tracking work in Redis."""
    device_id = f"test-device-{uuid4()}"
    metadata = {"board_type": "esp32", "firmware_version": "v1.0.0"}

    # Mark agent online
    await redis_service.set_agent_online(device_id, metadata, ttl_seconds=5)
    
    # Retrieve online agents and assert presence
    online = await redis_service.get_online_agents()
    assert device_id in online
    assert online[device_id]["board_type"] == "esp32"

    # Mark agent offline
    await redis_service.set_agent_offline(device_id)
    online = await redis_service.get_online_agents()
    assert device_id not in online


@pytest.mark.asyncio
async def test_session_lifecycle():
    """Verify session creation, observer membership, and closure."""
    device_id = f"dev-{uuid4()}"
    user_id = "user-123"

    async with AsyncSessionLocal() as db:
        # Create a mock device to satisfy foreign key constraints
        mock_device = SyncDevice(device_id=device_id, device_name="Test Verification Device")
        db.add(mock_device)
        await db.commit()

        # Create session
        session_in = DeviceSessionCreate(
            device_id=device_id,
            session_type="DEBUGGING",
            meta_data={"test": "lifecycle"}
        )
        session = await session_service.create_session(db, session_in, user_id)
        assert session.id is not None
        assert session.status == "ACTIVE"
        assert session.device_id == device_id
        assert session.controller_user_id == user_id

        # Verify lock presence in Redis
        controller = await redis_service.get_session_controller(str(session.id))
        assert controller == user_id

        # End session
        closed_session = await session_service.end_session(db, session.id, user_id)
        assert closed_session.status == "CLOSED"
        assert closed_session.ended_at is not None

        # Clean up mock device
        await db.delete(mock_device)
        await db.commit()


@pytest.mark.asyncio
async def test_log_storage():
    """Verify mock object storage and reference logging in PostgreSQL."""
    session_id = uuid4()
    log_content = b"SERIAL OUTPUT: Initializing bootloader... OK\nStarting main loop..."
    
    async with AsyncSessionLocal() as db:
        # Create mock active session
        mock_sess = DeviceSession(
            id=session_id,
            session_type="LOCAL",
            status="ACTIVE",
            started_at=datetime.now(timezone.utc)
        )
        db.add(mock_sess)
        await db.commit()

        # Store log
        log_ref = await log_service.store_log(db, session_id, "SERIAL_LOG", log_content)
        assert log_ref.id is not None
        assert log_ref.size == len(log_content)
        
        # Read log content back and verify
        content_read = await log_service.read_log_content(db, log_ref.id)
        assert content_read == log_content.decode("utf-8")

        # Clean up database records
        await db.delete(log_ref)
        await db.delete(mock_sess)
        await db.commit()


@pytest.mark.asyncio
async def test_command_validation_and_safety():
    """Verify that command service validates schemas, offline status, and safety confirmations."""
    device_id = f"dev-offline-{uuid4()}"
    user_id = "user-999"

    async with AsyncSessionLocal() as db:
        # Create command definition
        cmd_in = CommandCreate(
            name="factory_reset",
            description="Reverts device settings",
            command_template="reset --mode=full",
            parameter_schema={"type": "object", "properties": {"confirm": {"type": "boolean"}}},
            supported_boards=["esp32"],
            dangerous=True,
            requires_confirmation=True,
            enabled=True
        )
        # Check if already exists to avoid unique constraint violations
        existing_cmd = await command_repo.get_by_name(db, "factory_reset")
        if existing_cmd:
            cmd = existing_cmd
        else:
            cmd = await command_service.create_command(db, cmd_in)

        # Attempt execution on offline device (should raise HTTPException)
        req = CommandExecuteRequest(device_id=device_id, parameters={"confirm": True})
        
        from fastapi import BackgroundTasks
        bg_tasks = BackgroundTasks()

        with pytest.raises(HTTPException) as exc_info:
            await command_service.execute_command(db, cmd.id, req, user_id, bg_tasks)
        assert exc_info.value.status_code == 400
        assert "is offline" in exc_info.value.detail

        # Attempt execution without confirmation parameter (should raise confirmation warning)
        # Mark device online first
        await redis_service.set_agent_online(device_id, {"board_type": "esp32"})
        
        # Create a mock session for the device
        mock_device = SyncDevice(device_id=device_id, device_name="Online Test Device")
        db.add(mock_device)
        mock_sess = DeviceSession(
            device_id=device_id,
            session_type="REMOTE",
            status="ACTIVE",
            started_at=datetime.now(timezone.utc)
        )
        db.add(mock_sess)
        await db.commit()

        req_no_confirm = CommandExecuteRequest(device_id=device_id, parameters={"confirm": False})
        with pytest.raises(HTTPException) as exc_info:
            await command_service.execute_command(db, cmd.id, req_no_confirm, user_id, bg_tasks)
        assert exc_info.value.status_code == 400
        assert "requires explicit confirmation" in exc_info.value.detail

        # Clean up
        await redis_service.set_agent_offline(device_id)
        if not existing_cmd:
            await db.delete(cmd)
        await db.delete(mock_sess)
        await db.delete(mock_device)
        await db.commit()


@pytest.mark.asyncio
async def test_get_active_by_device_multiple_sessions():
    """Verify that get_active_by_device handles multiple active sessions and returns the most recent one."""
    device_id = f"test-mult-sess-{uuid4()}"
    user_id = "user-abc"

    async with AsyncSessionLocal() as db:
        # Create mock device
        mock_device = SyncDevice(device_id=device_id, device_name="Multi Session Device")
        db.add(mock_device)
        await db.commit()

        # Create older active session
        session_old = DeviceSession(
            device_id=device_id,
            session_type="DEBUGGING",
            status="ACTIVE",
            started_at=datetime.now(timezone.utc) - timedelta(hours=1),
            controller_user_id="user-old"
        )
        # Create newer active session
        session_new = DeviceSession(
            device_id=device_id,
            session_type="DEBUGGING",
            status="ACTIVE",
            started_at=datetime.now(timezone.utc),
            controller_user_id="user-new"
        )
        db.add(session_old)
        db.add(session_new)
        await db.commit()

        # Retrieve active session
        active_sess = await device_session_repo.get_active_by_device(db, device_id)
        assert active_sess is not None
        assert active_sess.controller_user_id == "user-new"

        # Cleanup
        await db.delete(session_old)
        await db.delete(session_new)
        await db.delete(mock_device)
        await db.commit()


def test_get_device_active_session_endpoint():
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    # Get with invalid token format
    res = client.get("/api/v1/devices/nonexistent/active-session")
    assert res.status_code == 422 # missing Header

    # Get with valid token format
    res = client.get(
        "/api/v1/devices/nonexistent/active-session",
        headers={"Authorization": TEST_JWT}
    )
    assert res.status_code == 200
    assert res.json() is None


