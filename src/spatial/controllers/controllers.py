# controller/controller.py
from flask import Blueprint, request, jsonify
from views.getis_services import SpatialDataHandler
from views.getis_confidence_services import SpatialDataHandler_confidence
from views.localmoran_services import SpatialDataHandler_moran
from views.derived_pm2_5 import PM25View, PM25_aod_Model_daily, Sentinel5PView, Satellite_data



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

@controller_bp.route('/derived_pm2_5', methods=['GET'])
def get_derived_pm2_5():
    return PM25View.get_pm25()

@controller_bp.route('/derived_pm2_5_daily', methods=['GET'])
def get_derived_pm2_5_daily():
    return PM25_aod_Model_daily.get_aod_for_dates()

@controller_bp.route('/sentinel5p', methods=['GET'])
def get_sentinel5p():
    return Sentinel5PView.get_pollutants_data()

@controller_bp.route('/satellite_data', methods=['GET'])
def get_satellite_data():
    return Satellite_data.get_pollutants_data()