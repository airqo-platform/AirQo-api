from pathlib import Path
import sys
from unittest.mock import patch

from flask import Flask


SPATIAL_ROOT = Path(__file__).resolve().parents[1]
if str(SPATIAL_ROOT) not in sys.path:
    sys.path.insert(0, str(SPATIAL_ROOT))

from models.site_category_model import SiteCategoryModel
from models.sentinel2_context_model import Sentinel2ContextModel
from models.SatellitePredictionModel import SatellitePredictionModel
from models.source_metadata_model import SourceMetadataModel
from configure import _resolve_credentials_path
from views.site_category_view import SiteCategorizationView
from views.satellite_predictions import SatellitePredictionView


def setup_function():
    SiteCategoryModel._SITE_CATEGORY_CACHE.clear()
    Sentinel2ContextModel._CACHE.clear()


def _reverse_result(address=None):
    return {
        "display_name": "Test place",
        "category": "place",
        "type": "suburb",
        "address": address or {"suburb": "Test suburb", "city": "Kampala"},
    }


def test_categorization_maps_major_highway_to_urban_commercial():
    model = SiteCategoryModel()
    model.search_radius_m = 500

    with (
        patch.object(model, "_reverse_geocode", return_value=_reverse_result()),
        patch.object(
            model,
            "_overpass_query",
            return_value=(
                [
                    {
                        "type": "node",
                        "id": 42,
                        "lat": 0.3226,
                        "lon": 32.5847,
                        "tags": {"highway": "primary", "name": "Test Road"},
                    }
                ],
                "https://overpass.test",
                [],
            ),
        ),
    ):
        result = model.categorize_site_osm(0.3225, 32.5847)

    assert result[0] == "Urban Commercial"
    assert result[6] == "primary"
    assert model.last_details["matched_feature"]["osm_type"] == "node"
    assert model.last_details["confidence"] > 0.9


def test_site_categorization_response_distinguishes_search_radius_from_distance():
    app = Flask(__name__)
    result = (
        "Urban Commercial",
        608.71,
        "Test Area",
        None,
        None,
        None,
        "primary",
        ["OSM context"],
    )
    details = {
        "search_radius_m": 500,
        "classification_method": "overpass",
    }

    def fake_categorize(model, latitude, longitude):
        model.last_details = details
        return result

    with (
        app.test_request_context("/?latitude=0.3&longitude=32.5"),
        patch.object(SiteCategoryModel, "categorize_site_osm", fake_categorize),
    ):
        response, status = SiteCategorizationView.get_site_categorization()

    payload = response.get_json()["site"]["site-category"]
    assert status == 200
    assert payload["search_radius_m"] == 500
    assert payload["matched_feature_distance_m"] == 608.71
    assert "search_radius" not in payload


def test_categorization_maps_water_to_background_site():
    category, _, reason = SiteCategoryModel._classify_tags(
        {"natural": "water"}
    )

    assert category == "Background Site"
    assert "water feature" in reason


def test_categorization_rules_only_return_supported_categories():
    representative_tags = (
        {"highway": "primary"},
        {"landuse": "industrial"},
        {"natural": "water"},
        {"landuse": "forest"},
        {"highway": "residential"},
        {"amenity": "school"},
        {"railway": "station"},
    )

    categories = {
        SiteCategoryModel._classify_tags(tags)[0]
        for tags in representative_tags
    }

    assert categories <= SiteCategoryModel.SITE_CATEGORIES


def test_categorization_uses_useful_fallback_instead_of_unknown_category():
    model = SiteCategoryModel()

    with (
        patch.object(
            model,
            "_reverse_geocode",
            return_value=_reverse_result({"village": "Rural village", "country": "Uganda"}),
        ),
        patch.object(model, "_overpass_query", return_value=([], None, ["timeout"])),
    ):
        result = model.categorize_site_osm(1.0, 32.0)

    assert result[0] == "Background Site"
    assert result[0] != "Unknown_Category"
    assert model.last_details["classification_method"] == "nominatim"


