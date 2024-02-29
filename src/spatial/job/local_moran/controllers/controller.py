# controller/controller.py
from flask import Blueprint, request, jsonify
from services.localmoran_services import SpatialDataHandler

controller_bp = Blueprint('controller', __name__)

@controller_bp.route('/localmoran', methods=['POST'])
def get_air_quality_data():
    return SpatialDataHandler.get_air_quality_data()
