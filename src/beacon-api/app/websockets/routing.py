import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import base64

from app.db.session import AsyncSessionLocal
from app.websockets.manager import manager
from app.services.redis_service import redis_service
from app.services.session import session_service
from app.services.job import job_service
from app.services.command import command_service
from app.repositories.operations import device_session_repo
from app.schemas.operations import CommandExecuteRequest

logger = logging.getLogger(__name__)

router = APIRouter()

def decode_jwt_user_id(token: str) -> Optional[str]:
    """Helper to decode JWT payload safely and retrieve user _id field."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        return payload.get("_id")
    except Exception as e:
        logger.warning(f"Failed to decode JWT token: {e}")
        return None


@router.websocket("/ws/agents")
async def ws_agents_endpoint(websocket: WebSocket):
    device_id: Optional[str] = None
    metadata: dict = {}
    
    try:
        # Wait for registration message before accepting fully or accepting connection first
        await websocket.accept()
        logger.info("Agent connection established. Awaiting registration.")

        # Accept registration payload
        data = await websocket.receive_text()
        msg = json.loads(data)
        
        if msg.get("type") != "register" or not msg.get("device_id"):
            logger.warning("Agent failed to register in first message. Closing connection.")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        device_id = msg["device_id"]
        metadata = msg.get("metadata", {})
        
        # Register in memory and Redis
        manager.active_agents[device_id] = websocket
        # Start a local subscription task
        task = asyncio.create_task(manager._listen_agent_pubsub(device_id))
        manager.agent_listener_tasks[device_id] = task

        await redis_service.set_agent_online(device_id, metadata)
        
        # Acknowledge registration
        await websocket.send_json({
            "type": "registered",
            "device_id": device_id,
            "status": "online"
        })

        # Main agent receive loop
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")

            if msg_type == "heartbeat":
                # Refresh presence in Redis
                await redis_service.set_agent_online(device_id, metadata)
                await websocket.send_json({"type": "heartbeat_ack"})

            elif msg_type == "telemetry":
                # Forward telemetry to active session channel
                active_session = await redis_service.client.hget("device_to_session", device_id)
                session_id = None
                if not active_session:
                    # Let's check if there is an active session in the database
                    async with AsyncSessionLocal() as db:
                        session_db = await device_session_repo.get_active_by_device(db, device_id)
                        if session_db:
                            session_id = str(session_db.id)
                else:
                    session_id = json.loads(active_session).get("session_id")
                
                if session_id:
                    await redis_service.publish_to_session(session_id, {
                        "event": "telemetry",
                        "device_id": device_id,
                        "data": msg.get("data", {})
                    })

            elif msg_type == "job_update":
                job_id_str = msg.get("job_id")
                if job_id_str:
                    job_id = UUID(job_id_str)
                    progress = msg.get("progress", 0)
                    job_status = msg.get("status", "RUNNING")
                    result = msg.get("result")

                    async with AsyncSessionLocal() as db:
                        job = await job_service.get_job(db, job_id)
                        # Only update if job status matches
                        if job and job.status in ["QUEUED", "RUNNING"]:
                            update_dict = {"status": job_status, "progress": progress}
                            if result:
                                update_dict["result"] = result
                            if job_status in ["COMPLETED", "FAILED"]:
                                update_dict["completed_at"] = datetime.now(timezone.utc)

                            from app.services.job import device_job_repo
                            await device_job_repo.update(db, db_obj=job, obj_in=update_dict)
                            # Publish update
                            await redis_service.publish_to_session(str(job.session_id), {
                                "event": "job_status",
                                "job_id": str(job.id),
                                "status": job_status,
                                "progress": progress,
                                "result": result
                            })

            elif msg_type == "serial_log":
                # Live serial logs streamed from agent
                active_session = await redis_service.client.hget("device_to_session", device_id)
                session_id = None
                if not active_session:
                    # Check database fallback
                    async with AsyncSessionLocal() as db:
                        session_db = await device_session_repo.get_active_by_device(db, device_id)
                        if session_db:
                            session_id = str(session_db.id)
                else:
                    session_id = json.loads(active_session).get("session_id")
                
                if session_id:
                    await redis_service.publish_to_session(session_id, {
                        "event": "serial_log",
                        "device_id": device_id,
                        "log": msg.get("log", "")
                    })

    except WebSocketDisconnect:
        logger.info(f"Agent websocket connection disconnected.")
    except Exception as e:
        logger.exception(f"Error in Agent websocket connection: {e}")
    finally:
        if device_id:
            await manager.disconnect_agent(device_id)
            await redis_service.set_agent_offline(device_id)
            # Auto-terminate any active sessions since agent/device disconnected
            async with AsyncSessionLocal() as db:
                try:
                    active_session = await device_session_repo.get_active_by_device(db, device_id)
                    if active_session:
                        logger.info(f"Agent {device_id} disconnected. Auto-terminating active session {active_session.id}.")
                        await session_service.end_session(db, active_session.id, active_session.user_id, status_value="CLOSED")
                except Exception as err:
                    logger.error(f"Failed to auto-terminate session on agent disconnect: {err}")


@router.websocket("/ws/sessions/{session_id}")
async def ws_sessions_endpoint(
    websocket: WebSocket,
    session_id: UUID,
    token: Optional[str] = Query(None)
):
    user_id = None
    if token:
        # Check standard JWT format e.g. "JWT <token>" or raw token
        clean_token = token.split(" ")[1] if token.startswith("JWT ") else token
        user_id = decode_jwt_user_id(clean_token)
    
    if not user_id:
        logger.warning(f"Unauthorized websocket connection attempt to session {session_id}")
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized token.")
        return

    session_id_str = str(session_id)
    try:
        # Join session as observer
        await manager.connect_session(session_id_str, websocket)
        await session_service.join_session(session_id, user_id)

        # Notify joining
        await websocket.send_json({
            "type": "joined",
            "session_id": session_id_str,
            "user_id": user_id
        })

        # Main receive loop for frontend events
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")

            if msg_type == "acquire_control":
                async with AsyncSessionLocal() as db:
                    success = await session_service.acquire_control(db, session_id, user_id)
                    await websocket.send_json({
                        "type": "control_response",
                        "success": success,
                        "controller_user_id": user_id if success else await redis_service.get_session_controller(session_id_str)
                    })

            elif msg_type == "release_control":
                async with AsyncSessionLocal() as db:
                    success = await session_service.release_control(db, session_id, user_id)
                    await websocket.send_json({
                        "type": "control_response",
                        "success": not success,  # True if release failed (still control), False if released
                        "controller_user_id": None if success else user_id
                    })

            elif msg_type == "execute_command":
                # Check if this user is the active controller
                current_controller = await redis_service.get_session_controller(session_id_str)
                if current_controller != user_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Only the active controller can execute commands."
                    })
                    continue

                command_id_str = msg.get("command_id")
                device_id = msg.get("device_id")
                parameters = msg.get("parameters", {})

                if not command_id_str or not device_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Missing command_id or device_id."
                    })
                    continue

                try:
                    async with AsyncSessionLocal() as db:
                        # Define background tasks local to websocket loop
                        from fastapi import BackgroundTasks
                        bg_tasks = BackgroundTasks()
                        
                        cmd_req = CommandExecuteRequest(device_id=device_id, parameters=parameters)
                        job = await command_service.execute_command(
                            db, UUID(command_id_str), cmd_req, user_id, bg_tasks
                        )
                        
                        # Manually invoke the background task since WebSockets don't trigger the FastAPI BackgroundTasks pipeline automatically!
                        # This is a critical edge case!
                        for task_def in bg_tasks.tasks:
                            asyncio.create_task(task_def.func(*task_def.args, **task_def.kwargs))

                        await websocket.send_json({
                            "type": "command_execution_started",
                            "job_id": str(job.id),
                            "job_type": job.job_type,
                            "status": job.status
                        })
                except HTTPException as e:
                    await websocket.send_json({
                        "type": "error",
                        "message": e.detail
                    })
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Execution failed: {str(e)}"
                    })

    except WebSocketDisconnect:
        logger.info(f"Session client websocket disconnected: {session_id_str}")
    except Exception as e:
        logger.exception(f"Error in Session websocket connection: {e}")
    finally:
        await manager.disconnect_session(session_id_str, websocket)
        await session_service.leave_session(session_id, user_id)
        # If no active observers left, close/end the session
        if session_id_str not in manager.active_sessions:
            logger.info(f"No active observers left for session {session_id_str}. Auto-terminating session.")
            async with AsyncSessionLocal() as db:
                try:
                    await session_service.end_session(db, session_id, user_id, status_value="CLOSED")
                except Exception as err:
                    logger.error(f"Failed to auto-terminate session {session_id_str}: {err}")
