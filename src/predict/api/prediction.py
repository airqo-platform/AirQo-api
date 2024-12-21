import traceback

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from flask import current_app
from functools import wraps
from typing import Dict, List, Optional, Union, Callable

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
    get_static_health_tip,
    add_forecast_health_tips_cached
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

DEFAULT_HEALTH_TIPS = {
    "good": {
        "everyone": {
            "title": "For Everyone",
            "description": "Air quality is good. Perfect for outdoor activities."
        }
    },
    "moderate": {
        "everyone": {
            "title": "For Everyone",
            "description": "Air quality is acceptable. Unusually sensitive people should consider reducing prolonged outdoor exertion."
        },
        "sensitive": {
            "title": "For Sensitive Groups",
            "description": "Consider reducing prolonged outdoor activities if you experience symptoms."
        }
    },
    "u4sg": {
        "everyone": {
            "title": "For Everyone",
            "description": "Reduce prolonged or heavy outdoor exertion. Take more breaks during outdoor activities."
        },
        "sensitive": {
            "title": "For Sensitive Groups",
            "description": "People with respiratory or heart conditions, elderly and children should limit outdoor exertion."
        }
    },
    "unhealthy": {
        "everyone": {
            "title": "For Everyone",
            "description": "Avoid prolonged or heavy outdoor exertion. Move activities indoors or reschedule."
        }
    },
    "very_unhealthy": {
        "everyone": {
            "title": "For Everyone",
            "description": "Avoid all outdoor activities. Stay indoors if possible."
        }
    },
    "hazardous": {
        "everyone": {
            "title": "For Everyone",
            "description": "Stay indoors and keep activity levels low. Wear a mask if you must go outside."
        }
    }
}

def handle_forecast_response(func: Callable) -> Callable:
    """
    Decorator to standardize forecast response handling and error management.
    Reduces code duplication and centralizes error handling.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            language = request.args.get("language", default="", type=str)
            result = func(*args, **kwargs)
            
            if not result:
                return jsonify({
                    "message": "No forecasts are available.",
                    "success": False,
                }), 404
                
            # Process health tips in batches for better memory management
            enhanced_result = process_forecasts(result, language)
            
            return jsonify({
                "success": True,
                "message": f"Forecasts successfully retrieved.",
                "forecasts": enhanced_result,
                "aqi_ranges": AQI_RANGES
            }), 200
            
        except Exception as e:
            current_app.logger.error(f"Error processing forecast: {str(e)}", exc_info=True)
            return jsonify({
                "message": "An error occurred processing the forecast.",
                "success": False
            }), 500
    
    return wrapper

def process_forecasts(
    result: Union[Dict, List], 
    language: str, 
    batch_size: int = 100
) -> Dict:
    """
    Process forecasts in batches to optimize memory usage and improve performance.
    
    Args:
        result: Forecast data to process
        language: Language for health tips
        batch_size: Number of forecasts to process in each batch
        
    Returns:
        Dict: Processed forecast data with health tips
    """
    if isinstance(result, dict) and "forecasts" in result:
        # Single site forecast
        return process_single_site(result, language)
    
    # Multi-site forecast
    return process_multiple_sites(result, language, batch_size)

def process_single_site(result: Dict, language: str) -> Dict:
    """Process a single site's forecasts efficiently."""
    enhanced = enhance_forecast_response(result, language)
    processed = add_forecast_health_tips({"default": enhanced["forecasts"]}, language)
    enhanced["forecasts"] = processed["default"]
    return enhanced

