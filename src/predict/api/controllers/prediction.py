import logging
import traceback

from dotenv import load_dotenv
from flask import Blueprint, request

from helpers.utils import (
    get_all_gp_predictions,
    get_gp_predictions,
    get_gp_predictions_id,
    get_forecasts_helper,
    get_predictions_by_geo_coordinates,
    get_health_tips,
    get_predictions_by_geo_coordinates_v2,
)
from routes import api

load_dotenv()

_logger = logging.getLogger(__name__)

ml_app = Blueprint("ml_app", __name__)


@ml_app.route(api.route["next_24hr_forecasts"], methods=["GET"])
def get_next_24hr_forecasts():
    """
    Get forecasts for the next 24 hours from specified start time.
    """
    return get_forecasts_helper(db_name="hourly_forecasts")


@ml_app.route(api.route["next_1_week_forecasts"], methods=["GET"])
def get_next_1_week_forecasts():
    """
    Get forecasts for the next 1 week from specified start day.
    """
    return get_forecasts_helper(db_name="daily_forecasts")


@ml_app.route(api.route["predict_for_heatmap"], methods=["GET"])
def predictions_for_heatmap():
    """
    makes predictions for a specified location at a given time.
    """
    if request.method == "GET":
        try:
            airqloud = request.args.get("airqloud").lower()
            data = get_gp_predictions(airqloud)
        except:
            try:
                aq_id = request.args.get("id")
                data = get_gp_predictions_id(aq_id)
            except:
                return {"message": "Please specify an airqloud", "success": False}, 400

        print(request.args.get("airqloud"))
        if request.args.get("airqloud") == None:
            data = get_all_gp_predictions()
            if not len(data) > 0:
                return {"message": "No predictions available", "success": False}, 400
        if len(data) > 0:
            return {"success": True, "data": data}, 200
        else:
            return {"message": "No data for specified airqloud", "success": False}, 400
    else:
        return {
            "message": "Wrong request method. This is a GET endpoint.",
            "success": False,
        }, 400


@ml_app.route(api.route["search_predictions"], methods=["GET"])
def search_predictions():
    try:
        latitude = float(request.args.get("latitude"))
        longitude = float(request.args.get("longitude"))
        source = str(request.args.get("source", "parishes")).lower()
        distance_in_metres = int(request.args.get("distance", 100))
        if source == "parishes":
            data = get_predictions_by_geo_coordinates_v2(
                latitude=latitude,
                longitude=longitude,
            )
        else:
            data = get_predictions_by_geo_coordinates(
                latitude=latitude,
                longitude=longitude,
                distance_in_metres=distance_in_metres,
            )
        if data:
            health_tips = get_health_tips()
            pm2_5 = data["pm2_5"]
            data["health_tips"] = list(
                filter(
                    lambda x: x["aqi_category"]["max"]
                    >= pm2_5
                    >= x["aqi_category"]["min"],
                    health_tips,
                )
            )

        return {"success": True, "data": data}, 200

    except Exception as ex:
        print(ex)
        traceback.print_exc()
        return {"message": "Please contact support", "success": False}, 500


if __name__ == "__main__":
    print(predictions_for_heatmap())
