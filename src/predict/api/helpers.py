import json
import math
from datetime import datetime

import pandas as pd
import requests
from dotenv import load_dotenv
from flask import current_app
from flask import request
from google.cloud import bigquery
from pymongo import errors
from sqlalchemy import func
from typing import Dict, List

from app import cache
from config import connect_mongo, Config

load_dotenv()
db = connect_mongo()

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

def date_to_str(date: datetime):
    return date.isoformat()


# Ensure these are updated when the API query parameters are changed
def heatmap_cache_key():
    args = request.args
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
    airqloud = args.get("airqloud")
    page = args.get("page")
    limit = args.get("limit")
    return f"{current_hour}_{airqloud}_{page}_{limit}"


def daily_forecasts_cache_key():
    current_day = datetime.now().strftime("%Y-%m-%d")
    args = request.args
    site_name = args.get("site_name")
    region = args.get("region")
    sub_county = args.get("sub_county")
    county = args.get("county")
    district = args.get("district")
    parish = args.get("parish")
    language = args.get("language")
    city = args.get("city")
    site_id = args.get("site_id")
    device_id = args.get("device_id")

    return f"daily_{current_day}_{site_name}_{region}_{sub_county}_{language}_{county}_{district}_{parish}_{city}_{site_id}_{device_id}"


def all_daily_forecasts_cache_key():
    current_day = datetime.now().strftime("%Y-%m-%d")
    return f"all_daily_{current_day}"


def hourly_forecasts_cache_key():
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
    args = request.args
    site_name = args.get("site_name")
    region = args.get("region")
    sub_county = args.get("sub_county")
    county = args.get("county")
    district = args.get("district")
    parish = args.get("parish")
    language = args.get("language")
    city = args.get("city")
    site_id = args.get("site_id")
    device_id = args.get("device_id")

    return f"hourly_{current_hour}_{site_name}_{region}_{sub_county}_{county}_{language}_{district}_{parish}_{city}_{site_id}_{device_id}"


def all_hourly_forecasts_cache_key():
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
    return f"all_hourly_{current_hour}"


def get_faults_cache_key():
    args = request.args
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
    airqloud = args.get("airqloud")
    device_name = args.get("device_name")
    correlation_fault = args.get("correlation_fault")
    missing_data_fault = args.get("missing_data_fault")
    created_at = args.get("created_at")
    return f"{airqloud}_{device_name}_{correlation_fault}_{missing_data_fault}_{created_at}"


def geo_coordinates_cache_key():
    key = (
        "geo_coordinates:"
        + str(round(float(request.args.get("latitude")), 6))
        + ":"
        + str(round(float(request.args.get("longitude")), 6))
        + ":"
        + str(request.args.get("distance_in_metres"))
    )
    return key


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_health_tips(language="") -> list[dict]:
    """
    Fetch health tips from the AirQo API with enhanced error handling and validation.
    
    Args:
        language (str): Optional language code for localized tips
        
    Returns:
        list[dict]: List of health tips or empty list on failure
    """
    # Validate language parameter
    if language and not isinstance(language, str):
        current_app.logger.warning(f"Invalid language parameter type: {type(language)}")
        return []

    # Build request parameters including the token
    params = {"token": Config.AIRQO_API_AUTH_TOKEN}
    if language:
        params["language"] = language.strip()

    try:
        # Make request with timeout
        response = requests.get(
            f"{Config.AIRQO_BASE_URL}api/v2/devices/tips",
            params=params,
            timeout=10
        )
        
        # Raise for bad status
        response.raise_for_status()
        
        # Parse response
        result = response.json()
        
        # Validate response structure
        if not isinstance(result, dict):
            raise ValueError("Invalid response format: expected dictionary")
            
        if "tips" not in result:
            raise ValueError("Invalid response format: missing 'tips' key")
            
        if not isinstance(result["tips"], list):
            raise ValueError("Invalid response format: 'tips' must be a list")
        
        # Validate each tip has required fields
        for tip in result["tips"]:
            if not all(k in tip for k in ["title", "description", "aqi_category"]):
                raise ValueError("Invalid tip format: missing required fields")
            
            if not all(k in tip["aqi_category"] for k in ["min", "max"]):
                raise ValueError("Invalid AQI category format: missing min/max values")
        
        return result["tips"]
        
    except requests.Timeout:
        current_app.logger.error("Timeout while fetching health tips", exc_info=True)
        
    except requests.RequestException as ex:
        current_app.logger.error(
            f"Failed to retrieve health tips: {str(ex)}", exc_info=True
        )
        
    except (ValueError, KeyError, TypeError) as ex:
        current_app.logger.error(
            f"Invalid response format: {str(ex)}", exc_info=True
        )
        
    except Exception as ex:
        current_app.logger.error(
            f"Unexpected error fetching health tips: {str(ex)}", exc_info=True
        )
    
    # Clear cache on failure
    cache.delete_memoized(get_health_tips)
    return []


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_predictions_by_geo_coordinates(
    latitude: float, longitude: float, distance_in_metres: int
) -> dict:
    client = bigquery.Client()

    query = (
        f"SELECT pm2_5, timestamp, pm2_5_confidence_interval "
        f"FROM `{Config.BIGQUERY_MEASUREMENTS_PREDICTIONS}` "
        f"WHERE ST_DISTANCE(location, ST_GEOGPOINT({longitude}, {latitude})) <= {distance_in_metres} "
        f"ORDER BY pm2_5_confidence_interval "
        f"LIMIT 1"
    )
    dataframe = client.query(query=query).result().to_dataframe()

    if dataframe.empty:
        return {}

    dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
    dataframe["timestamp"] = dataframe["timestamp"].apply(date_to_str)
    dataframe.drop_duplicates(keep="first", inplace=True)

    data = dataframe.to_dict("records")[0]

    return data


