from flask import request, jsonify
from models.site_category_model import SiteCategoryModel


class SiteCategorizationView:
    @staticmethod
    def get_site_categorization():
        # Helper function to validate latitude and longitude
        def has_at_least_six_decimal_places(value):
            str_value = f"{value:.10f}"
            integer_part, decimal_part = str_value.split(".")
            return len(decimal_part) >= 6

        # Instantiate the model
        site_category_model = SiteCategoryModel(category=None)

        # Handle GET request for single coordinate
        if request.method == "GET":
            try:
                latitude = float(request.args.get("latitude"))
                longitude = float(request.args.get("longitude"))
            except (TypeError, ValueError):
                return jsonify({"error": "Latitude and longitude must be valid floating-point numbers"}), 400

            if not has_at_least_six_decimal_places(latitude) or not has_at_least_six_decimal_places(longitude):
                return jsonify({"error": "Latitude and longitude must have at least 6 decimal places"}), 400

            try:
                category, search_radius, area_name, landuse, natural, waterway, highway, debug_info = site_category_model.categorize_site_osm(latitude, longitude)
            except Exception as e:
                return jsonify({"error": f"An error occurred: {e}"}), 500

            response = {
                "site": {
                    "site-category": {
                        "category": category,
                        "search_radius": search_radius,
                        "area_name": area_name,
                        "landuse": landuse,
                        "natural": natural,
                        "waterway": waterway,
                        "highway": highway,
                        "latitude": latitude,
                        "longitude": longitude,
                    },
                    "OSM_info": debug_info,
                }
            }
            return jsonify(response), 200

        # Handle POST request for batch coordinates
        elif request.method == "POST":
            try:
                data = request.get_json()
                coords = data.get("coordinates", [])
                if not coords or not all(isinstance(coord, list) and len(coord) == 2 for coord in coords):
                    return jsonify({"error": "Invalid coordinates format. Expected list of [latitude, longitude] pairs."}), 400

                for lat, lon in coords:
                    try:
                        lat, lon = float(lat), float(lon)
                    except (TypeError, ValueError):
                        return jsonify({"error": f"Invalid coordinates: {lat}, {lon} must be valid floating-point numbers"}), 400

                    if not has_at_least_six_decimal_places(lat) or not has_at_least_six_decimal_places(lon):
                        return jsonify({"error": f"Coordinates {lat}, {lon} must have at least 6 decimal places"}), 400

                results = site_category_model.batch_categorize(coords)

                response = {
                    "sites": [
                        {
                            "latitude": lat,
                            "longitude": lon,
                            "site-category": {
                                "category": result[0],
                                "search_radius": result[1],
                                "area_name": result[2],
                                "landuse": result[3],
                                "natural": result[4],
                                "waterway": result[5],
                                "highway": result[6],
                            },
                            "OSM_info": result[7]
                        }
                        for (lat, lon), result in results.items()
                    ]
                }
                return jsonify(response), 200
            except Exception as e:
                return jsonify({"error": f"An error occurred: {str(e)}"}), 500

        else:
            return jsonify({"error": "Method not allowed. Use GET for single site or POST for batch."}), 405