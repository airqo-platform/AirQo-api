from pathlib import Path
import sys
from unittest.mock import Mock, patch

import pytest


SPATIAL_ROOT = Path(__file__).resolve().parents[1]
if str(SPATIAL_ROOT) not in sys.path:
    sys.path.insert(0, str(SPATIAL_ROOT))

from models.site_category_model import SiteCategoryModel
from models.site_selection_model import (
    SensorDeployment,
    SiteCategoryModel as SelectionSiteCategoryModel,
)
from utils.geocoding import ReverseGeocodingBusyError, ReverseGeocodingService


def setup_function():
    ReverseGeocodingService.clear_cache()
    ReverseGeocodingService._last_request_at = 0.0
    SiteCategoryModel._SITE_CATEGORY_CACHE.clear()


def test_reverse_geocoding_cache_is_shared_across_consumers():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "display_name": "Kampala, Uganda",
        "address": {"city": "Kampala", "country": "Uganda"},
    }
    service = ReverseGeocodingService()
    service.min_interval_seconds = 0

    with patch("utils.geocoding.requests.get", return_value=response) as request:
        first = service.reverse(0.3476, 32.5825)
        second = ReverseGeocodingService().reverse(0.3476, 32.5825)

    assert first == second
    request.assert_called_once()
    assert isinstance(SiteCategoryModel._GEOCODING_SERVICE, ReverseGeocodingService)
    assert isinstance(
        SelectionSiteCategoryModel.geocoding_service,
        ReverseGeocodingService,
    )


def test_reverse_geocoding_retries_then_raises_when_busy():
    service = ReverseGeocodingService()
    service.acquire_attempts = 3
    service.acquire_retry_delay_seconds = 0
    unavailable_lock = Mock()
    unavailable_lock.acquire.return_value = False

    with (
        patch.object(ReverseGeocodingService, "_request_lock", unavailable_lock),
        patch("utils.geocoding.requests.get") as request,
        pytest.raises(ReverseGeocodingBusyError),
    ):
        service.reverse(0.3476, 32.5825)

    assert unavailable_lock.acquire.call_count == 3
    request.assert_not_called()
    assert service._get_cached(service._cache_key(0.3476, 32.5825)) is None


def test_overpass_candidate_wins_when_reverse_geocoder_is_busy():
    model = SiteCategoryModel()
    element = {
        "type": "node",
        "id": 42,
        "lat": 0.3226,
        "lon": 32.5847,
        "tags": {"highway": "primary", "name": "Test Road"},
    }

    with (
        patch.object(
            model,
            "_reverse_geocode",
            side_effect=ReverseGeocodingBusyError("busy"),
        ),
        patch.object(model, "_overpass_query", return_value=([element], "test", [])),
    ):
        result = model.categorize_site_osm(0.3225, 32.5847)

    assert result[0] == "Urban Commercial"
    assert model.last_details["classification_method"] == "overpass"


def test_busy_geocoder_without_overpass_candidate_is_not_classified_or_cached():
    model = SiteCategoryModel()

    with (
        patch.object(
            model,
            "_reverse_geocode",
            side_effect=ReverseGeocodingBusyError("busy"),
        ),
        patch.object(model, "_overpass_query", return_value=([], None, [])),
        pytest.raises(ReverseGeocodingBusyError),
    ):
        model.categorize_site_osm(0.3225, 32.5847)

    assert SiteCategoryModel._SITE_CATEGORY_CACHE == {}


def test_legacy_site_selection_defers_busy_geocoding_without_dropping_site():
    deployment = SensorDeployment(
        {"coordinates": [[[32.57, 0.30], [32.60, 0.30], [32.60, 0.33], [32.57, 0.30]]]}
    )
    deployment.sites = [
        {
            "latitude": 0.31,
            "longitude": 32.58,
            "category": "Unknown",
            "area_name": "Unknown",
        }
    ]

    with patch.object(
        SelectionSiteCategoryModel.geocoding_service,
        "reverse",
        side_effect=ReverseGeocodingBusyError("busy"),
    ):
        deployment.categorize_sites(max_workers=1)

    assert len(deployment.sites) == 1
    assert deployment.sites[0]["category"] is None
    assert deployment.sites[0]["area_name"] is None
    assert deployment.sites[0]["geocoding_status"] == "deferred"
    assert deployment.get_category_counts() == {"Unenriched": 1}
