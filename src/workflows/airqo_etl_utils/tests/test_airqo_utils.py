import unittest
from unittest.mock import patch
from datetime import datetime

import pandas as pd
import pymongo as pm
import pytest

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
