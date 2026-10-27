from pathlib import Path
import sys
from unittest.mock import Mock, patch


SPATIAL_ROOT = Path(__file__).resolve().parents[1]
if str(SPATIAL_ROOT) not in sys.path:
    sys.path.insert(0, str(SPATIAL_ROOT))

from models.site_category_model import SiteCategoryModel
from models.site_selection_model import SiteCategoryModel as SelectionSiteCategoryModel
from utils.geocoding import ReverseGeocodingService


def setup_function():
    ReverseGeocodingService.clear_cache()
    ReverseGeocodingService._last_request_at = 0.0


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


def test_reverse_geocoding_returns_fast_fallback_when_busy():
    service = ReverseGeocodingService()
    unavailable_lock = Mock()
    unavailable_lock.acquire.return_value = False

    with (
        patch.object(ReverseGeocodingService, "_request_lock", unavailable_lock),
        patch("utils.geocoding.requests.get") as request,
    ):
        result = service.reverse(0.3476, 32.5825)

    assert result == {"_error": "reverse_geocoder_busy"}
    request.assert_not_called()
