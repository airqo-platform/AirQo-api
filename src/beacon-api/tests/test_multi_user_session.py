"""
Multi-User Session Integration Test
====================================

This test verifies that multiple users can connect to the same device session
via WebSocket and both receive logs/telemetry from the device agent.

Endpoints exercised:
  1. POST   /api/v1/sessions                          — Create a remote session
  2. GET    /api/v1/devices/{device_id}/active-session — Check active session
  3. WS     /api/v1/ws/agents                         — Device agent connects
  4. WS     /api/v1/ws/sessions/{session_id}?token=... — User observers connect
  5. DELETE  /api/v1/sessions/{id}                     — End session (cleanup)

Flow:
  ┌─────────┐       ┌─────────────────┐       ┌────────┐  ┌────────┐
  │  Agent  │──ws──▸│  Beacon API     │◂──ws──│ User 1 │  │ User 2 │
  │ (device)│       │  (Redis PubSub) │──ws──▸│        │  │        │
  └─────────┘       └─────────────────┘──ws──▸└────────┘  └────────┘
"""
import pytest
import json
import time
import base64
from uuid import uuid4
from starlette.testclient import TestClient
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.sync import SyncDevice
from app.models.operations import DeviceSession
from app.services.redis_service import redis_service
from app.websockets.routing import decode_jwt_user_id


# ── Two fake JWT tokens with distinct user IDs ──────────────────────────────

