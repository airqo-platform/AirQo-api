import json
from flask import Flask
from flask.testing import FlaskClient
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from typing import Dict, Any

# Fix the import to use the correct module path
from api.utils.data_formatters import get_validated_filter
from api.views.common.data_ops import DownloadService


@pytest.fixture
def app_client(app: Flask):
    """Create a test client for the Flask application."""
    return app.test_client()


@pytest.fixture
def mock_empty_dataframe():
    """Return an empty DataFrame."""
    return pd.DataFrame()


@pytest.fixture
def mock_data_dataframe_raw():
    """Return a test DataFrame with some records."""
    data = {
        "dateTime": ["2023-01-01 12:00:00Z", "2023-01-01 13:00:00Z"],
        "device_id": ["device1", "device2"],
        "pm2_5": [0.0, 0.0],
        "pm10": [0.0, 0.0],
        "s1_pm2_5": [15.5, 20.3],
        "s2_pm2_5": [15.5, 20.3],
        "s1_pm10": [25.7, 30.2],
        "s2_pm10": [25.7, 30.2],
        "temperature": [24.5, 23.8],
        "humidity": [65.3, 67.2],
        "site_name": ["Site A", "Site B"],
    }
    return pd.DataFrame(data)


@pytest.fixture
def mock_data_dataframe_raw_no_metadata():
    """Return a test DataFrame with some records."""
    data = {
        "dateTime": ["2023-01-01 12:00:00Z", "2023-01-01 13:00:00Z"],
        "device_id": ["device1", "device2"],
        "pm2_5": [0.0, 0.0],
        "pm10": [0.0, 0.0],
        "s1_pm2_5": [15.5, 20.3],
        "s2_pm2_5": [15.5, 20.3],
        "s1_pm10": [25.7, 30.2],
        "s2_pm10": [25.7, 30.2],
        "site_name": ["Site A", "Site B"],
    }
    return pd.DataFrame(data)


@pytest.fixture
def mock_data_dataframe_averaged():
    """Return a test DataFrame with some records."""
    data = {
        "dateTime": ["2023-01-01 12:00:00Z", "2023-01-01 13:00:00Z"],
        "device_id": ["device1", "device2"],
        "pm2_5": [15.5, 20.3],
        "pm10": [25.7, 30.2],
        "pm2_5_calibrated_value": [15.5, 20.3],
        "pm10_calibrated_value": [25.7, 30.2],
        "temperature": [24.5, 23.8],
        "humidity": [65.3, 67.2],
        "site_name": ["Site A", "Site B"],
    }
    return pd.DataFrame(data)


@pytest.fixture
def mock_data_dataframe_averaged_no_metadata():
    """Return a test DataFrame with some records."""
    data = {
        "dateTime": ["2023-01-01 12:00:00Z", "2023-01-01 13:00:00Z"],
        "device_id": ["device1", "device2"],
        "pm2_5": [15.5, 20.3],
        "pm10": [25.7, 30.2],
        "pm2_5_calibrated_value": [15.5, 20.3],
        "pm10_calibrated_value": [25.7, 30.2],
        "site_name": ["Site A", "Site B"],
    }
    return pd.DataFrame(data)


@pytest.fixture
def valid_raw_data_request_device_names_v3():
    """Return a valid raw data request payload for v3."""
    return {
        "network": "airqo",
        "startDateTime": "2023-01-01T00:00:00Z",
        "endDateTime": "2023-01-02T00:00:00Z",
        "device_category": "lowcost",
        "device_names": ["device1", "device2"],
        "pollutants": ["pm2_5", "pm10"],
        "metaDataFields": ["latitude", "longitude"],
        "weatherFields": ["temperature", "humidity"],
        "frequency": "raw",
        "cursor": "test_cursor_token",  # Added for V3 pagination
    }


@pytest.fixture
def valid_raw_data_request_sites_v3():
    """Return a valid raw data request payload for v3."""
    return {
        "network": "airqo",
        "startDateTime": "2023-01-01T00:00:00Z",
        "endDateTime": "2023-01-02T00:00:00Z",
        "device_category": "lowcost",
        "sites": ["site1", "site2"],
        "pollutants": ["pm2_5", "pm10"],
        "frequency": "raw",
        "cursor": "test_cursor_token",
    }