def test_source_metadata_uses_free_sentinel2_context():
    category_result = (
        "Urban Commercial",
        12.0,
        "Industrial Area",
        "industrial",
        None,
        None,
        None,
        ["OSM context"],
    )
    details = {
        "classification_method": "overpass",
        "confidence": 0.95,
        "matched_feature": {
            "osm_type": "way",
            "osm_id": 99,
            "name": "Industrial Area",
            "tags": {"landuse": "industrial", "man_made": "works"},
        },
        "nearby_feature_counts": {"building": 20, "man_made": 3},
        "elapsed_ms": 25.0,
        "cache_hit": False,
    }

    def fake_categorize(model, latitude, longitude):
        model.last_details = details
        return category_result

    sentinel_context = {
        "provider": "Element 84 Earth Search",
        "collection": "sentinel-2-l2a",
        "scene_id": "test-scene",
        "scene_datetime": "2026-06-01T08:00:00+00:00",
        "scene_cloud_cover": 2.0,
        "scene_classification": 5,
        "indices": {
            "ndvi": 0.08,
            "ndbi": 0.24,
            "ndwi": -0.2,
            "bare_soil_index": 0.18,
            "normalized_burn_ratio": 0.04,
        },
        "aerosol_optical_thickness": 0.3,
        "elapsed_ms": 50.0,
        "cache_hit": False,
    }

    with (
        patch.object(SiteCategoryModel, "categorize_site_osm", fake_categorize),
        patch.object(
            Sentinel2ContextModel,
            "get_context",
            return_value=sentinel_context,
        ),
    ):
        result = SourceMetadataModel().build_source_metadata(
            latitude=0.3,
            longitude=32.5,
            include_satellite=True,
        )

    assert result["primary_source"]["source_type"] == "industrial"
    assert result["metadata"]["satellite_data_used"] is True
    assert result["evidence"]["sentinel2_context"]["scene_id"] == "test-scene"


def test_source_metadata_falls_back_when_sentinel2_is_unavailable():
    category_result = (
        "Urban Background",
        20.0,
        "Test Area",
        None,
        None,
        None,
        "residential",
        ["OSM context"],
    )
    details = {
        "classification_method": "overpass",
        "confidence": 0.8,
        "matched_feature": {
            "osm_type": "way",
            "osm_id": 10,
            "name": "Local Road",
            "tags": {"highway": "residential"},
        },
        "nearby_feature_counts": {"highway": 4},
        "elapsed_ms": 10.0,
        "cache_hit": False,
    }

    def fake_categorize(model, latitude, longitude):
        model.last_details = details
        return category_result

    with (
        patch.object(SiteCategoryModel, "categorize_site_osm", fake_categorize),
        patch.object(
            Sentinel2ContextModel,
            "get_context",
            side_effect=LookupError("No cloud-free scene"),
        ),
    ):
        result = SourceMetadataModel().build_source_metadata(
            latitude=0.3,
            longitude=32.5,
            include_satellite=True,
        )

    assert result["primary_source"]["source_type"] in {"traffic", "mixed_urban"}
    assert result["primary_source"]["confidence"] > 0
    assert result["metadata"]["satellite_data_used"] is False
    assert result["evidence"]["sentinel2_error"] == "No cloud-free scene"


def test_satellite_prediction_uses_declared_sentinel2_feature_schema():
    class CompatibleModel:
        feature_names_in_ = ["ndvi", "aerosol_optical_thickness", "latitude"]

        def predict(self, data):
            assert list(data.columns) == list(self.feature_names_in_)
            return [24.5]

    context = {
        "scene_id": "test-scene",
        "scene_datetime": "2026-06-01T08:00:00+00:00",
        "scene_cloud_cover": 3.0,
        "indices": {
            "ndvi": 0.35,
            "ndbi": 0.05,
            "ndwi": -0.2,
            "bare_soil_index": 0.04,
            "normalized_burn_ratio": 0.2,
        },
        "aerosol_optical_thickness": 0.12,
    }

    with patch.object(
        Sentinel2ContextModel,
        "get_context",
        return_value=context,
    ):
        prediction, features, returned_context = SatellitePredictionModel.predict(
            model=CompatibleModel(),
            latitude=0.3,
            longitude=32.5,
        )

    assert prediction == 24.5
    assert features["ndvi"] == 0.35
    assert returned_context["scene_id"] == "test-scene"


