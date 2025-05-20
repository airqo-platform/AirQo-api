# views/PolygonSensorOptimizerViews.py
from flask import request, jsonify
from shapely.geometry import Polygon, MultiPolygon
from models.PolygonSensorOptimizer import PolygonSensorOptimizer
import logging

# Configure logging
# The application should configure logging.  
logger = logging.getLogger(__name__)

class SensorOptimizationAPI:
    @staticmethod
    def optimize_sensors():
        try:
            data = request.get_json()
            if not data or 'geometry' not in data or 'coordinates' not in data['geometry']:
                return jsonify({"error": "Missing or invalid geometry coordinates"}), 400

            coords = data['geometry']['coordinates']

            try:
                if isinstance(coords[0][0][0], (int, float)):
                    geometry = Polygon(coords[0])  # Single Polygon
                elif isinstance(coords[0][0][0][0], (int, float)):
                    geometry = MultiPolygon([Polygon(p[0]) for p in coords])  # MultiPolygon
                else:
                    raise ValueError("Unsupported coordinate structure")
            except Exception as e:
                logger.error(f"Failed to parse geometry: {e}")
                return jsonify({"error": f"Invalid GeoJSON geometry: {str(e)}"}), 400

            if not geometry.is_valid:
                return jsonify({"error": "Invalid geometry provided"}), 400

            optimizer = PolygonSensorOptimizer()

            if 'config' in data:
                try:
                    optimizer.configure(**data['config'])
                except Exception as e:
                    logger.error(f"Invalid configuration: {e}")
                    return jsonify({"error": f"Invalid configuration: {str(e)}"}), 400

            logger.info("Running sensor optimization...")
            result = optimizer.optimize_sensors(geometry)
            logger.info("Optimization complete.")

            if "error" in result:
                return jsonify({"error": result["error"]}), 400

            return jsonify(result), 200

        except Exception as e:
            logger.error(f"Unexpected server error: {e}")
            return jsonify({"error": f"Server error: {str(e)}"}), 500
