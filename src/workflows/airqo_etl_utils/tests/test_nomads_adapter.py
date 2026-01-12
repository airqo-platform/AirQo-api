from unittest.mock import patch, MagicMock
from airqo_etl_utils.sources.nomads_adapter import NomadsAdapter
from airqo_etl_utils.utils import Result


@patch("airqo_etl_utils.sources.nomads_adapter.DataApi")
@patch("airqo_etl_utils.sources.nomads_adapter.requests.get")
def test_nomads_success(mock_get, mock_dataapi_cls):
    mock_instance = MagicMock()
    mock_instance._DataApi__nomads_url_util.return_value = (
        "https://nomads.example",
        "?file=abc",
        "gdas.t00z.pgrb2.0p25.f000",
    )
    mock_dataapi_cls.return_value = mock_instance
    # Utils.parse_api_response will be called; ensure it returns a path
    with patch(
        "airqo_etl_utils.sources.nomads_adapter.Utils.parse_api_response",
        return_value="/tmp/gdas.t00z.pgrb2.0p25.f000",
    ):
        adapter = NomadsAdapter()
        res = adapter.fetch()
        assert isinstance(res, Result)
        assert res.error is None
        assert res.data["meta"]["file"] == "/tmp/gdas.t00z.pgrb2.0p25.f000"


@patch("airqo_etl_utils.sources.nomads_adapter.DataApi")
@patch("airqo_etl_utils.sources.nomads_adapter.requests.get")
def test_nomads_failure(mock_get, mock_dataapi_cls):
    mock_instance = MagicMock()
    mock_instance._DataApi__nomads_url_util.return_value = (
        "https://nomads.example",
        "?file=abc",
        "gdas.t00z.pgrb2.0p25.f000",
    )
    mock_dataapi_cls.return_value = mock_instance
    mock_get.side_effect = Exception("network")
    adapter = NomadsAdapter()
    res = adapter.fetch()
    assert isinstance(res, Result)
    assert res.data["records"] == []
    assert res.error is not None
