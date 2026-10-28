import hashlib
import json
import logging
import os
import random
import threading
from shapely.geometry import Polygon, Point
from geopy.distance import great_circle
from sklearn.cluster import KMeans
from concurrent.futures import ThreadPoolExecutor
from utils.geocoding import (
    ReverseGeocodingBusyError,
    ReverseGeocodingLookupError,
    ReverseGeocodingService,
)


GEOCODING_MAX_WORKERS = max(1, int(os.getenv("SITE_LOCATION_GEOCODING_WORKERS", "1")))
CANDIDATE_MULTIPLIER = max(10, int(os.getenv("SITE_LOCATION_CANDIDATE_MULTIPLIER", "30")))
KMEANS_N_INIT = max(1, int(os.getenv("SITE_LOCATION_KMEANS_N_INIT", "3")))
logger = logging.getLogger(__name__)

class SiteCategoryModel:
    geocoding_service = ReverseGeocodingService()

    def categorize_site_osm(self, lat, lon):
        result = self.geocoding_service.reverse(lat, lon)
        if result.get("_error"):
            raise ReverseGeocodingLookupError(result["_error"])
        address = result.get("address") or {}
        category = self._determine_category(address)
        highway = (
            address.get("road")
            if category in ["Urban", "Commercial", "Residential"]
            else None
        )
        landuse = (
            address.get("landuse")
            if category in ["Residential", "Commercial", "Industrial"]
            else None
        )
        natural = address.get("natural") if category in ["Natural", "Rural"] else None
        place_name = next(
            (
                address[key]
                for key in (
                    "suburb", "neighbourhood", "city_district", "city", "town",
                    "village", "hamlet", "municipality", "county", "state", "country",
                )
                if address.get(key)
            ),
            result.get("display_name"),
        )
        if not place_name:
            raise ReverseGeocodingLookupError("Nominatim returned no place name")
        return (category, None, place_name, landuse, natural, None, highway, None)

    @staticmethod
    def _determine_category(address):
        if "landuse" in address:
            landuse = address["landuse"]
            if landuse in ["residential"]:
                return "Residential"
            elif landuse in ["commercial"]:
                return "Commercial"
            elif landuse in ["industrial"]:
                return "Industrial"
        if "natural" in address:
            return "Natural"
        if "city" in address or "suburb" in address:
            return "Urban"
        return "Unknown"


class SensorDeployment:
    def __init__(self, polygon, must_have_locations=None, min_distance_km=0.5):
        self.polygon = Polygon(polygon["coordinates"][0])
        self.sites = []
        self.must_have_locations = must_have_locations or []
        self.min_distance_km = min_distance_km

    def is_far_enough(self, point):
        for site in self.sites:
            existing_point = Point(site["longitude"], site["latitude"])
            distance = great_circle(
                (point.y, point.x), (existing_point.y, existing_point.x)
            ).kilometers
            if distance < self.min_distance_km:
                return False
        return True

    def generate_random_points(self, num_points):
        minx, miny, maxx, maxy = self.polygon.bounds
        points = []
        seed_payload = json.dumps(
            {
                "polygon": self.polygon.wkt,
                "must_have_locations": self.must_have_locations,
                "min_distance_km": self.min_distance_km,
            },
            sort_keys=True,
        ).encode("utf-8")
        seed = int.from_bytes(hashlib.sha256(seed_payload).digest()[:8], "big")
        random_generator = random.Random(seed)
        while len(points) < num_points:
            random_point = Point(
                random_generator.uniform(minx, maxx),
                random_generator.uniform(miny, maxy),
            )
            if self.polygon.contains(random_point):
                points.append(random_point)
        return points

    def optimize_sensor_locations(self, num_sensors):
        # Add must-have locations first
        for loc in self.must_have_locations:
            lat, lon = loc
            if self.polygon.contains(Point(lon, lat)):
                self.sites.append(
                    {
                        "latitude": round(lat, 6),
                        "longitude": round(lon, 6),
                        "category": "Unknown",
                        "area_name": "Unknown",
                        "highway": "Unknown",
                        "landuse": "Unknown",
                        "natural": "Unknown",
                    }
                )

        # Generate random points within the polygon
        random_points = self.generate_random_points(
            num_sensors * CANDIDATE_MULTIPLIER
        )  # Generate more points than needed
        random_coords = [(point.y, point.x) for point in random_points]

        # Apply KMeans clustering to find optimal sensor locations
        kmeans = KMeans(n_clusters=num_sensors, random_state=42, n_init=KMEANS_N_INIT)
        kmeans.fit(random_coords)
        cluster_centers = kmeans.cluster_centers_

        for center in cluster_centers:
            lat, lon = center
            self.sites.append(
                {
                    "latitude": round(lat, 6),
                    "longitude": round(lon, 6),
                    "category": "Unknown",
                    "area_name": "Unknown",
                    "highway": "Unknown",
                    "landuse": "Unknown",
                    "natural": "Unknown",
                }
            )

    def categorize_sites(self, max_workers=GEOCODING_MAX_WORKERS):
        model = SiteCategoryModel()
        skip_geocoding = threading.Event()

        def unenriched(site, status):
            site.update(
                {
                    "category": None,
                    "area_name": None,
                    "highway": None,
                    "landuse": None,
                    "natural": None,
                    "geocoding_status": status,
                }
            )
            return site

        def process_site(site):
            if skip_geocoding.is_set():
                return unenriched(site, "skipped")
            try:
                lat, lon = site["latitude"], site["longitude"]
                (
                    category,
                    _,
                    area_name,
                    landuse,
                    natural,
                    _,
                    highway,
                    _,
                ) = model.categorize_site_osm(lat, lon)

                if natural in [
                    "water",
                    "wetland",
                    "lake",
                    "river",
                    "stream",
                    "glacier",
                    "beach",
                ]:
                    return None  # Skip sites with natural features that are not desired

                site.update(
                    {
                        "category": category,
                        "area_name": area_name,
                        "highway": highway,
                        "landuse": landuse,
                        "natural": natural,
                        "geocoding_status": "completed",
                    }
                )
                return site
            except ReverseGeocodingBusyError:
                skip_geocoding.set()
                return unenriched(site, "deferred")
            except ReverseGeocodingLookupError:
                skip_geocoding.set()
                return unenriched(site, "failed")
            except Exception:
                logger.exception("Site geocoding failed")
                skip_geocoding.set()
                return unenriched(site, "failed")

        max_workers = max(1, min(max_workers, len(self.sites)))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = [
                result for result in executor.map(process_site, self.sites)
                if result is not None
            ]

        self.sites = results

    def get_category_counts(self):
        counts = {}
        for site in self.sites:
            category = site.get("category") or "Unenriched"
            counts[category] = counts.get(category, 0) + 1
        return counts
