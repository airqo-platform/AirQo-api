import json
from flask import Flask, request, jsonify
from shapely.geometry import Polygon, Point
import logging
from models.site_selection_model import SensorDeployment 

app = Flask(__name__)
# Assuming the classes SiteCategoryModel and SensorDeployment are already defined above or imported
 

class SiteSelectionView:
    def site_selection():
        data = request.json
        polygon = data.get('polygon')
        must_have_locations = data.get('must_have_locations', [])
        min_distance_km = data.get('min_distance_km', 3)
        num_sensors = data.get('num_sensors', len(must_have_locations) + 5)  # Default if not provided

        deployment = SensorDeployment(polygon, must_have_locations, min_distance_km)
        deployment.optimize_sensor_locations(num_sensors)
        deployment.categorize_sites()

        return jsonify(deployment.sites)
        # Assuming the classes SiteCategoryModel and SensorDeployment are already defined above or imported