# controller/controller.py
from flask import Blueprint, request, jsonify
from views.getis_services import SpatialDataHandler
from views.getis_confidence_services import SpatialDataHandler_confidence
from views.localmoran_services import SpatialDataHandler_moran


controller_bp = Blueprint('controller', __name__)
  # 95% confidence level
@controller_bp.route('/getisord', methods=['POST'])
def get_air_quality_data():
    return SpatialDataHandler.get_air_quality_data()

@controller_bp.route('/getisord_confidence', methods=['POST'])
def get_air_quality_data_confi():
    return SpatialDataHandler_confidence.get_air_quality_data_getis()

@controller_bp.route('/localmoran', methods=['POST'])
def get_air_quality_data_moran():
    return SpatialDataHandler_moran.get_air_quality_data_moran()
