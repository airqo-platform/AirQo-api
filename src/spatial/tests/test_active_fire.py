from pathlib import Path
import json
import sys
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from flask import Flask


SPATIAL_ROOT = Path(__file__).resolve().parents[1]
if str(SPATIAL_ROOT) not in sys.path:
    sys.path.insert(0, str(SPATIAL_ROOT))

from models.active_fire_model import ActiveFireModel
from app_factory import create_app
from views.active_fire_view import ActiveFireView


FIRMS_CSV = """latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
0.32,32.58,330.2,0.42,0.45,2026-06-17,1012,N,VIIRS,n,2.0NRT,290.1,12.4,D
45.00,32.00,331.2,0.43,0.46,2026-06-17,1010,N,VIIRS,h,2.0NRT,291.1,16.4,D
-18.90,47.52,335.0,0.44,0.47,2026-06-17,1008,N,VIIRS,h,2.0NRT,292.1,20.4,N
"""

FIRMS_WINDOW_CSV = """latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
0.32,32.58,330.2,0.42,0.45,2026-06-17,1012,N,VIIRS,n,2.0NRT,290.1,12.4,D
0.35,32.59,331.2,0.43,0.46,2026-06-16,2159,N,VIIRS,h,2.0NRT,291.1,16.4,D
-18.90,47.52,335.0,0.44,0.47,2026-06-16,2200,N,VIIRS,h,2.0NRT,292.1,20.4,N
"""

NOW = datetime(2026, 6, 17, 10, 12, tzinfo=timezone.utc)


class FakeRedis:
    def __init__(self):
        self.store = {}
        self.ttl_by_key = {}
    def ping(self):
        return True

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self.store[key] = value
        self.ttl_by_key[key] = ex


def test_fetch_africa_active_fires_filters_non_africa_rows():
    response = Mock()
    response.text = FIRMS_CSV
    response.raise_for_status.return_value = None

    with patch("models.active_fire_model.requests.get", return_value=response) as get:
        result = ActiveFireModel(
            map_key="test-key",
            base_url="https://firms.test",
            timeout_seconds=5,
            redis_client=False,
        ).fetch_africa_active_fires(day_range=1, now=NOW)

    assert result["count"] == 2
    assert {fire["latitude"] for fire in result["fires"]} == {0.32, -18.9}
    assert all(-35 <= fire["latitude"] <= 38.5 for fire in result["fires"])
    get.assert_called_once()
    assert "/api/area/csv/test-key/VIIRS_SNPP_NRT/-25.5,-35.0,63.5,38.5/1" in get.call_args[0][0]


def test_fetch_africa_active_fires_applies_min_confidence_and_limit():
    response = Mock()
    response.text = FIRMS_CSV
    response.raise_for_status.return_value = None

    with patch("models.active_fire_model.requests.get", return_value=response):
        result = ActiveFireModel(
            map_key="test-key",
            redis_client=False,
        ).fetch_africa_active_fires(
            min_confidence="high",
            limit=1,
            now=NOW,
        )

    assert result["count"] == 1
    assert result["fires"][0]["confidence"] == "h"


def test_fetch_africa_active_fires_defaults_to_today():
    response = Mock()
    response.text = FIRMS_WINDOW_CSV
    response.raise_for_status.return_value = None

    with patch("models.active_fire_model.requests.get", return_value=response) as get:
        result = ActiveFireModel(
            map_key="test-key",
            base_url="https://firms.test",
            redis_client=False,
        ).fetch_africa_active_fires(now=NOW)

    assert result["query"]["date"] == "2026-06-17"
    assert result["query"]["hours"] is None
    assert result["query"]["window_start"] == "2026-06-17T00:00:00+00:00"
    assert result["query"]["window_end"] == "2026-06-17T10:12:00+00:00"
    assert result["count"] == 1
    assert result["fires"][0]["acquisition_datetime"] == "2026-06-17T10:12:00+00:00"
    assert "/api/area/csv/test-key/VIIRS_SNPP_NRT/-25.5,-35.0,63.5,38.5/1/2026-06-17" in get.call_args[0][0]


