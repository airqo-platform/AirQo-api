import unittest
from unittest.mock import patch
from datetime import datetime

import pandas as pd
import numpy as np
import pymongo as pm
import pytest

import airqo_etl_utils.tests.conftest as ct
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import date_to_str


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
        self.assertEqual(date_to_str(data.iloc[0]["timestamp"]), "2022-01-01T10:00:00Z")

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 1, "timestamp": "2022-01-02T10:00:01Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "01")
        self.assertEqual(data.iloc[0]["device_number"], 1)
        self.assertEqual(date_to_str(data.iloc[0]["timestamp"]), "2022-01-02T10:00:01Z")

        data = pd.DataFrame(
            [{"site_id": "01", "device_number": 2, "timestamp": "2022-01-01T10:00:00Z"}]
        )
        data = AirQoDataUtils.map_site_ids_to_historical_data(
            data=data, deployment_logs=logs
        )
        self.assertEqual(data.iloc[0]["site_id"], "01")
        self.assertEqual(data.iloc[0]["device_number"], 2)
        self.assertEqual(date_to_str(data.iloc[0]["timestamp"]), "2022-01-01T10:00:00Z")

    @patch('airqo_etl_utils.airqo_utils.BigQueryApi')
    def test_extract_aggregated_raw_data(self, MockBigQueryApi):

        mock_bigquery_api = MockBigQueryApi.return_value

        input_data = {
            "tenant": ["airqo"] * 10,
            "timestamp": [
                pd.Timestamp("2024-07-10T00:47:12.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:00:49.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:55:52.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:41:12.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:46:05.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:42:27.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:59:30.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:44:57.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:42:20.000000000", tz="UTC"),
                pd.Timestamp("2024-07-10T00:54:23.000000000", tz="UTC"),
            ],
            "site_id": ["60d058c8048305120d2d616d"] * 10,
            "device_number": [930426] * 10,
            "device_id": ["aq_71"] * 10,
            "latitude": [0.36545] * 10,
            "longitude": [32.64675] * 10,
            "pm2_5": [
                99.255,
                88.075,
                94.645,
                104.185,
                100.05,
                99.65,
                93.145,
                95.965,
                99.09,
                95.415,
            ],
            "s1_pm2_5": [
                103.53,
                91.55,
                98.62,
                108.57,
                103.77,
                101.5,
                97.67,
                96.53,
                102.75,
                98.78,
            ],
            "s2_pm2_5": [94.98, 84.6, 90.67, 99.8, 96.33, 97.8, 88.62, 95.4, 95.43, 92.05],
            "pm10": [
                106.415,
                96.675,
                101.355,
                110.19,
                108.33,
                106.19,
                101.07,
                104.93,
                107.35,
                101.455,
            ],
            "s1_pm10": [
                113.53,
                102.97,
                108.43,
                116.03,
                116.58,
                110.75,
                108.37,
                109.03,
                115.28,
                108.43,
            ],
            "s2_pm10": [
                99.3,
                90.38,
                94.28,
                104.35,
                100.08,
                101.63,
                93.77,
                100.83,
                99.42,
                94.48,
            ],
            "no2": [np.nan] * 10,
            "pm1": [np.nan] * 10,
            "s1_pm1": [np.nan] * 10,
            "s2_pm1": [np.nan] * 10,
            "pressure": [np.nan] * 10,
            "s1_pressure": [np.nan] * 10,
            "s2_pressure": [np.nan] * 10,
            "temperature": [np.nan] * 10,
            "humidity": [np.nan] * 10,
            "voc": [np.nan] * 10,
            "s1_voc": [np.nan] * 10,
            "s2_voc": [np.nan] * 10,
            "wind_speed": [0.02, 0.16, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02],
            "altitude": [
                1202.3,
                1183.1,
                1202.3,
                1202.3,
                1202.3,
                1202.3,
                1202.3,
                1202.3,
                1202.3,
                1202.3,
            ],
            "satellites": [10.0] * 10,
            "hdop": [87.0, 125.0, 87.0, 87.0, 87.0, 87.0, 87.0, 87.0, 87.0, 87.0],
            "device_temperature": [np.nan] * 10,
            "device_humidity": [np.nan] * 10,
            "battery": [3.94, 3.94, 3.95, 3.95, 3.95, 3.95, 3.95, 3.95, 3.95, 3.95],
            "co": [np.nan] * 10,
            "nh3": [np.nan] * 10,
        }

        input_dataframe = pd.DataFrame(input_data)
        input_dataframe['timestamp'] = pd.to_datetime(input_dataframe['timestamp'])
        input_dataframe['device_number'] = input_dataframe['device_number'].astype('int64')

        mock_bigquery_api.query_data.return_value = input_dataframe

        expected_data = {
            "device_number": [930426],
            "latitude": [0.36545],
            "longitude": [32.64675],
            "pm2_5": [96.9475],
            "s1_pm2_5": [100.327],
            "s2_pm2_5": [93.568],
            "pm10": [104.396],
            "s1_pm10": [110.94],
            "s2_pm10": [97.852],
            "no2": [np.nan],
            "pm1": [np.nan],
            "s1_pm1": [np.nan],
            "s2_pm1": [np.nan],
            "pressure": [np.nan],
            "s1_pressure": [np.nan],
            "s2_pressure": [np.nan],
            "temperature": [np.nan],
            "humidity": [np.nan],
            "voc": [np.nan],
            "s1_voc": [np.nan],
            "s2_voc": [np.nan],
            "wind_speed": [0.034],
            "altitude": [1200.38],
            "satellites": [10.0],
            "hdop": [90.8],
            "device_temperature": [np.nan],
            "device_humidity": [np.nan],
            "battery": [3.948],
            "co": [np.nan],
            "nh3": [np.nan],
            "timestamp": [pd.Timestamp("2024-07-10T00:00:00.000000000", tz="UTC")],
            "site_id": ["60d058c8048305120d2d616d"],
        }
        expected_dataframe = pd.DataFrame(expected_data)
        expected_dataframe['timestamp'] = pd.to_datetime(expected_dataframe['timestamp'])
        expected_dataframe['device_number'] = expected_dataframe['device_number'].astype('int64')

        start_date_time = '2024-07-10T00:00:00Z'
        end_date_time = '2024-07-11T11:59:59Z'

        result = AirQoDataUtils.extract_aggregated_raw_data(start_date_time, end_date_time)

        pd.testing.assert_frame_equal(result, expected_dataframe)


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
