import unittest

import pandas as pd

from airqo_etl_utils.airqo_utils import AirQoDataUtils
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


if __name__ == "__main__":
    unittest.main()
