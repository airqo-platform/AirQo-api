from airqo_etl_utils.storage import (
    register_storage,
    get_storage,
    get_default_storage,
    get_configured_storage,
)


def test_register_and_get_storage():
    fake = object()
    register_storage("fake_store", fake)
    assert get_storage("fake_store") is fake
    # default storage should return some registered backend (at least fake_store present)
    default = get_default_storage()
    assert default is not None


def test_get_configured_storage_prefers_registered(monkeypatch):
    class FakeAdapter:
        pass

    fake = FakeAdapter()
    # register under 'bigquery' so the configured factory returns it
    register_storage("bigquery", fake)
    adapter = get_configured_storage()
    assert adapter is fake
