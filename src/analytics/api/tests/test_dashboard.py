import json
import pandas as pd
import pytest
from flask import Flask
from unittest.mock import patch, MagicMock, ANY
from typing import Dict, Any
from datetime import datetime, timezone

from api.utils.data_formatters import get_validated_filter
from api.models.dashboard.dashboarddatautils import DashboardDataUtils
from constants import Frequency, DataType, DeviceCategory


@pytest.fixture
def app_client(app: Flask):
    """Create a test client for the Flask application."""
    return app.test_client()


@pytest.fixture
def mock_chart_dataframe():
    """Return a test DataFrame with some records for chart data."""
    data = {
        "datetime": ["2023-01-01T12:00:00Z", "2023-01-01T13:00:00Z"],
        "device_id": ["device1", "device2"],
        "pm2_5": [15.5, 45.3],
        "pm10": [25.7, 70.2],
        "site_id": ["site_1", "site_2"],
        "site_name": ["Site A", "Site B"],
        "latitude": [0.3123, 0.3124],
        "longitude": [32.5678, 32.5679],
    }
    return pd.DataFrame(data)


@pytest.fixture
def mock_empty_dataframe():
    """Return an empty DataFrame."""
    return pd.DataFrame()


@pytest.fixture
def valid_chart_data_request_line():
    """Return a valid chart data request for line chart."""
    return {
        "network": "airqo",
        "startDate": "2023-01-01T00:00:00Z",
        "endDate": "2023-01-02T00:00:00Z",
        "sites": ["site_1", "site_2"],
        "pollutant": "pm2_5",
        "frequency": "hourly",
        "chartType": "line",
        "metaDataFields": ["site_id"],
    }


@pytest.fixture
def valid_chart_weekly_data_request_line():
    """Return a valid chart data request for line chart."""
    return {
        "network": "airqo",
        "startDate": "2023-01-01T00:00:00Z",
        "endDate": "2023-01-02T00:00:00Z",
        "sites": ["site_1", "site_2"],
        "pollutant": "pm2_5",
        "frequency": "weekly",
        "chartType": "line",
        "metaDataFields": ["site_id"],
    }


@pytest.fixture
def valid_chart_data_request_pie():
    """Return a valid chart data request for pie chart."""
    return {
        "network": "airqo",
        "startDate": "2023-01-01T00:00:00Z",
        "endDate": "2023-01-02T00:00:00Z",
        "sites": ["site_1", "site_2"],
        "pollutant": "pm2_5",
        "frequency": "hourly",
        "chartType": "pie",
        "metaDataFields": ["site_id"],
    }


@pytest.fixture
def invalid_chart_data_request():
    """Return an invalid chart data request missing required fields."""
    return {
        "network": "airqo",
        "startDate": "2023-01-01T00:00:00Z",
        # missing endDate
        "sites": ["site_1"],
        # missing pollutant
        "frequency": "hourly",
        "chartType": "line",
    }


@pytest.fixture
def processed_d3_data():
    """Return processed D3 data."""
    return [
        {
            "time": "2023-01-01T12:00:00Z",
            "value": 15.5,
            "site_id": "site_1",
            "name": "Site A",
            "generated_name": "Site A",
            "latitude": 0.3123,
            "longitude": 32.5678,
        },
        {
            "time": "2023-01-01T13:00:00Z",
            "value": 45.3,
            "site_id": "site_2",
            "name": "Site B",
            "generated_name": "Site B",
            "latitude": 0.3124,
            "longitude": 32.5679,
        },
    ]


