import unittest.mock
import pandas as pd
import pytest
from airqo_etl_utils.datautils import DataUtils
from .conftest import DevicesFixtures


class TestsDevices(DevicesFixtures):
    def test_successful_load_from_cache(self, cached_device_df):
        with unittest.mock.patch(
            "airqo_etl_utils.datautils.DataUtils.load_cached_data",
            return_value=cached_device_df,
        ), unittest.mock.patch(
            "airqo_etl_utils.datautils.DataUtils.fetch_devices_from_api"
        ) as mock_fetch_api:
            devices, _ = DataUtils.get_devices()
            expected_df = cached_device_df.copy()
            expected_df["device_number"] = (
                expected_df["device_number"].fillna(-1).astype(int)
            )
            pd.testing.assert_frame_equal(devices, expected_df)
            mock_fetch_api.assert_not_called()

    def test_successful_fetch_from_api(self, api_device_df, airqo_device_keys):
        with unittest.mock.patch(
            "airqo_etl_utils.datautils.DataUtils.load_cached_data",
            return_value=pd.DataFrame(),
        ), unittest.mock.patch(
            "airqo_etl_utils.datautils.DataUtils.fetch_devices_from_api",
            return_value=(api_device_df.copy(), airqo_device_keys),
        ):
            devices, keys = DataUtils.get_devices()
            expected_df = api_device_df.copy()
            expected_df["device_number"] = (
                expected_df["device_number"].fillna(-1).astype(int)
            )
            pd.testing.assert_frame_equal(devices, expected_df)
            assert keys == airqo_device_keys


def test_failure_to_retrieve_from_api():
    with unittest.mock.patch(
        "airqo_etl_utils.datautils.DataUtils.load_cached_data",
        return_value=pd.DataFrame(),
    ), unittest.mock.patch(
        "airqo_etl_utils.datautils.DataUtils.fetch_devices_from_api",
        return_value=(pd.DataFrame(), {}),
    ):
        with pytest.raises(
            RuntimeError,
            match="Failed to retrieve devices data from both cache and API.",
        ):
            DataUtils.get_devices()
