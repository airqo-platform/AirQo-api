import unittest
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

    def test_extract_aggregated_raw_data(self):

        expected_data = {
            'device_number': [930426, 930426, 930426, 930426, 930426, 930426],
            'latitude': [0.36545, 0.36545, 0.36545, 0.36545, 0.36545, 0.36545],
            'longitude': [32.64675, 32.64675, 32.64675, 32.64675, 32.64675, 32.64675],
            'pm2_5': [92.92818181818183, 87.155, 85.07763157894736, 86.9524, 78.91153846153846, 76.75399999999999],
            's1_pm2_5': [95.87681818181818, 89.86695652173913, 87.45578947368422, 89.01360000000001, 81.49, 80.02000000000001],
            's2_pm2_5': [89.97954545454546, 84.44304347826088, 82.69947368421053, 84.89119999999998, 76.33307692307692, 73.488],
            'pm10': [100.07227272727273, 94.0882608695652, 91.97763157894737, 95.05799999999999, 89.10865384615384, 85.256],
            's1_pm10': [105.55363636363636, 99.2895652173913, 96.8221052631579, 99.984, 94.99538461538462, 90.313],
            's2_pm10': [94.5909090909091, 88.88695652173914, 87.13315789473684, 90.132, 83.22192307692308, 80.199],
            'no2': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'pm1': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            's1_pm1': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            's2_pm1': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'pressure': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            's1_pressure': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            's2_pressure': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'temperature': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'humidity': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'voc': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            's1_voc': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            's2_voc': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'wind_speed': [0.10909090909090909, 0.02, 0.13789473684210526, 0.1275, 0.030000000000000002, 0.03],
            'altitude': [1190.081818181818, 1202.3, 1193.3736842105263, 1188.825, 1180.2, 1180.2],
            'satellites': [10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
            'hdop': [111.18181818181819, 87.0, 146.78947368421052, 140.75, 89.0, 89.0],
            'device_temperature': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'device_humidity': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'battery': [3.9490909090909097, 3.9495652173913043, 3.9489473684210528, 3.95, 3.9496153846153845, 3.9490000000000003],
            'co': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'nh3': [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            'timestamp': [pd.Timestamp('2024-07-10 00:00:00+0000', tz='UTC'),
                        pd.Timestamp('2024-07-10 01:00:00+0000', tz='UTC'),
                        pd.Timestamp('2024-07-10 02:00:00+0000', tz='UTC'),
                        pd.Timestamp('2024-07-10 03:00:00+0000', tz='UTC'),
                        pd.Timestamp('2024-07-10 04:00:00+0000', tz='UTC'),
                        pd.Timestamp('2024-07-10 05:00:00+0000', tz='UTC')],
            'site_id': ['60d058c8048305120d2d616d', '60d058c8048305120d2d616d', '60d058c8048305120d2d616d',
                        '60d058c8048305120d2d616d', '60d058c8048305120d2d616d', '60d058c8048305120d2d616d']
        }
        expected_df = pd.DataFrame(expected_data)

        start_date_time = '2024-07-10T00:00:00Z'
        end_date_time = '2024-07-11T11:59:59Z'

        result = AirQoDataUtils.extract_aggregated_raw_data(start_date_time, end_date_time)

        result_filtered = result[result['device_number'] == 930426]

        result_subset = result_filtered.head(6).reset_index(drop=True)

        pd.testing.assert_frame_equal(result_subset, expected_df)


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
