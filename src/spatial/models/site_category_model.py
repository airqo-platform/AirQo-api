"""Fast, dependency-light site categorization from OpenStreetMap context."""

from concurrent.futures import ThreadPoolExecutor
import logging
import math
import os
import time
from collections import Counter

import requests

from configure import Config


logger = logging.getLogger(__name__)


class SiteCategoryModel:
    """Classify a coordinate using Overpass features and Nominatim context.

    The public ``categorize_site_osm`` tuple is retained for existing callers.
    Additional response metadata is available through ``last_details``.
    """

    _SITE_CATEGORY_CACHE = {}
    _CACHE_MAX_ITEMS = 5000
    SITE_CATEGORIES = {
        "Background Site",
        "Urban Background",
        "Urban Commercial",
    }

    MAJOR_HIGHWAYS = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary"}
    LOCAL_HIGHWAYS = {"residential", "living_street", "unclassified", "tertiary", "service"}
    COMMERCIAL_LANDUSE = {"commercial", "retail", "industrial", "construction", "quarry", "mine"}
    BACKGROUND_LANDUSE = {
        "allotments", "farmland", "farmyard", "forest", "grass", "meadow",
        "orchard", "park", "recreation_ground", "scrub", "vineyard",
    }
    BACKGROUND_NATURAL = {"bare_rock", "grassland", "heath", "scrub", "tree", "tree_row", "wood"}
    WATER_NATURAL = {"bay", "lake", "reservoir", "water", "wetland"}
    URBAN_AMENITIES = {
        "bus_station", "clinic", "college", "fuel", "hospital", "marketplace",
        "parking", "school", "university",
    }
    SOURCE_TAGS = (
        "landuse", "natural", "waterway", "highway", "amenity", "shop",
        "office", "man_made", "industrial", "power", "aeroway", "railway",
    )

    def __init__(self, category=None):
        self.category = category
        self.overpass_urls = self._load_overpass_urls()
        self.timeout_seconds = max(2.0, float(os.getenv("SITE_CATEGORY_HTTP_TIMEOUT", "8")))
        self.search_radius_m = max(100, min(int(os.getenv("SITE_CATEGORY_SEARCH_RADIUS", "500")), 2000))
        self.cache_ttl_seconds = max(1, int(os.getenv("SITE_CATEGORY_CACHE_TTL", "3600")))
        self.user_agent = os.getenv(
            "SPATIAL_OSM_USER_AGENT",
            "AirQo-Spatial/2.0 (https://airqo.net)",
        )
        self.last_details = {}

    @staticmethod
    def _load_overpass_urls():
        raw_urls = getattr(Config, "OVERPASS_API_URLS", "") or ""
        urls = [url.strip() for url in raw_urls.split(",") if url.strip()]
        return urls or ["https://overpass-api.de/api/interpreter"]

    @staticmethod
    def _cache_key(latitude, longitude):
        return round(float(latitude), 5), round(float(longitude), 5)

    @classmethod
    def _get_cached_result(cls, latitude, longitude, ttl_seconds):
        key = cls._cache_key(latitude, longitude)
        cached = cls._SITE_CATEGORY_CACHE.get(key)
        if not cached:
            return None
        if time.monotonic() - cached["stored_at"] > ttl_seconds:
            cls._SITE_CATEGORY_CACHE.pop(key, None)
            return None
        return cached

    @classmethod
    def _set_cached_result(cls, latitude, longitude, value, details):
        if len(cls._SITE_CATEGORY_CACHE) >= cls._CACHE_MAX_ITEMS:
            oldest_key = min(
                cls._SITE_CATEGORY_CACHE,
                key=lambda key: cls._SITE_CATEGORY_CACHE[key]["stored_at"],
            )
            cls._SITE_CATEGORY_CACHE.pop(oldest_key, None)
        cls._SITE_CATEGORY_CACHE[cls._cache_key(latitude, longitude)] = {
            "stored_at": time.monotonic(),
            "value": value,
            "details": details,
        }

    def _request_json(self, method, url, **kwargs):
        headers = {"User-Agent": self.user_agent, "Accept": "application/json"}
        response = requests.request(
            method,
            url,
            headers=headers,
            timeout=(2.5, self.timeout_seconds),
            **kwargs,
        )
        response.raise_for_status()
        return response.json()

    def _reverse_geocode(self, latitude, longitude):
        try:
            return self._request_json(
                "GET",
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "zoom": 18,
                },
            )
        except Exception as error:
            logger.warning("Nominatim reverse lookup failed: %s", error)
            return {"_error": "reverse_geocode_failed"}

    def _overpass_query(self, latitude, longitude):
        local_radius = min(self.search_radius_m, 150)
        urban_radius = min(self.search_radius_m, 300)
        selectors = "\n".join(
            [
                f'nwr(around:{self.search_radius_m},{latitude},{longitude})["landuse"];',
                (
                    f'nwr(around:{self.search_radius_m},{latitude},{longitude})'
                    '["natural"~"^(water|wetland|wood|scrub|heath|bare_rock|grassland|sand)$"];'
                ),
                f'nwr(around:{self.search_radius_m},{latitude},{longitude})["waterway"];',
                f'way(around:{local_radius},{latitude},{longitude})["highway"];',
                (
                    f'nwr(around:{urban_radius},{latitude},{longitude})'
                    '["amenity"~"^(bus_station|clinic|college|fuel|hospital|marketplace|parking|'
                    'recycling|school|university|waste_disposal|waste_transfer_station)$"];'
                ),
                f'nwr(around:{urban_radius},{latitude},{longitude})["shop"];',
                f'nwr(around:{urban_radius},{latitude},{longitude})["office"];',
                (
                    f'nwr(around:{self.search_radius_m},{latitude},{longitude})'
                    '["man_made"~"^(chimney|petroleum_well|wastewater_plant|works)$"];'
                ),
                f'nwr(around:{self.search_radius_m},{latitude},{longitude})["industrial"];',
                (
                    f'nwr(around:{self.search_radius_m},{latitude},{longitude})'
                    '["power"~"^(generator|plant|substation)$"];'
                ),
                f'nwr(around:{urban_radius},{latitude},{longitude})["aeroway"];',
                f'nwr(around:{urban_radius},{latitude},{longitude})["railway"];',
            ]
        )
        query = f"[out:json][timeout:{math.ceil(self.timeout_seconds)}];({selectors});out center tags;"
        errors = []

        # Bound failover to two public endpoints to avoid multiplying latency.
        for url in self.overpass_urls[:2]:
            try:
                payload = self._request_json("POST", url, data={"data": query})
                return payload.get("elements", []), url, errors
            except Exception as error:
                errors.append(f"{url}: {error}")
                logger.warning("Overpass lookup failed via %s: %s", url, error)
        return [], None, errors

    @staticmethod
    def _haversine_m(lat1, lon1, lat2, lon2):
        radius = 6371000.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        d_phi = math.radians(lat2 - lat1)
        d_lambda = math.radians(lon2 - lon1)
        a = (
            math.sin(d_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
        )
        return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def _classify_tags(cls, tags):
        highway = tags.get("highway")
        landuse = tags.get("landuse")
        natural = tags.get("natural")
        waterway = tags.get("waterway")

        if highway in cls.MAJOR_HIGHWAYS:
            return "Urban Commercial", 100, f"major highway '{highway}'"
        if landuse in cls.COMMERCIAL_LANDUSE:
            return "Urban Commercial", 90, f"land use '{landuse}'"
        if tags.get("industrial") or tags.get("man_made") in {"chimney", "works", "petroleum_well"}:
            return "Urban Commercial", 88, "industrial infrastructure"
        if tags.get("power") in {"plant", "generator", "substation"}:
            return "Urban Commercial", 84, f"power infrastructure '{tags.get('power')}'"
        if natural in cls.WATER_NATURAL or waterway:
            return "Background Site", 80, f"water feature '{natural or waterway}'"
        if landuse in cls.BACKGROUND_LANDUSE or natural in cls.BACKGROUND_NATURAL:
            return "Background Site", 70, f"background feature '{landuse or natural}'"
        if highway in cls.LOCAL_HIGHWAYS:
            return "Urban Background", 65, f"local road '{highway}'"
        if tags.get("amenity") in cls.URBAN_AMENITIES or tags.get("shop") or tags.get("office"):
            return "Urban Background", 60, "urban point of interest"
        if tags.get("building") and tags.get("building") not in {"barn", "farm_auxiliary", "shed"}:
            return "Urban Background", 45, f"building '{tags.get('building')}'"
        if tags.get("railway") or tags.get("aeroway"):
            return "Urban Commercial", 55, "transport infrastructure"
        return None, 0, None

    @classmethod
    def _classify_reverse_result(cls, reverse_result):
        address = reverse_result.get("address") or {}
        tags = {
            "landuse": address.get("landuse"),
            "natural": address.get("natural"),
            "waterway": address.get("waterway"),
            "highway": reverse_result.get("type") if reverse_result.get("category") == "highway" else None,
        }
        category, priority, reason = cls._classify_tags(tags)
        if category:
            return category, priority, reason, tags
        if any(address.get(key) for key in ("city", "town", "suburb", "city_district")):
            return "Urban Background", 40, "reverse-geocoded urban settlement", tags
        if any(address.get(key) for key in ("village", "hamlet", "farm", "municipality")):
            return "Background Site", 35, "reverse-geocoded rural settlement", tags
        return "Background Site", 10, "low-density fallback; no stronger mapped feature found", tags

    @staticmethod
    def _element_coordinates(element):
        if "lat" in element and "lon" in element:
            return element["lat"], element["lon"]
        center = element.get("center") or {}
        return center.get("lat"), center.get("lon")

    @staticmethod
    def _area_name(reverse_result, matched_tags):
        address = reverse_result.get("address") or {}
        return (
            matched_tags.get("name")
            or address.get("suburb")
            or address.get("village")
            or address.get("town")
            or address.get("city")
            or address.get("county")
            or reverse_result.get("display_name")
        )

    def categorize_site_osm(self, latitude, longitude):
        started_at = time.perf_counter()
        cached = self._get_cached_result(latitude, longitude, self.cache_ttl_seconds)
        if cached:
            self.last_details = {**cached["details"], "cache_hit": True}
            return cached["value"]

        with ThreadPoolExecutor(max_workers=2) as executor:
            reverse_future = executor.submit(self._reverse_geocode, latitude, longitude)
            overpass_future = executor.submit(self._overpass_query, latitude, longitude)
            reverse_result = reverse_future.result()
            elements, overpass_url, overpass_errors = overpass_future.result()

        candidates = []
        feature_counts = Counter()
        for element in elements:
            tags = element.get("tags") or {}
            for tag_name in self.SOURCE_TAGS:
                if tags.get(tag_name):
                    feature_counts[tag_name] += 1
            category, priority, reason = self._classify_tags(tags)
            if not category:
                continue
            element_lat, element_lon = self._element_coordinates(element)
            distance = (
                self._haversine_m(latitude, longitude, element_lat, element_lon)
                if element_lat is not None and element_lon is not None
                else float(self.search_radius_m)
            )
            # Priority protects strong pollution-relevant features while distance
            # selects the most locally representative feature within each class.
            score = priority - min(distance / max(self.search_radius_m, 1), 1) * 20
            candidates.append((score, distance, category, reason, tags, element))

        if candidates:
            _, distance, category, reason, matched_tags, matched_element = max(
                candidates, key=lambda candidate: candidate[0]
            )
            method = "overpass"
            confidence = min(0.98, max(0.45, 0.98 - distance / (self.search_radius_m * 2)))
        else:
            category, priority, reason, matched_tags = self._classify_reverse_result(reverse_result)
            matched_element = None
            distance = None
            method = "nominatim" if not reverse_result.get("_error") else "heuristic_fallback"
            confidence = round(min(0.75, max(0.2, priority / 100)), 2)

        if category not in self.SITE_CATEGORIES:
            logger.warning("Unexpected site category %r; using Background Site", category)
            category = "Background Site"

        area_name = self._area_name(reverse_result, matched_tags)
        landuse = matched_tags.get("landuse")
        natural = matched_tags.get("natural")
        waterway = matched_tags.get("waterway")
        highway = matched_tags.get("highway")
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
        debug_info = [
            f"Classification method: {method}.",
            f"Reason: {reason}.",
            f"Evaluated {len(elements)} nearby OSM elements within {self.search_radius_m}m.",
        ]
        if overpass_errors:
            debug_info.append("Overpass failover: " + " | ".join(overpass_errors))
        if reverse_result.get("_error"):
            debug_info.append("Reverse-geocoder error: " + reverse_result["_error"])

        details = {
            "classification_method": method,
            "confidence": round(confidence, 3),
            "reason": reason,
            "matched_feature": {
                "osm_type": matched_element.get("type") if matched_element else None,
                "osm_id": matched_element.get("id") if matched_element else None,
                "name": matched_tags.get("name"),
                "tags": matched_tags,
            },
            "nearby_feature_counts": dict(feature_counts),
            "search_radius_m": self.search_radius_m,
            "osm_elements_evaluated": len(elements),
            "overpass_endpoint": overpass_url,
            "distance_note": (
                "Distance uses the OSM element center; linear and polygon features "
                "may physically extend closer to the coordinate."
            ),
            "elapsed_ms": elapsed_ms,
            "cache_hit": False,
        }
        result = (
            category,
            round(distance, 2) if distance is not None else None,
            area_name,
            landuse,
            natural,
            waterway,
            highway,
            debug_info,
        )
        self.last_details = details
        self._set_cached_result(latitude, longitude, result, details)
        return result
