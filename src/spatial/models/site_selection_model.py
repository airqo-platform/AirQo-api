import hashlib
import json
import os
import random
from shapely.geometry import Polygon, Point
from geopy.distance import great_circle
from sklearn.cluster import KMeans
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils.geocoding import ReverseGeocodingService


GEOCODING_MAX_WORKERS = max(1, int(os.getenv("SITE_LOCATION_GEOCODING_WORKERS", "4")))

class SiteCategoryModel:
    geocoding_service = ReverseGeocodingService()

    def categorize_site_osm(self, lat, lon):
        result = self.geocoding_service.reverse(lat, lon)
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
        place_name = address.get("suburb", address.get("city", "Unknown"))
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
            num_sensors * 100
        )  # Generate more points than needed
        random_coords = [(point.y, point.x) for point in random_points]

        # Apply KMeans clustering to find optimal sensor locations
        kmeans = KMeans(n_clusters=num_sensors, random_state=42, n_init=10)
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

        def process_site(site):
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
                    }
                )
                return site
            except Exception as e:
                #   print(f"Error processing site at ({site['latitude']}, {site['longitude']}): {e}")
                return None

        max_workers = max(1, min(max_workers, len(self.sites)))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_site = {
                executor.submit(process_site, site): site for site in self.sites
            }
            results = []
            for future in as_completed(future_to_site):
                result = future.result()
                if result is not None:
                    results.append(result)

        self.sites = results

    def get_category_counts(self):
        counts = {}
        for site in self.sites:
            category = site.get("category", "Unknown")
            counts[category] = counts.get(category, 0) + 1
        return counts
