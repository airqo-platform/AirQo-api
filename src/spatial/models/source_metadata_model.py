"""Rule-based pollution-source metadata with optional atmospheric evidence.

This file intentionally keeps the first implementation self-contained. The
functions below can later be split into route, validation, spatial, satellite,
environment, and inference service modules without changing the API contract.
"""

import math
from statistics import mean
from typing import Dict, List, Optional, Tuple

import geopandas as gpd
import requests
from shapely.geometry import Point

from configure import Config

try:
    from models.site_category_model import SiteCategoryModel
except Exception:  # pragma: no cover - import should normally work in Flask app
    SiteCategoryModel = None


SATELLITE_PROVIDER_NAME = "Copernicus Atmosphere Monitoring Service (CAMS)"
SATELLITE_PROVIDER_DESCRIPTION = (
    "Free Copernicus Atmosphere Monitoring Service atmospheric composition data "
    "from atmosphere.copernicus.eu / Atmosphere Data Store; no Google Earth Engine."
)

CAMS_FIELD_MAP = {
    "nitrogen_dioxide": "NO2",
    "sulphur_dioxide": "SO2",
    "carbon_monoxide": "CO",
    "ozone": "O3",
    "methane": "CH4",
    "formaldehyde": "HCHO",
    "aerosol_optical_depth_550nm": "AOD",
    "dust_aerosol_optical_depth_550nm": "Dust_AOD",
}


def validate_coordinates(latitude, longitude) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    """Validate and coerce latitude/longitude request inputs."""
    if latitude is None or longitude is None:
        return None, None, "Latitude and longitude are required."

    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return None, None, "Latitude and longitude must be numbers."

    if not math.isfinite(lat) or not math.isfinite(lon):
        return None, None, "Latitude and longitude must be finite numbers."
    if lat < -90 or lat > 90:
        return None, None, "Latitude must be between -90 and 90."
    if lon < -180 or lon > 180:
        return None, None, "Longitude must be between -180 and 180."
    return lat, lon, None


