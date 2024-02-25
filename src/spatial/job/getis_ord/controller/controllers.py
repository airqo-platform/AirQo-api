# controller/controller.py
from flask import Blueprint, request, jsonify
from services.getis_services import SpatialDataHandler
from services.getis_confidence_services import SpatialDataHandler_confidence
controller_bp = Blueprint('controller', __name__)

@controller_bp.route('/getisord', methods=['POST'])
def get_air_quality_data():
    return SpatialDataHandler.get_air_quality_data()

@controller_bp.route('/getisord_confidence', methods=['POST'])
def get_air_quality_data_confi():
    return SpatialDataHandler_confidence.get_air_quality_data()
