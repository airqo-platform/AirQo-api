from unittest.mock import Mock, patch

from utils import redis_client


def test_sentinel_mode_discovers_master_and_ignores_standalone_url(monkeypatch):
    monkeypatch.setenv("REDIS_USE_SENTINEL", "true")
    monkeypatch.setenv("REDIS_HOST", "sentinel-service")
    monkeypatch.setenv("REDIS_PORT", "26379")
    monkeypatch.setenv("REDIS_SENTINEL_MASTER", "mymaster")
    monkeypatch.setenv("REDIS_PASSWORD", "secret")
    monkeypatch.setenv("REDIS_DB", "2")
    monkeypatch.setenv("REDIS_URL", "redis://old-master:6379/0")
    client = Mock()
    sentinel = Mock()
    sentinel.master_for.return_value = client
    with patch.object(redis_client, "Sentinel", return_value=sentinel) as factory:
        assert redis_client.create_redis_client(decode_responses=True) is client
    factory.assert_called_once_with(
        [("sentinel-service", 26379)], socket_timeout=0.5,
        sentinel_kwargs={
            "socket_timeout": 0.5,
            "socket_connect_timeout": 0.5,
            "password": "secret",
        },
    )
    sentinel.master_for.assert_called_once_with(
        "mymaster", db=2, password="secret", decode_responses=True,
        socket_timeout=0.5,
    )
    client.ping.assert_called_once()


def test_standalone_mode_keeps_url_connection(monkeypatch):
    monkeypatch.setenv("REDIS_USE_SENTINEL", "false")
    monkeypatch.setenv("REDIS_URL", "redis://old-master:6379/0")
    client = Mock()
    with patch.object(redis_client.redis, "from_url", return_value=client) as factory:
        assert redis_client.create_redis_client() is client
    factory.assert_called_once_with("redis://old-master:6379/0", decode_responses=False)
    client.ping.assert_called_once()


def test_standalone_mode_uses_host_and_port_without_url(monkeypatch):
    monkeypatch.setenv("REDIS_USE_SENTINEL", "false")
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("REDIS_HOST", "old-master")
    monkeypatch.setenv("REDIS_PORT", "6379")
    monkeypatch.setenv("REDIS_DB", "0")
    monkeypatch.setenv("REDIS_PASSWORD", "secret")
    client = Mock()
    with patch.object(redis_client.redis, "Redis", return_value=client) as factory:
        assert redis_client.create_redis_client() is client
    factory.assert_called_once_with(
        host="old-master", port=6379, db=0, password="secret",
        decode_responses=False,
    )
    client.ping.assert_called_once()


def test_heatmap_standalone_prefers_host_and_port_over_url(monkeypatch):
    monkeypatch.setenv("REDIS_USE_SENTINEL", "false")
    monkeypatch.setenv("REDIS_URL", "redis://different-master:6379/0")
    monkeypatch.setenv("REDIS_HOST", "heatmap-master")
    monkeypatch.setenv("REDIS_PORT", "6379")
    monkeypatch.setenv("REDIS_DB", "0")
    monkeypatch.delenv("REDIS_PASSWORD", raising=False)
    client = Mock()
    with patch.object(redis_client.redis, "Redis", return_value=client) as direct:
        with patch.object(redis_client.redis, "from_url") as from_url:
            assert redis_client.create_redis_client(
                decode_responses=True, prefer_host_port=True
            ) is client
    direct.assert_called_once_with(
        host="heatmap-master", port=6379, db=0, password=None,
        decode_responses=True,
    )
    from_url.assert_not_called()
