import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pandas as pd
import pymongo as pm
import pytest

import airqo_etl_utils.airqo_utils as airqo_utils_module
import airqo_etl_utils.tests.conftest as ct
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import DateUtils


class TestAirQoDataUtils(unittest.TestCase):
    def test_map_site_ids_to_historical_data(self):
        logs = pd.DataFrame(
            [
                {
                    "site_id": "02",
                    "device_number": 1,
                    "start_date_time": "2022-01-01T00:00:00Z",
                    "end_date_time": "2022-01-02T00:00:00Z",
                }
            ]
        )

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 1, "timestamp": "2022-01-01T10:00:00Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "02")
        self.assertEqual(data.iloc[0]["device_number"], 1)
        self.assertEqual(
            DateUtils.date_to_str(data.iloc[0]["timestamp"]), "2022-01-01T10:00:00Z"
        )

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 1, "timestamp": "2022-01-02T10:00:01Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "01")
        self.assertEqual(data.iloc[0]["device_number"], 1)
        self.assertEqual(
            DateUtils.date_to_str(data.iloc[0]["timestamp"]), "2022-01-02T10:00:01Z"
        )

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 2, "timestamp": "2022-01-01T10:00:00Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "01")
        self.assertEqual(data.iloc[0]["device_number"], 2)
        self.assertEqual(
            DateUtils.date_to_str(data.iloc[0]["timestamp"]), "2022-01-01T10:00:00Z"
        )


class TestFaultDetector(ct.FaultDetectionFixtures):
    def test_input_output_type(self, df_valid):
        assert isinstance(df_valid, pd.DataFrame)
        assert isinstance(AirQoDataUtils.flag_faults(df_valid), pd.DataFrame)

    @pytest.mark.xfail
    def test_output_columns(self, df_valid):
        output = AirQoDataUtils.flag_faults(df_valid)
        expected_columns = [
            "device_name",
            "correlation_fault",
            "missing_data_fault",
            "created_at",
        ]
        assert list(output.columns) == expected_columns
        assert output["device_name"].dtype == object
        assert output["correlation_fault"].dtype == int
        assert output["missing_data_fault"].dtype == int
        assert output["created_at"].dtype == "datetime64[ns]"

    @pytest.mark.xfail
    def test_output_values(self, df_valid, expected_output):
        output = AirQoDataUtils.flag_faults(df_valid)
        # assert len(output) == 1
        assert output.iloc[0]["device_name"] == "B"
        assert output.iloc[0]["correlation_fault"] == 1
        assert output.iloc[0]["missing_data_fault"] == 0

    def test_output_flags(self, df_invalid_corr, df_invalid_nan):
        output_invalid_corr = AirQoDataUtils.flag_faults(df_invalid_corr)
        output_invalid_nan = AirQoDataUtils.flag_faults(df_invalid_nan)
        assert output_invalid_corr.iloc[0]["correlation_fault"] == 1
        assert output_invalid_nan.iloc[0]["missing_data_fault"] == 1

    @pytest.mark.xfail
    def test_output_timestamp(self, df_valid):
        output = AirQoDataUtils.flag_faults(df_valid)
        assert output.iloc[0]["created_at"] == datetime.now().isoformat(
            timespec="seconds"
        )

    def test_input_errors(self, df_invalid_type, df_invalid_columns, df_invalid_empty):
        with pytest.raises(ValueError):
            AirQoDataUtils.flag_faults(df_invalid_type)
            AirQoDataUtils.flag_faults(df_invalid_columns)
            AirQoDataUtils.flag_faults(df_invalid_empty)


mock_client = pm.MongoClient()
mock_db = mock_client["test_database"]
collection = mock_db.faulty_devices
sample_data = pd.DataFrame(
    {
        "device_name": ["aq_1", "aq_2", "aq_3"],
        "correlation_fault": [1, 0, 1],
        "missing_data_fault": [0, 1, 0],
        "created_at": [
            datetime(2021, 1, 1),
            datetime(2021, 1, 2),
            datetime(2021, 1, 3),
        ],
    }
)


@pytest.fixture(autouse=True)
def mock_mongo(monkeypatch):
    monkeypatch.setattr(configuration, "MONGO_URI", mock_client)
    monkeypatch.setattr(configuration, "MONGO_DATABASE_NAME", "test_database")


