import pytest


@pytest.fixture(autouse=True)
def configure_test_cache():
    from app import application, cache
    from config import Config

    cache.init_app(
        application,
        config={
            "CACHE_TYPE": "SimpleCache",
            "CACHE_DEFAULT_TIMEOUT": Config.CACHE_TIMEOUT,
        },
    )
    with application.app_context():
        yield


@pytest.fixture
def monkeypatch():
    mpatch = pytest.MonkeyPatch()
    yield mpatch
    mpatch.undo()
