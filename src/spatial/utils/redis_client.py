"""Redis connection shared by spatial caches during the Sentinel transition."""

import os
import logging

try:
    import redis
    from redis.sentinel import Sentinel
except ImportError:  # Redis caching is optional.
    redis = None
    Sentinel = None

logger = logging.getLogger(__name__)


def create_redis_client(*, decode_responses=False, prefer_host_port=False):
    """Connect to the current master, or directly to standalone Redis."""
    if redis is None:
        return None

    password = os.getenv("REDIS_PASSWORD") or None
    db = int(os.getenv("REDIS_DB", "0"))
    if os.getenv("REDIS_USE_SENTINEL", "false").lower() == "true":
        host = os.getenv("REDIS_HOST")
        if host:
            try:
                port = int(os.getenv("REDIS_PORT", "26379"))
                sentinel = Sentinel(
                    [(host, port)],
                    sentinel_kwargs={
                        "socket_timeout": 0.5,
                        "socket_connect_timeout": 0.5,
                        **({"password": password} if password else {}),
                    },
                )
                client = sentinel.master_for(
                    os.getenv("REDIS_SENTINEL_MASTER", "mymaster"),
                    db=db,
                    password=password,
                    decode_responses=decode_responses,
                    socket_timeout=5,
                )
                client.ping()
                return client
            except redis.RedisError:
                if not os.getenv("REDIS_URL"):
                    raise
                logger.warning("Sentinel unavailable; using standalone Redis URL", exc_info=True)
        url = os.getenv("REDIS_URL")
        if not url:
            return None
        client = redis.from_url(url, decode_responses=decode_responses)
    else:
        url = os.getenv("REDIS_URL")
        host = os.getenv("REDIS_HOST")
        port = os.getenv("REDIS_PORT")
        if prefer_host_port and host and port:
            client = redis.Redis(
                host=host, port=int(port), db=db, password=password,
                decode_responses=decode_responses,
            )
        elif url:
            client = redis.from_url(url, decode_responses=decode_responses)
        elif host and port:
            client = redis.Redis(
                host=host, port=int(port), db=db, password=password,
                decode_responses=decode_responses,
            )
        else:
            return None
    client.ping()
    return client
