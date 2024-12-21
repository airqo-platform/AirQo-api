import traceback

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from flask import current_app

import routes
from app import cache
from config import Config
from helpers import (
    get_parish_predictions,
    convert_to_geojson,
    get_forecasts_1,
    get_forecasts_2,
    hourly_forecasts_cache_key,
    daily_forecasts_cache_key,
    all_daily_forecasts_cache_key,
    all_hourly_forecasts_cache_key,
    get_predictions_by_geo_coordinates_v2,
    get_predictions_by_geo_coordinates,
    get_health_tips,
    geo_coordinates_cache_key,
    read_predictions_from_db,
    heatmap_cache_key,
    read_faulty_devices,
    get_faults_cache_key,
    add_forecast_health_tips,
)

load_dotenv()

# Centralized AQI Ranges Configuration
AQI_RANGES = {
    "good": {
        "min": 0,
        "max": 9.1,
        "label": "Good",
        "aqi_category": "Good",
        "aqi_color": "00e400",
        "aqi_color_name": "Green"
    },
    "moderate": {
        "min": 9.101,
        "max": 35.49,
        "label": "Moderate",
        "aqi_category": "Moderate",
        "aqi_color": "ffff00",
        "aqi_color_name": "Yellow"
    },
    "u4sg": {
        "min": 35.491,
        "max": 55.49,
        "label": "Unhealthy for Sensitive Groups",
        "aqi_category": "Unhealthy for Sensitive Groups",
        "aqi_color": "ff7e00",
        "aqi_color_name": "Orange"
    },
    "unhealthy": {
        "min": 55.491,
        "max": 125.49,
        "label": "Unhealthy",
        "aqi_category": "Unhealthy",
        "aqi_color": "ff0000",
        "aqi_color_name": "Red"
    },
    "very_unhealthy": {
        "min": 125.491,
        "max": 225.49,
        "label": "Very Unhealthy",
        "aqi_category": "Very Unhealthy",
        "aqi_color": "8f3f97",
        "aqi_color_name": "Purple"
    },
    "hazardous": {
        "min": 225.491,
        "max": None,
        "label": "Hazardous",
        "aqi_category": "Hazardous",
        "aqi_color": "7e0023",
        "aqi_color_name": "Maroon"
    }
}

def get_aqi_category(value):
    """
    Determine the AQI category for a given value.
    
    Args:
        value (float): The air quality value to categorize
    
    Returns:
        dict: The AQI category that matches the value
    """
    for category, range_info in AQI_RANGES.items():
        if range_info['max'] is None and value >= range_info['min']:
            return {
                'category': category,
                **range_info
            }
        elif range_info['max'] is not None and range_info['min'] <= value <= range_info['max']:
            return {
                'category': category,
                **range_info
            }
    return None

def enhance_forecast_response(result, language=''):
    """
    Enhance forecast response with additional metadata.
    
    Args:
        result (dict): The original forecast result
        language (str, optional): Language for health tips. Defaults to ''
    
    Returns:
        dict: Enhanced forecast result
    """
    # Add health tips if possible
    try:
        add_forecast_health_tips(result, language=language)
    except Exception as e:
        current_app.logger.error(f"Error adding health tips: {str(e)}")
    
    # Add AQI ranges to the response
    result['aqi_ranges'] = AQI_RANGES
    
    # Enhance forecasts with AQI category, color, and color name
    if 'forecasts' in result:
        enhanced_forecasts = []
        for forecast in result['forecasts']:
            enhanced_forecast = forecast.copy()
            aqi_category_details = get_aqi_category(forecast['pm2_5'])
            
            if aqi_category_details:
                enhanced_forecast.update({
                    'aqi_category': aqi_category_details['aqi_category'],
                    'aqi_color': aqi_category_details['aqi_color'],
                    'aqi_color_name': aqi_category_details['aqi_color_name']
                })
            
            enhanced_forecasts.append(enhanced_forecast)
        
        result['forecasts'] = enhanced_forecasts
    
    return result

ml_app = Blueprint("ml_app", __name__)