def parse_boolean(value, default=False) -> bool:
    """Parse common boolean query/body values."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    return default


def create_point_buffer(lat, lon, buffer_radius_m=1000):
    """Create a metric point buffer around latitude/longitude."""
    point = gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326")
    metric_point = point.to_crs(epsg=3857)
    return metric_point.buffer(buffer_radius_m).to_crs(epsg=4326).iloc[0]


def _score_to_level(score: float) -> str:
    if score >= 0.67:
        return "high"
    if score >= 0.34:
        return "medium"
    return "low"


def exposure_level(score):
    """Return low/medium/high exposure label for a 0..1 score."""
    return _score_to_level(float(score or 0.0))


def _fallback_features(lat, lon, buffer_radius_m=1000) -> Dict:
    """Return stable fallback spatial features when OSM lookups are unavailable."""
    urban_seed = abs(math.sin(math.radians(lat * 13.0)) + math.cos(math.radians(lon * 7.0))) / 2
    urbanization_score = max(0.35, min(0.9, round(0.55 + urban_seed * 0.35, 2)))
    road_density_score = max(0.25, min(0.85, round(urbanization_score - 0.06, 2)))
    building_density_score = max(0.25, min(0.8, round(urbanization_score - 0.13, 2)))

    return {
        "latitude": lat,
        "longitude": lon,
        "buffer_radius_m": buffer_radius_m,
        "landuse": "residential",
        "natural": None,
        "waterway": None,
        "highway": "primary" if road_density_score >= 0.65 else "residential",
        "site_category": "Urban Background",
        "area_name": None,
        "road_density_score": road_density_score,
        "building_density_score": building_density_score,
        "urbanization_score": urbanization_score,
        "distance_to_major_road_m": 120 if road_density_score >= 0.65 else 650,
        "industrial_poi_count": 0,
        "industrial_landuse": False,
        "commercial_landuse": False,
        "agricultural_landuse": False,
        "wetland_or_waterbody": False,
    }


def extract_spatial_features(lat, lon, buffer_radius_m=1000) -> Dict:
    """Extract spatial context from OSM, with a deterministic fallback."""
    features = _fallback_features(lat, lon, buffer_radius_m)
    features["buffer_geometry"] = create_point_buffer(lat, lon, buffer_radius_m)

    if SiteCategoryModel is None:
        return features

    try:
        site_model = SiteCategoryModel(category=None)
        (
            category,
            _search_radius,
            area_name,
            landuse,
            natural,
            waterway,
            highway,
            _debug_info,
        ) = site_model.categorize_site_osm(lat, lon)
    except Exception:
        return features

    landuse_value = (landuse or features["landuse"] or "").strip().lower()
    highway_value = (highway or features["highway"] or "").strip().lower()
    natural_value = (natural or "").strip().lower() or None

    major_roads = {"motorway", "trunk", "primary", "secondary"}
    local_roads = {"tertiary", "residential", "unclassified", "service"}
    industrial = landuse_value in {"industrial", "quarry", "mine"}
    commercial = landuse_value in {"commercial", "retail"}
    agricultural = landuse_value in {"farmland", "farmyard", "orchard", "greenhouse_horticulture"}
    waterbody = bool(waterway) or natural_value in {"water", "wetland", "bay"}

    if highway_value in major_roads:
        road_density_score = 0.78
        distance_to_major_road_m = 80
    elif highway_value in local_roads:
        road_density_score = 0.52
        distance_to_major_road_m = 420
    else:
        road_density_score = features["road_density_score"]
        distance_to_major_road_m = features["distance_to_major_road_m"]

    building_density_score = 0.74 if landuse_value in {"residential", "commercial", "retail"} else 0.38
    if industrial:
        building_density_score = 0.58
    urbanization_score = max(road_density_score, building_density_score)
    if agricultural or waterbody:
        urbanization_score = min(urbanization_score, 0.32)

    features.update(
        {
            "landuse": landuse_value or features["landuse"],
            "natural": natural_value,
            "waterway": waterway,
            "highway": highway_value,
            "site_category": category or features["site_category"],
            "area_name": area_name,
            "road_density_score": round(road_density_score, 2),
            "building_density_score": round(building_density_score, 2),
            "urbanization_score": round(urbanization_score, 2),
            "distance_to_major_road_m": distance_to_major_road_m,
            "industrial_poi_count": 1 if industrial else 0,
            "industrial_landuse": industrial,
            "commercial_landuse": commercial,
            "agricultural_landuse": agricultural,
            "wetland_or_waterbody": waterbody,
        }
    )
    return features


def _mean_numeric(values) -> Optional[float]:
    numeric_values = []
    for value in values or []:
        try:
            if value is None:
                continue
            numeric = float(value)
            if math.isfinite(numeric):
                numeric_values.append(numeric)
        except (TypeError, ValueError):
            continue
    return round(mean(numeric_values), 6) if numeric_values else None


def _request_cams_point_data(lat, lon, buffer_radius_m) -> Optional[Dict]:
    """Request a point/buffer summary from a configured CAMS data service.

    The public Atmosphere Data Store primarily serves gridded files/jobs. For a
    low-latency API endpoint, configure ``CAMS_POINT_DATA_URL`` to point at an
    AirQo-owned or hosted service that pre-processes free CAMS data into point
    summaries. If it is unset, the source-metadata endpoint reports satellite
    data as unavailable instead of falling back to paid Google Earth Engine.
    """
    if not Config.CAMS_POINT_DATA_URL:
        return None

    headers = {}
    if Config.CAMS_API_KEY:
        headers["Authorization"] = f"Bearer {Config.CAMS_API_KEY}"

    params = {
        "latitude": lat,
        "longitude": lon,
        "buffer_radius_m": buffer_radius_m,
        "dataset": Config.CAMS_DATASET,
        "variables": ",".join(Config.CAMS_VARIABLES),
    }
    response = requests.get(
        Config.CAMS_POINT_DATA_URL,
        headers=headers,
        params=params,
        timeout=Config.CAMS_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def _extract_cams_pollutants(payload) -> Optional[Dict]:
    """Normalize CAMS point-summary payloads into the API pollutant schema."""
    if not payload:
        return None

    if isinstance(payload, dict) and isinstance(payload.get("pollutants"), dict):
        payload = payload["pollutants"]
    if isinstance(payload, dict) and isinstance(payload.get("satellite_pollutants_mean"), dict):
        payload = payload["satellite_pollutants_mean"]
    if not isinstance(payload, dict):
        return None

    pollutants = {name: None for name in ["NO2", "SO2", "CO", "O3", "CH4", "HCHO", "AOD", "Aerosol_Index"]}
    for raw_key, raw_value in payload.items():
        key = str(raw_key).strip()
        pollutant = CAMS_FIELD_MAP.get(key, key.upper())
        pollutant_key = pollutant.upper()
        if pollutant not in pollutants and pollutant_key != "DUST_AOD":
            continue
        value = raw_value.get("mean") if isinstance(raw_value, dict) else raw_value
        if pollutant_key == "DUST_AOD":
            dust_aod = _mean_numeric(value if isinstance(value, list) else [value])
            if dust_aod is not None:
                pollutants["Aerosol_Index"] = round(min(dust_aod * 2.0, 5.0), 6)
            continue
        pollutants[pollutant] = _mean_numeric(value if isinstance(value, list) else [value])
    return pollutants if any(value is not None for value in pollutants.values()) else None


def fetch_satellite_pollutants(lat, lon, buffer_radius_m=1000) -> Optional[Dict]:
    """Fetch satellite-assimilated atmospheric pollutant means.

    The current provider is Copernicus Atmosphere Monitoring Service (CAMS).
    Configure ``CAMS_POINT_DATA_URL`` for a preprocessed free CAMS point-summary
    service. Return ``None`` when data is unavailable so the API can degrade
    gracefully.
    """
    if lat is None or lon is None or buffer_radius_m <= 0:
        return None
    if Config.SOURCE_METADATA_SATELLITE_PROVIDER != "cams":
        return None
    if Config.CAMS_USE_MOCK_DATA:
        return {
            "NO2": 48.0,
            "SO2": 12.0,
            "CO": 620.0,
            "O3": 112.0,
            "CH4": 1810.0,
            "HCHO": None,
            "AOD": 0.24,
            "Aerosol_Index": 0.65,
        }
    payload = _request_cams_point_data(lat, lon, buffer_radius_m)
    return _extract_cams_pollutants(payload)


def classify_environment(features) -> str:
    """Classify the surrounding environment from spatial features."""
    if features.get("wetland_or_waterbody"):
        return "wetland_or_waterbody"
    if features.get("industrial_landuse") or features.get("industrial_poi_count", 0) > 0:
        return "industrial"
    if features.get("agricultural_landuse"):
        return "agricultural"
    if features.get("distance_to_major_road_m", 9999) <= 150:
        return "roadside"
    if features.get("commercial_landuse"):
        return "commercial"
    if features.get("urbanization_score", 0) >= 0.7 and features.get("landuse") == "residential":
        return "urban_residential"
    if features.get("urbanization_score", 0) >= 0.6:
        return "mixed_urban"
    if features.get("urbanization_score", 0) >= 0.35:
        return "peri_urban"
    return "rural"


def _add(scores, evidence, source, amount, reason):
    scores[source] = scores.get(source, 0.0) + amount
    evidence.setdefault(source, [])
    if reason not in evidence[source]:
        evidence[source].append(reason)


def _is_elevated(value, threshold) -> bool:
    try:
        return value is not None and float(value) > threshold
    except (TypeError, ValueError):
        return False


def infer_candidate_sources(features, satellite_pollutants=None) -> List[Dict]:
    """Infer ranked candidate pollution sources from spatial and satellite evidence."""
    sources = [
        "traffic",
        "industrial_activity",
        "biomass_burning",
        "residential_cooking",
        "waste_burning",
        "mixed_urban",
        "dust",
        "agriculture",
        "landfill_or_waste_site",
        "regional_pollution",
    ]
    scores = {source: 0.0 for source in sources}
    evidence = {source: [] for source in sources}

    road_score = features.get("road_density_score", 0.0)
    building_score = features.get("building_density_score", 0.0)
    landuse = (features.get("landuse") or "").lower()

    if road_score >= 0.65:
        _add(scores, evidence, "traffic", 0.46, "high road density")
    elif road_score >= 0.35:
        _add(scores, evidence, "traffic", 0.22, "moderate road density")
    if features.get("distance_to_major_road_m", 9999) <= 200:
        _add(scores, evidence, "traffic", 0.22, "near major road")

    if features.get("industrial_landuse") or features.get("industrial_poi_count", 0) > 0:
        _add(scores, evidence, "industrial_activity", 0.52, "industrial landuse or POIs")
    if landuse in {"commercial", "retail"}:
        _add(scores, evidence, "mixed_urban", 0.25, "commercial landuse")
    if landuse == "residential":
        _add(scores, evidence, "residential_cooking", 0.18, "residential landuse")
    if building_score >= 0.6:
        _add(scores, evidence, "mixed_urban", 0.25, "dense buildings")
        _add(scores, evidence, "residential_cooking", 0.08, "dense residential buildings")
    if features.get("agricultural_landuse"):
        _add(scores, evidence, "agriculture", 0.45, "agricultural landuse")
        _add(scores, evidence, "biomass_burning", 0.08, "seasonal biomass burning potential")
    if features.get("natural") in {"bare_rock", "scrub", "heath"}:
        _add(scores, evidence, "dust", 0.18, "dust-prone natural surface")
    if features.get("wetland_or_waterbody"):
        _add(scores, evidence, "regional_pollution", 0.08, "wetland or waterbody context")

    if satellite_pollutants:
        if _is_elevated(satellite_pollutants.get("NO2"), 40):
            _add(scores, evidence, "traffic", 0.2, "elevated NO2")
            _add(scores, evidence, "industrial_activity", 0.08, "combustion NO2 signal")
        if _is_elevated(satellite_pollutants.get("SO2"), 20):
            _add(scores, evidence, "industrial_activity", 0.28, "elevated SO2")
        if _is_elevated(satellite_pollutants.get("CO"), 500):
            _add(scores, evidence, "biomass_burning", 0.22, "elevated CO")
            _add(scores, evidence, "traffic", 0.08, "CO combustion signal")
            _add(scores, evidence, "residential_cooking", 0.08, "CO combustion signal")
        if _is_elevated(satellite_pollutants.get("O3"), 100):
            _add(scores, evidence, "regional_pollution", 0.16, "elevated O3")
        if _is_elevated(satellite_pollutants.get("CH4"), 1800):
            _add(scores, evidence, "landfill_or_waste_site", 0.2, "elevated CH4")
            _add(scores, evidence, "agriculture", 0.12, "elevated CH4")
            _add(scores, evidence, "waste_burning", 0.08, "elevated CH4")
        if _is_elevated(satellite_pollutants.get("HCHO"), 30):
            _add(scores, evidence, "biomass_burning", 0.12, "elevated HCHO")
            _add(scores, evidence, "mixed_urban", 0.1, "urban VOC signal")
            _add(scores, evidence, "industrial_activity", 0.08, "VOC-related industrial signal")
        if _is_elevated(satellite_pollutants.get("Aerosol_Index"), 0.3) or _is_elevated(
            satellite_pollutants.get("AOD"), 0.2
        ):
            _add(scores, evidence, "dust", 0.16, "aerosol signal present")
            _add(scores, evidence, "biomass_burning", 0.12, "aerosol signal present")
            _add(scores, evidence, "mixed_urban", 0.08, "aerosol signal present")
        if _is_elevated(satellite_pollutants.get("Dust"), 60):
            _add(scores, evidence, "dust", 0.2, "elevated dust")

    normalized = normalize_scores(scores)
    return [
        {
            "source_type": source,
            "confidence": confidence,
            "evidence": evidence[source],
        }
        for source, confidence in sorted(normalized.items(), key=lambda item: item[1], reverse=True)
        if confidence > 0
    ]


def normalize_scores(scores) -> Dict[str, float]:
    """Normalize non-zero scores to rounded confidences that sum to exactly 1.0."""
    positive = {key: max(float(value or 0.0), 0.0) for key, value in scores.items() if value and value > 0}
    total = sum(positive.values())
    if total <= 0:
        return {}

    normalized = {key: round(value / total, 4) for key, value in positive.items()}
    delta = round(1.0 - sum(normalized.values()), 4)
    if normalized and delta:
        top_key = max(normalized, key=normalized.get)
        normalized[top_key] = round(normalized[top_key] + delta, 4)
    return normalized


def _device_context(features) -> Dict:
    environment_type = classify_environment(features)
    road_score = features.get("road_density_score", 0.0)
    building_score = features.get("building_density_score", 0.0)
    industrial_score = 0.85 if features.get("industrial_landuse") else 0.15

    return {
        "environment_type": environment_type,
        "urbanization_score": features.get("urbanization_score", 0.0),
        "traffic_exposure": exposure_level(road_score),
        "industrial_exposure": exposure_level(industrial_score),
        "landuse": features.get("landuse"),
        "road_density_score": road_score,
        "building_density_score": building_score,
    }


class SourceMetadataModel:
    """Build source-attribution metadata for a latitude/longitude point."""

    def build_source_metadata(
        self,
        latitude: float,
        longitude: float,
        buffer_radius_m: int = 1000,
        satellite: bool = False,
        **_kwargs,
    ) -> Dict:
        """Build the response for ``GET /api/v2/spatial/source_metadata``."""
        satellite_enabled = satellite
        features = extract_spatial_features(latitude, longitude, buffer_radius_m)

        satellite_pollutants = None
        satellite_metadata = None
        if satellite_enabled:
            try:
                satellite_pollutants = fetch_satellite_pollutants(
                    latitude, longitude, buffer_radius_m
                )
            except Exception:
                satellite_pollutants = None
            satellite_metadata = {
                "source": SATELLITE_PROVIDER_NAME,
                "provider_description": SATELLITE_PROVIDER_DESCRIPTION,
                "base_url": Config.CAMS_BASE_URL,
                "ads_api_url": Config.CAMS_ADS_API_URL,
                "dataset": Config.CAMS_DATASET,
                "variables": Config.CAMS_VARIABLES,
                "aggregation": "mean_within_buffer",
                "buffer_radius_m": buffer_radius_m,
                "status": "available" if satellite_pollutants else "unavailable",
            }

        candidate_sources = infer_candidate_sources(features, satellite_pollutants)

        response = {
            "location": {"latitude": latitude, "longitude": longitude},
            "device_context": _device_context(features),
            "satellite_enabled": bool(satellite_enabled),
            "satellite_pollutants_mean": satellite_pollutants if satellite_enabled else None,
            "candidate_sources": candidate_sources,
            "method": (
                "rule_based_spatial_and_satellite_inference"
                if satellite_enabled and satellite_pollutants
                else "rule_based_spatial_inference"
            ),
            "spatial_layer": "GeoPandas + Shapely + OSMnx",
            "buffer_radius_m": buffer_radius_m,
        }
        if satellite_enabled:
            response["satellite_metadata"] = satellite_metadata
            response["satellite_layer"] = SATELLITE_PROVIDER_NAME
        return response
