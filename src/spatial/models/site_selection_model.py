import random
from shapely.geometry import Polygon, Point
from geopy.distance import great_circle
from geopy.geocoders import Nominatim
from sklearn.cluster import KMeans

random.seed(42)
class SiteCategoryModel:
    def __init__(self):
        self.geolocator = Nominatim(user_agent="sensor_deployment")

    def categorize_site_osm(self, lat, lon):
        try:
            location = self.geolocator.reverse((lat, lon), language='en')
            address = location.raw.get('address', {})
        except Exception as e:
        #    print(f"Error during reverse geocoding: {e}")
            address = {}

        category = self._determine_category(address)
        highway = address.get('road', None) if category in ["Urban", "Commercial", "Residential"] else None
        landuse = address.get('landuse', None) if category in ["Residential", "Commercial", "Industrial"] else None
        natural = address.get('natural', None) if category in ["Natural", "Rural"] else None

        place_name = address.get('suburb', address.get('city', 'Unknown'))

        return (
            category,
            None,
            place_name,
            landuse,
            natural,
            None,
            highway,
            None
        )

    def _determine_category(self, address):
        if 'landuse' in address:
            landuse = address['landuse']
            if landuse in ['residential']:
                return 'Residential'
            elif landuse in ['commercial']:
                return 'Commercial'
            elif landuse in ['industrial']:
                return 'Industrial'
        if 'natural' in address:
            return 'Natural'
        if 'city' in address or 'suburb' in address:
            return 'Urban'
        return 'Rural'


class SensorDeployment:
    def __init__(self, polygon, must_have_locations=None, min_distance_km=0.5):
        self.polygon = Polygon(polygon["coordinates"][0])
        self.sites = []
        self.must_have_locations = must_have_locations or []
        self.min_distance_km = min_distance_km

    def is_far_enough(self, point):
        for site in self.sites:
            existing_point = Point(site['longitude'], site['latitude'])
            distance = great_circle((point.y, point.x), (existing_point.y, existing_point.x)).kilometers
            if distance < self.min_distance_km:
                return False
        return True

    def generate_random_points(self, num_points):
        minx, miny, maxx, maxy = self.polygon.bounds
        points = []
        while len(points) < num_points:
            random_point = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
            if self.polygon.contains(random_point):
                points.append(random_point)
        return points

    def optimize_sensor_locations(self, num_sensors):
        # Add must-have locations first
        for loc in self.must_have_locations:
            lat, lon = loc
            if self.polygon.contains(Point(lon, lat)):
                self.sites.append({
                    'latitude': round(lat, 6),
                    'longitude': round(lon, 6),
                    'category': "Unknown",
                    'area_name': "Unknown",
                    'highway': "Unknown",
                    'landuse': "Unknown",
                    'natural': "Unknown"
                })

        # Generate random points within the polygon
        random_points = self.generate_random_points(num_sensors )  # Generate more points than needed
        random_coords = [(point.y, point.x) for point in random_points]

        # Apply KMeans clustering to find optimal sensor locations
        kmeans = KMeans(n_clusters=num_sensors, random_state=42, n_init=10)
        kmeans.fit(random_coords)
        cluster_centers = kmeans.cluster_centers_

        for center in cluster_centers:
            lat, lon = center
            self.sites.append({
                'latitude': round(lat, 6),
                'longitude': round(lon, 6),
                'category': "Unknown",
                'area_name': "Unknown",
                'highway': "Unknown",
                'landuse': "Unknown",
                'natural': "Unknown"
            })

    def categorize_sites(self):
        model = SiteCategoryModel()
        for site in self.sites:
            lat, lon = site['latitude'], site['longitude']
            category, _, area_name, landuse, natural, _, highway, _ = model.categorize_site_osm(lat, lon)

            if natural in ["Water", "Wetland"]:
#                print(f"Skipping site at ({lat}, {lon}) due to water body presence.")
                continue

            site.update({
                'category': category,
                'area_name': area_name,
                'highway': highway,
                'landuse': landuse,
                'natural': natural
            }) 