def _make_fake_jwt(user_id: str, email: str) -> str:
    """Craft a minimal unsigned JWT with the given _id. Signature is ignored by decode_jwt_user_id."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps({"_id": user_id, "email": email}).encode()).rstrip(b"=").decode()
    return f"{header}.{payload}.fakesig"

USER_1_ID = "user-aaa-111"
USER_2_ID = "user-bbb-222"
TOKEN_USER_1 = _make_fake_jwt(USER_1_ID, "user1@airqo.net")
TOKEN_USER_2 = _make_fake_jwt(USER_2_ID, "user2@airqo.net")


# ── Helpers ─────────────────────────────────────────────────────────────────

ENDPOINTS_USED = []

def log_endpoint(method: str, path: str, status: int = None, note: str = ""):
    entry = f"{method:7s} {path}"
    if status:
        entry += f"  -> {status}"
    if note:
        entry += f"  ({note})"
    ENDPOINTS_USED.append(entry)


# ── The Test ────────────────────────────────────────────────────────────────

def test_multi_user_session_receives_device_data():
    """
    Two users connect to the SAME session, a device agent sends serial_log and
    telemetry messages, and BOTH users must receive them over their WebSocket.
    
    Uses a synchronous test with TestClient so all WebSocket & HTTP calls share
    the same event loop created internally by the TestClient.
    """
    # Reset Redis singleton so it re-initializes on the TestClient's event loop
    redis_service._client = None
    
    from main import app
    
    device_id = f"test-multi-user-{uuid4()}"
    ENDPOINTS_USED.clear()
    session_id = None

    with TestClient(app) as client:
        # ── Step 0: Create mock device in DB ────────────────────────────
        # Use the client's event loop for async DB operations by making them
        # happen inside the app endpoints. Instead, we'll use a sync approach:
        # hit a simple endpoint to warm up, then use the async session directly.
        import asyncio
        
        async def setup_device():
            async with AsyncSessionLocal() as db:
                mock_device = SyncDevice(device_id=device_id, device_name="Multi-User Test Device")
                db.add(mock_device)
                await db.commit()
        
        # Run async setup in a new event loop (separate from TestClient's)
        loop = asyncio.new_event_loop()
        loop.run_until_complete(setup_device())
        loop.close()

        try:
            # ── Step 1: Create a session via REST ───────────────────────
            create_resp = client.post(
                "/api/v1/sessions",
                json={"device_id": device_id, "session_type": "REMOTE"},
                headers={"Authorization": f"JWT {TOKEN_USER_1}"},
            )
            assert create_resp.status_code == 201, f"Session creation failed: {create_resp.text}"
            session_data = create_resp.json()
            session_id = session_data["id"]
            log_endpoint("POST", "/api/v1/sessions", 201, "User 1 creates session")
            print(f"\n  ✓ Session {session_id} created")

            # ── Step 2: Verify active-session endpoint ──────────────────
            active_resp = client.get(
                f"/api/v1/devices/{device_id}/active-session",
                headers={"Authorization": f"JWT {TOKEN_USER_1}"},
            )
            assert active_resp.status_code == 200
            assert active_resp.json()["id"] == session_id
            log_endpoint("GET", f"/api/v1/devices/{device_id}/active-session", 200, "Confirms session is ACTIVE")
            print(f"  ✓ Active session confirmed for device {device_id}")

            # ── Step 3: Connect device agent via WebSocket ──────────────
            with client.websocket_connect("/api/v1/ws/agents") as ws_agent:
                log_endpoint("WS", "/api/v1/ws/agents", note="Device agent connects")

                # Register the agent
                ws_agent.send_text(json.dumps({
                    "type": "register",
                    "device_id": device_id,
                    "metadata": {"board_type": "esp32", "firmware_version": "v2.1.0"}
                }))
                reg_ack = ws_agent.receive_json()
                assert reg_ack["type"] == "registered", f"Expected 'registered', got: {reg_ack}"
                assert reg_ack["device_id"] == device_id
                print(f"  ✓ Agent registered: {device_id}")

                # ── Step 4: Connect User 1 to the session WS ───────────
                ws_url_1 = f"/api/v1/ws/sessions/{session_id}?token={TOKEN_USER_1}"
                with client.websocket_connect(ws_url_1) as ws_user1:
                    log_endpoint("WS", f"/api/v1/ws/sessions/{{session_id}}?token=<user1>", note="User 1 joins session")

                    join_msg_1 = ws_user1.receive_json()
                    assert join_msg_1["type"] == "joined"
                    assert join_msg_1["user_id"] == USER_1_ID
                    print(f"  ✓ User 1 ({USER_1_ID}) joined session")

                    # drain the observer_joined broadcast for user 1
                    _obs_1 = ws_user1.receive_json()

                    # ── Step 5: Connect User 2 to the SAME session WS ──
                    ws_url_2 = f"/api/v1/ws/sessions/{session_id}?token={TOKEN_USER_2}"
                    with client.websocket_connect(ws_url_2) as ws_user2:
                        log_endpoint("WS", f"/api/v1/ws/sessions/{{session_id}}?token=<user2>", note="User 2 joins SAME session")

                        join_msg_2 = ws_user2.receive_json()
                        assert join_msg_2["type"] == "joined"
                        assert join_msg_2["user_id"] == USER_2_ID
                        print(f"  ✓ User 2 ({USER_2_ID}) joined SAME session")

                        # drain observer_joined broadcasts
                        _obs_2a = ws_user2.receive_json()  # user2 sees own join
                        _obs_2b = ws_user1.receive_json()   # user1 sees user2 join

                        # ── Step 6: Agent sends serial_log ──────────────
                        ws_agent.send_text(json.dumps({
                            "type": "serial_log",
                            "log": "Booting firmware v2.1.0 ... OK"
                        }))

                        # Wait for Redis pub/sub propagation
                        time.sleep(0.5)

                        # Both users should receive the serial_log event
                        log_user1 = ws_user1.receive_json()
                        log_user2 = ws_user2.receive_json()

                        assert log_user1["event"] == "serial_log", f"User 1 got: {log_user1}"
                        assert log_user1["device_id"] == device_id
                        assert log_user1["log"] == "Booting firmware v2.1.0 ... OK"

                        assert log_user2["event"] == "serial_log", f"User 2 got: {log_user2}"
                        assert log_user2["device_id"] == device_id
                        assert log_user2["log"] == "Booting firmware v2.1.0 ... OK"

                        log_endpoint("MSG", "agent -> serial_log", note="✅ Both users received serial_log")
                        print(f"  ✓ Both users received serial_log: 'Booting firmware v2.1.0 ... OK'")

                        # ── Step 7: Agent sends telemetry ───────────────
                        ws_agent.send_text(json.dumps({
                            "type": "telemetry",
                            "data": {"pm2_5": 12.5, "pm10": 28.1, "temperature": 25.3}
                        }))

                        time.sleep(0.5)

                        telem_user1 = ws_user1.receive_json()
                        telem_user2 = ws_user2.receive_json()

                        assert telem_user1["event"] == "telemetry", f"User 1 got: {telem_user1}"
                        assert telem_user1["data"]["pm2_5"] == 12.5

                        assert telem_user2["event"] == "telemetry", f"User 2 got: {telem_user2}"
                        assert telem_user2["data"]["pm2_5"] == 12.5

                        log_endpoint("MSG", "agent -> telemetry", note="✅ Both users received telemetry")
                        print(f"  ✓ Both users received telemetry: pm2_5=12.5, pm10=28.1, temp=25.3")

            # ── Step 8: Clean up — end session ──────────────────────────
            del_resp = client.delete(
                f"/api/v1/sessions/{session_id}",
                headers={"Authorization": f"JWT {TOKEN_USER_1}"},
            )
            assert del_resp.status_code == 200
            log_endpoint("DELETE", f"/api/v1/sessions/{{session_id}}", 200, "Session closed")
            print(f"  ✓ Session {session_id} closed")

        finally:
            # Clean up DB
            async def cleanup_db():
                async with AsyncSessionLocal() as db:
                    sessions = (await db.execute(
                        select(DeviceSession).where(DeviceSession.device_id == device_id)
                    )).scalars().all()
                    for s in sessions:
                        await db.delete(s)
                    device = (await db.execute(
                        select(SyncDevice).where(SyncDevice.device_id == device_id)
                    )).scalar_one_or_none()
                    if device:
                        await db.delete(device)
                    await db.commit()

            loop2 = asyncio.new_event_loop()
            loop2.run_until_complete(cleanup_db())
            loop2.close()

    # ── Print endpoint summary ──────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  ENDPOINTS USED IN THIS TEST")
    print("=" * 70)
    for entry in ENDPOINTS_USED:
        print(f"    {entry}")
    print("=" * 70)
    print(f"\n  ✅ PASS — Both User 1 ({USER_1_ID}) and User 2 ({USER_2_ID})")
    print(f"     received serial_log AND telemetry from the device")
    print(f"     on the SAME session (shared observation)")
    print()
