import overpy
from geopy.distance import geodesic
from functools import lru_cache

from utils.reverse_geocoder import ReverseGeocoder


# Initialize the Overpass API
api = overpy.Overpass(read_chunk_size=65535)
# Initialize reverse geocoder with Nominatim primary and LocationIQ fallback
reverse_geocoder = ReverseGeocoder(user_agent="site_categorization_app")


class SiteCategoryModel:
    def __init__(self, category=None):
        # Initialize the class with an optional category
        self.category = category

    def get_location_name(self, latitude, longitude, retries=3, delay=2):
        """
        Use Nominatim to get a human-readable name for the location and
        fall back to LocationIQ when Nominatim is unavailable.
        """
        result = self.get_location_details(
            latitude=latitude, longitude=longitude, retries=retries, delay=delay
        )
        return result.get("display_name") if result else None

    def get_location_details(self, latitude, longitude, retries=3, delay=2):
        """
        Return reverse-geocoded location details, including the provider used.
        """
        result = reverse_geocoder.reverse(
            latitude=latitude,
            longitude=longitude,
            retries=retries,
            delay=delay,
            exactly_one=True,
            require_display_name=True,
        )
        return result

    @staticmethod
    @lru_cache(maxsize=256)
    def _cached_location_details(latitude, longitude):
        model = SiteCategoryModel()
        return model.get_location_details(latitude, longitude)

    @staticmethod
    @lru_cache(maxsize=256)
    def _cached_query(query):
        return api.query(query)

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
        location_name_cache = {"resolved": False, "value": None, "provider": None}

        def fallback_name():
            if not location_name_cache["resolved"]:
                result = self._cached_location_details(
                    round(latitude, 5), round(longitude, 5)
                )
                location_name_cache["resolved"] = True
                if result:
                    location_name_cache["value"] = result.get("display_name")
                    location_name_cache["provider"] = result.get("provider")
                    if result.get("provider") == "locationiq":
                        debug_info.append("Reverse geocoder provider: LocationIQ")
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
                result = self._cached_query(query)
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
