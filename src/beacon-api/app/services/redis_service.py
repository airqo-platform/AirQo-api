import json
import logging
from typing import Optional, List, Set, Dict, Any
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self) -> None:
        self.redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
        self._client: Optional[aioredis.Redis] = None

    @property
    def client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self.redis_url, decode_responses=True)
            logger.info("Async Redis client initialized.")
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("Async Redis client closed.")

    # Presence Tracking for Agents
    async def set_agent_online(self, device_id: str, metadata: dict, ttl_seconds: int = 30) -> None:
        presence_key = f"agent:presence:{device_id}"
        await self.client.set(presence_key, "online", ex=ttl_seconds)
        
        # Store metadata in a hash of all agents
        await self.client.hset("active_agents", device_id, json.dumps(metadata))
        logger.debug(f"Agent {device_id} marked online in Redis.")

    async def set_agent_offline(self, device_id: str) -> None:
        presence_key = f"agent:presence:{device_id}"
        await self.client.delete(presence_key)
        await self.client.hdel("active_agents", device_id)
        logger.info(f"Agent {device_id} marked offline in Redis.")

    async def get_online_agents(self) -> Dict[str, dict]:
        agents = await self.client.hgetall("active_agents")
        online_agents = {}
        for device_id, meta_str in agents.items():
            # Verify if the presence key still exists (heartbeat check)
            is_alive = await self.client.exists(f"agent:presence:{device_id}")
            if is_alive:
                try:
                    online_agents[device_id] = json.loads(meta_str)
                except Exception:
                    online_agents[device_id] = {}
            else:
                # Clean up expired agent
                await self.client.hdel("active_agents", device_id)
        return online_agents

    # Active Sessions Tracking
    async def track_session_start(self, session_id: str, metadata: dict) -> None:
        await self.client.hset("active_sessions", session_id, json.dumps(metadata))
        device_id = metadata.get("device_id")
        if device_id:
            await self.client.hset("device_to_session", device_id, json.dumps(metadata))

    async def track_session_end(self, session_id: str) -> None:
        session_str = await self.client.hget("active_sessions", session_id)
        if session_str:
            try:
                metadata = json.loads(session_str)
                device_id = metadata.get("device_id")
                if device_id:
                    await self.client.hdel("device_to_session", device_id)
            except Exception:
                pass
        await self.client.hdel("active_sessions", session_id)
        await self.client.delete(f"session:observers:{session_id}")
        await self.client.delete(f"session:controller:{session_id}")

    # Observers Management
    async def add_session_observer(self, session_id: str, user_id: str) -> int:
        key = f"session:observers:{session_id}"
        count = await self.client.sadd(key, user_id)
        # Publish observer update to the session channel
        await self.publish_to_session(session_id, {
            "event": "observer_joined",
            "user_id": user_id,
            "observers": list(await self.get_session_observers(session_id))
        })
        return count

    async def remove_session_observer(self, session_id: str, user_id: str) -> int:
        key = f"session:observers:{session_id}"
        count = await self.client.srem(key, user_id)
        # Publish observer update
        await self.publish_to_session(session_id, {
            "event": "observer_left",
            "user_id": user_id,
            "observers": list(await self.get_session_observers(session_id))
        })
        return count

    async def get_session_observers(self, session_id: str) -> Set[str]:
        key = f"session:observers:{session_id}"
        observers = await self.client.smembers(key)
        return set(observers)

    # Controller Lock (Session Ownership)
    async def acquire_controller_lock(self, session_id: str, user_id: str) -> bool:
        key = f"session:controller:{session_id}"
        # Set if not exists
        acquired = await self.client.set(key, user_id, nx=True)
        if acquired:
            await self.publish_to_session(session_id, {
                "event": "controller_acquired",
                "user_id": user_id
            })
            return True
        # Check if already owned by this user
        current_controller = await self.client.get(key)
        return current_controller == user_id

    async def release_controller_lock(self, session_id: str, user_id: str) -> bool:
        key = f"session:controller:{session_id}"
        current_controller = await self.client.get(key)
        if current_controller == user_id:
            await self.client.delete(key)
            await self.publish_to_session(session_id, {
                "event": "controller_released",
                "user_id": user_id
            })
            return True
        return False

    async def get_session_controller(self, session_id: str) -> Optional[str]:
        key = f"session:controller:{session_id}"
        return await self.client.get(key)

    # Pub/Sub Layer
    async def publish_to_session(self, session_id: str, message: dict) -> int:
        channel = f"session:channel:{session_id}"
        return await self.client.publish(channel, json.dumps(message))

    async def publish_to_agent(self, device_id: str, message: dict) -> int:
        channel = f"agent:channel:{device_id}"
        return await self.client.publish(channel, json.dumps(message))

redis_service = RedisService()