@ml_app.get(routes.route["fetch_faulty_devices"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=get_faults_cache_key)
def fetch_faulty_devices():
    try:
        result = read_faulty_devices()
        if len(result) == 0:
            return (
                jsonify(
                    {
                        "message": "Error fetching faulty devices",
                        "success": True,
                        "data": None,
                    }
                ),
                200,
            )
        return (
            jsonify(
                {
                    "message": "Faulty devices found",
                    "success": True,
                    "data": result,
                    "total": len(result),
                }
            ),
            200,
        )
    except Exception as e:
        current_app.logger.error("Error: ", str(e))
        return (
            jsonify(
                {"message": "Internal server error", "success": False, "data": None}
            ),
            500,
        )

@ml_app.route(routes.route["next_24hr_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=hourly_forecasts_cache_key)
def get_next_24hr_forecasts():
    """
    Get forecasts for the next 24 hours from specified start time.
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
    language = request.args.get("language", default="", type=str)
    result = get_forecasts_1(**params, db_name="hourly_forecasts_1")
    
    if result:
        result = enhance_forecast_response(result, language)
        
        # Restructure the response to put forecasts at the top level
        response = {
            "success": True,
            "message": "Forecasts successfully retrieved.",
            "forecasts": result['forecasts'],
            **result.get("aqi_ranges", {})
        }
        
    else:
        response = {
            "message": "No forecasts are available.",
            "success": False,
        }
    
    return jsonify(response), 200

@ml_app.route(routes.route["next_1_week_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=daily_forecasts_cache_key)
def get_next_1_week_forecasts():
    """
    Get forecasts for the next 1 week from specified start day.
    """
    params = {
        name: request.args.get(name, default=None, type=str)
        for name in [
            "device_id",
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
    language = request.args.get("language", default="", type=str)
    result = get_forecasts_1(**params, db_name="daily_forecasts_1")
    
    if result:
        result = enhance_forecast_response(result, language)
        response = {
            "success": True,
            "message": "Forecasts successfully retrieved.",
            "forecasts": result['forecasts'],
            **result.get("aqi_ranges", {})
        }

    else:
        response = {
            "message": "No forecasts are available.",
            "success": False,
        }
    
    return jsonify(response), 200

@ml_app.route(routes.route["all_1_week_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=all_daily_forecasts_cache_key)
def get_all_daily_forecasts():
    """
    Get all forecasts from the database.
    """
    language = request.args.get("language", default="", type=str)
    result = get_forecasts_2(db_name="daily_forecasts_1", all_forecasts=True)
    current_app.logger.info(f"result: result retriece", exc_info=True)
    
    if result:
        result = enhance_forecast_response(result, language)
        response = {
            "success": True,
            "message": "All daily forecasts successfully retrieved.",
            "forecasts": result['forecasts'],
            **result.get("aqi_ranges", {})
        }
    else:
        response = {
            "message": "No forecasts are available.",
            "success": False,
        }
    
    return jsonify(response), 200

@ml_app.route(routes.route["all_24hr_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=all_hourly_forecasts_cache_key)
def get_all_hourly_forecasts():
    """
    Get all forecasts from the database.
    """
    language = request.args.get("language", default="", type=str)
    result = get_forecasts_2(db_name="hourly_forecasts_1", all_forecasts=True)
    
    if result:
        result = enhance_forecast_response(result, language)
        response = {
            "success": True,
            "message": "All hourly forecasts successfully retrieved.",
            "forecasts": result['forecasts'],
            **result.get("aqi_ranges", {})
        }
    else:
        response = {
            "message": "No forecasts are available.",
            "success": False,
        }
    
    return jsonify(response), 200

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
            response["aqi_ranges"] = AQI_RANGES  # Add AQI ranges to heatmap response
            if airqloud:
                response["airqloud"] = airqloud
            status_code = 200
        else:
            response["error"] = "No data found."
            status_code = 404
    except Exception as e:
        response["error"] = f"Unfortunately an error occured"
        current_app.logger.error("Error: ", str(e), exc_info=True)
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
            
            # Use the new get_aqi_category function
            aqi_category_details = get_aqi_category(pm2_5)
            
            if aqi_category_details:
                data.update({
                    'aqi_category': aqi_category_details['aqi_category'],
                    'aqi_color': aqi_category_details['aqi_color'],
                    'aqi_color_name': aqi_category_details['aqi_color_name']
                })

            data['health_tips'] = list(
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
        district = request.args.get("district", None)
        data, total_pages = get_parish_predictions(
            parish=parish, district=district, page_size=page_size, offset=offset
        )
        
        # Add AQI ranges to the response
        return {
            "success": True,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "page_limit": limit,
            "aqi_ranges": AQI_RANGES,
            "data": data,
        }, 200
    except Exception as ex:
        print(ex)
        traceback.print_exc()
        return {"message": "Please contact support", "success": False}, 500