import datetime
import unittest

import pandas as pd

from airqo_etl_utils.urban_better_utils import UrbanBetterUtils


class TestUrbanBetterUtils(unittest.TestCase):
    def test_get_nearest_gps_coordinates(self):
        now = datetime.datetime.now()
        sensor_positions = pd.DataFrame(
            [
                {
                    "timestamp": now + datetime.timedelta(hours=2),
                    "horizontal_accuracy": 1,
                    "longitude": 100,
                    "latitude": 110,
                },
                {
                    "timestamp": now - datetime.timedelta(hours=2),
                    "horizontal_accuracy": 2,
                    "longitude": 200,
                    "latitude": 220,
                },
                {
                    "timestamp": now + datetime.timedelta(minutes=2),
                    "horizontal_accuracy": 3,
                    "longitude": 300,
                    "latitude": 230,
                },
            ]
        )

        coordinates = UrbanBetterUtils.get_nearest_gps_coordinates(
            sensor_positions=pd.DataFrame(sensor_positions), date_time=now
        )
        self.assertEqual(coordinates["timestamp"], now + datetime.timedelta(minutes=2))
        self.assertEqual(coordinates["longitude"], 300)
        self.assertEqual(coordinates["latitude"], 230)
        self.assertEqual(coordinates["horizontal_accuracy"], 3)


if __name__ == "__main__":
    unittest.main()
