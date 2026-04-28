import logging
import os
import random
import time

import overpy
from configure import Config
from geopy.distance import geodesic
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError


logger = logging.getLogger(__name__)


# Initialize Nominatim geocoder
geolocator = Nominatim(user_agent="site_categorization_app")


class SiteCategoryModel:
    _SITE_CATEGORY_CACHE = {}
    MAJOR_HIGHWAY_TYPES = {"motorway", "trunk", "primary", "secondary", "service"}
    RESIDENTIAL_HIGHWAY_TYPES = {
        "residential",
        "living_street",
        "unclassified",
        "tertiary",
    }
    BACKGROUND_LANDUSE_TYPES = {
        "forest",
        "farmland",
        "grass",
        "meadow",
        "vineyard",
        "wetland",
        "park",
        "scrub",
        "heath",
        "orchard",
    }
    BACKGROUND_NATURAL_TYPES = {"forest", "wood", "scrub"}
    WATER_TYPES = {"water", "wetland", "lake", "river"}

    def __init__(self, category=None):
        # Initialize the class with an optional category
        self.category = category
        self.overpass_urls = self._load_overpass_urls()
        self.overpass_max_attempts = max(
            1, int(getattr(Config, "OVERPASS_MAX_ATTEMPTS", os.getenv("OVERPASS_MAX_ATTEMPTS", "3")))
        )
        self.overpass_base_delay = max(
            0.0,
            float(getattr(Config, "OVERPASS_RETRY_BASE_DELAY", os.getenv("OVERPASS_RETRY_BASE_DELAY", "0.25"))),
        )
        self.site_cache_ttl_seconds = max(
            1, int(getattr(Config, "SITE_CATEGORY_CACHE_TTL", os.getenv("SITE_CATEGORY_CACHE_TTL", "300")))
        )

    @staticmethod
    def _load_overpass_urls():
        raw_urls = getattr(Config, "OVERPASS_API_URLS", "") or ""
        urls = [url.strip() for url in raw_urls.split(",") if url.strip()]
        if urls:
            return urls
        return ["https://overpass-api.de/api/interpreter"]

    @staticmethod
    def _build_overpass_client(url):
        return overpy.Overpass(url=url)

    @staticmethod
    def _cache_key(latitude, longitude):
        return (round(float(latitude), 6), round(float(longitude), 6))

    @classmethod
    def _get_cached_site_result(cls, latitude, longitude, ttl_seconds):
        cache_key = cls._cache_key(latitude, longitude)
        cached_item = cls._SITE_CATEGORY_CACHE.get(cache_key)
        if not cached_item:
            return None

        if time.time() - cached_item["stored_at"] > ttl_seconds:
            cls._SITE_CATEGORY_CACHE.pop(cache_key, None)
            return None

        return cached_item["value"]

    @classmethod
    def _set_cached_site_result(cls, latitude, longitude, value):
        cls._SITE_CATEGORY_CACHE[cls._cache_key(latitude, longitude)] = {
            "stored_at": time.time(),
            "value": value,
        }

    @classmethod
    def _coerce_reverse_geocoder_tags(cls, address, location_raw):
        raw_class = (
            location_raw.get("class")
            or location_raw.get("category")
            or ""
        ).lower()
        raw_type = (location_raw.get("type") or "").lower()

        landuse = (address.get("landuse") or "").lower() or None
        natural = (address.get("natural") or "").lower() or None
        waterway = (address.get("waterway") or "").lower() or None
        highway = None

        if raw_class == "landuse" and raw_type:
            landuse = landuse or raw_type
        if raw_class == "natural" and raw_type:
            natural = natural or raw_type
        if raw_class == "waterway" and raw_type:
            waterway = waterway or raw_type

        if raw_class == "highway" and raw_type:
            highway = raw_type
        elif raw_type in cls.MAJOR_HIGHWAY_TYPES | cls.RESIDENTIAL_HIGHWAY_TYPES:
            highway = raw_type
        elif address.get("road"):
            # Reverse geocoder usually gives a road name, not an OSM class.
            # Map it to a generic local-road signal for downstream heuristics.
            highway = "residential"

        return landuse, natural, waterway, highway, raw_class, raw_type

    def get_location_name(self, latitude, longitude, retries=3, delay=2):
        """
        Use Nominatim to get a human-readable name for the location.
        Retries a few times in case of timeout or service error.
        """
        for attempt in range(retries):
            try:
                location = geolocator.reverse((latitude, longitude), exactly_one=True)
                if location:
                    return location.address
                return None
            except (GeocoderTimedOut, GeocoderServiceError) as e:
                print(f"Geocoding error: {e}, retry {attempt+1}/{retries}")
                time.sleep(delay * (2**attempt))  # exponential backoff
            except Exception as e:
                print(f"Unexpected geocoding error: {e}")
                return None
        return None

    @classmethod
    def _determine_category_from_address(cls, address, location_raw):
        """Infer a coarse site category from reverse-geocoded address tags."""
        (
            landuse,
            natural,
            waterway,
            highway,
            _raw_class,
            _raw_type,
        ) = cls._coerce_reverse_geocoder_tags(address, location_raw)

        if landuse in {"industrial", "commercial", "retail"}:
            return "Urban Commercial"
        if highway in cls.MAJOR_HIGHWAY_TYPES:
            return "Major Highway"
        if natural in cls.WATER_TYPES or waterway:
            return "Water Body"
        if landuse in cls.BACKGROUND_LANDUSE_TYPES or natural in cls.BACKGROUND_NATURAL_TYPES:
            return "Background Site"
        if highway in cls.RESIDENTIAL_HIGHWAY_TYPES:
            return "Urban Background"
        if address.get("city") or address.get("town") or address.get("suburb"):
            return "Urban Background"
        if address.get("village") or address.get("hamlet") or address.get("farm"):
            return "Background Site"
        return "Unknown_Category"

    def _categorize_from_reverse_geocoder(self, latitude, longitude, debug_info):
        """Fallback classification when Overpass is unavailable."""
        try:
            location = geolocator.reverse((latitude, longitude), exactly_one=True)
            if not location:
                return None

            location_raw = location.raw or {}
            address = location_raw.get("address", {})
            category = self._determine_category_from_address(address, location_raw)
            area_name = (
                address.get("suburb")
                or address.get("city")
                or address.get("village")
                or address.get("town")
                or address.get("county")
                or location.address
            )
            (
                landuse,
                natural,
                waterway,
                highway,
                raw_class,
                raw_type,
            ) = self._coerce_reverse_geocoder_tags(address, location_raw)

            debug_info.append(
                "Overpass unavailable; using reverse-geocoder fallback classification."
            )
            if raw_class or raw_type:
                debug_info.append(
                    f"Reverse-geocoder raw context: class='{raw_class or 'unknown'}', type='{raw_type or 'unknown'}'."
                )

            return (
                category,
                None,
                area_name,
                landuse,
                natural,
                waterway,
                highway,
                debug_info,
            )
        except Exception as error:
            debug_info.append(f"Reverse-geocoder fallback failed: {error}")
            return None

    @staticmethod
    def _is_transient_overpass_error(error):
        message = str(error).lower()
        transient_markers = (
            "server load too high",
            "too many requests",
            "rate limit",
            "timed out",
            "timeout",
            "gateway timeout",
            "temporarily unavailable",
            "connection reset",
            "remote end closed",
            "406",
            "not acceptable",
            "429",
            "502",
            "503",
            "504",
        )
        transient_types = (
            overpy.exception.OverpassGatewayTimeout,
            overpy.exception.OverpassRuntimeError,
            overpy.exception.OverpassTooManyRequests,
            overpy.exception.OverpassUnknownHTTPStatusCode,
        )
        return isinstance(error, transient_types) or any(
            marker in message for marker in transient_markers
        )

    def _query_osm_with_retries(self, query, retries=None, base_delay=None):
        retries = self.overpass_max_attempts if retries is None else retries
        base_delay = self.overpass_base_delay if base_delay is None else base_delay
        last_error = None

        for attempt in range(1, retries + 1):
            for overpass_url in self.overpass_urls:
                try:
                    return self._build_overpass_client(overpass_url).query(query)
                except Exception as error:
                    last_error = error
                    if not self._is_transient_overpass_error(error):
                        raise

                    logger.warning(
                        "Transient Overpass error on attempt %d/%d via %s: %s",
                        attempt,
                        retries,
                        overpass_url,
                        error,
                    )

            if attempt == retries:
                break

            delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, 0.5)
            logger.warning(
                "All Overpass endpoints failed on attempt %d/%d. Retrying in %.1f seconds.",
                attempt,
                retries,
                delay,
            )
            time.sleep(delay)

        raise last_error

    def categorize_site_osm(self, latitude, longitude):
        cached_result = self._get_cached_site_result(
            latitude, longitude, self.site_cache_ttl_seconds
        )
        if cached_result is not None:
            return cached_result

        # Define search radii
        search_radii = [50, 100, 250]
        max_search_radius = max(search_radii)

        # Define categories
        categories = {
            "Urban Background": ["residential", "urban", "mine", "quarry"],
            "Urban Commercial": ["commercial", "retail", "industrial"],
            "Background Site": [
                "forest", "farmland", "grass", "meadow", "vineyard",
                "wetland", "park", "scrub", "heath", "bare_rock", "orchard",
            ],
            "Water Body": ["river", "stream", "lake", "canal", "reservoir", "ditch"],
            "Major Highway": ["motorway", "trunk", "primary", "secondary", "service"],
            "Residential Road": ["residential", "living_street", "unclassified", "tertiary"],
        }

        # Priority order of categories for determining the site type
        priority_categories = [
            "Major Highway",
            "Urban Commercial",
            "Urban Background",
            "Background Site",
            "Residential Road",
            "Water Body",
        ]

        # Initialize variables to track the nearest categorization
        nearest_categorization = None
        nearest_distance = float("inf")
        nearest_area_name = None
        landuse_info = None
        natural_info = None
        waterway_info = None
        highway_info = None
        debug_info = []

        # Cache for reverse-geocoded name
        location_name_cache = {"value": None}

        def fallback_name():
            if location_name_cache["value"] is None:
                location_name_cache["value"] = self.get_location_name(latitude, longitude)
            return location_name_cache["value"]

        query = f"""
        [out:json];
        (
          node(around:{max_search_radius}, {latitude}, {longitude})["landuse"];
          way(around:{max_search_radius}, {latitude}, {longitude})["landuse"];
          relation(around:{max_search_radius}, {latitude}, {longitude})["landuse"];
          node(around:{max_search_radius}, {latitude}, {longitude})["natural"];
          way(around:{max_search_radius}, {latitude}, {longitude})["natural"];
          relation(around:{max_search_radius}, {latitude}, {longitude})["natural"];
          node(around:{max_search_radius}, {latitude}, {longitude})["waterway"];
          way(around:{max_search_radius}, {latitude}, {longitude})["waterway"];
          relation(around:{max_search_radius}, {latitude}, {longitude})["waterway"];
          node(around:{max_search_radius}, {latitude}, {longitude})["highway"];
          way(around:{max_search_radius}, {latitude}, {longitude})["highway"];
          relation(around:{max_search_radius}, {latitude}, {longitude})["highway"];
        );
        out center;
        """

        try:
            result = self._query_osm_with_retries(query)
        except Exception as e:
            error_message = f"Error querying OSM after retries: {e}"
            if error_message not in debug_info:
                debug_info.append(error_message)

            if self._is_transient_overpass_error(e):
                fallback_result = self._categorize_from_reverse_geocoder(
                    latitude, longitude, debug_info
                )
                if fallback_result is not None:
                    self._set_cached_site_result(latitude, longitude, fallback_result)
                    return fallback_result

            final_result = (
                "Unknown_Category",
                None,
                fallback_name(),
                landuse_info,
                natural_info,
                waterway_info,
                highway_info,
                debug_info,
            )
            self._set_cached_site_result(latitude, longitude, final_result)
            return final_result

        for way in result.ways:
            tags = way.tags
            landuse = tags.get("landuse", "unknown")
            natural = tags.get("natural", "unknown")
            waterway = tags.get("waterway", "unknown")
            highway = tags.get("highway", "unknown")
            center_lat = way.center_lat
            center_lon = way.center_lon
            area_name = tags.get("name", "Unnamed")

            debug_info.append("Found OSM data:")
            debug_info.append(f"  Landuse: {landuse}")
            debug_info.append(f"  Natural: {natural}")
            debug_info.append(f"  Waterway: {waterway}")
            debug_info.append(f"  Highway: {highway}")
            debug_info.append(f"  Location: ({center_lat}, {center_lon})")
            debug_info.append(f"  Area Name: {area_name}")

            if center_lat and center_lon:
                distance = geodesic((latitude, longitude), (center_lat, center_lon)).meters

                if landuse == "industrial":
                    final_result = (
                        "Urban Commercial",
                        distance,
                        area_name if area_name != "Unnamed" else fallback_name(),
                        landuse,
                        natural,
                        waterway,
                        highway,
                        debug_info,
                    )
                    self._set_cached_site_result(latitude, longitude, final_result)
                    return final_result

                if distance < 50 and highway in categories["Major Highway"]:
                    final_result = (
                        "Major Highway",
                        distance,
                        area_name if area_name != "Unnamed" else fallback_name(),
                        landuse,
                        natural,
                        waterway,
                        highway,
                        debug_info,
                    )
                    self._set_cached_site_result(latitude, longitude, final_result)
                    return final_result

                for category in priority_categories:
                    if category == "Urban Background" and (
                        landuse in categories["Urban Background"]
                        or natural in ["urban_area"]
                        or highway in categories["Residential Road"]
                    ):
                        if distance < nearest_distance:
                            nearest_categorization = "Urban Background"
                            nearest_distance = distance
                            nearest_area_name = area_name if area_name != "Unnamed" else fallback_name()
                            landuse_info, natural_info, waterway_info, highway_info = landuse, natural, waterway, highway

                    elif category == "Urban Commercial" and landuse in categories["Urban Commercial"]:
                        if distance < nearest_distance:
                            nearest_categorization = "Urban Commercial"
                            nearest_distance = distance
                            nearest_area_name = area_name if area_name != "Unnamed" else fallback_name()
                            landuse_info, natural_info, waterway_info, highway_info = landuse, natural, waterway, highway

                    elif category == "Background Site" and (
                        landuse in categories["Background Site"]
                        or natural in ["forest", "wood", "scrub"]
                        or highway in ["path", "footway", "track", "cycleway"]
                        or waterway in ["riverbank", "stream", "canal"]
                    ):
                        if distance < nearest_distance:
                            nearest_categorization = "Background Site"
                            nearest_distance = distance
                            nearest_area_name = area_name if area_name != "Unnamed" else fallback_name()
                            landuse_info, natural_info, waterway_info, highway_info = landuse, natural, waterway, highway

                    elif category == "Water Body" and (waterway in categories["Water Body"] or natural == "water"):
                        if distance < nearest_distance:
                            nearest_categorization = "Water Body"
                            nearest_distance = distance
                            nearest_area_name = area_name if area_name != "Unnamed" else fallback_name()
                            landuse_info, natural_info, waterway_info, highway_info = landuse, natural, waterway, highway

        # Fallbacks
        if nearest_categorization is None and nearest_area_name:
            nearest_area_name = nearest_area_name if nearest_area_name != "Unnamed" else fallback_name()
            if "forest" in nearest_area_name.lower():
                final_result = ("Background Site", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info)
                self._set_cached_site_result(latitude, longitude, final_result)
                return final_result
            elif "urban" in nearest_area_name.lower():
                final_result = ("Urban Background", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info)
                self._set_cached_site_result(latitude, longitude, final_result)
                return final_result
            elif "water" in nearest_area_name.lower():
                final_result = ("Water Body", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info)
                self._set_cached_site_result(latitude, longitude, final_result)
                return final_result

        # Final return
        final_result = (
            nearest_categorization if nearest_categorization else "Unknown_Category",
            nearest_distance if nearest_categorization else None,
            nearest_area_name if nearest_area_name and nearest_area_name != "Unnamed" else fallback_name(),
            landuse_info, natural_info, waterway_info, highway_info, debug_info
        )
        self._set_cached_site_result(latitude, longitude, final_result)
        return final_result
