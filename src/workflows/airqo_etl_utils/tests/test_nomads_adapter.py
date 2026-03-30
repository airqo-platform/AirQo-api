import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from airqo_etl_utils.sources.nomads_adapter import NomadsAdapter, _NOMADS_BASE_URL
from airqo_etl_utils.utils import Result


def _utc(year, month, day, hour, minute=0):
    """Convenience helper: timezone-aware UTC datetime."""
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "now_utc, expected_date, expected_cycle",
    [
        # Before 00z data is ready (now 03:00 → available_at 23:30 yesterday → 18z prev day)
        (_utc(2024, 3, 25, 3, 0), "20240324", "18"),
        # Just after 00z data is ready (now 04:00 → available_at 00:30 → 00z today)
        (_utc(2024, 3, 25, 4, 0), "20240325", "00"),
        # Before 06z data is ready (now 09:00 → available_at 05:30 → 00z today)
        (_utc(2024, 3, 25, 9, 0), "20240325", "00"),
        # Just after 06z data is ready (now 10:00 → available_at 06:30 → 06z today)
        (_utc(2024, 3, 25, 10, 0), "20240325", "06"),
        # Before 12z data is ready (now 15:00 → available_at 11:30 → 06z today)
        (_utc(2024, 3, 25, 15, 0), "20240325", "06"),
        # Just after 12z data is ready (now 16:00 → available_at 12:30 → 12z today)
        (_utc(2024, 3, 25, 16, 0), "20240325", "12"),
        # Before 18z data is ready (now 21:00 → available_at 17:30 → 12z today)
        (_utc(2024, 3, 25, 21, 0), "20240325", "12"),
        # Just after 18z data is ready (now 22:00 → available_at 18:30 → 18z today)
        (_utc(2024, 3, 25, 22, 0), "20240325", "18"),
        # Midnight boundary: 00:00 UTC → available_at 20:30 yesterday → 18z prev day
        (_utc(2024, 3, 25, 0, 0), "20240324", "18"),
    ],
)
def test_latest_cycle(now_utc, expected_date, expected_cycle):
    date_str, cycle = NomadsAdapter._latest_cycle(_now=now_utc)
    assert date_str == expected_date, f"wrong date for {now_utc}: got {date_str}"
    assert cycle == expected_cycle, f"wrong cycle for {now_utc}: got {cycle}"


def test_build_url_contains_cycle_and_date():
    _now = _utc(2024, 3, 25, 10, 0)  # → 06z on 20240325
    base_url, endpoint, grib_filename = NomadsAdapter._build_url(_now=_now)

    assert base_url == _NOMADS_BASE_URL
    assert "gdas.20240325" in endpoint
    assert "%2F06%2F" in endpoint
    assert grib_filename == "gdas.t06z.pgrb2.0p25.f000"
    assert f"file={grib_filename}" in endpoint


def test_build_url_custom_forecast_hour():
    _now = _utc(2024, 3, 25, 16, 0)  # → 12z on 20240325
    _, endpoint, grib_filename = NomadsAdapter._build_url(
        forecast_hour="003", _now=_now
    )
    assert grib_filename == "gdas.t12z.pgrb2.0p25.f003"
    assert "f003" in grib_filename


def test_build_url_midnight_crossover():
    """Ensure the URL uses the previous day's date when the delay crosses midnight."""
    _now = _utc(2024, 3, 25, 2, 0)  # → available_at == 22:30 on 2024-03-24 → 18z
    _, endpoint, grib_filename = NomadsAdapter._build_url(_now=_now)
    assert "gdas.20240324" in endpoint
    assert "%2F18%2F" in endpoint
    assert grib_filename == "gdas.t18z.pgrb2.0p25.f000"


def test_nomads_fetch_success():
    adapter = NomadsAdapter()
    adapter.client.download_file = MagicMock(return_value=MagicMock())

    _now = _utc(2024, 3, 25, 10, 0)  # → 06z
    expected_file = "/tmp/gdas.t06z.pgrb2.0p25.f000"

    with patch(
        "airqo_etl_utils.sources.nomads_adapter.NomadsAdapter._build_url",
        return_value=(_NOMADS_BASE_URL, "?dir=...", "gdas.t06z.pgrb2.0p25.f000"),
    ), patch(
        "airqo_etl_utils.sources.nomads_adapter.Utils.parse_api_response",
        return_value=expected_file,
    ):
        res = adapter.fetch()

    assert isinstance(res, Result)
    assert res.error is None
    assert res.data["meta"]["file"] == expected_file
    adapter.client.download_file.assert_called_once()


def test_nomads_fetch_download_returns_none():
    """When parse_api_response returns None the result should carry an error."""
    adapter = NomadsAdapter()
    adapter.client.download_file = MagicMock(return_value=MagicMock())

    with patch(
        "airqo_etl_utils.sources.nomads_adapter.Utils.parse_api_response",
        return_value=None,
    ), patch("airqo_etl_utils.sources.nomads_adapter.Path.exists", return_value=False):
        res = adapter.fetch()

    assert isinstance(res, Result)
    assert res.error is not None
    assert res.data["records"] == []
    assert res.data["meta"].get("file") is None


def test_nomads_fetch_skips_download_when_file_exists():
    """When the GRIB2 file already exists locally it must be returned immediately
    without issuing any HTTP request."""
    adapter = NomadsAdapter()
    adapter.client.download_file = MagicMock()

    with patch("airqo_etl_utils.sources.nomads_adapter.Path.exists", return_value=True):
        res = adapter.fetch()

    adapter.client.download_file.assert_not_called()
    assert isinstance(res, Result)
    assert res.error is None
    assert res.data["records"] == []
    assert res.data["meta"].get("file") is not None


def test_nomads_fetch_network_error():
    """A network exception must be caught and surfaced as a Result error."""
    adapter = NomadsAdapter()
    adapter.client.download_file = MagicMock(side_effect=Exception("network timeout"))

    with patch(
        "airqo_etl_utils.sources.nomads_adapter.Path.exists", return_value=False
    ):
        res = adapter.fetch()

    assert isinstance(res, Result)
    assert "network timeout" in res.error
    assert res.data["records"] == []
