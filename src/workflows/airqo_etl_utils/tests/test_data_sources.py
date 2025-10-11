import json
import pytest
from unittest.mock import patch, MagicMock

import requests
from airqo_etl_utils.data_sources import DataSourcesApis


class TestThingspeakMethod:
    """Tests for the thingspeak method of DataSourcesApis class."""

    def setup_method(self):
        """Setup for each test method."""
        self.data_source = DataSourcesApis()
        self.device_number = 12345
        self.start_date_time = "2023-01-01T00:00:00Z"
        self.end_date_time = "2023-01-02T00:00:00Z"
        self.read_key = "TEST_READ_KEY"
        self.expected_url = (
            f"{self.data_source.THINGSPEAK_CHANNEL_URL}{self.device_number}/feeds.json?"
            f"start={self.start_date_time}&end={self.end_date_time}&api_key={self.read_key}"
        )

    @patch("requests.get")
    def test_thingspeak_success(self, mock_get):
        """Test successful data fetch from ThingSpeak."""
        # Prepare mock response
        mock_response = MagicMock()
        mock_response.content = json.dumps(
            {
                "feeds": [
                    {
                        "created_at": "2025-07-10T12:02:15Z",
                        "entry_id": 30735,
                        "field1": "39.37",
                        "field2": "45.47",
                        "field3": "40.63",
                        "field4": "47.77",
                        "field5": "0.000000",
                        "field6": "0.000000",
                        "field7": "4.25",
                        "field8": "0.000000,0.000000,0.00,0.00,0.00,0.00,33,40,28.30,53.21,0.00,0,4.261,100,0",
                    },
                    {
                        "created_at": "2025-07-10T12:03:03Z",
                        "entry_id": 30736,
                        "field1": "41.53",
                        "field2": "48.43",
                        "field3": "44.47",
                        "field4": "53.13",
                        "field5": "0.000000",
                        "field6": "0.000000",
                        "field7": "4.25",
                        "field8": "0.000000,0.000000,0.00,0.00,0.00,0.00,33,40,28.31,53.15,0.00,0,4.257,100,0",
                    },
                ],
                "channel": {
                    "id": 12345,
                    "name": "device1",
                    "latitude": "0.0",
                    "longitude": "0.0",
                    "field1": "Sensor1 PM2.5_CF_1_ug/m3",
                    "field2": "Sensor1 PM10_CF_1_ug/m3",
                    "field3": "Sensor2 PM2.5_CF_1_ug/m3",
                    "field4": "Sensor2 PM10_CF_1_ug/m3",
                    "field5": "Latitude",
                    "field6": "Longitude",
                    "field7": "Battery Voltage",
                    "field8": "ExtraData",
                    "created_at": "2025-03-12T08:32:04Z",
                    "updated_at": "2025-08-21T13:28:22Z",
                    "last_entry_id": 49549,
                },
            }
        ).encode("utf-8")
        mock_get.return_value = mock_response

        data, meta_data, data_available = self.data_source.thingspeak(
            self.device_number, self.start_date_time, self.end_date_time, self.read_key
        )

        # Assertions
        mock_get.assert_called_once_with(self.expected_url, timeout=100.0)
        assert len(data) == 2
        assert data[0]["field1"] == "39.37"
        assert data[1]["field2"] == "48.43"
        assert meta_data["name"] == "device1"
        assert data_available is True

    @patch("requests.get")
    def test_thingspeak_empty_data(self, mock_get):
        """Test ThingSpeak response with no data."""
        # Prepare mock response with empty feeds
        mock_response = MagicMock()
        mock_response.content = json.dumps(
            {
                "feeds": [],
                "channel": {
                    "id": 12345,
                    "name": "device1",
                    "latitude": "0.0",
                    "longitude": "0.0",
                    "field1": "Sensor1 PM2.5_CF_1_ug/m3",
                    "field2": "Sensor1 PM10_CF_1_ug/m3",
                    "field3": "Sensor2 PM2.5_CF_1_ug/m3",
                    "field4": "Sensor2 PM10_CF_1_ug/m3",
                    "field5": "Latitude",
                    "field6": "Longitude",
                    "field7": "Battery Voltage",
                    "field8": "ExtraData",
                    "created_at": "2025-03-12T08:32:04Z",
                    "updated_at": "2025-08-21T13:28:22Z",
                    "last_entry_id": 49549,
                },
            }
        ).encode("utf-8")
        mock_get.return_value = mock_response

        data, meta_data, data_available = self.data_source.thingspeak(
            self.device_number, self.start_date_time, self.end_date_time, self.read_key
        )

        assert data == []
        assert meta_data["name"] == "device1"
        assert data_available is False

    @patch("requests.get")
    def test_thingspeak_request_exception(self, mock_get):
        """Test ThingSpeak API request exception handling."""
        mock_get.side_effect = requests.exceptions.RequestException("Connection error")

        data, meta_data, data_available = self.data_source.thingspeak(
            self.device_number, self.start_date_time, self.end_date_time, self.read_key
        )

        assert data is None
        assert meta_data is None
        assert data_available is False

    @patch("requests.get")
    def test_thingspeak_value_error(self, mock_get):
        """Test ThingSpeak response with invalid JSON."""
        mock_response = MagicMock()
        mock_response.content = b"Invalid JSON"
        mock_get.return_value = mock_response

        data, meta_data, data_available = self.data_source.thingspeak(
            self.device_number, self.start_date_time, self.end_date_time, self.read_key
        )

        assert data is None
        assert meta_data is None
        assert data_available is False

    @patch("requests.get")
    def test_thingspeak_generic_exception(self, mock_get):
        """Test ThingSpeak with a generic exception."""
        mock_get.side_effect = Exception("Unknown error")

        data, meta_data, data_available = self.data_source.thingspeak(
            self.device_number, self.start_date_time, self.end_date_time, self.read_key
        )

        assert data is None
        assert meta_data is None
        assert data_available is False


