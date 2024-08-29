from flask import Flask, request, jsonify
from models.site_selection_model import SensorDeployment 

app = Flask(__name__)
# Assuming the classes SiteCategoryModel and SensorDeployment are already defined above or imported
 

class SiteSelectionView:
    def site_selection():
        data = request.json
        polygon = data.get('polygon')
        must_have_locations = data.get('must_have_locations', [])
        min_distance_km = data.get('min_distance_km', 3)
        num_sensors = data.get('num_sensors', len(must_have_locations) + 5)

        deployment = SensorDeployment(polygon, must_have_locations, min_distance_km)
        deployment.optimize_sensor_locations(num_sensors)
        deployment.categorize_sites()

        # Format the response as per your requirement
        formatted_sites = {
            "site_location": [
                {
                    "area_name": site.get('area_name', "Unknown"),
                    "category": site.get('category', "Unknown"),
                    "highway": site.get('highway', None),
                    "landuse": site.get('landuse', None),
                    "latitude": site['latitude'],
                    "longitude": site['longitude'],
                    "natural": site.get('natural', None)
                } for site in deployment.sites
            ]
        }

        return jsonify(formatted_sites)