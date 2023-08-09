from unittest.mock import patch

import pytest
from flask import json
from mongomock import MongoClient

from app import create_app
from prediction import validate_param_values

valid_params = [
    {"correlation_fault": "0", "missing_data_fault": "0"},
    {"correlation_fault": "1", "missing_data_fault": "1"},
    {"correlation_fault": "0", "missing_data_fault": "1"},
    {"correlation_fault": "1", "missing_data_fault": "0"},
]

invalid_params = [
    {"correlation_fault": "2", "missing_data_fault": "0"},
    {"correlation_fault": "0", "missing_data_fault": "-1"},
    {"correlation_fault": "a", "missing_data_fault": "b"},
    {"correlation_fault": "", "missing_data_fault": ""},
]


@pytest.fixture(params=valid_params)
def valid_param(request):
    return request.param


@pytest.fixture(params=invalid_params)
def invalid_param(request):
    return request.param


def test_validate_param_values_with_valid_params(valid_param):
    result, error = validate_param_values(valid_param)
    assert result is True
    assert error is None


# Define a test function that asserts that the function returns False and an error message for invalid parameters
def test_validate_param_values_with_invalid_params(invalid_param):
    result, error = validate_param_values(invalid_param)
    assert result is False
    assert error.startswith("Invalid value for")

@pytest.fixture(scope="module")
def test_client():
    flask_app = create_app("testing")
    testing_client = flask_app.test_client()
    mock_db = MongoClient().db
    mock_db.faulty_devices.insert_many(
        [
            {
                "airqloud_names": "airqloud1",
                "device_name": "device1",
                "correlation_fault": 1,
                "missing_data_fault": 0,
            },
            {
                "airqloud_names": "airqloud2",
                "device_name": "device2",
                "correlation_fault": 0,
                "missing_data_fault": 1,
            },
            {
                "airqloud_names": "airqloud3",
                "device_name": "device3",
                "correlation_fault": 1,
                "missing_data_fault": 1,
            },
        ]
    )
    ctx = flask_app.app_context()
    ctx.push()

    yield testing_client

    ctx.pop()


@pytest.mark.xfail
def test_fetch_faulty_devices(test_client):
    with patch("prediction.mongo", test_client.application.config["DB_NAME"]):
        response = test_client.get("/fetch_faulty_devices")
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 3

        response = test_client.get("/fetch_faulty_devices?airqloud_names=airqloud1")
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 1
        assert json.loads(response.data)[0]["device_name"] == "device1"

        response = test_client.get("/fetch_faulty_devices?device_name=device2")
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 1
        assert json.loads(response.data)[0]["airqloud_names"] == "airqloud2"

        response = test_client.get("/fetch_faulty_devices?correlation_fault=1")
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 2

        response = test_client.get("/fetch_faulty_devices?missing_data_fault=1")
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 2

        response = test_client.get("/fetch_faulty_devices?correlation_fault=2")
        assert response.status_code == 400
        assert (
            json.loads(response.data)["error"]
            == "Invalid value for correlation_fault: 2"
        )
