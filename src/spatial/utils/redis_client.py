"""Redis connection shared by spatial caches during the Sentinel transition."""

import os

try:
    import redis
    from redis.sentinel import Sentinel
except ImportError:  # Redis caching is optional.
    redis = None
    Sentinel = None


def create_redis_client(*, decode_responses=False):
    """Connect to the current master, or directly to standalone Redis."""
    if redis is None:
        return None

    password = os.getenv("REDIS_PASSWORD") or None
    db = int(os.getenv("REDIS_DB", "0"))
    if os.getenv("REDIS_USE_SENTINEL", "false").lower() == "true":
        host = os.getenv("REDIS_HOST")
        if not host:
            return None
        port = int(os.getenv("REDIS_PORT", "26379"))
        sentinel = Sentinel(
            [(host, port)],
            socket_timeout=0.5,
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
            socket_timeout=0.5,
        )
    else:
        url = os.getenv("REDIS_URL")
        if url:
            client = redis.from_url(url, decode_responses=decode_responses)
        else:
            host = os.getenv("REDIS_HOST")
            port = os.getenv("REDIS_PORT")
            if not host or not port:
                return None
            client = redis.Redis(
                host=host, port=int(port), db=db, password=password,
                decode_responses=decode_responses,
            )
    client.ping()
    return client
