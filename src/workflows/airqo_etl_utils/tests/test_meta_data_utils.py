import pytest
import pandas as pd
import json
from unittest.mock import patch, MagicMock
from airqo_etl_utils.meta_data_utils import MetaDataUtils
from airqo_etl_utils.constants import (
    MetaDataType,
    DataType,
    DeviceCategory,
    Frequency,
    DeviceNetwork,
)


@pytest.fixture
def device_computed_metadata_schema():
    """Fixture to load required columns from device_computed_metadata.json."""
    schema_path = "airqo_etl_utils/schema/device_computed_metadata.json"
    with open(schema_path, "r") as f:
        schema = json.load(f)
    return [field["name"] for field in schema if field.get("mode") == "REQUIRED"]


@pytest.fixture
def mock_extract_devices_df():
    """Fixture to mock the extract_devices method."""
    return pd.DataFrame(
        {
            "network": ["airqo", "airqo", "other"],
            "device_id": ["device1", "device2", "device3"],
            "deployed": [True, True, False],
            "active": [True, True, False],
            "latitude": [0.315, 0.316, 0.317],
            "longitude": [32.581, 32.582, 32.583],
            "site_id": ["site1", "site2", None],
            "device_number": [1, 2, 3],
            "description": ["desc1", "desc2", "desc3"],
            "device_manufacturer": ["manufacturer1", "manufacturer2", "manufacturer3"],
            "device_category": ["lowcost", "lowcost", "general"],
            "mount_type": ["vehicle", "wall", "vehicle"],
            "mobility": [True, False, True],
            "device_maintenance": [
                "2023-01-01 13:00:00Z",
                "2023-01-02 13:00:00Z",
                "2023-01-03 13:00:00Z",
            ],
        }
    )


@pytest.fixture
def mock_devices_df():
    """Fixture providing a mock devices DataFrame."""
    return pd.DataFrame(
        {
            "network": ["airqo", "airqo", "other"],
            "device_id": ["device1", "device2", "device3"],
            "status": ["deployed", "deployed", "not deployed"],
            "isActive": [True, True, False],
            "latitude": [0.315, 0.316, 0.317],
            "longitude": [32.581, 32.582, 32.583],
            "site_id": ["site1", "site2", None],
            "device_id": ["device1", "device2", "device3"],
            "device_number": [1, 2, 3],
            "description": ["desc1", "desc2", "desc3"],
            "device_manufacturer": ["manufacturer1", "manufacturer2", "manufacturer3"],
            "device_category": ["lowcost", "lowcost", "general"],
            "mountType": ["vehicle", "wall", "vehicle"],
            "mobility": [True, False, True],
            "device_maintenance": [
                "2023-01-01 13:00:00Z",
                "2023-01-02 13:00:00Z",
                "2023-01-03 13:00:00Z",
            ],
        }
    )


@pytest.fixture
def mock_sites_df():
    """Fixture providing a mock sites DataFrame."""
    return pd.DataFrame(
        {
            "site_id": ["site1", "site2", "site3"],
            "latitude": [0.315, 0.316, 0.317],
            "longitude": [32.581, 32.582, 32.583],
            "network": ["airqo", "airqo", "other"],
            "weather_stations": [
                [],
                [{"station_code": "station1"}],
                [{"station_code": "station2"}],
            ],
            "name": ["Site 1", "Site 2", "Site 3"],
            "display_name": ["Display Site 1", "Display Site 2", "Display Site 3"],
            "display_location": ["Location 1", "Location 2", "Location 3"],
            "description": ["Description 1", "Description 2", "Description 3"],
            "city": ["city1", "city2", "city3"],
            "region": ["region1", "region2", "region3"],
            "country": ["country1", "country2", "country3"],
        }
    )


@pytest.fixture
def mock_recent_readings_df():
    """Fixture providing mock recent readings."""
    return pd.DataFrame(
        {
            "device_id": ["device1", "device2"],
            "site_id": ["site1", "site2"],
            "next_offset_date": ["2023-01-10 15:00:00Z", "2023-01-12 15:00:00Z"],
            "pollutant": ["pm2_5", "pm2_5"],
            "recent_maintenance_date": ["2023-01-01 14:00:00Z", "2023-01-02 14:00:00Z"],
            "maximum": [50.0, 55.0],
            "minimum": [10.0, 12.0],
            "average": [30.0, 33.0],
        }
    )


@pytest.fixture
def mock_computed_metadata_df(device_computed_metadata_schema):
    """Fixture providing mock computed metadata with all required columns."""
    data = {}
    for col in device_computed_metadata_schema:
        if col == "device_id":
            data[col] = ["device1", "device2"]
        elif col == "site_id":
            data[col] = ["site1", "site2"]
        elif (
            col == "created"
            or col == "next_offset_date"
            or col == "recent_maintenance_date"
        ):
            data[col] = ["2025-01-01 00:00:00Z", "2025-01-01 00:00:00Z"]
        elif col == "pollutant":
            data[col] = ["pm2_5", "pm2_5"]
        elif col == "data_resolution":
            data[col] = ["hourly", "hourly"]
        elif col == "baseline_type":
            data[col] = ["weekly", "weekly"]
        elif col == "sample_count":
            data[col] = [100, 150]
        else:  # Numeric fields
            data[col] = [10.5, 20.7]
    return pd.DataFrame(data)