@pytest.fixture
def valid_data_download_request_device_names_csv_v3():
    """Return a valid data download request payload for v3."""
    return {
        "startDateTime": "2023-01-01T00:00:00Z",
        "endDateTime": "2023-01-02T00:00:00Z",
        "device_category": "lowcost",
        "device_names": ["device1", "device2"],
        "pollutants": ["pm2_5", "pm10"],
        "frequency": "hourly",
        "datatype": "calibrated",
        "outputFormat": "airqo-standard",
        "downloadType": "csv",
        "metaDataFields": ["latitude", "longitude"],
        "weatherFields": ["temperature", "humidity"],
        "minimum": True,
    }


@pytest.fixture
def valid_data_download_request_sites_json_v3():
    """Return a valid data download request payload for v3."""
    return {
        "startDateTime": "2023-01-01T00:00:00Z",
        "endDateTime": "2023-01-02T00:00:00Z",
        "device_category": "lowcost",
        "sites": ["site1", "site2"],
        "pollutants": ["pm2_5", "pm10"],
        "frequency": "hourly",
        "datatype": "calibrated",
        "outputFormat": "airqo-standard",
        "downloadType": "json",
        "metaDataFields": ["latitude", "longitude"],
        "weatherFields": ["temperature", "humidity"],
        "minimum": True,
    }


@pytest.fixture
def invalid_raw_data_request_missing_fields():
    """Return an invalid raw data request with missing required fields."""
    return {
        "startDateTime": "2023-01-01T00:00:00Z",
        "device_category": "lowcost",
        "device_names": ["device1", "device2"],
        "frequency": "raw",
        # Missing endDateTime, network, pollutants
    }


