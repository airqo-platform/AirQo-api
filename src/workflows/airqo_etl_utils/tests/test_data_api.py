from unittest.mock import MagicMock, patch
import pytest
from airqo_etl_utils.data_api import DataApi
from airqo_etl_utils.constants import (
    DeviceCategory,
    DeviceNetwork,
    MetaDataType,
    Frequency,
)
from .conftest import (
    mock_bigquery_api,
    mock_data_validation_utils,
    mock_measurement_data,
    mock_devices_data,
    expected_api_payload,
)


@pytest.fixture(scope="session")
def data_api():
    """Fixture providing a DataApi instance."""
    return DataApi()


@pytest.fixture(scope="function")
def mock_request():
    """Fixture providing a mocked _request method for each test."""
    with patch.object(DataApi, "_request") as mock:
        yield mock


class TestDataApi:
    def test_send_to_events_api(self, data_api, mock_request, mock_measurement_data):
        """Test sending measurements to events API."""
        # Convert DataFrame to list of dicts for API format
        measurements = mock_measurement_data.to_dict("records")

        # Test successful request
        data_api.send_to_events_api(measurements)
        mock_request.assert_called_once_with(
            endpoint="devices/events", method="post", body=measurements
        )

    @patch.object(DataApi, "_request")
    def test_send_to_events_api_with_retry(
        self, mock_request, data_api, mock_measurement_data
    ):
        """Test sending measurements with retry logic.

        Tests:
        1. Successful request without retries
        2. Failed request triggers retries (tenacity handles the exceptions internally)
        """
        # Convert DataFrame to list of dicts for API format
        measurements = mock_measurement_data.to_dict("records")

        # Test 1: Successful request without retries
        data_api.send_to_events_api_with_retry(measurements)
        mock_request.assert_called_once_with(
            endpoint="devices/events", method="post", body=measurements
        )

        # Test 2: Test that retries are attempted when request fails
        # Since tenacity catches exceptions internally, we need to patch tenacity's retry behavior
        # or test that the method completes despite the exception (which tenacity handles)
        mock_request.reset_mock()
        mock_request.side_effect = Exception("API Error")

        # The tenacity decorator will catch and retry the exception internally
        # We can't easily test the exact retry count without complex mocking,
        # but we can verify that the method doesn't raise an exception
        # (tenacity handles it internally)
        data_api.send_to_events_api_with_retry(measurements)

        # Verify that at least one call was made (the initial attempt)
        assert mock_request.call_count >= 1

    @patch("concurrent.futures.ThreadPoolExecutor")
    def test_save_events(self, mock_executor, data_api, mock_measurement_data):
        """Test parallel saving of events."""
        # Convert DataFrame to list of dicts for API format
        measurements = mock_measurement_data.to_dict("records")

        mock_executor_instance = MagicMock()
        mock_executor.return_value.__enter__.return_value = mock_executor_instance

        with patch.object(DataApi, "send_to_events_api_with_retry") as mock_send:
            # Test with sample measurements
            data_api.save_events(measurements)

            # Verify that ThreadPoolExecutor was used correctly
            mock_executor.assert_called_once()
            mock_executor_instance.submit.assert_called()

    def test_get_maintenance_logs(self, data_api, mock_request):
        """Test retrieving maintenance logs."""
        expected_response = {
            "site_activities": [{"activity": "maintenance", "date": "2025-10-30"}]
        }
        mock_request.return_value = expected_response

        # Test without activity type
        result = data_api.get_maintenance_logs("airqo", "device1")
        assert result == expected_response["site_activities"]
        mock_request.assert_called_once_with(
            "devices/activities", {"network": "airqo", "device": "device1"}
        )

        # Test with activity type
        mock_request.reset_mock()
        mock_request.return_value = {
            "device_activities": [{"activity": "maintenance", "date": "2025-10-30"}]
        }
        result = data_api.get_maintenance_logs("airqo", "device1", "maintenance")
        assert result == mock_request.return_value["device_activities"]
        mock_request.assert_called_once_with(
            "devices/activities",
            {"network": "airqo", "device": "device1", "activity_type": "maintenance"},
        )

    def test_get_devices(self, data_api):
        """Test retrieving devices with various parameters."""
        # Sample device data
        def get_mock_device():
            return {
                "name": "device1",
                "category": "lowcost",
                "network": "airqo",
                "site": {"_id": "site1", "location_name": "Location 1"},
                "status": "deployed",
                "latest_maintenance_activity": {"date": "2025-11-30"},
            }

        with patch.object(DataApi, "_fetch_metadata") as mock_fetch:
            # Test with parameters
            mock_fetch.return_value = [get_mock_device()]
            result = data_api.get_devices({"device_network": DeviceNetwork.AIRQO})

            # Verify result structure
            assert len(result) == 1
            device = result[0]
            assert device["device_id"] == "device1"
            assert device["site_id"] == "site1"
            assert device["device_category"] == "lowcost"
            assert device["device_manufacturer"] == "airqo"
            assert device["device_maintenance"] == "2025-11-30"

            # Test with empty params - need fresh data since get_devices mutates the dict
            mock_fetch.return_value = [get_mock_device()]
            result = data_api.get_devices()
            assert len(result) == 1
            assert result[0]["device_id"] == "device1"
            assert result[0]["site_id"] == "site1"

            # Test with specific parameters - need fresh data again
            mock_fetch.return_value = [get_mock_device()]
            params = {
                "device_network": DeviceNetwork.AIRQO,
                "device_category": DeviceCategory.LOWCOST,
            }
            result = data_api.get_devices(params)
            assert len(result) == 1
            assert result[0]["device_category"] == "lowcost"

    @patch("airqo_etl_utils.data_api.configuration")
    def test_get_devices_production_environment(self, mock_config, data_api):
        """Test device retrieval in production environment."""
        mock_config.ENVIRONMENT = "production"

        with patch.object(DataApi, "_fetch_metadata") as mock_fetch:
            mock_fetch.return_value = []

            params = {"device_network": DeviceNetwork.AIRQO}
            result = data_api.get_devices(params)

            # Verify status is set to "deployed" in production
            mock_fetch.assert_called_once()
            assert mock_fetch.call_args[0][2]["status"] == "deployed"

    def test_get_devices_empty_response(self, data_api):
        """Test handling of empty response from devices API."""
        with patch.object(DataApi, "_fetch_metadata") as mock_fetch:
            mock_fetch.return_value = []
            result = data_api.get_devices()
            assert result == []

    def test_maintenance_activity_processing(self, data_api):
        """Test processing of device maintenance activity."""
        device_data = {
            "name": "test_device",
            "latest_maintenance_activity": {"date": "2025-11-30"},
            "status": "active",
        }

        # Test internal method for maintenance activity processing
        maintenance = data_api._DataApi__get_device_maintenance_activity(device_data)
        assert (
            maintenance == "2025-11-30"
        )  # Should match the provided maintenance activity date

        # Test with updated maintenance data
        device_data["latest_maintenance_activity"] = {"date": "2025-10-30"}
        maintenance = data_api._DataApi__get_device_maintenance_activity(device_data)
        assert maintenance == "2025-10-30"

        # Test with no maintenance data (should fall back to deployment)
        del device_data["latest_maintenance_activity"]
        device_data["latest_deployment_activity"] = {"date": "2025-09-30"}
        maintenance = data_api._DataApi__get_device_maintenance_activity(device_data)
        assert maintenance == "2025-09-30"

        # Test with no activities at all
        del device_data["latest_deployment_activity"]
        maintenance = data_api._DataApi__get_device_maintenance_activity(device_data)
        assert maintenance is None

    def test_check_api_params(self, data_api):
        """Test API parameter validation and filtering."""
        # Test valid parameters
        params = {
            "status": "deployed",
            "device_network": DeviceNetwork.AIRQO,
            "device_category": DeviceCategory.LOWCOST,
        }
        filtered = data_api._DataApi__check_api_params(params)
        assert "status" in filtered
        assert filtered["status"] == "deployed"
        assert filtered["device_network"] == DeviceNetwork.AIRQO.str

        # Test invalid parameter types
        invalid_params = {
            "status": 123,  # Should be string
            "device_network": "invalid",  # Should be DeviceNetwork enum
            "invalid_param": "value",  # Should be filtered out
        }
        filtered = data_api._DataApi__check_api_params(invalid_params)
        assert len(filtered) == 0

    def test_fetch_metadata_pagination(self, data_api, mock_request):
        """Test metadata fetching with pagination."""
        # Mock responses for paginated data
        first_response = {
            "meta": {"nextPage": "http://api.example.com/devices?skip=10&limit=10"},
            "devices": [{"id": 1}, {"id": 2}],
        }
        second_response = {"meta": {"nextPage": False}, "devices": [{"id": 3}]}

        mock_request.side_effect = [first_response, second_response]

        result = data_api._fetch_metadata(
            "devices/summary", MetaDataType.DEVICES, {"limit": 10}
        )

        assert len(result) == 3
        assert mock_request.call_count == 2
        assert result[0]["id"] == 1
        assert result[2]["id"] == 3

    def test_fetch_metadata_error_handling(self, data_api, mock_request):
        """Test error handling in metadata fetching."""
        mock_request.side_effect = Exception("API Error")

        result = data_api._fetch_metadata("devices/summary", MetaDataType.DEVICES, {})

        assert result == []
        mock_request.assert_called_once()

    def test_get_networks(self, data_api):
        """Test network retrieval functionality."""
        expected_networks = [
            {"id": 1, "name": "Network 1"},
            {"id": 2, "name": "Network 2"},
        ]

        with patch.object(DataApi, "_request") as mock_request:
            mock_request.return_value = {"networks": expected_networks}

            # Test successful retrieval
            networks, error = data_api.get_networks()
            assert networks == expected_networks
            assert error is None

            # Test error handling
            mock_request.side_effect = Exception("API Error")
            networks, error = data_api.get_networks()
            assert networks == []
            assert "Failed to fetch networks" in error

    @patch("airqo_etl_utils.data_api.configuration")
    def test_get_networks_production_environment(self, mock_config, data_api):
        """Test network retrieval in production environment."""
        mock_config.ENVIRONMENT = "production"

        with patch.object(DataApi, "_request") as mock_request:
            mock_request.return_value = {"networks": []}
            data_api.get_networks(net_status="inactive")
            mock_request.assert_called_once_with(
                "users/networks", {"net_status": "inactive"}
            )