@pytest.fixture
def processed_pie_data():
    """Return processed pie chart data."""
    return [
        [
            {"name": "Site A", "category": "Good", "color": "#00E400", "value": 1},
            {"name": "Site A", "category": "Moderate", "color": "#FFFF00", "value": 0},
            {"name": "Site A", "category": "UHFSG", "color": "#FF7E00", "value": 0},
            {"name": "Site A", "category": "Unhealthy", "color": "#FF0000", "value": 0},
            {
                "name": "Site A",
                "category": "VeryUnhealthy",
                "color": "#99004C",
                "value": 0,
            },
            {"name": "Site A", "category": "Hazardous", "color": "#7E0023", "value": 0},
            {"name": "Site A", "category": "Other", "color": "#808080", "value": 0},
            {"name": "Site A", "category": "Unknown", "color": "#808080", "value": 0},
        ],
        [
            {"name": "Site B", "category": "Good", "color": "#00E400", "value": 0},
            {"name": "Site B", "category": "Moderate", "color": "#FFFF00", "value": 1},
            {"name": "Site B", "category": "UHFSG", "color": "#FF7E00", "value": 0},
            {"name": "Site B", "category": "Unhealthy", "color": "#FF0000", "value": 0},
            {
                "name": "Site B",
                "category": "VeryUnhealthy",
                "color": "#99004C",
                "value": 0,
            },
            {"name": "Site B", "category": "Hazardous", "color": "#7E0023", "value": 0},
            {"name": "Site B", "category": "Other", "color": "#808080", "value": 0},
            {"name": "Site B", "category": "Unknown", "color": "#808080", "value": 0},
        ],
    ]