def test_fetch_africa_active_fires_supports_explicit_rolling_hours():
    response = Mock()
    response.text = FIRMS_WINDOW_CSV
    response.raise_for_status.return_value = None

    with patch("models.active_fire_model.requests.get", return_value=response):
        result = ActiveFireModel(
            map_key="test-key",
            redis_client=False,
        ).fetch_africa_active_fires(hours=12, now=NOW)

    assert result["query"]["date"] is None
    assert result["query"]["hours"] == 12
    assert result["query"]["window_start"] == "2026-06-16T22:12:00+00:00"
    assert result["count"] == 1


def test_fetch_africa_active_fires_expands_day_range_for_hour_window():
    response = Mock()
    response.text = FIRMS_WINDOW_CSV
    response.raise_for_status.return_value = None

    with patch("models.active_fire_model.requests.get", return_value=response) as get:
        result = ActiveFireModel(
            map_key="test-key",
            base_url="https://firms.test",
            redis_client=False,
        ).fetch_africa_active_fires(day_range=1, hours=36, now=NOW)

    assert result["query"]["requested_day_range"] == 1
    assert result["query"]["day_range"] == 2
    assert "/api/area/csv/test-key/VIIRS_SNPP_NRT/-25.5,-35.0,63.5,38.5/2" in get.call_args[0][0]


def test_fetch_africa_active_fires_uses_cached_firms_rows():
    response = Mock()
    response.text = FIRMS_CSV
    response.raise_for_status.return_value = None
    redis_client = FakeRedis()
    model = ActiveFireModel(map_key="test-key", redis_client=redis_client)

    with patch("models.active_fire_model.requests.get", return_value=response) as get:
        first = model.fetch_africa_active_fires(now=NOW)
        second = model.fetch_africa_active_fires(now=NOW)

    assert first["count"] == 2
    assert second["count"] == 2
    get.assert_called_once()
    cached_payload = json.loads(next(iter(redis_client.store.values())))
    assert cached_payload["latest_acquisition_datetime"] == "2026-06-17T10:12:00+00:00"
    assert cached_payload["rows"][0]["latitude"] == "0.32"


def test_fetch_africa_active_fires_caps_cache_ttl_at_12_hours():
    response = Mock()
    response.text = FIRMS_CSV
    response.raise_for_status.return_value = None
    redis_client = FakeRedis()

    with patch("models.active_fire_model.requests.get", return_value=response):
        ActiveFireModel(
            map_key="test-key",
            redis_client=redis_client,
            cache_ttl_seconds=99 * 60 * 60,
        ).fetch_africa_active_fires(now=NOW)

    assert next(iter(redis_client.ttl_by_key.values())) == 12 * 60 * 60


def test_active_fire_cache_key_varies_by_firms_map_key():
    first = ActiveFireModel(map_key="first-key", redis_client=False)
    second = ActiveFireModel(map_key="second-key", redis_client=False)

    assert first._cache_key("VIIRS_SNPP_NRT", 1, None) != second._cache_key(
        "VIIRS_SNPP_NRT",
        1,
        None,
    )


def test_active_fire_view_returns_400_for_bad_day_range():
    app = Flask(__name__)

    with app.test_request_context("/?day_range=6"):
        response, status = ActiveFireView.get_africa_active_fires()

    assert status == 400
    assert "day_range" in response.get_json()["error"]


def test_active_fire_view_returns_400_for_bad_hours():
    app = Flask(__name__)

    with app.test_request_context("/?hours=0"):
        response, status = ActiveFireView.get_africa_active_fires()

    assert status == 400
    assert "hours" in response.get_json()["error"]


def test_active_fire_view_returns_503_without_firms_key():
    app = Flask(__name__)

    with app.test_request_context("/"), patch(
        "models.active_fire_model.Config.FIRMS_MAP_KEY",
        None,
    ):
        response, status = ActiveFireView.get_africa_active_fires()

    assert status == 503
    assert response.get_json()["error"] == "Service is temporarily unavailable."


def test_active_fire_route_is_registered_on_existing_spatial_app():
    app = create_app()

    with patch.object(
        ActiveFireModel,
        "fetch_africa_active_fires",
        return_value={
            "source": "NASA FIRMS",
            "product": "VIIRS_SNPP_NRT",
            "scope": "Africa",
            "query": {},
            "count": 0,
            "fires": [],
        },
    ):
        response = app.test_client().get("/api/v2/spatial/active_fires/africa")

    assert response.status_code == 200
    assert response.get_json()["data"]["scope"] == "Africa"
