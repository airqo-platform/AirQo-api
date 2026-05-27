from unittest.mock import patch
from datetime import timedelta

import pytest
import requests
from flask import json
from mongomock import MongoClient

from app import cache, create_app
from config import Config
from tests.conftest import monkeypatch
from helpers import (
    add_forecast_health_tips,
    get_health_tips,
    read_predictions_from_db,
    validate_param_values,
)

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
    mock_db.faulty_devices_1.insert_many(
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
    flask_app.config["TEST_DB"] = mock_db
    ctx = flask_app.app_context()
    ctx.push()

    yield testing_client

    ctx.pop()


def test_fetch_faulty_devices(test_client):
    with patch("helpers.db", test_client.application.config["TEST_DB"]):
        response = test_client.get("/api/v2/predict/faulty-devices")
        assert response.status_code == 200
        assert json.loads(response.data)["total"] == 3
        assert len(json.loads(response.data)["data"]) == 3

        response = test_client.get(
            "/api/v2/predict/faulty-devices?airqloud_names=airqloud1"
        )
        assert response.status_code == 200
        assert len(json.loads(response.data)["data"]) == 1
        assert json.loads(response.data)["data"][0]["device_name"] == "device1"

        response = test_client.get(
            "/api/v2/predict/faulty-devices?device_name=device2"
        )
        assert response.status_code == 200
        assert len(json.loads(response.data)["data"]) == 1
        assert json.loads(response.data)["data"][0]["airqloud_names"] == "airqloud2"

        response = test_client.get(
            "/api/v2/predict/faulty-devices?correlation_fault=1"
        )
        assert response.status_code == 200
        assert len(json.loads(response.data)["data"]) == 2

        response = test_client.get(
            "/api/v2/predict/faulty-devices?missing_data_fault=1"
        )
        assert response.status_code == 200
        assert len(json.loads(response.data)["data"]) == 2

        response = test_client.get(
            "/api/v2/predict/faulty-devices?correlation_fault=2"
        )
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
    assert tips == []


@pytest.fixture
def site_hourly_forecast_client(monkeypatch):
    import helpers as helpers_module

    real_timestamp = helpers_module.pd.Timestamp
    start_timestamp = real_timestamp("2026-01-01T00:00:00Z").to_pydatetime()

    class FrozenTimestamp:
        @staticmethod
        def utcnow():
            return real_timestamp(start_timestamp)

    flask_app = create_app("testing")
    flask_app.config["TESTING"] = True
    cache.init_app(flask_app, config={"CACHE_TYPE": "NullCache"})

    mock_db = MongoClient().db
    monkeypatch.setattr(helpers_module.pd, "Timestamp", FrozenTimestamp)
    monkeypatch.setattr(helpers_module, "site_forecast_db", mock_db)
    monkeypatch.setattr(
        helpers_module.Config, "MONGO_SITE_HOURLY_FORECAST_COLLECTION", "site_hourly"
    )
    monkeypatch.setattr(
        helpers_module.Config, "SITE_HOURLY_FORECAST_HORIZON_HOURS", "2"
    )

    with flask_app.app_context():
        yield flask_app.test_client(), mock_db["site_hourly"], start_timestamp


def _hourly_forecast_doc(site_id, site_name, timestamp, pm2_5_mean):
    return {
        "timestamp": timestamp,
        "site_id": site_id,
        "site_name": site_name,
        "site_latitude": 0.31,
        "site_longitude": 32.58,
        "pm2_5_mean": pm2_5_mean,
        "pm2_5_q10": pm2_5_mean - 2,
        "pm2_5_q90": pm2_5_mean + 3,
        "forecast_confidence": 82.5,
        "air_temperature": 24.0,
        "relative_humidity": 61.0,
        "air_pressure_at_sea_level": 1012.0,
        "precipitation_amount": 0.2,
        "cloud_area_fraction": 40.0,
        "wind_speed": 3.1,
        "wind_from_direction": 90.0,
        "created_at": timestamp,
    }


def _daily_forecast_doc(site_id, site_name, forecast_date, pm2_5_mean):
    return {
        "date": forecast_date,
        "site_id": site_id,
        "site_name": site_name,
        "site_latitude": 0.31,
        "site_longitude": 32.58,
        "pm2_5_mean": pm2_5_mean,
        "pm2_5_low": pm2_5_mean - 2,
        "pm2_5_high": pm2_5_mean + 3,
        "pm2_5_min": pm2_5_mean - 4,
        "pm2_5_max": pm2_5_mean + 5,
        "forecast_confidence": 82.5,
        "air_temperature": 24.0,
        "relative_humidity": 61.0,
        "air_pressure_at_sea_level": 1012.0,
        "precipitation_amount": 0.2,
        "cloud_area_fraction": 40.0,
        "wind_speed": 3.1,
        "wind_from_direction": 90.0,
        "created_at": forecast_date,
    }


def test_site_daily_forecasting_appends_pm2_5_trend_message(monkeypatch):
    import helpers as helpers_module
    from prediction import (
        get_aqi_category,
        get_pm2_5_trend_message,
        wind_deg_to_compass,
    )

    forecast_documents = [
        _daily_forecast_doc("site-1", "Site One", "2026-01-01", 12.4),
        _daily_forecast_doc("site-1", "Site One", "2026-01-02", 20.4),
    ]
    monkeypatch.setattr(
        helpers_module,
        "get_site_daily_forecasts",
        lambda site_id, start_date: forecast_documents,
    )

    flask_app = create_app("testing")
    with flask_app.app_context():
        response, status_code = helpers_module.build_site_forecast_response(
            site_id="site-1",
            aqi_category_getter=get_aqi_category,
            trend_message_getter=get_pm2_5_trend_message,
            wind_direction_formatter=wind_deg_to_compass,
        )

    assert status_code == 200
    [site_forecast] = response["data"]["forecasts"]
    first_label = site_forecast["forecasts"][0]["aqi"]["label"]
    first_trend_message = site_forecast["forecasts"][0]["aqi"]["trend_message"]
    second_label = site_forecast["forecasts"][1]["aqi"]["label"]
    second_trend_message = site_forecast["forecasts"][1]["aqi"]["trend_message"]
    assert any(
        trend_message == first_trend_message
        for trend_message in [
            "Air pollution may increase tomorrow. Consider reducing prolonged outdoor exposure.",
            "Conditions are expected to worsen. Sensitive groups should plan ahead.",
        ]
    )
    assert first_trend_message not in first_label
    assert "tomorrow" not in second_label.lower()
    assert second_trend_message is None


def test_site_hourly_forecasting_all_sites_groups_forecasts(
    site_hourly_forecast_client,
):
    client, collection, start_timestamp = site_hourly_forecast_client
    next_timestamp = start_timestamp + timedelta(hours=1)
    collection.insert_many(
        [
            _hourly_forecast_doc("site-1", "Site One", start_timestamp, 12.4),
            _hourly_forecast_doc("site-1", "Site One", next_timestamp, 13.2),
            _hourly_forecast_doc("site-2", "Site Two", start_timestamp, 26.7),
        ]
    )

    response = client.get("/api/v2/predict/hourly-forecasting?page=2&limit=1")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["data"]["hours"] == 2
    assert payload["data"]["total"] == 2
    assert payload["data"]["page"] == 2
    assert payload["data"]["limit"] == 1
    assert payload["data"]["total_pages"] == 2
    assert set(payload["data"]["descriptions"].keys()) == {
        "pm2_5_mean",
        "pm2_5_q10",
        "pm2_5_q90",
        "forecast_confidence",
    }
    assert len(payload["data"]["forecasts"]) == 1

    forecasts_by_site = {
        forecast["site_details"]["site_id"]: forecast
        for forecast in payload["data"]["forecasts"]
    }
    assert forecasts_by_site["site-2"]["total"] == 1
    assert forecasts_by_site["site-2"]["hours"] == 1
    assert forecasts_by_site["site-2"]["forecasts"][0]["forecast"] == {
        "pm2_5_mean": 26.7,
        "pm2_5_q10": 24.7,
        "pm2_5_q90": 29.7,
        "forecast_confidence": 82.5,
    }
    assert forecasts_by_site["site-2"]["forecasts"][0]["aqi"]["aqi_value"] == 26.7
    assert forecasts_by_site["site-2"]["forecasts"][0]["aqi"]["label"] in {
        "It is okay to take a walk, keep outdoor activity light, and sensitive groups should take breaks.",
        "You can go outside, choose lighter exercise, and watch for symptoms if you are sensitive.",
        "A short walk is fine, keep children and sensitive people from overexerting, and rest indoors when needed.",
    }
    assert forecasts_by_site["site-2"]["forecasts"][0]["met"][
        "wind_direction_compass"
    ] == "E"


def test_site_hourly_forecasting_varies_aqi_labels(site_hourly_forecast_client):
    client, collection, start_timestamp = site_hourly_forecast_client
    collection.insert_many(
        [
            _hourly_forecast_doc("site-1", "Site One", start_timestamp, 12.4),
            _hourly_forecast_doc("site-2", "Site Two", start_timestamp, 26.7),
        ]
    )

    response = client.get("/api/v2/predict/hourly-forecasting?page=1&limit=2")

    assert response.status_code == 200
    payload = response.get_json()
    labels = {
        forecast["site_details"]["site_id"]: forecast["forecasts"][0]["aqi"]["label"]
        for forecast in payload["data"]["forecasts"]
    }
    assert labels["site-1"] != labels["site-2"]


def test_site_hourly_forecasting_adds_hourly_trend_message(
    site_hourly_forecast_client,
):
    client, collection, start_timestamp = site_hourly_forecast_client
    next_timestamp = start_timestamp + timedelta(hours=1)
    collection.insert_many(
        [
            _hourly_forecast_doc("site-1", "Site One", start_timestamp, 12.4),
            _hourly_forecast_doc("site-1", "Site One", next_timestamp, 20.4),
        ]
    )

    response = client.get("/api/v2/predict/hourly-forecasting?site_id=site-1")

    assert response.status_code == 200
    payload = response.get_json()
    [site_forecast] = payload["data"]["forecasts"]
    first_trend_message = site_forecast["forecasts"][0]["aqi"]["trend_message"]
    second_trend_message = site_forecast["forecasts"][1]["aqi"]["trend_message"]
    assert first_trend_message in {
        "Air pollution may increase in the next hour. Consider reducing outdoor exposure.",
        "Conditions are expected to worsen soon. Sensitive groups should plan ahead.",
    }
    assert second_trend_message is None


def test_site_hourly_forecasting_site_id_filters_and_groups_forecasts(
    site_hourly_forecast_client,
):
    client, collection, start_timestamp = site_hourly_forecast_client
    next_timestamp = start_timestamp + timedelta(hours=1)
    collection.insert_many(
        [
            _hourly_forecast_doc("site-1", "Site One", start_timestamp, 12.4),
            _hourly_forecast_doc("site-1", "Site One", next_timestamp, 13.2),
            _hourly_forecast_doc("site-2", "Site Two", start_timestamp, 26.7),
        ]
    )

    response = client.get(
        "/api/v2/predict/hourly-forecasting?site_id=site-1&page=2&limit=1"
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["data"]["hours"] == 2
    assert payload["data"]["total"] == 2
    assert payload["data"]["page"] == 2
    assert payload["data"]["limit"] == 1
    assert payload["data"]["total_pages"] == 2

    [site_forecast] = payload["data"]["forecasts"]
    assert site_forecast["site_details"]["site_id"] == "site-1"
    assert site_forecast["hours"] == 2
    assert site_forecast["total"] == 2
    assert len(site_forecast["forecasts"]) == 1
    assert [
        forecast["forecast"]["pm2_5_mean"]
        for forecast in site_forecast["forecasts"]
    ] == [13.2]


@pytest.mark.parametrize("query_string", ["", "?site_id=missing-site"])
def test_site_hourly_forecasting_returns_404_when_no_docs(
    site_hourly_forecast_client, query_string
):
    client, _, _ = site_hourly_forecast_client

    response = client.get(f"/api/v2/predict/hourly-forecasting{query_string}")

    assert response.status_code == 404
    payload = response.get_json()
    assert payload["success"] is False
    assert payload["data"]["page"] == 1
    assert payload["data"]["limit"] == 10
    assert payload["data"]["total"] == 0
    assert payload["data"]["total_pages"] == 0
    assert payload["data"]["forecasts"] == []
    assert set(payload["data"]["descriptions"].keys()) == {
        "pm2_5_mean",
        "pm2_5_q10",
        "pm2_5_q90",
        "forecast_confidence",
    }
