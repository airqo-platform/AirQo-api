# controller/controller.py
from flask import Blueprint, request, jsonify

from views.getis_services import SpatialDataHandler
from views.getis_confidence_services import SpatialDataHandler_confidence
from views.localmoran_services import SpatialDataHandler_moran
from views.derived_pm2_5 import (
    PM25View,
    PM25_aod_Model_daily,
    Sentinel5PView,
    Satellite_data,
)
from views.satellite_predictions import SatellitePredictionView
from views.site_category_view import SiteCategorizationView
from views.site_selection_views import SiteSelectionView
from views.report_view import ReportView

from views.pollutant_views import PollutantApis
from views.pollutant_profile_view import PollutantProfileApis


controller_bp = Blueprint("controller", __name__)


# 95% confidence level
@controller_bp.route("/getisord", methods=["POST"])
def get_air_quality_data():
    return SpatialDataHandler.get_air_quality_data()


@controller_bp.route("/getisord_confidence", methods=["POST"])
def get_air_quality_data_confi():
    return SpatialDataHandler_confidence.get_air_quality_data_getis()


@controller_bp.route("/localmoran", methods=["POST"])
def get_air_quality_data_moran():
    return SpatialDataHandler_moran.get_air_quality_data_moran()


@controller_bp.route("/derived_pm2_5", methods=["GET"])
def get_derived_pm2_5():
    return PM25View.get_pm25()


@controller_bp.route("/derived_pm2_5_daily", methods=["GET"])
def get_derived_pm2_5_daily():
    return PM25_aod_Model_daily.get_aod_for_dates()


@controller_bp.route("/sentinel5p", methods=["GET"])
def get_sentinel5p():
    return Sentinel5PView.get_pollutants_data()


@controller_bp.route("/satellite_data", methods=["GET"])
def get_satellite_data():
    return Satellite_data.get_pollutants_data()


@controller_bp.route("/categorize_site", methods=["GET"])
def categorize_site():
    return SiteCategorizationView.get_site_categorization()


@controller_bp.route("/site_location", methods=["POST"])
def site_selection():
    return SiteSelectionView.site_selection()


@controller_bp.route("/satellite_prediction", methods=["POST"])
def get_satellite_prediction():
    return SatellitePredictionView.make_predictions()
    
@controller_bp.route("/air_quality_report", methods=["POST"])
def fetch_air_quality():
    return ReportView.generate_air_quality_report_with_gemini()

@controller_bp.route("/rulebase_air_quality_report", methods=["POST"])
def fetch_air_quality_without_llm():
    return ReportView.generate_air_quality_report_without_llm()

@controller_bp.route("/air_quality_report_with_customised_prompt", methods=["POST"])
def fetch_air_quality_with_customised_prompt():
    return ReportView.generate_air_quality_report_with_customised_prompt_gemini()

@controller_bp.route('/upload-image', methods=['POST'])
def upload_image_for_prediction():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    return PollutantApis.upload_image()

@controller_bp.route('/get-data-by-confidence', methods=['GET'])
def get_data_by_confidence():
    return PollutantApis.get_data_by_confidence()

@controller_bp.route('/get-all-data', methods=['GET'])
def get_all_data():
    return PollutantApis.get_all_data()

@controller_bp.route('/get-all-data-location', methods=['GET'])
def get_all_location_data():
    return PollutantProfileApis.get_all_data()

