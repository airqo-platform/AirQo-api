# controller/controller.py
from flask import Blueprint
from views.site_category_view import SiteCategorizationView
from views.site_selection_views import SiteSelectionView 
from views.PolygonSensorOptimizerViews import SensorOptimizationAPI
from views.heatmapViews import AQIImageGenerator
from views.source_metadata_view import SourceMetadataView
from views.satellite_predictions import SatellitePredictionView
from views.active_fire_view import ActiveFireView



controller_bp = Blueprint("controller", __name__)


@controller_bp.route("/categorize_site", methods=["GET"])
def categorize_site():
    return SiteCategorizationView.get_site_categorization()


@controller_bp.route("/site_location", methods=["POST"])
def site_selection():
    return SiteSelectionView.site_selection()


@controller_bp.route("/polygon_site_location", methods=["POST"])
def polygon_site_selection():
    return SensorOptimizationAPI.optimize_sensors()
     
@controller_bp.route("/heatmaps", methods=["GET"])
def get_heatmaps():
    return AQIImageGenerator.generate_aqi_image()

@controller_bp.route("/heatmaps/<id>", methods=["GET"])
def get_heatmap_by_id(id):
    return AQIImageGenerator.generate_aqi_image_for_city(id)


@controller_bp.route("/source_metadata", methods=["GET"])
def get_source_metadata():
    return SourceMetadataView.get_source_metadata()


@controller_bp.route("/source_metadata/batch", methods=["POST"])
def get_source_metadata_batch():
    return SourceMetadataView.get_source_metadata_batch()


@controller_bp.route("/satellite_prediction", methods=["POST"])
def get_satellite_prediction():
    return SatellitePredictionView.make_predictions()


@controller_bp.route("/active_fires/africa", methods=["GET"])
def get_africa_active_fires():
    return ActiveFireView.get_africa_active_fires()