def geo_coordinates_cache_key_v2():
    key = (
        "geo_coordinates:"
        + str(round(float(request.args.get("latitude")), 6))
        + ":"
        + str(round(float(request.args.get("longitude")), 6))
    )
    return key


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_parish_predictions(
    parish: str, district: str, page_size: int, offset: int
) -> []:
    from app import postgres_db, Predictions

    query = postgres_db.session.query(
        func.ST_AsGeoJSON(Predictions.geometry).label("geometry"),
        Predictions.parish.label("parish"),
        Predictions.district.label("district"),
        Predictions.timestamp.label("timestamp"),
        Predictions.pm2_5.label("pm2_5"),
    )

    if parish:
        query = query.filter(Predictions.parish.ilike(f"%{parish}%"))

    if district:
        query = query.filter(Predictions.district.ilike(f"%{district}%"))

    parishes = query.limit(page_size).offset(offset).all()

    total_rows = query.count()
    total_pages = math.ceil(total_rows / page_size)

    data = [
        {
            "parish": parish.parish,
            "pm2_5": parish.pm2_5,
            "district": parish.district,
            "timestamp": parish.timestamp,
            "geometry": json.loads(parish.geometry),
        }
        for parish in parishes
    ]

    return data, total_pages


def get_predictions_by_geo_coordinates_v2(latitude: float, longitude: float) -> dict:
    from app import postgres_db, Predictions

    point = func.ST_MakePoint(longitude, latitude)
    query = postgres_db.session.query(Predictions).filter(
        func.ST_Within(point, Predictions.geometry)
    )
    point = query.first()
    if not point:
        return {}
    return {
        "parish": point.parish,
        "district": point.district,
        "pm2_5": point.pm2_5,
        "timestamp": point.timestamp,
    }


# TODO: Delete once mobile app is updated
def get_forecasts_1(
    db_name,
    device_id=None,
    site_id=None,
    site_name=None,
    parish=None,
    county=None,
    city=None,
    district=None,
    region=None,
):
    query = {}
    params = {
        "device_id": device_id,
        "site_id": site_id,
        "site_name": site_name,
        "parish": parish,
        "county": county,
        "city": city,
        "district": district,
        "region": region,
    }
    for name, value in params.items():
        if value is not None:
            query[name] = value
    site_forecasts = list(
        db[db_name].find(query, {"_id": 0}).sort([("$natural", -1)]).limit(1)
    )

    results = []
    if site_forecasts:
        for time, pm2_5 in zip(
            site_forecasts[0]["timestamp"],
            site_forecasts[0]["pm2_5"],
            # site_forecasts[0]["margin_of_error"],
            # site_forecasts[0]["adjusted_forecast"],
        ):
            result = {
                key: value
                for key, value in zip(
                    ["time", "pm2_5"],
                    [time, pm2_5],
                )
            }
            results.append(result)

    formatted_results = {"forecasts": results}
    return formatted_results


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_forecasts_2(
    db_name,
    device_id=None,
    site_id=None,
    site_name=None,
    parish=None,
    county=None,
    city=None,
    district=None,
    region=None,
    all_forecasts=False,
):
    query = {}
    if not all_forecasts:
        params = {
            "device_id": device_id,
            "site_id": site_id,
            "site_name": site_name,
            "parish": parish,
            "county": county,
            "city": city,
            "district": district,
            "region": region,
        }
        for name, value in params.items():
            if value is not None:
                query[name] = value
    cursor = db[db_name].find(query, {"_id": 0})

    results = {}
    for forecast in cursor:
        site_id = forecast["site_id"]
        if site_id:
            if site_id not in results:
                results[site_id] = []
            forecast_entry = {
                "time": forecast.get("timestamp"),
                "pm2_5": forecast.get("pm2_5"),
            }
            results[site_id].append(forecast_entry)

    return results


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def read_predictions_from_db(airqloud=None, page_number=1, limit=1000):
    collection = db.gp_model_predictions

    pipeline = []

    if airqloud:
        pipeline.append({"$match": {"airqloud": airqloud}})

    pipeline.extend(
        [
            {"$unwind": "$values"},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "values": {"$push": "$values"},
                }
            },
            {
                "$project": {
                    "total": 1,
                    "values": {"$slice": ["$values", (page_number - 1) * limit, limit]},
                }
            },
        ]
    )

    result = collection.aggregate(pipeline)

    total = 0
    values = []

    for document in result:
        total = document["total"]
        values = document.get("values", [])

    return values, total


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def convert_to_geojson(values):
    geojson = {"type": "FeatureCollection", "features": []}
    for value in values:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [value["longitude"], value["latitude"]],
            },
            "properties": {
                "pm2_5": value["predicted_value"],
                "variance": value["variance"],
                "interval": value["interval"],
                "latitude": value["latitude"],
                "longitude": value["longitude"],
            },
        }
        geojson["features"].append(feature)
    return geojson