class TestIQAirMethod:
    """Tests for the iqair method of DataSourcesApis class."""

    def setup_method(self):
        """Setup for each test method."""
        self.data_source = DataSourcesApis()
        self.valid_device = {
            "api_code": "https://api.example.com/iqair",
            "serial_number": "ABC123",
        }

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_success_instant(self, mock_get, mock_config):
        """Test successful data fetch from IQAir API with instant resolution."""
        # Configure mocks
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly", "daily": "daily"}
        }
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "historical": {
                "instant": [
                    {
                        "pm25": {"conc": 21},
                        "pm10": {"conc": 37},
                        "ts": "2025-01-01T00:00:00Z",
                    }
                ]
            }
        }
        mock_get.return_value = mock_response

        result = self.data_source.iqair(self.valid_device, resolution="instant")

        expected_url = "https://api.example.com/iqair/ABC123"
        mock_get.assert_called_once_with(expected_url, timeout=10)
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["pm25"]["conc"] == 21

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_success_hourly(self, mock_get, mock_config):
        """Test successful data fetch from IQAir API with hourly resolution."""
        # Configure mocks
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly", "daily": "daily"}
        }
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "historical": {
                "hourly": [
                    {
                        "pm25": {"conc": 22},
                        "pm10": {"conc": 38},
                        "ts": "2025-01-01T00:00:00Z",
                    }
                ]
            }
        }
        mock_get.return_value = mock_response

        result = self.data_source.iqair(self.valid_device, resolution="hourly")

        expected_url = "https://api.example.com/iqair/ABC123"
        mock_get.assert_called_once_with(expected_url, timeout=10)
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["pm25"]["conc"] == 22

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_success_current(self, mock_get, mock_config):
        """Test successful data fetch from IQAir API with current resolution."""
        # Configure mocks
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly", "current": "current"}
        }
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "current": {
                "pm25": {"conc": 23},
                "pm10": {"conc": 39},
                "ts": "2025-01-01T00:00:00Z",
            }
        }
        mock_get.return_value = mock_response

        result = self.data_source.iqair(self.valid_device, resolution="current")

        expected_url = "https://api.example.com/iqair/ABC123"
        mock_get.assert_called_once_with(expected_url, timeout=10)
        assert isinstance(result, dict)
        assert result["pm25"]["conc"] == 23

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_empty_api_code(self, mock_get, mock_config):
        """Test IQAir API with empty API code in device."""
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly"}
        }

        invalid_device = {"api_code": "", "serial_number": "ABC123"}

        result = self.data_source.iqair(invalid_device, resolution="instant")

        assert result is None
        mock_get.assert_not_called()

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_nan_api_code(self, mock_get, mock_config):
        """Test IQAir API with NaN API code in device."""
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly"}
        }
        import numpy as np

        invalid_device = {"api_code": np.nan, "serial_number": "ABC123"}

        result = self.data_source.iqair(invalid_device, resolution="instant")

        assert result is None
        mock_get.assert_not_called()

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_missing_serial_number(self, mock_get, mock_config):
        """Test IQAir API with missing serial number in device."""
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly"}
        }

        invalid_device = {"api_code": "https://api.example.com/iqair"}

        result = self.data_source.iqair(invalid_device, resolution="instant")

        assert result is None
        mock_get.assert_not_called()

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_request_exception(self, mock_get, mock_config):
        """Test IQAir API request exception handling."""
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly"}
        }
        mock_get.side_effect = requests.exceptions.RequestException("Connection error")

        result = self.data_source.iqair(self.valid_device, resolution="instant")

        assert result is None
        mock_get.assert_called_once()

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_value_error(self, mock_get, mock_config):
        """Test IQAir API with value error."""
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly"}
        }
        mock_response = MagicMock()
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_get.return_value = mock_response

        result = self.data_source.iqair(self.valid_device, resolution="instant")

        assert result is None
        mock_get.assert_called_once()

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_generic_exception(self, mock_get, mock_config):
        """Test IQAir API with generic exception."""
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly"}
        }
        mock_get.side_effect = Exception("Unknown error")

        result = self.data_source.iqair(self.valid_device, resolution="instant")

        assert result is None
        mock_get.assert_called_once()

    @patch("airqo_etl_utils.data_sources.configuration")
    @patch("requests.get")
    def test_iqair_missing_data_in_response(self, mock_get, mock_config):
        """Test IQAir API with missing data in response."""
        mock_config.DATA_RESOLUTION_MAPPING = {
            "iqair": {"instant": "instant", "hourly": "hourly"}
        }
        mock_response = MagicMock()
        mock_response.json.return_value = {}
        mock_get.return_value = mock_response

        result = self.data_source.iqair(self.valid_device, resolution="instant")

        assert result is None
        mock_get.assert_called_once()
