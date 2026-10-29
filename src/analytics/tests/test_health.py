"""
Tests for FastAPI health endpoint and basic application functionality.

This module contains unit tests for the health check endpoint
and basic application setup.
"""

import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Test cases for the health check endpoint."""

    def test_health_endpoint_success(self, client: TestClient):
        """
        Test that the health endpoint returns success status.

        Args:
            client: FastAPI test client
        """
        response = client.get("/health")

        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "2.0.0"
        assert "message" in data
        assert "environment" in data

    def test_health_endpoint_response_structure(self, client: TestClient):
        """
        Test that the health endpoint returns properly structured response.

        Args:
            client: FastAPI test client
        """
        response = client.get("/health")
        data = response.json()

        # Check required fields are present
        required_fields = ["status", "message", "version", "environment"]
        for field in required_fields:
            assert field in data

        # Check data types
        assert isinstance(data["status"], str)
        assert isinstance(data["message"], str)
        assert isinstance(data["version"], str)
        assert isinstance(data["environment"], str)


class TestApplicationSetup:
    """Test cases for basic application setup."""

    def test_openapi_docs_available(self, client: TestClient):
        """
        Test that OpenAPI documentation is available.

        Args:
            client: FastAPI test client
        """
        response = client.get("/docs")

        # Should redirect or return HTML (FastAPI serves docs)
        assert response.status_code in [200, 302]

    def test_openapi_json_available(self, client: TestClient):
        """
        Test that OpenAPI JSON specification is available.

        Args:
            client: FastAPI test client
        """
        response = client.get("/openapi.json")

        assert response.status_code == 200

        data = response.json()
        assert "openapi" in data
        assert "info" in data
        assert "paths" in data

    def test_redoc_available(self, client: TestClient):
        """
        Test that ReDoc documentation is available.

        Args:
            client: FastAPI test client
        """
        response = client.get("/redoc")

        # Should return HTML or redirect
        assert response.status_code in [200, 302]
