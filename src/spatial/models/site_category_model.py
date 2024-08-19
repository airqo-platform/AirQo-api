import overpy
from geopy.distance import geodesic

# Initialize the Overpass API
api = overpy.Overpass()

class SiteCategoryModel:
    def __init__(self, category=None):
        self.category = category

    def categorize_site_osm(self, latitude, longitude):
        search_radii = [50, 100, 250]
        categories = {
            "Urban Background": ["residential", "urban"],
            "Urban Commercial": ["commercial", "retail", "industrial"],
            "Background Site": ["forest", "farmland", "grass", "meadow", "wetland", "park"],
            "Water Body": ["river", "stream", "lake", "canal", "ditch"],
            "Major Highway": ["motorway", "trunk", "primary", "secondary"],
            "Residential Road": ["residential", "living_street", "unclassified", "tertiary", "service"]
        }
        
        # Priority list of categories to check in case of unknown
        priority_categories = [
            "Major Highway",
            "Urban Commercial",
            "Urban Background",
            "Background Site",
            "Residential Road",
            "Water Body"
        ]
        
        nearest_categorization = None
        nearest_distance = float('inf')
        nearest_area_name = None
        landuse_info = None
        natural_info = None
        waterway_info = None
        highway_info = None
        debug_info = []

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

                # Append debug information
                debug_info.append(f"Found OSM data:")
                debug_info.append(f"  Landuse: {landuse}")
                debug_info.append(f"  Natural: {natural}")
                debug_info.append(f"  Waterway: {waterway}")
                debug_info.append(f"  Highway: {highway}")
                debug_info.append(f"  Location: ({center_lat}, {center_lon})")
                debug_info.append(f"  Area Name: {area_name}")

                if center_lat and center_lon:
                    distance = geodesic((latitude, longitude), (center_lat, center_lon)).meters

                    # Check for industrial landuse first
                    if landuse == "industrial":
                        return "Urban Commercial", distance, area_name, landuse, natural, waterway, highway, debug_info

                    # Check for major highways within 50m
                    if distance < 50 and highway in categories["Major Highway"]:
                        return "Urban Commercial", distance, area_name, landuse, natural, waterway, highway, debug_info

                    # Update nearest_categorization based on landuse and highway tags
                    for category in priority_categories:
                        if category == "Urban Background" and (landuse in categories["Urban Background"] or natural in ["urban_area"] or highway in categories["Residential Road"]):
                            if distance < nearest_distance:
                                nearest_categorization = "Urban Background"
                                nearest_distance = distance
                                nearest_area_name = area_name
                                landuse_info = landuse
                                natural_info = natural
                                waterway_info = waterway
                                highway_info = highway

                        elif category == "Urban Commercial" and landuse in categories["Urban Commercial"]:
                            if distance < nearest_distance:
                                nearest_categorization = "Urban Commercial"
                                nearest_distance = distance
                                nearest_area_name = area_name
                                landuse_info = landuse
                                natural_info = natural
                                waterway_info = waterway
                                highway_info = highway

                        elif category == "Background Site" and (landuse in categories["Background Site"] or natural in ["forest", "wood", "scrub"] or highway in ["path", "footway", "track", "cycleway"] or waterway in ["riverbank", "stream", "canal"]):
                            if distance < nearest_distance:
                                nearest_categorization = "Background Site"
                                nearest_distance = distance
                                nearest_area_name = area_name
                                landuse_info = landuse
                                natural_info = natural
                                waterway_info = waterway
                                highway_info = highway

                        elif category == "Water Body" and (waterway in categories["Water Body"] or natural == "water"):
                            if distance < nearest_distance:
                                nearest_categorization = "Water Body"
                                nearest_distance = distance
                                nearest_area_name = area_name
                                landuse_info = landuse
                                natural_info = natural
                                waterway_info = waterway
                                highway_info = highway

        # Fallback if no categorization found but area name is available
        if nearest_categorization is None and nearest_area_name:
            if "forest" in nearest_area_name.lower():
                return "Background Site", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info
            elif "urban" in nearest_area_name.lower():
                return "Urban Background", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info
            elif "water" in nearest_area_name.lower():
                return "Water Body", None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info

        # Final return if no suitable categorization was found
        return nearest_categorization if nearest_categorization else "Unknown_Category", nearest_distance if nearest_categorization else None, nearest_area_name, landuse_info, natural_info, waterway_info, highway_info, debug_info
