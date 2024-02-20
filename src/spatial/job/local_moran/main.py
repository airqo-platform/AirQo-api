from flask import Flask, jsonify, request
from utils import AirQualitySpatilaAnalyzer
from geojson import FeatureCollection
from datetime import datetime
from moran_analyzer import SpatialDataHandler

app = Flask(__name__)

@app.route('/spatial/local', methods=['POST'])
def air_quality_data_route():
    return SpatialDataHandler.get_air_quality_data()
if __name__ == '__main__':
    app.run()