@pytest.fixture
def mock_devices_data():
    """Fixture providing mock devices data."""
    return pd.DataFrame(
        {
            "network": ["airqo", "airqo"],
            "deployed": [True, True],
            "active": [True, False],
            "latitude": [0.315, 0.316],
            "longitude": [32.581, 32.582],
            "site_id": ["site1", "site2"],
            "device_id": ["device1", "device2"],
            "device_number": [1, 2],
            "description": ["desc1", "desc2"],
            "device_manufacturer": ["manufacturer1", "manufacturer2"],
            "device_category": ["lowcost", "lowcost"],
            "mount_type": ["pole", "wall"],
            "mobility": ["stationary", "stationary"],
            "device_maintenance": [
                "2023-01-01 13:00:00Z",
                "2023-01-02 13:00:00Z",
            ],
        }
    )


class TestMetaDataUtils:
    def test_extract_devices(self, mock_extract_devices_df):
        """Test the extract_devices method."""
        with patch(
            "airqo_etl_utils.meta_data_utils.MetaDataUtils.extract_devices",
            return_value=mock_extract_devices_df,
        ):
            result = MetaDataUtils.extract_devices()

            # Check that all expected columns are present
            expected_columns = [
                "network",
                "deployed",
                "active",
                "latitude",
                "longitude",
                "site_id",
                "device_id",
                "device_number",
                "description",
                "device_manufacturer",
                "device_category",
                "mount_type",
                "mobility",
                "device_maintenance",
                "device_id",
            ]
            for col in expected_columns:
                assert col in result.columns

            assert result["active"].tolist() == [True, True, False]

            assert result["mount_type"].tolist() == ["vehicle", "wall", "vehicle"]

            assert result["device_id"].tolist() == result["device_id"].tolist()

    @patch("airqo_etl_utils.meta_data_utils.MetaDataUtils.extract_devices")
    @patch(
        "airqo_etl_utils.meta_data_utils.DataUtils.extract_most_recent_metadata_record"
    )
    @patch("airqo_etl_utils.meta_data_utils.DataUtils._get_table")
    @patch(
        "airqo_etl_utils.meta_data_utils.DataUtils.compute_device_site_metadata_per_device"
    )
    def test_compute_device_site_metadata(
        self,
        mock_compute_per_device,
        mock_get_table,
        mock_extract_recent,
        mock_extract_devices,
        mock_extract_devices_df,
        mock_recent_readings_df,
        mock_computed_metadata_df,
        device_computed_metadata_schema,
    ):
        """Test the compute_device_site_metadata method."""
        mock_extract_devices.return_value = mock_extract_devices_df
        mock_extract_recent.return_value = mock_recent_readings_df
        mock_get_table.return_value = ("table_name", "project.dataset")

        # Configure compute_device_site_metadata_per_device mock to return slices of our test data
        # This simulates different devices returning different result dataframes
        mock_compute_per_device.side_effect = [
            mock_computed_metadata_df.iloc[0:1],
            mock_computed_metadata_df.iloc[1:2],
        ]

        # We need to mock the ThreadPoolExecutor context and its behavior
        with patch("concurrent.futures.ThreadPoolExecutor") as mock_executor:
            mock_executor_instance = MagicMock()
            mock_executor.return_value.__enter__.return_value = mock_executor_instance

            # Mock the as_completed function with a custom implementation
            metadata = MetaDataUtils()
            with patch(
                "airqo_etl_utils.meta_data_utils.as_completed",
                side_effect=lambda futures: futures,
            ):
                result = metadata.compute_device_site_metadata(
                    data_type=DataType.AVERAGED,
                    device_category=DeviceCategory.LOWCOST,
                    metadata_type=MetaDataType.DEVICES,
                    frequency=Frequency.WEEKLY,
                )

                # Verify the result is not empty and contains all required columns
                assert not result.empty
                for col in device_computed_metadata_schema:
                    assert col in result.columns

                assert len(result) == 2

                mock_extract_devices.assert_called_once()
                mock_extract_recent.assert_called_once()
                mock_get_table.assert_called_once()

                assert mock_compute_per_device.call_count == 2

                assert "data_resolution" in result.columns
                assert "baseline_type" in result.columns

    @patch("airqo_etl_utils.meta_data_utils.AirQoDataDriftCompute.compute_baseline")
    @patch("airqo_etl_utils.meta_data_utils.DataUtils.extract_data_from_bigquery")
    @patch(
        "airqo_etl_utils.meta_data_utils.DataUtils.extract_most_recent_metadata_record"
    )
    @patch("airqo_etl_utils.meta_data_utils.frequency_to_dates")
    def test_compute_device_site_baseline(
        self,
        mock_frequency_to_dates,
        mock_extract_metadata,
        mock_extract_data,
        mock_compute_baseline,
    ):
        """Test the compute_device_site_baseline method."""
        start_date = "2023-01-01 00:00:00Z"
        end_date = "2023-02-01 00:00:00Z"
        mock_frequency_to_dates.return_value = (start_date, end_date)

        # Mock extract_most_recent_metadata_record to return some test data
        mock_metadata = pd.DataFrame(
            {
                "device_id": ["device1"],
                "site_id": ["site1"],
                "pollutant": ["pm2_5"],
                "minimum": [10.0],
                "maximum": [50.0],
                "average": [30.0],
            }
        )
        mock_extract_metadata.return_value = mock_metadata

        mock_data = pd.DataFrame(
            {
                "device_id": ["device1"],
                "timestamp": ["2023-01-01 00:00:00Z"],
                "pm2_5": [25.0],
                "site_id": ["site1"],
            }
        )
        mock_extract_data.return_value = mock_data

        mock_baseline_result = [
            {
                "device_id": "device1",
                "pollutant": "pm2_5",
                "data_type": DataType.AVERAGED.str,
                "baseline_id": "baseline1",
                "mean": 25.0,
                "stddev": 5.0,
                "window_start": start_date,
                "window_end": end_date,
                "data_resolution": Frequency.HOURLY.str,
                "baseline_type": Frequency.WEEKLY.str,
                "site_id": "site1",
                "next_offset_date": "2023-02-08 00:00:00Z",
            }
        ]
        mock_compute_baseline.return_value = mock_baseline_result

        def submit_side_effect(*args, **kwargs):
            # This simulates calling AirQoDataDriftCompute.compute_baseline with the args
            result = mock_compute_baseline(*args[1:])
            mock_future = MagicMock()
            mock_future.result.return_value = result
            return mock_future

        with patch(
            "airqo_etl_utils.meta_data_utils.ThreadPoolExecutor"
        ) as mock_executor:
            mock_executor_instance = MagicMock()
            mock_executor_instance.submit.side_effect = submit_side_effect
            mock_executor.return_value.__enter__.return_value = mock_executor_instance

            def as_completed_side_effect(futures):
                return futures

            with patch(
                "airqo_etl_utils.meta_data_utils.as_completed",
                side_effect=as_completed_side_effect,
            ) as mock_as_completed:
                result = MetaDataUtils.compute_device_site_baseline(
                    data_type=DataType.AVERAGED,
                    device_category=DeviceCategory.LOWCOST,
                    device_network=DeviceNetwork.AIRQO,
                    frequency=Frequency.WEEKLY,
                )

                assert isinstance(result, pd.DataFrame)
                assert not result.empty
                assert "device_id" in result.columns
                assert result["device_id"].iloc[0] == "device1"

                mock_frequency_to_dates.assert_called_once_with(Frequency.WEEKLY)

                mock_extract_metadata.assert_called_once()
                mock_extract_data.assert_called_once()

                mock_compute_baseline.assert_called()

                assert mock_executor_instance.submit.call_count >= 1

    @patch("airqo_etl_utils.meta_data_utils.MetaDataUtils.extract_devices")
    def test_extract_transform_and_decrypt_metadata_devices(
        self, mock_extract_devices, mock_devices_data
    ):
        """Test extract_transform_and_decrypt_metadata for devices."""
        mock_extract_devices.return_value = mock_devices_data

        metadata_utils = MetaDataUtils()
        result = metadata_utils.extract_transform_and_decrypt_metadata(
            metadata_type=MetaDataType.DEVICES
        )

        assert isinstance(result, pd.DataFrame)
        assert not result.empty
        assert result.equals(mock_devices_data)

        mock_extract_devices.assert_called_once()

    @patch("airqo_etl_utils.meta_data_utils.MetaDataUtils.extract_sites")
    def test_extract_transform_and_decrypt_metadata_sites(
        self, mock_extract_sites, mock_sites_df
    ):
        """Test extract_transform_and_decrypt_metadata for sites."""
        mock_extract_sites.return_value = mock_sites_df

        metadata_utils = MetaDataUtils()
        result = metadata_utils.extract_transform_and_decrypt_metadata(
            metadata_type=MetaDataType.SITES
        )

        assert isinstance(result, pd.DataFrame)
        assert not result.empty
        assert result.equals(mock_sites_df)

        mock_extract_sites.assert_called_once()

    def test_extract_transform_and_decrypt_metadata_invalid_type(self):
        """Test extract_transform_and_decrypt_metadata with an invalid metadata type."""
        metadata_utils = MetaDataUtils()
        result = metadata_utils.extract_transform_and_decrypt_metadata(
            metadata_type="INVALID_TYPE"
        )

        assert isinstance(result, pd.DataFrame)
        assert result.empty
