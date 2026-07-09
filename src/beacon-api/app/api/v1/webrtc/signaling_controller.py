import logging
import json
import asyncio
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import AsyncSessionLocal
from app.api.v1.operations import decode_jwt_user_id
from app.models.webrtc import WebRTCSessionMember, WebRTCSession
from app.services.redis_service import redis_service
from app.services.webrtc.participant_service import participant_service
from app.services.webrtc.signaling_service import signaling_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/signaling/{session_id}")
async def ws_webrtc_signaling_endpoint(
    websocket: WebSocket,
    session_id: UUID,
    token: Optional[str] = Query(None)
):
    user_id = None
    if token:
        clean_token = token.split(" ")[1] if token.startswith("JWT ") else token
        user_id = decode_jwt_user_id(clean_token)

    if not user_id:
        logger.warning(f"Unauthorized WebRTC WebSocket connection attempt to session {session_id}")
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized token.")
        return

    session_id_str = str(session_id)

    # Verify session is active and user is a member
    async with AsyncSessionLocal() as db:
        session = await db.get(WebRTCSession, session_id)
        if not session or session.status != "ACTIVE":
            logger.warning(f"WebSocket connect request to inactive/non-existent session {session_id}")
            await websocket.accept()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Session is not active.")
            return

        query = select(WebRTCSessionMember).where(
            and_(
                WebRTCSessionMember.session_id == session_id,
                WebRTCSessionMember.user_id == user_id,
                WebRTCSessionMember.left_at.is_(None)
            )
        )
        member = (await db.execute(query)).scalar_one_or_none()
        if not member:
            logger.warning(f"WebSocket connect request from non-member {user_id} for session {session_id}")
            await websocket.accept()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Not an active session member.")
            return

        # Mark as connected in db
        member.connected = True
        from datetime import datetime, timezone
        member.connected_at = datetime.now(timezone.utc)
        await db.commit()

    # Accept the connection
    await websocket.accept()
    logger.info(f"WebRTC signaling socket connected: User={user_id}, Session={session_id}")

    # Add presence to Redis set
    redis_key_pres = f"webrtc:session:presence:{session_id}"
    await redis_service.client.sadd(redis_key_pres, user_id)

    # Background task to listen to Redis pub/sub and send to client
    async def listen_redis_pubsub():
        pubsub = redis_service.client.pubsub()
        user_channel = f"webrtc:session:{session_id}:user:{user_id}"
        session_channel = f"webrtc:session:channel:{session_id}"
        await pubsub.subscribe(user_channel, session_channel)
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    msg_type = data.get("type")

                    # Handle force disconnect/removal by host
                    if msg_type == "removeParticipant" and data.get("user_id") == user_id:
                        logger.info(f"User {user_id} was removed by host. Closing WebSocket.")
                        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Removed from session.")
                        break

                    # Handle session closure by host
                    if msg_type == "sessionClosed":
                        logger.info(f"Session {session_id} closed by host. Closing WebSocket.")
                        await websocket.close(code=status.WS_1000_NORMAL_CLOSURE, reason="Session closed.")
                        break

                    # Send signaling message to user browser
                    await websocket.send_json(data)
        except asyncio.CancelledError:
            logger.debug(f"Redis listener task cancelled for user {user_id}")
        except Exception as ex:
            logger.error(f"Error in WebRTC pubsub reader for user {user_id}: {ex}")
        finally:
            try:
                await pubsub.unsubscribe()
                await pubsub.close()
            except Exception:
                pass

    pubsub_task = asyncio.create_task(listen_redis_pubsub())

    try:
        # Wait a tiny bit for pubsub subscription to complete
        await asyncio.sleep(0.1)

        # Broadcast that we joined the WebRTC signaling WebSocket
        channel = f"webrtc:session:channel:{session_id}"
        await redis_service.client.publish(
            channel,
            json.dumps({
                "type": "peerJoined",
                "session_id": session_id_str,
                "user_id": user_id,
                "role": member.role
            })
        )

        # Main receive loop (Client -> Server -> Pub/Sub -> Target Peer)
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            # Simple route function
            async with AsyncSessionLocal() as db:
                await signaling_service.route_signaling_message(
                    db=db,
                    session_id=session_id,
                    sender_id=user_id,
                    message=msg
                )
    except WebSocketDisconnect:
        logger.info(f"WebRTC signaling socket disconnected: User={user_id}, Session={session_id}")
    except Exception as e:
        logger.error(f"Error in WebRTC signaling WebSocket connection: {e}", exc_info=True)
    finally:
        pubsub_task.cancel()
        # Clean up member state
        async with AsyncSessionLocal() as db:
            try:
                await participant_service.leave_session(db, session_id, user_id)
            except Exception as e:
                logger.error(f"Error during WebRTC leave_session cleanup: {e}")
