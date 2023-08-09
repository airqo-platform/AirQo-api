import logging
import traceback

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify

import routes
from app import cache
from config import Config
from helpers import (
    get_parish_predictions,
    convert_to_geojson,
    get_forecasts,
    hourly_forecasts_cache_key,
    daily_forecasts_cache_key,
    get_faults_cache_key,
    get_predictions_by_geo_coordinates_v2,
    get_predictions_by_geo_coordinates,
    get_health_tips,
    geo_coordinates_cache_key,
    read_predictions_from_db,
    heatmap_cache_key,
    read_faulty_devices,
    validate_param_values,
)

load_dotenv()

_logger = logging.getLogger(__name__)

ml_app = Blueprint("ml_app", __name__)


@ml_app.route(routes.route["fetch_faulty_devices"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=get_faults_cache_key)
def fetch_faulty_devices():
    try:
        params = request.args.to_dict()
        valid, error = validate_param_values(params)
        if not valid:
            return jsonify({"error": error}), 400
        query = {}
        for param, value in params.items():
            if param == "airqloud_names":
                query[param] = {"$in": [value]}
            else:
                query[param] = {
                    "$eq": int(value)
                    if param in ["correlation_fault", "missing_data_fault"]
                    else value
                }

        result = read_faulty_devices(query)
        return jsonify(result), 200
    except Exception as e:
        _logger.error(e)
        return jsonify({"error": "Failed to retrieve faulty devices"}), 500


@ml_app.route(routes.route["next_24hr_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=hourly_forecasts_cache_key)
def get_next_24hr_forecasts():
    """
    Get forecasts for the next 24 hours from specified start time.
    """

    """
    Get forecasts for the next 1 week from specified start day.
    """
    params = {
        name: request.args.get(name, default=None, type=str)
        for name in [
            "site_id",
            "site_name",
            "parish",
            "county",
            "city",
            "district",
            "region",
        ]
    }
    if not any(params.values()):
        return (
            jsonify(
                {
                    "message": "Please specify at least one query parameter",
                    "success": False,
                }
            ),
            400,
        )
    result = get_forecasts(**params, db_name="hourly_forecasts")
    if result:
        response = result
    else:
        response = {
            "message": "forecasts for this site are not available",
            "success": False,
        }
    data = jsonify(response)
    return data, 200


@ml_app.route(routes.route["next_1_week_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=daily_forecasts_cache_key)
def get_next_1_week_forecasts():
    """
    Get forecasts for the next 1 week from specified start day.
    """
    params = {
        name: request.args.get(name, default=None, type=str)
        for name in [
            "site_id",
            "site_name",
            "parish",
            "county",
            "city",
            "district",
            "region",
        ]
    }
    if not any(params.values()):
        return (
            jsonify(
                {
                    "message": "Please specify at least one query parameter",
                    "success": False,
                }
            ),
            400,
        )
    result = get_forecasts(**params, db_name="daily_forecasts")
    if result:
        response = result
    else:
        response = {
            "message": "forecasts for this site are not available",
            "success": False,
        }
    data = jsonify(response)
    return data, 200


@ml_app.route(routes.route["predict_for_heatmap"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=heatmap_cache_key)
def predictions_for_heatmap():
    airqloud = request.args.get("airqloud")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 1000))

    response = {}

    try:
        values, total = read_predictions_from_db(airqloud, page, limit)
        if values:
            response["predictions"] = convert_to_geojson(values)
            response["total"] = total
            response["pages"] = (total // limit) + (1 if total % limit else 0)
            response["page"] = page
            if airqloud:
                response["airqloud"] = airqloud
            status_code = 200
        else:
            response["error"] = "No data found."
            status_code = 404
    except Exception as e:
        response["error"] = f"Unfortunately an error occured"
        status_code = 500
    finally:
        return jsonify(response), status_code


@ml_app.route(routes.route["search_predictions"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=geo_coordinates_cache_key)
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


@ml_app.route(routes.route["parish_predictions"], methods=["GET"])
def parish_predictions():
    try:
        page = int(request.args.get("page", 1, type=int))
        page_size = int(request.args.get("page_size", 10, type=int))
        limit = Config.PARISH_PREDICTIONS_QUERY_LIMIT
        if page_size > limit:
            page_size = limit
        offset = (page - 1) * page_size

        parish = request.args.get("parish", None)
        data, total_pages = get_parish_predictions(
            parish, page_size=page_size, offset=offset
        )
        return {
            "success": True,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "page_limit": limit,
            "data": data,
        }, 200
    except Exception as ex:
        print(ex)
        traceback.print_exc()
        return {"message": "Please contact support", "success": False}, 500


if __name__ == "__main__":
    print(predictions_for_heatmap())