class TestD3ChartDataEndpoint:
    @patch("api.views.v2.dashboard.get_validated_filter")
    @patch("api.views.v2.dashboard.DataUtils.extract_data_from_bigquery")
    @patch("api.views.v2.dashboard.DashboardDataUtils")
    def test_d3_chart_data_line_success(
        self,
        mock_dashboard_utils,
        mock_extract_data,
        mock_validate,
        app_client,
        mock_chart_dataframe,
        valid_chart_data_request_line,
        processed_d3_data,
    ):
        mock_validate.return_value = ("sites", ["site_1", "site_2"], None)
        mock_extract_data.return_value = (mock_chart_dataframe, {})

        mock_utils_instance = MagicMock()
        mock_dashboard_utils.return_value = mock_utils_instance
        mock_utils_instance.processd3data.return_value = processed_d3_data

        response = app_client.post(
            "/api/v2/analytics/dashboard/chart/d3/data",
            json=valid_chart_data_request_line,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "success"
        assert data["message"] == "successfully retrieved d3 chart data"
        assert data["data"] == processed_d3_data

        mock_validate.assert_called_once()
        valid_chart_data_request_line["startDate"] = datetime.fromisoformat(
            valid_chart_data_request_line["startDate"].replace("Z", "+00:00")
        )
        valid_chart_data_request_line["endDate"] = datetime.fromisoformat(
            valid_chart_data_request_line["endDate"].replace("Z", "+00:00")
        )
        mock_extract_data.assert_called_once_with(
            DataType.CALIBRATED,
            valid_chart_data_request_line["startDate"],
            valid_chart_data_request_line["endDate"],
            frequency=Frequency.HOURLY,
            dynamic_query=True,
            device_category=DeviceCategory.LOWCOST,
            main_columns=[valid_chart_data_request_line["pollutant"]],
            data_filter={"sites": valid_chart_data_request_line["sites"]},
            extra_columns=valid_chart_data_request_line["metaDataFields"],
            use_cache=True,
        )
        mock_utils_instance.processd3data.assert_called_once_with(
            mock_chart_dataframe, Frequency.HOURLY
        )
        mock_utils_instance.d3_generate_pie_chart_data.assert_not_called()

    @patch("api.views.v2.dashboard.get_validated_filter")
    @patch("api.views.v2.dashboard.DataUtils.extract_data_from_bigquery")
    @patch("api.views.v2.dashboard.DashboardDataUtils")
    def test_d3_chart_weekly_data_line_success(
        self,
        mock_dashboard_utils,
        mock_extract_data,
        mock_validate,
        app_client,
        mock_chart_dataframe,
        valid_chart_weekly_data_request_line,
        processed_d3_data,
    ):
        mock_validate.return_value = ("sites", ["site_1", "site_2"], None)
        mock_extract_data.return_value = (mock_chart_dataframe, {})

        mock_utils_instance = MagicMock()
        mock_dashboard_utils.return_value = mock_utils_instance
        mock_utils_instance.processd3data.return_value = processed_d3_data

        response = app_client.post(
            "/api/v2/analytics/dashboard/chart/d3/data",
            json=valid_chart_weekly_data_request_line,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "success"
        assert data["message"] == "successfully retrieved d3 chart data"
        assert data["data"] == processed_d3_data

        mock_validate.assert_called_once()
        valid_chart_weekly_data_request_line["startDate"] = datetime.fromisoformat(
            valid_chart_weekly_data_request_line["startDate"].replace("Z", "+00:00")
        )
        valid_chart_weekly_data_request_line["endDate"] = datetime.fromisoformat(
            valid_chart_weekly_data_request_line["endDate"].replace("Z", "+00:00")
        )
        mock_extract_data.assert_called_once_with(
            DataType.CALIBRATED,
            valid_chart_weekly_data_request_line["startDate"],
            valid_chart_weekly_data_request_line["endDate"],
            frequency=Frequency.WEEKLY,
            dynamic_query=True,
            device_category=DeviceCategory.LOWCOST,
            main_columns=[valid_chart_weekly_data_request_line["pollutant"]],
            data_filter={"sites": valid_chart_weekly_data_request_line["sites"]},
            extra_columns=valid_chart_weekly_data_request_line["metaDataFields"],
            use_cache=True,
        )
        mock_utils_instance.processd3data.assert_called_once_with(
            mock_chart_dataframe, Frequency.WEEKLY
        )
        mock_utils_instance.d3_generate_pie_chart_data.assert_not_called()

    @patch("api.views.v2.dashboard.get_validated_filter")
    @patch("api.views.v2.dashboard.DataUtils.extract_data_from_bigquery")
    @patch("api.views.v2.dashboard.DashboardDataUtils")
    def test_d3_chart_data_pie_success(
        self,
        mock_dashboard_utils,
        mock_extract_data,
        mock_validate,
        app_client,
        mock_chart_dataframe,
        valid_chart_data_request_pie,
        processed_d3_data,
        processed_pie_data,
    ):
        mock_validate.return_value = ("sites", ["site_1", "site_2"], None)
        mock_extract_data.return_value = (mock_chart_dataframe, {})

        mock_utils_instance = MagicMock()
        mock_dashboard_utils.return_value = mock_utils_instance
        mock_utils_instance.processd3data.return_value = processed_d3_data
        mock_utils_instance.d3_generate_pie_chart_data.return_value = processed_pie_data

        response = app_client.post(
            "/api/v2/analytics/dashboard/chart/d3/data",
            json=valid_chart_data_request_pie,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "success"
        assert data["message"] == "successfully retrieved d3 chart data"
        assert data["data"] == processed_pie_data

        mock_validate.assert_called_once()
        mock_extract_data.assert_called_once()
        mock_utils_instance.processd3data.assert_called_once_with(
            mock_chart_dataframe, Frequency.HOURLY
        )
        mock_utils_instance.d3_generate_pie_chart_data.assert_called_once_with(
            processed_d3_data, valid_chart_data_request_pie["pollutant"]
        )

    def test_d3_chart_data_validation_error(
        self, app_client, invalid_chart_data_request
    ):
        response = app_client.post(
            "/api/v2/analytics/dashboard/chart/d3/data", json=invalid_chart_data_request
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert "errors" in data
        errors = data["errors"]
        assert "endDate" in errors or "pollutant" in errors

    @patch("api.views.v2.dashboard.get_validated_filter")
    def test_d3_chart_data_filter_validation_error(
        self, mock_validate, app_client, valid_chart_data_request_line
    ):
        error_message = (
            "Invalid filter: please provide a valid device, site or airqloud"
        )
        mock_validate.return_value = (None, None, error_message)

        response = app_client.post(
            "/api/v2/analytics/dashboard/chart/d3/data",
            json=valid_chart_data_request_line,
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["status"] == "error"
        assert data["message"] == error_message

    @patch("api.views.v2.dashboard.get_validated_filter")
    @patch("api.views.v2.dashboard.DataUtils.extract_data_from_bigquery")
    def test_d3_chart_data_empty_dataframe(
        self,
        mock_extract_data,
        mock_validate,
        app_client,
        mock_empty_dataframe,
        valid_chart_data_request_line,
    ):
        mock_validate.return_value = ("sites", ["site_1", "site_2"], None)
        mock_extract_data.return_value = (mock_empty_dataframe, {})

        response = app_client.post(
            "/api/v2/analytics/dashboard/chart/d3/data",
            json=valid_chart_data_request_line,
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "success"
        assert isinstance(data["data"], list)
        assert len(data["data"]) == 0

    @patch("api.views.v2.dashboard.get_validated_filter")
    @patch("api.views.v2.dashboard.DataUtils.extract_data_from_bigquery")
    def test_d3_chart_data_server_error(
        self,
        mock_extract_data,
        mock_validate,
        app_client,
        valid_chart_data_request_line,
    ):
        mock_validate.return_value = ("sites", ["site_1", "site_2"], None)
        mock_extract_data.side_effect = Exception("Database connection error")

        response = app_client.post(
            "/api/v2/analytics/dashboard/chart/d3/data",
            json=valid_chart_data_request_line,
        )

        assert response.status_code == 500
        data = json.loads(response.data)
        assert data["status"] == "error"
        assert "An Error occurred while processing your request" in data["message"]


class TestDashboardDataUtils:
    def test_processd3data(self, mock_chart_dataframe):
        dashboard_utils = DashboardDataUtils()
        result = dashboard_utils.processd3data(mock_chart_dataframe, Frequency.HOURLY)

        assert isinstance(result, list)
        assert len(result) == 2

        assert "time" in result[0]
        assert "value" in result[0]
        assert "name" in result[0]
        assert "generated_name" in result[0]

        assert result[0]["value"] == mock_chart_dataframe.iloc[0]["pm2_5"]
        assert result[1]["value"] == mock_chart_dataframe.iloc[1]["pm2_5"]

    def test_processd3data_missing_pollutant_columns(self):

        df = pd.DataFrame(
            {
                "datetime": ["2023-01-01T12:00:00Z"],
                "device_id": ["device1"],
                "temperature": [24.5],
            }
        )

        dashboard_utils = DashboardDataUtils()

        with pytest.raises(ValueError) as excinfo:
            dashboard_utils.processd3data(df, Frequency.HOURLY)

        assert "must contain one of the following columns" in str(excinfo.value)

    def test_d3_generate_pie_chart_data(self):
        records = [
            {"value": 10.0, "name": "Site A"},  # Good for PM2.5
            {"value": 35.5, "name": "Site A"},  # Moderate for PM2.5
            {"value": 12.0, "name": "Site B"},  # Good for PM2.5
        ]

        dashboard_utils = DashboardDataUtils()
        result = dashboard_utils.d3_generate_pie_chart_data(records, "pm2_5")

        assert isinstance(result, list)
        assert len(result) == 2

        site_a_data = next(
            (site_data for site_data in result if site_data[0]["name"] == "Site A"),
            None,
        )
        assert site_a_data is not None

        good_category = next(
            (cat for cat in site_a_data if cat["category"] == "Good"), None
        )
        moderate_category = next(
            (cat for cat in site_a_data if cat["category"] == "Moderate"), None
        )

        assert good_category["value"] == 1
        assert moderate_category["value"] == 0