def validate_param_values(params):
    for param in params:
        if param in ["correlation_fault", "missing_data_fault"]:
            value = params[param]
            if value not in [0, 1, None]:
                return False, f"Invalid value for {param}: {value}"
    return True, None


def read_faulty_devices():
    devices = []
    try:
        collection = db["faulty_devices_1"]
        devices = list(collection.find({}, {"_id": 0}))
    except errors.ServerSelectionTimeoutError:
        current_app.logger.error("Error with database connection", exc_info=False)
    except errors.PyMongoError as e:
        current_app.logger.error("Error", str(e), exc_info=False)
    except Exception as e:
        current_app.logger.error("Error: ", str(e), exc_info=False)
    finally:
        return devices


def get_static_health_tip(pm2_5_value, aqi_ranges=AQI_RANGES):
    """
    Get static health tip based on PM2.5 value using AQI ranges.
    
    Args:
        pm2_5_value (float): PM2.5 value to determine AQI category
        aqi_ranges (dict): AQI range definitions
        
    Returns:
        list: List of applicable health tips
    """
    for category, range_info in aqi_ranges.items():
        if range_info['max'] is None and pm2_5_value >= range_info['min']:
            return DEFAULT_HEALTH_TIPS.get(category, {})
        elif range_info['max'] is not None and range_info['min'] <= pm2_5_value <= range_info['max']:
            return DEFAULT_HEALTH_TIPS.get(category, {})
    return {}

def add_forecast_health_tips(results: dict, language: str = ""):
    """
    Enhanced version of add_forecast_health_tips with fallback mechanism.
    
    Args:
        results (dict): Forecast results to enhance
        language (str): Language preference
        
    Returns:
        dict: Enhanced results with health tips
    """
    # Try to get API health tips
    try:
        api_health_tips = get_health_tips(language=language)
    except Exception as e:
        current_app.logger.error(f"Error fetching API health tips: {str(e)}")
        api_health_tips = []
    
    for site_id, forecasts in results.items():
        for forecast in forecasts:
            health_tips = []
            
            for pm2_5_value in forecast.get("pm2_5", []):
                tips_for_value = []
                
                # Try API health tips first
                if api_health_tips:
                    tips_for_value = [
                        tip for tip in api_health_tips
                        if (tip['aqi_category']['max'] is None and pm2_5_value >= tip['aqi_category']['min']) or
                        (tip['aqi_category']['max'] is not None and 
                         tip['aqi_category']['min'] <= pm2_5_value <= tip['aqi_category']['max'])
                    ]
                
                # Fallback to static tips if no API tips available
                if not tips_for_value:
                    static_tips = get_static_health_tip(pm2_5_value)
                    tips_for_value = [
                        {"title": tip["title"], "description": tip["description"]}
                        for tip in static_tips.values()
                    ]
                
                health_tips.append(tips_for_value)
            
            forecast["health_tips"] = health_tips
    
    return results

def add_forecast_health_tips_cached(
    results: Dict, 
    cached_health_tips: List, 
    language: str
) -> Dict:
    """
    Version of add_forecast_health_tips that uses pre-fetched health tips
    to avoid multiple API calls.
    """
    for site_id, forecasts in results.items():
        for forecast in forecasts:
            health_tips = []
            
            for pm2_5_value in forecast.get("pm2_5", []):
                tips_for_value = []
                
                # Use cached health tips
                if cached_health_tips:
                    tips_for_value = [
                        tip for tip in cached_health_tips
                        if (tip['aqi_category']['max'] is None and 
                            pm2_5_value >= tip['aqi_category']['min']) or
                        (tip['aqi_category']['max'] is not None and 
                         tip['aqi_category']['min'] <= pm2_5_value <= 
                         tip['aqi_category']['max'])
                    ]
                
                # Fallback to static tips if needed
                if not tips_for_value:
                    static_tips = get_static_health_tip(pm2_5_value)
                    tips_for_value = [
                        {"title": tip["title"], "description": tip["description"]}
                        for tip in static_tips.values()
                    ]
                
                health_tips.append(tips_for_value)
            
            forecast["health_tips"] = health_tips
    
    return results