@pytest.mark.xfail
def test_save_faulty_devices():
    AirQoDataUtils.save_faulty_devices(sample_data)

    assert "faulty_devices" in mock_db.list_collection_names()
    assert mock_db.faulty_devices.count_documents({}) == 3
    assert mock_db.faulty_devices.find_one({"device_name": "aq_1"}) == {
        "device_name": "aq_1",
        "correlation_fault": 1,
        "missing_data_fault": 1,
        "created_at": datetime(2021, 1, 1),
    }


# ---------------------------------------------------------------------------
# TestExtractDevicesWithMissingData
# ---------------------------------------------------------------------------


def _make_storage_mock(monkeypatch, result_df=None, query_error=None):
    """Wire up a fake storage adapter and return the dict that captures the query."""
    captured: dict = {}

    class _FakeResult:
        error = query_error
        data = result_df if result_df is not None else pd.DataFrame()

    class _FakeStorage:
        def execute_query(self, query: str):
            captured["query"] = query
            return _FakeResult()

    mock_config = MagicMock()
    mock_config.DataSource.get.return_value.get.return_value.get.return_value = (
        "project.dataset.hourly_events"
    )
    mock_config.BIGQUERY_DEVICES_DEVICES_TABLE = "project.dataset.devices"

    monkeypatch.setattr(
        airqo_utils_module, "get_configured_storage", lambda: _FakeStorage()
    )
    monkeypatch.setattr(airqo_utils_module, "Config", mock_config)
    return captured


def test_extract_devices_with_missing_data_default_window_is_24_hours(monkeypatch):
    captured = _make_storage_mock(monkeypatch)
    AirQoDataUtils.extract_devices_with_missing_data(start_date="2026-05-13T14:00:00Z")
    assert "GENERATE_ARRAY(0, 24 - 1)" in captured["query"]


def test_extract_devices_with_missing_data_custom_n_hours(monkeypatch):
    captured = _make_storage_mock(monkeypatch)
    AirQoDataUtils.extract_devices_with_missing_data(
        start_date="2026-05-13T14:00:00Z",
        n_hours=48,
    )
    assert "GENERATE_ARRAY(0, 48 - 1)" in captured["query"]


def test_extract_devices_with_missing_data_start_date_in_query(monkeypatch):
    captured = _make_storage_mock(monkeypatch)
    AirQoDataUtils.extract_devices_with_missing_data(start_date="2026-05-13T14:00:00Z")
    assert "2026-05-13T14:00:00Z" in captured["query"]
    assert "pm2_5_calibrated_value IS NULL" in captured["query"]


def test_extract_devices_with_missing_data_returns_empty_dataframe_on_error(
    monkeypatch,
):
    _make_storage_mock(monkeypatch, query_error="connection refused")
    result = AirQoDataUtils.extract_devices_with_missing_data(
        start_date="2026-05-13T14:00:00Z"
    )
    assert isinstance(result, pd.DataFrame)
    assert result.empty


def test_extract_devices_with_missing_data_raises_when_no_storage(monkeypatch):
    monkeypatch.setattr(airqo_utils_module, "get_configured_storage", lambda: None)
    with pytest.raises(RuntimeError, match="No configured storage adapter"):
        AirQoDataUtils.extract_devices_with_missing_data(
            start_date="2026-05-13T14:00:00Z"
        )


def test_missing_data_window_excludes_current_hour():
    """24-hour window must start at current_hour - 24 h, not include the running hour."""
    runtime = datetime(2026, 5, 14, 14, 30, 0, tzinfo=timezone.utc)
    current_hour = runtime.replace(minute=0, second=0, microsecond=0)
    window_start = current_hour - timedelta(hours=24)

    assert window_start == datetime(2026, 5, 13, 14, 0, 0, tzinfo=timezone.utc)
    assert (
        DateUtils.format_datetime_by_unit_str(window_start, "hours_start")
        == "2026-05-13T14:00:00Z"
    )


def test_missing_data_window_excludes_current_hour_at_midnight():
    """Window computation is correct when the runtime is exactly midnight."""
    runtime = datetime(2026, 5, 14, 0, 0, 0, tzinfo=timezone.utc)
    current_hour = runtime.replace(minute=0, second=0, microsecond=0)
    window_start = current_hour - timedelta(hours=24)

    assert window_start == datetime(2026, 5, 13, 0, 0, 0, tzinfo=timezone.utc)
    assert (
        DateUtils.format_datetime_by_unit_str(window_start, "hours_start")
        == "2026-05-13T00:00:00Z"
    )
