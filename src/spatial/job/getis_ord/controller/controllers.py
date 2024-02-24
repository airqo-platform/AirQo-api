# controller/controller.py
from flask import Blueprint, request, jsonify
from services.getis_services import SpatialDataHandler
controller_bp = Blueprint('controller', __name__)

@controller_bp.route('/getisord', methods=['POST'])
def get_air_quality_data():
    return SpatialDataHandler.get_air_quality_data()
