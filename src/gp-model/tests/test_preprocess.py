import unittest
import pandas as pd
import numpy as np
from data.preprocess import data_to_df, drop_missing_value


class TestFunctions(unittest.TestCase):

    def setUp(self):
        self.data = {
            "time": ["2023-01-01 00:00", "2023-01-01 01:00", "2023-01-01 01:00", np.nan],
            "latitude": [34.0522, 34.0522, 34.0522, np.nan],
            "longitude": [-118.2437, -118.2437, -118.2437, np.nan],
            "pm2_5": [12.1, 15.2, 15.2, np.nan]
        }

        self.expected_df_data_to_df = pd.DataFrame(self.data)

        self.data_after_drop_missing_value = {
            "time": ["2023-01-01 00:00", "2023-01-01 01:00"],
            "latitude": [34.0522, 34.0522],
            "longitude": [-118.2437, -118.2437],
            "pm2_5": [12.1, 15.2]
        }

        self.expected_df_drop_missing_value = pd.DataFrame(
            self.data_after_drop_missing_value)
        self.expected_df_drop_missing_value['time'] = pd.to_datetime(
            self.expected_df_drop_missing_value['time'])

    def test_data_to_df(self):
        df = data_to_df(self.data)
        pd.testing.assert_frame_equal(df, self.expected_df_data_to_df)

    def test_drop_missing_value(self):
        df = data_to_df(self.data)
        df = drop_missing_value(df)
        pd.testing.assert_frame_equal(df, self.expected_df_drop_missing_value)


if __name__ == '__main__':
    unittest.main()
