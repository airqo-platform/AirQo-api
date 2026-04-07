from airqo_etl_utils.sources.thingspeak_adapter import ThingSpeakAdapter


class DummyClient:
    def __init__(self, response):
        self._response = response

    def get_json(self, url, params=None, headers=None):
        return self._response


def test_thingspeak_adapter_fetch(monkeypatch):
    sample_response = {
        "channel": {"id": 123, "name": "test-channel"},
        "feeds": [
            {"field1": "10", "created_at": "2024-01-01T00:00:00Z"},
            {"field1": "12", "created_at": "2024-01-01T01:00:00Z"},
        ],
    }

    adapter = ThingSpeakAdapter()
    # replace the client's HTTP calls with a dummy predictable response
    adapter.client = DummyClient(sample_response)

    device = {"device_number": 123, "key": "abc"}
    dates = [("2024-01-01T00:00:00Z", "2024-01-01T02:00:00Z")]

    result = adapter.fetch(device, dates)

    assert result.error is None
    records = result.data["records"]
    meta = result.data["meta"]
    assert isinstance(records, list)
    assert len(records) == 2
    assert meta.get("id") == 123
