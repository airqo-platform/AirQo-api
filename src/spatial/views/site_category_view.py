import math

from flask import request, jsonify
from models.site_category_model import SiteCategoryModel


class SiteCategorizationView:
    @staticmethod
    def get_site_categorization():
        # Extract and validate latitude and longitude
        try:
            latitude = float(request.args.get("latitude"))
            longitude = float(request.args.get("longitude"))
        except (TypeError, ValueError):
            return (
                jsonify(
                    {
                        "error": "Latitude and longitude must be valid floating-point numbers"
                    }
                ),
                400,
            )

        if not math.isfinite(latitude) or not math.isfinite(longitude):
            return (
                jsonify({"error": "Latitude and longitude must be finite numbers"}),
                400,
            )
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            return jsonify({"error": "Coordinates are outside valid latitude/longitude ranges"}), 400

        # Instantiate the model and categorize the site
        site_category_model = SiteCategoryModel(category=None)
        try:
            (
                category,
                matched_feature_distance_m,
                area_name,
                landuse,
                natural,
                waterway,
                highway,
                debug_info,
            ) = site_category_model.categorize_site_osm(latitude, longitude)
        except Exception as e:
            return jsonify({"error": f"An error occurred: {e}"}), 500

        # Prepare and return the response
        response = {
            "site": {
                "site-category": {
                    "category": category,
                    "matched_feature_distance_m": matched_feature_distance_m,
                    "area_name": area_name,
                    "landuse": landuse,
                    "natural": natural,
                    "waterway": waterway,
                    "highway": highway,
                    "latitude": latitude,
                    "longitude": longitude,
                    **site_category_model.last_details,
                },
                "OSM_info": debug_info,
            }
        }
        return jsonify(response), 200
