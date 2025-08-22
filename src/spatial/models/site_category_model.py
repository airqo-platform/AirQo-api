import overpy
from geopy.distance import geodesic
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from concurrent.futures import ThreadPoolExecutor, as_completed
import time


# Initialize the Overpass API
api = overpy.Overpass()
# Initialize Nominatim geocoder
geolocator = Nominatim(user_agent="site_categorization_app")


class SiteCategoryModel:
    # Initialize the class with an optional category
    def __init__(self, category=None):
        self.category = category

    def get_location_name(self, latitude, longitude, retries=3, delay=2):
        """
        Use Nominatim to get a human-readable name for the location.
        Retries a few times, but returns 'Unknown' if it fails.
        """
        for attempt in range(retries):
            try:
                location = geolocator.reverse(
                    (latitude, longitude),
                    exactly_one=True,
                    timeout=10
                )
                if location:
                    return location.address
                return "Unknown"
            except (GeocoderTimedOut, GeocoderServiceError) as e:
                print(f"Nominatim error: {e}, retry {attempt+1}/{retries}")
                time.sleep(delay * (2 ** attempt))
            except Exception as e:
                print(f"Unexpected geocoding error: {e}. Skipping.")
                return "Unknown"

        print(f"Skipping location  after {retries} failed attempts.")
        return "Unknown"

    def categorize_site_osm(self, latitude, longitude):
        """
        Categorize the site based on OSM data (landuse, natural, waterway, highway).
        Falls back to Nominatim if needed. Always returns non-empty OSM_info.
        """
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

        # Priority order
        priority_categories = [
            "Major Highway",
            "Urban Commercial",
            "Urban Background",
            "Background Site",
            "Residential Road",
            "Water Body",
        ]

        nearest_categorization = None
        nearest_distance = float("inf")
        nearest_area_name = None
        landuse_info = natural_info = waterway_info = highway_info = None
        debug_info = []

        location_name_cache = {"value": None}

        def fallback_name():
            if location_name_cache["value"] is None:
                location_name_cache["value"] = self.get_location_name(latitude, longitude)
            return location_name_cache["value"] or "Unknown"

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
                debug_info.append({"radius": radius, "error": str(e)})
                continue

            # Process nodes, ways, and relations
            for element in result.nodes + result.ways + result.relations:
                tags = element.tags
                landuse = tags.get("landuse", "unknown")
                natural = tags.get("natural", "unknown")
                waterway = tags.get("waterway", "unknown")
                highway = tags.get("highway", "unknown")
                
                # Get coordinates based on element type
                if hasattr(element, 'lat') and hasattr(element, 'lon'):
                    center_lat, center_lon = element.lat, element.lon
                elif hasattr(element, 'center_lat') and hasattr(element, 'center_lon'):
                    center_lat, center_lon = element.center_lat, element.center_lon
                else:
                    center_lat, center_lon = latitude, longitude  # Fallback to query coordinates
                
                area_name = tags.get("name", "Unnamed")

                distance = None
                if center_lat and center_lon:
                    distance = geodesic((latitude, longitude), (center_lat, center_lon)).meters

                # Log OSM info with more details
                element_info = {
                    "radius": radius,
                    "element_type": element.__class__.__name__,
                    "element_id": getattr(element, 'id', 'unknown'),
                    "landuse": landuse,
                    "natural": natural,
                    "waterway": waterway,
                    "highway": highway,
                    "name": area_name,
                    "distance_m": distance,
                    "coordinates": (center_lat, center_lon),
                    "tags": tags  # Include all tags for comprehensive analysis
                }
                debug_info.append(element_info)

                # Skip if no distance could be calculated
                if distance is None:
                    continue

                # Industrial shortcut
                if landuse == "industrial":
                    return (
                        "Urban Commercial", 
                        distance,
                        area_name if area_name != "Unnamed" else fallback_name(),
                        landuse, natural, waterway, highway, 
                        debug_info
                    )

                # Check for major highways within 50 m
                if distance < 50 and highway in categories["Major Highway"]:
                    return (
                        "Urban Commercial", 
                        distance,
                        area_name if area_name != "Unnamed" else fallback_name(),
                        landuse, natural, waterway, highway, 
                        debug_info
                    )

                # Priority-based categorization
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

        # Fallbacks based on name
        if nearest_categorization is None:
            fallback_name_val = fallback_name()
            if "forest" in fallback_name_val.lower():
                return ("Background Site", None, fallback_name_val, landuse_info, natural_info, waterway_info, highway_info, debug_info)
            elif "urban" in fallback_name_val.lower() or "city" in fallback_name_val.lower():
                return ("Urban Background", None, fallback_name_val, landuse_info, natural_info, waterway_info, highway_info, debug_info)
            elif "water" in fallback_name_val.lower() or "river" in fallback_name_val.lower() or "lake" in fallback_name_val.lower():
                return ("Water Body", None, fallback_name_val, landuse_info, natural_info, waterway_info, highway_info, debug_info)

        # Ensure OSM_info is never empty
        osm_info = debug_info if debug_info else [{"status": "No OSM data found"}]

        # Final return
        return (
            nearest_categorization if nearest_categorization else "Unknown_Category",
            nearest_distance if nearest_categorization else None,
            nearest_area_name if nearest_area_name and nearest_area_name != "Unnamed" else fallback_name(),
            landuse_info or "unknown",
            natural_info or "unknown",
            waterway_info or "unknown",
            highway_info or "unknown",
            osm_info
        )

    def batch_categorize(self, coords, max_workers=5):
        """
        Process multiple (lat, lon) locations in parallel.
        Returns a dictionary mapping coordinates to their categorization results.
        """
        results = {}
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_coord = {executor.submit(self.categorize_site_osm, lat, lon): (lat, lon) for lat, lon in coords}
            for future in as_completed(future_to_coord):
                coord = future_to_coord[future]
                try:
                    results[coord] = future.result()
                except Exception as exc:
                    print(f"{coord} generated an exception: {exc}")
                    results[coord] = ("Unknown_Category", None, "Unknown", "unknown", "unknown", "unknown", "unknown", [{"error": str(exc)}])
        return results