def test_satellite_prediction_adds_date_and_weather_for_weather_schema():
    class WeatherModel:
        feature_names_in_ = [
            "temperature",
            "humidity",
            "year",
            "month",
            "day",
        ]

        def predict(self, data):
            assert list(data.columns) == list(self.feature_names_in_)
            assert data.loc[0, "temperature"] == 24.25
            assert data.loc[0, "humidity"] == 71.5
            assert data.loc[0, "year"] == 2026
            assert data.loc[0, "month"] == 6
            assert data.loc[0, "day"] == 20
            return [18.75]

    class WeatherResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "properties": {
                    "parameter": {
                        "T2M": {"20260620": 24.25},
                        "RH2M": {"20260620": 71.5},
                    }
                }
            }

    context = {
        "scene_id": "test-scene",
        "scene_datetime": "2026-06-20T08:00:00+00:00",
        "scene_cloud_cover": 3.0,
        "indices": {
            "ndvi": 0.35,
            "ndbi": 0.05,
            "ndwi": -0.2,
            "bare_soil_index": 0.04,
            "normalized_burn_ratio": 0.2,
        },
        "aerosol_optical_thickness": 0.12,
    }

    with (
        patch.object(
            Sentinel2ContextModel,
            "get_context",
            return_value=context,
        ) as get_context,
        patch(
            "models.SatellitePredictionModel.requests.get",
            return_value=WeatherResponse(),
        ) as get_weather,
    ):
        prediction, features, _ = SatellitePredictionModel.predict(
            model=WeatherModel(),
            latitude=0.3476,
            longitude=32.5825,
            date="2026-06-20",
        )

    assert prediction == 18.75
    assert features["requested_date"] == "2026-06-20"
    assert features["weather_source"] == "NASA POWER"
    assert features["air_temperature"] == 24.25
    assert features["relative_humidity"] == 71.5
    get_context.assert_called_once_with(
        latitude=0.3476,
        longitude=32.5825,
        start_date=None,
        end_date="2026-06-20",
    )
    assert "20260620" in get_weather.call_args.args[0]


def test_satellite_prediction_view_returns_daily_pm25_for_starttime_endtime():
    app = Flask(__name__)

    class Model:
        pass

    def fake_predict(model, latitude, longitude, date):
        return (
            20.0 if date == "2026-06-20" else 21.0,
            {
                "requested_date": date,
                "weather_source": "NASA POWER",
            },
            {
                "scene_id": f"scene-{date}",
                "scene_datetime": f"{date}T08:00:00+00:00",
            },
        )

    payload = {
        "latitude": 0.3476,
        "longitude": 32.5825,
        "starttime": "2026-06-20",
        "endtime": "2026-06-21",
    }

    with (
        app.test_request_context(
            "/satellite_prediction",
            method="POST",
            json=payload,
        ),
        patch(
            "views.satellite_predictions.get_trained_model_from_gcs",
            return_value=(Model(), None),
        ),
        patch(
            "views.satellite_predictions.SatellitePredictionModel.predict",
            side_effect=fake_predict,
        ) as predict,
        patch.object(SatellitePredictionView, "_save_prediction", return_value=False),
    ):
        response, status = SatellitePredictionView.make_predictions()

    body = response.get_json()
    assert status == 200
    assert body["starttime"] == "2026-06-20"
    assert body["endtime"] == "2026-06-21"
    assert body["count"] == 2
    assert body["max_days"] == 30
    assert [item["date"] for item in body["daily_pm2_5"]] == [
        "2026-06-20",
        "2026-06-21",
    ]
    assert [item["pm2_5_prediction"] for item in body["daily_pm2_5"]] == [
        20.0,
        21.0,
    ]
    assert [call.kwargs["date"] for call in predict.call_args_list] == [
        "2026-06-20",
        "2026-06-21",
    ]


def test_satellite_prediction_view_rejects_ranges_over_30_days_before_model_load():
    app = Flask(__name__)
    payload = {
        "latitude": 0.3476,
        "longitude": 32.5825,
        "starttime": "2026-06-01",
        "endtime": "2026-07-01",
    }

    with (
        app.test_request_context(
            "/satellite_prediction",
            method="POST",
            json=payload,
        ),
        patch("views.satellite_predictions.get_trained_model_from_gcs") as load_model,
    ):
        response, status = SatellitePredictionView.make_predictions()

    assert status == 400
    assert "30 days" in response.get_json()["error"]
    load_model.assert_not_called()


def test_satellite_prediction_rejects_legacy_model_schema():
    class LegacyModel:
        feature_names_in_ = [
            "COPERNICUS/S5P/OFFL/L3_NO2_NO2_column_number_density"
        ]

    try:
        SatellitePredictionModel.prepare_model_input(
            LegacyModel(),
            {"ndvi": 0.3},
        )
    except ValueError as error:
        assert "incompatible" in str(error)
        assert "NO2_column_number_density" in str(error)
    else:
        raise AssertionError("Expected incompatible legacy model schema to fail")


def test_spatial_credentials_resolve_from_supported_mount(tmp_path, monkeypatch):
    credentials = tmp_path / "google_application_credentials.json"
    credentials.write_text("{}", encoding="utf-8")
    monkeypatch.chdir(tmp_path)

    assert _resolve_credentials_path("google_application_credentials.json") == str(
        credentials
    )
