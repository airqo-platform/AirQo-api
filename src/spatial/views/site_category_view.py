from flask import request, jsonify
from models.site_category_model import SiteCategoryModel

class SiteCategorizationView:
    
    @staticmethod
    def get_site_categorization():
        # Extract and validate latitude and longitude
        try:
            latitude = float(request.args.get('latitude'))
            longitude = float(request.args.get('longitude'))
        except (TypeError, ValueError):
            return jsonify({"error": "Latitude and longitude must be valid floating-point numbers"}), 400
        
        # Validate that latitude and longitude have at least 6 decimal places
        def has_at_least_six_decimal_places(value):
            str_value = f"{value:.10f}"  # Use more than 6 decimal places to ensure accuracy
            integer_part, decimal_part = str_value.split('.')
            return len(decimal_part) >= 6
        
        if not has_at_least_six_decimal_places(latitude) or not has_at_least_six_decimal_places(longitude):
            return jsonify({"error": "Latitude and longitude must have at least 6 decimal places"}), 400

        # Instantiate the model and categorize the site
        site_category_model = SiteCategoryModel(category=None)
        try:
            category, search_radius, area_name, landuse, natural, waterway, highway, debug_info = site_category_model.categorize_site_osm(latitude, longitude)
        except Exception as e:
            return jsonify({"error": f"An error occurred: {e}"}), 500
        
        # Prepare and return the response
        response = {
            "site":{
            "site-category": {
                "category": category,
                "search_radius": search_radius,
                "area_name": area_name,
                "landuse": landuse,
                "natural": natural,
                "waterway": waterway,
                "highway": highway,
                "latitude": latitude,
                "longitude": longitude
            },
            "OSM_info": debug_info
        }
        }
        return jsonify(response), 200
