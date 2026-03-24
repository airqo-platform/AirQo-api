from unittest.mock import patch, MagicMock
from airqo_etl_utils.sources.nomads_adapter import NomadsAdapter
from airqo_etl_utils.utils import Result


def test_nomads_success():
    adapter = NomadsAdapter()
    # Patch download_file on the adapter's HttpClient instance so no real HTTP call is made.
    adapter.client.download_file = MagicMock(return_value=MagicMock())

    with patch(
        "airqo_etl_utils.sources.nomads_adapter.Utils.parse_api_response",
        return_value="/tmp/gdas.t00z.pgrb2.0p25.f000",
    ):
        res = adapter.fetch()

    assert isinstance(res, Result)
    assert res.error is None
    assert res.data["meta"]["file"] == "/tmp/gdas.t00z.pgrb2.0p25.f000"
    adapter.client.download_file.assert_called_once()


def test_nomads_failure():
    adapter = NomadsAdapter()
    # Simulate a network error from the HTTP client.
    adapter.client.download_file = MagicMock(side_effect=Exception("network"))

    res = adapter.fetch()

    assert isinstance(res, Result)
    assert res.data["records"] == []
    assert res.error is not None