def process_multiple_sites(
    result: Dict, 
    language: str, 
    batch_size: int
) -> Dict:
    """
    Process multiple sites' forecasts in batches for better performance.
    Implements generator-based batch processing to reduce memory usage.
    """
    enhanced_result = {}
    
    # Pre-fetch health tips once to avoid multiple API calls
    health_tips = get_health_tips(language)
    
    # Process sites in batches
    sites = list(result.keys())
    for i in range(0, len(sites), batch_size):
        batch_sites = sites[i:i + batch_size]
        batch_result = {
            site_id: result[site_id] 
            for site_id in batch_sites
        }
        
        # Process batch
        for site_id, forecasts in batch_result.items():
            site_result = {"forecasts": forecasts}
            enhanced_site = enhance_forecast_response(site_result, language)
            enhanced_result[site_id] = enhanced_site["forecasts"]
            
        # Add health tips for the batch
        enhanced_batch = add_forecast_health_tips_cached(
            {site_id: enhanced_result[site_id] for site_id in batch_sites},
            health_tips,
            language
        )
        enhanced_result.update(enhanced_batch)
    
    return enhanced_result


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
    Enhanced forecast response with more resilient health tip handling.
    
    Args:
        result (dict): Original forecast result
        language (str): Language preference
        
    Returns:
        dict: Enhanced forecast result
    """
    enhanced_result = {}
    
    if 'forecasts' in result:
        enhanced_forecasts = []
        
        # Try to get health tips from API first
        try:
            api_health_tips = get_health_tips(language=language)
        except Exception as e:
            current_app.logger.error(f"Error fetching API health tips: {str(e)}")
            api_health_tips = []
        
        for forecast in result['forecasts']:
            enhanced_forecast = forecast.copy()
            pm2_5_value = forecast['pm2_5']
            
            # Add AQI category details
            aqi_category_details = get_aqi_category(pm2_5_value)
            if aqi_category_details:
                enhanced_forecast.update({
                    'aqi_category': aqi_category_details['aqi_category'],
                    'aqi_color': aqi_category_details['aqi_color'],
                    'aqi_color_name': aqi_category_details['aqi_color_name']
                })
            
            # Try API health tips first
            health_tips = []
            if api_health_tips:
                health_tips = [
                    tip for tip in api_health_tips
                    if (tip['aqi_category']['max'] is None and pm2_5_value >= tip['aqi_category']['min']) or
                    (tip['aqi_category']['max'] is not None and 
                     tip['aqi_category']['min'] <= pm2_5_value <= tip['aqi_category']['max'])
                ]
            
            # Fallback to static tips if no API tips available
            if not health_tips:
                static_tips = get_static_health_tip(pm2_5_value)
                health_tips = [
                    {"title": tip["title"], "description": tip["description"]}
                    for tip in static_tips.values()
                ]
            
            enhanced_forecast['health_tips'] = health_tips
            enhanced_forecasts.append(enhanced_forecast)
        
        # Reorder the response structure
        enhanced_result['forecasts'] = enhanced_forecasts
        
        # Copy other fields except aqi_ranges
        for key, value in result.items():
            if key not in ['forecasts', 'aqi_ranges']:
                enhanced_result[key] = value
        
        # Add AQI ranges at the end
        enhanced_result['aqi_ranges'] = AQI_RANGES
    
    return enhanced_result


ml_app = Blueprint("ml_app", __name__)

@ml_app.get(routes.route["fetch_faulty_devices"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=get_faults_cache_key)
def fetch_faulty_devices():
    """Fetch faulty devices endpoint."""
    try:
        result = read_faulty_devices()
        if len(result) == 0:
            return jsonify({
                "message": "Error fetching faulty devices",
                "success": True,
                "data": None,
            }), 200
            
        return jsonify({
            "message": "Faulty devices found",
            "success": True,
            "data": result,
            "total": len(result),
        }), 200
        
    except Exception as e:
        current_app.logger.error("Error: ", str(e))
        return jsonify({
            "message": "Internal server error",
            "success": False,
            "data": None
        }), 500

@ml_app.route(routes.route["next_24hr_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=hourly_forecasts_cache_key)
def get_next_24hr_forecasts():
    """Get forecasts for the next 24 hours from specified start time."""
    params = {
        name: request.args.get(name, default=None, type=str)
        for name in [
            "site_id", "site_name", "parish",
            "county", "city", "district", "region"
        ]
    }
    
    if not any(params.values()):
        return jsonify({
            "message": "Please specify at least one query parameter",
            "success": False,
        }), 400
        
    language = request.args.get("language", default="", type=str)
    result = get_forecasts_1(**params, db_name="hourly_forecasts_1")
    
    if result:
        result = enhance_forecast_response(result, language)
        response = result
    else:
        response = {
            "message": "forecasts for this site are not available",
            "success": False,
        }
    
    return jsonify(response), 200

@ml_app.route(routes.route["next_1_week_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=daily_forecasts_cache_key)
@handle_forecast_response
def get_next_1_week_forecasts():
    """Get forecasts for the next 1 week from specified start day."""
    params = {
        name: request.args.get(name, default=None, type=str)
        for name in [
            "device_id", "site_id", "site_name", "parish",
            "county", "city", "district", "region",
        ]
    }
    
    if not any(params.values()):
        raise ValueError("Please specify at least one query parameter")
        
    return get_forecasts_1(**params, db_name="daily_forecasts_1")

@ml_app.route(routes.route["all_1_week_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=all_daily_forecasts_cache_key)
@handle_forecast_response
def get_all_daily_forecasts():
    """Get all forecasts from the database."""
    return get_forecasts_2(db_name="daily_forecasts_1", all_forecasts=True)

@ml_app.route(routes.route["all_24hr_forecasts"], methods=["GET"])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=all_hourly_forecasts_cache_key)
@handle_forecast_response
def get_all_hourly_forecasts():
    """Get all hourly forecasts from the database."""
    return get_forecasts_2(db_name="hourly_forecasts_1", all_forecasts=True)

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