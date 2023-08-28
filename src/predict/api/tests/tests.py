from unittest.mock import patch

import pytest
import requests
from flask import json
from mongomock import MongoClient

from app import create_app
from config import Config
from tests.conftest import monkeypatch
from helpers import read_predictions_from_db, add_forecast_health_tips, get_health_tips
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


@pytest.fixture
def mock_collection(mocker):
    collection = mocker.Mock()
    mocker.patch("db.gp_predictions", collection)
    return collection


# test the read_predictions_from_db function with different parameters and expected results
@pytest.mark.parametrize(
    "airqloud, page_number, limit, pipeline, result, expected_values, expected_total",
    [
        # test case 1: airqloud is None, page_number is 1, limit is 1000
        (
            None,
            1,
            1000,
            [
                {"$unwind": "$values"},
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": 1},
                        "values": {"$push": "$values"},
                    }
                },
                {
                    "$project": {
                        "total": 1,
                        "values": {"$slice": ["$values", 0, 1000]},
                    }
                },
            ],
            [{"total": 2000, "values": list(range(1000))}],
            list(range(1000)),
            2000,
        ),
        # test case 2: airqloud is "foo", page_number is 2, limit is 500
        (
            "foo",
            2,
            500,
            [
                {"$match": {"airqloud": "foo"}},
                {"$unwind": "$values"},
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": 1},
                        "values": {"$push": "$values"},
                    }
                },
                {
                    "$project": {
                        "total": 1,
                        "values": {"$slice": ["$values", 500, 500]},
                    }
                },
            ],
            [{"total": 1500, "values": list(range(500, 1000))}],
            list(range(500, 1000)),
            1500,
        ),
        # test case 3: airqloud is "bar", page_number is 3, limit is 100
        (
            "bar",
            3,
            100,
            [
                {"$match": {"airqloud": "bar"}},
                {"$unwind": "$values"},
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": 1},
                        "values": {"$push": "$values"},
                    }
                },
                {
                    "$project": {
                        "total": 1,
                        "values": {"$slice": ["$values", 200, 100]},
                    }
                },
            ],
            [{"total": 500, "values": list(range(200, 300))}],
            list(range(200, 300)),
            500,
        ),
        # test case 4: airqloud is "baz", page_number is 4, limit is 10
        (
            "baz",
            4,
            10,
            [
                {"$match": {"airqloud": "baz"}},
                {"$unwind": "$values"},
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": 1},
                        "values": {"$push": "$values"},
                    }
                },
                {
                    "$project": {
                        "total": 1,
                        "values": {"$slice": ["$values", 30, 10]},
                    }
                },
            ],
            [{"total": 100, "values": list(range(30, 40))}],
            list(range(30, 40)),
            100,
        ),
        # test case 5: airqloud is None, page_number is -1, limit is -1
        (
            None,
            -1,
            -1,
            [
                {"$unwind": "$values"},
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": 1},
                        "values": {"$push": "$values"},
                    }
                },
                {
                    "$project": {
                        "total": 1,
                        # this will return an empty array
                        "values": {"$slice": ["$values", -2, -1]},
                    }
                },
            ],
            [{"total": -2, "values": []}],
            [],
            -2,
        ),
    ],
)
@pytest.mark.xfail
def test_read_predictions_from_db(
    mock_collection,
    airqloud,
    page_number,
    limit,
    pipeline,
    result,
    expected_values,
    expected_total,
):
    mock_collection.aggregate.return_value = result

    values, total = read_predictions_from_db(airqloud, page_number, limit)

    mock_collection.aggregate.assert_called_once_with(pipeline)

    assert values == expected_values
    assert total == expected_total


def test_validate_param_values_with_valid_params(valid_param):
    result, error = validate_param_values(valid_param)
    assert result is True
    assert error is None


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


def test_add_forecast_health_tips(monkeypatch):
    # mock the get_health_tips function to return some sample tips
    def mock_get_health_tips():
        return [
            {
                "_id": "64283f6402cbab001e628296",
                "title": "For Everyone",
                "description": "If you have to spend a lot of time outside, disposable masks like the N95 are helpful.",
                "image": "image link here",
                "aqi_category": {"min": 250.5, "max": 500},
            },
            {
                "_id": "64283f4702cbab001e628293",
                "title": "For Everyone",
                "description": "Reduce the intensity of your outdoor activities. Try to stay indoors until the air quality improves.",
                "image": "image link here",
                "aqi_category": {"min": 150.5, "max": 250.49},
            },
        ]

    monkeypatch.setattr("helpers.get_health_tips", mock_get_health_tips)

    result = {
        "forecasts": [
            {
                "pm2_5": 200,
            },
            {
                "pm2_5": 300,
            },
        ]
    }

    add_forecast_health_tips(result)

    assert len(result["forecasts"]) == 2
    assert result["forecasts"][0]["health_tips"][0]["_id"] == "64283f4702cbab001e628293"
    assert len(result["forecasts"][1]["health_tips"]) == 1
    assert result["forecasts"][1]["health_tips"][0]["_id"] == "64283f6402cbab001e628296"


def test_get_health_tips_success(requests_mock):
    # mock the external API call to return some sample data
    requests_mock.get(
        f"{Config.AIRQO_BASE_URL}/api/v2/devices/tips?token={Config.AIRQO_API_AUTH_TOKEN}",
        json={
            "success": True,
            "message": "successfully retrieved the tip(s)",
            "tips": [
                {
                    "_id": "64283f6402cbab001e628296",
                    # other fields omitted for brevity
                },
                {
                    "_id": "64283f4702cbab001e628293",
                    # other fields omitted for brevity
                },
            ],
        },
    )

    # call the function to get health tips
    tips = get_health_tips()

    # assert that the function returns the expected list of tips
    assert len(tips) == 2
    assert tips[0]["_id"] == "64283f6402cbab001e628296"
    assert tips[1]["_id"] == "64283f4702cbab001e628293"


def test_get_health_tips_timeout(requests_mock):
    requests_mock.get(
        f"{Config.AIRQO_BASE_URL}/api/v2/devices/tips?token={Config.AIRQO_API_AUTH_TOKEN}",
        exc=requests.exceptions.Timeout,
    )
    tips = get_health_tips()
    assert tips == [
        {"_id": "64283f6402cbab001e628296"},
        {"_id": "64283f4702cbab001e628293"},
    ]
