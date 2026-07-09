import asyncio
import json
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self) -> None:
        self.active_agents: Dict[str, WebSocket] = {}
        self.active_sessions: Dict[str, Set[WebSocket]] = {}
        self.session_listener_tasks: Dict[str, asyncio.Task] = {}
        self.agent_listener_tasks: Dict[str, asyncio.Task] = {}

    async def connect_agent(self, device_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_agents[device_id] = websocket
        
        # Start a Redis subscription listener task for this agent
        task = asyncio.create_task(self._listen_agent_pubsub(device_id))
        self.agent_listener_tasks[device_id] = task
        logger.info(f"Agent websocket connected: {device_id}")

    async def disconnect_agent(self, device_id: str) -> None:
        if device_id in self.active_agents:
            del self.active_agents[device_id]
        if device_id in self.agent_listener_tasks:
            self.agent_listener_tasks[device_id].cancel()
            del self.agent_listener_tasks[device_id]
        logger.info(f"Agent websocket disconnected: {device_id}")

    async def connect_session(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if session_id not in self.active_sessions:
            self.active_sessions[session_id] = set()
            # Start a Redis subscription listener task for this session
            task = asyncio.create_task(self._listen_session_pubsub(session_id))
            self.session_listener_tasks[session_id] = task
        self.active_sessions[session_id].add(websocket)
        logger.info(f"Session client connected: {session_id}")

    async def disconnect_session(self, session_id: str, websocket: WebSocket) -> None:
        if session_id in self.active_sessions:
            self.active_sessions[session_id].discard(websocket)
            if not self.active_sessions[session_id]:
                del self.active_sessions[session_id]
                if session_id in self.session_listener_tasks:
                    self.session_listener_tasks[session_id].cancel()
                    del self.session_listener_tasks[session_id]
        logger.info(f"Session client disconnected: {session_id}")

    async def send_to_agent_local(self, device_id: str, message: dict) -> None:
        ws = self.active_agents.get(device_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to local agent {device_id}: {e}")
                await self.disconnect_agent(device_id)

    async def send_to_session_local(self, session_id: str, message: dict) -> None:
        sockets = self.active_sessions.get(session_id, set())
        for ws in list(sockets):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to session client {session_id}: {e}")
                await self.disconnect_session(session_id, ws)

    async def _listen_session_pubsub(self, session_id: str) -> None:
        """Listens to session:channel:{session_id} in Redis and forwards to local sockets."""
        channel_name = f"session:channel:{session_id}"
        pubsub = redis_service.client.pubsub()
        await pubsub.subscribe(channel_name)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await self.send_to_session_local(session_id, data)
        except asyncio.CancelledError:
            logger.info(f"Subscription task for session {session_id} cancelled.")
        except Exception as e:
            logger.error(f"Error in session subscription listener for {session_id}: {e}")
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()

    async def _listen_agent_pubsub(self, device_id: str) -> None:
        """Listens to agent:channel:{device_id} in Redis and forwards to local agent socket."""
        channel_name = f"agent:channel:{device_id}"
        pubsub = redis_service.client.pubsub()
        await pubsub.subscribe(channel_name)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await self.send_to_agent_local(device_id, data)
        except asyncio.CancelledError:
            logger.info(f"Subscription task for agent {device_id} cancelled.")
        except Exception as e:
            logger.error(f"Error in agent subscription listener for {device_id}: {e}")
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()

manager = ConnectionManager()
