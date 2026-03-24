import pandas as pd
from unittest.mock import patch, MagicMock

import pytest

from airqo_etl_utils.sources.openweather_adapter import OpenWeatherAdapter
from airqo_etl_utils.sources.tahmo_adapter import TahmoAdapter
from airqo_etl_utils.utils import Result


def test_openweather_missing_coordinates():
    adapter = OpenWeatherAdapter()
    res = adapter.fetch({})
    assert isinstance(res, Result)
    assert res.data["records"] == []
    assert res.error is not None


@patch("airqo_etl_utils.sources.openweather_adapter.HttpClient.get_json")
def test_openweather_success(mock_get_json):
    mock_payload = {"weather": [{"id": 1}], "main": {"temp": 20}}
    mock_get_json.return_value = mock_payload
    adapter = OpenWeatherAdapter()
    device = {"latitude": 0.1, "longitude": 36.8}
    res = adapter.fetch(device)
    mock_get_json.assert_called_once()
    assert isinstance(res, Result)
    assert res.data["records"] == mock_payload


def test_tahmo_no_stations():
    adapter = TahmoAdapter()
    res = adapter.fetch({})
    assert isinstance(res, Result)
    assert res.data["records"] == []
    assert res.error is not None


@patch("airqo_etl_utils.sources.tahmo_adapter.TahmoAdapter.get_tahmo_data")
def test_tahmo_with_data(mock_get_tahmo):
    df = pd.DataFrame([{"value": 1, "variable": "temp", "station": "S1", "time": "t1"}])
    mock_get_tahmo.return_value = df
    adapter = TahmoAdapter()
    device = {"stations": ["S1"]}
    dates = [("2025-01-01T00:00:00Z", "2025-01-01T01:00:00Z")]
    res = adapter.fetch(device, dates=dates)
    mock_get_tahmo.assert_called_once()
    assert isinstance(res, Result)
    assert isinstance(res.data["records"], list)
    assert len(res.data["records"]) == 1


@patch("airqo_etl_utils.sources.tahmo_adapter.TahmoAdapter.get_tahmo_data")
def test_tahmo_single_tuple_dates(mock_get_tahmo):
    """A single (start, end) tuple should be accepted without unpacking errors."""
    df = pd.DataFrame([{"value": 2, "variable": "rh", "station": "S2", "time": "t2"}])
    mock_get_tahmo.return_value = df
    adapter = TahmoAdapter()
    device = {"stations": ["S2"]}
    dates = ("2025-01-01T00:00:00Z", "2025-01-01T01:00:00Z")  # single tuple, not a list
    res = adapter.fetch(device, dates=dates)
    mock_get_tahmo.assert_called_once()
    assert isinstance(res, Result)
    assert res.error is None
    assert len(res.data["records"]) == 1
