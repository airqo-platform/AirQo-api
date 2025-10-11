import overpy
from geopy.distance import geodesic
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time


# Initialize the Overpass API
api = overpy.Overpass()
# Initialize Nominatim geocoder
geolocator = Nominatim(user_agent="site_categorization_app")


class SiteCategoryModel:
    def __init__(self, category=None):
        # Initialize the class with an optional category
        self.category = category

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

    def categorize_site_osm(self, latitude, longitude):
        # Define search radii
        search_radii = [50, 100, 250]

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

        # Loop through search radii
        for radius in search_radii:
            query = f"""
            [out:json];
            (
              node(around:{radius}, {latitude}, {longitude})["landuse"];
              way(around:{radius}, {latitude}, {longitude})["landuse"];
              relation(around:{radius}, {latitude}, {longitude})["landuse"];
              node(around:{radius}, {latitude}, {longitude})["natural"];
              way(around:{radius}, {latitude}, {longitude})["natural"];
              relation(around:{radius}, {latitude}, {longitude})["natural"];
              node(around:{radius}, {latitude}, {longitude})["waterway"];
              way(around:{radius}, {latitude}, {longitude})["waterway"];
              relation(around:{radius}, {latitude}, {longitude})["waterway"];
              node(around:{radius}, {latitude}, {longitude})["highway"];
              way(around:{radius}, {latitude}, {longitude})["highway"];
              relation(around:{radius}, {latitude}, {longitude})["highway"];
            );
            out center;
            """

            try:
                result = api.query(query)
            except Exception as e:
                debug_info.append(f"Error querying OSM: {e}")
                continue

            for way in result.ways:
                tags = way.tags
                landuse = tags.get("landuse", "unknown")
                natural = tags.get("natural", "unknown")
                waterway = tags.get("waterway", "unknown")
                highway = tags.get("highway", "unknown")
                center_lat = way.center_lat
                center_lon = way.center_lon
                area_name = tags.get("name", "Unnamed")

                debug_info.append(f"Found OSM data:")
                debug_info.append(f"  Landuse: {landuse}")
                debug_info.append(f"  Natural: {natural}")
                debug_info.append(f"  Waterway: {waterway}")
                debug_info.append(f"  Highway: {highway}")
                debug_info.append(f"  Location: ({center_lat}, {center_lon})")
                debug_info.append(f"  Area Name: {area_name}")
                # Calculate the distance from the query point to the OSM way center
                if center_lat and center_lon:
                    distance = geodesic((latitude, longitude), (center_lat, center_lon)).meters

                    # Industrial shortcut
                    if landuse == "industrial":
                        return (
                            "Urban Commercial",
                            distance,
                            area_name if area_name != "Unnamed" else fallback_name(),
                            landuse, natural, waterway, highway, debug_info
                        )

                    #  Check for major highways within 50 m
                    if distance < 50 and highway in categories["Major Highway"]:
                        return (
                            "Urban Commercial",
                            distance,
                            area_name if area_name != "Unnamed" else fallback_name(),
                            landuse, natural, waterway, highway, debug_info
                        )

                    # Priority categories
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
                return ("Background Site", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info)
            elif "urban" in nearest_area_name.lower():
                return ("Urban Background", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info)
            elif "water" in nearest_area_name.lower():
                return ("Water Body", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info)

        # Final return
        return (
            nearest_categorization if nearest_categorization else "Unknown_Category",
            nearest_distance if nearest_categorization else None,
            nearest_area_name if nearest_area_name and nearest_area_name != "Unnamed" else fallback_name(),
            landuse_info, natural_info, waterway_info, highway_info, debug_info
        )