class TestV3RawDataEndpoint:
    @patch("api.views.v3.data.get_validated_filter")
    @patch("api.views.common.data_ops.DownloadService.fetch_data")
    @patch("api.views.common.data_ops.DownloadService.format_and_respond")
    def test_raw_data_devices_success(
        self,
        mock_format,
        mock_fetch,
        mock_validate,
        app_client: Any,
        mock_data_dataframe_raw: pd.DataFrame,
        valid_raw_data_request_device_names_v3: Dict[str, Any],
    ):
        mock_validate.return_value = ("devices", ["device1", "device2"], None)
        mock_fetch.return_value = (
            mock_data_dataframe_raw,
            {"total_count": 2, "has_more": True, "next": "next_cursor_token"},
        )
        mock_format.return_value = {
            "status": "success",
            "message": "Data downloaded successfully",
            "data": json.loads(mock_data_dataframe_raw.to_json(orient="records")),
            "metadata": {"totalCount": 2, "hasMore": True, "next": "next_cursor_token"},
        }

        response = app_client.post(
            "/api/v3/public/analytics/raw-data",
            json=valid_raw_data_request_device_names_v3,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert "data" in data
        assert isinstance(data["data"], list)
        assert len(data["data"]) == 2

        assert "metadata" in data
        assert data["metadata"]["hasMore"] is True
        assert data["metadata"]["next"] == "next_cursor_token"

        mock_validate.assert_called_once()
        mock_fetch.assert_called_once()
        mock_format.assert_called_once()

    @patch("api.views.v3.data.get_validated_filter")
    @patch("api.views.common.data_ops.DownloadService.fetch_data")
    @patch("api.views.common.data_ops.DownloadService.format_and_respond")
    def test_raw_data_sites_with_metadata(
        self,
        mock_format,
        mock_fetch,
        mock_validate,
        app_client: Any,
        mock_data_dataframe_raw_no_metadata: pd.DataFrame,
        valid_raw_data_request_sites_v3: Dict[str, Any],
    ):
        mock_validate.return_value = ("sites", ["site1", "site2"], None)
        mock_fetch.return_value = (
            mock_data_dataframe_raw_no_metadata,
            {
                "total_count": 2,
                "has_more": False,
                "next": None,
            },
        )
        mock_format.return_value = {
            "status": "success",
            "message": "Data downloaded successfully",
            "data": json.loads(
                mock_data_dataframe_raw_no_metadata.to_json(orient="records")
            ),
            "metadata": {
                "totalCount": 2,
                "hasMore": False,
                "next": None,
            },
        }

        response = app_client.post(
            "/api/v3/public/analytics/raw-data", json=valid_raw_data_request_sites_v3
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "data" in data
        assert len(data["data"]) == 2

        assert "metadata" in data

        mock_validate.assert_called_once()
        mock_fetch.assert_called_once()
        mock_format.assert_called_once()

    @patch("api.views.v3.data.get_validated_filter")
    @patch("api.views.common.data_ops.DownloadService.fetch_data")
    def test_raw_data_empty_response(
        self,
        mock_fetch,
        mock_validate,
        app_client: Any,
        mock_empty_dataframe: pd.DataFrame,
        valid_raw_data_request_device_names_v3: Dict[str, Any],
    ):
        mock_validate.return_value = ("devices", ["device1", "device2"], None)
        mock_fetch.return_value = (mock_empty_dataframe, {})

        response = app_client.post(
            "/api/v3/public/analytics/raw-data",
            json=valid_raw_data_request_device_names_v3,
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["status"] == "error"
        assert data["message"] == "No data found"

    def test_raw_data_validation_error(
        self, app_client: Any, invalid_raw_data_request_missing_fields: Dict[str, Any]
    ):
        response = app_client.post(
            "/api/v3/public/analytics/raw-data",
            json=invalid_raw_data_request_missing_fields,
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["status"] == "error"
        assert (
            "network" in str(data["message"])
            or "endDateTime" in str(data["message"])
            or "pollutants" in str(data["message"])
        )


class TestV3DataDownloadEndpoint:
    @patch("api.views.v3.data.get_validated_filter")
    @patch("api.views.common.data_ops.DownloadService.fetch_data")
    @patch("api.views.common.data_ops.DownloadService.format_and_respond")
    def test_data_download_json_with_metadata(
        self,
        mock_format,
        mock_fetch,
        mock_validate,
        app_client: FlaskClient,
        mock_data_dataframe_averaged: pd.DataFrame,
        valid_data_download_request_device_names_csv_v3: Dict[str, Any],
    ):
        mock_validate.return_value = ("devices", ["device1", "device2"], None)
        mock_fetch.return_value = (
            mock_data_dataframe_averaged,
            {"total_count": 2, "has_more": False, "next": None},
        )
        mock_format.return_value = {
            "status": "success",
            "message": "Data downloaded successfully",
            "data": json.loads(mock_data_dataframe_averaged.to_json(orient="records")),
            "metadata": {"total_count": 2, "has_more": False, "next": None},
        }

        response = app_client.post(
            "/api/v3/public/analytics/data-download",
            json=valid_data_download_request_device_names_csv_v3,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert "data" in data
        assert len(data["data"]) == 2
        assert "metadata" in data
        mock_validate.assert_called_once()
        mock_fetch.assert_called_once()
        mock_format.assert_called_once()

    @patch("api.views.v3.data.get_validated_filter")
    @patch("api.views.common.data_ops.DownloadService.fetch_data")
    @patch("api.views.common.data_ops.DownloadService.format_and_respond")
    def test_data_download_csv_format(
        self,
        mock_format,
        mock_fetch,
        mock_validate,
        app_client: FlaskClient,
        mock_data_dataframe_averaged: pd.DataFrame,
        valid_data_download_request_device_names_csv_v3: Dict[str, Any],
    ):
        mock_validate.return_value = ("devices", ["device1", "device2"], None)
        mock_fetch.return_value = (
            mock_data_dataframe_averaged,
            {"total_count": 2, "has_more": False, "next": None},
        )
        mock_format.return_value = {
            "status": "success",
            "message": "Data downloaded successfully",
            "data": mock_data_dataframe_averaged.to_dict(orient="records"),
            "metadata": {"total_count": 2, "has_more": False, "next": None},
        }

        response = app_client.post(
            "/api/v3/public/analytics/data-download",
            json=valid_data_download_request_device_names_csv_v3,
        )
        assert response.status_code == 200
        mock_validate.assert_called_once()
        mock_fetch.assert_called_once()
        mock_format.assert_called_once()

    @patch("api.views.v3.data.get_validated_filter")
    @patch("api.views.common.data_ops.DownloadService.fetch_data")
    def test_data_download_empty_response(
        self,
        mock_fetch,
        mock_validate,
        app_client: FlaskClient,
        mock_empty_dataframe: pd.DataFrame,
        valid_data_download_request_device_names_csv_v3: Dict[str, Any],
    ):
        mock_validate.return_value = ("devices", ["device1", "device2"], None)
        mock_fetch.return_value = (mock_empty_dataframe, {})

        response = app_client.post(
            "/api/v3/public/analytics/data-download",
            json=valid_data_download_request_device_names_csv_v3,
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["status"] == "error"
        assert data["message"] == "No data found"
