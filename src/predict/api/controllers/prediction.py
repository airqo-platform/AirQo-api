import logging
import traceback
from app import cache

from dotenv import load_dotenv
from flask import Blueprint, request

from helpers.utils import get_gp_predictions, get_forecasts_helper, \
    get_predictions_by_geo_coordinates, get_health_tips, convert_to_geojson, weekly_forecasts_cache_key, \
    heatmap_cache_key, geo_coordinates_cache_key
from routes import api
from config.constants import Config

load_dotenv()

_logger = logging.getLogger(__name__)

ml_app = Blueprint('ml_app', __name__)


@ml_app.route(api.route['next_24hr_forecasts'], methods=['GET'])
def get_next_24hr_forecasts():
    """
    Get forecasts for the next 24 hours from specified start time.
    """
    return get_forecasts_helper(db_name='hourly_forecasts')


@ml_app.route(api.route['next_1_week_forecasts'], methods=['GET'])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=weekly_forecasts_cache_key)
def get_next_1_week_forecasts():
    """
    Get forecasts for the next 1 week from specified start day.
    """
    return get_forecasts_helper(db_name='daily_forecasts')


@ml_app.route(api.route['predict_for_heatmap'], methods=['GET'])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=heatmap_cache_key)
def predictions_for_heatmap():
    """
    This function handles the GET requests to the predict_for_heatmap endpoint.
    It validates the request parameters and returns a geojson response with the GP model predictions.
    """

    if request.method != 'GET':
        return {
            'message': 'Wrong request method. This is a GET endpoint.',
            'success': False
        }, 400

    airqloud = request.args.get('airqloud')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 1000))

    if airqloud and not isinstance(airqloud, str):
        return {
            'message': 'Please specify a valid airqloud name',
            'success': False
        }, 400

    try:
        airqloud_id, created_at, predictions, total_count, pages = get_gp_predictions(airqloud, page=page, limit=limit)
        geojson_data = convert_to_geojson(predictions)
    except Exception as e:
        _logger.error(e)
        return {
            'message': 'Error occurred while fetching predictions',
            'success': False
        }, 500

    if len(geojson_data['features']) > 0:
        if page > pages:
            return {
                'message': 'Page number is greater than total pages',
                'success': False
            }, 400

        return {
            'data': geojson_data['features'],
            'airqloud': airqloud,
            'airqloud_id':airqloud_id,
            'created_at': created_at,
            'success': True,
            'page': page,
            'limit': limit,
            'total': total_count,
            'pages': pages,
        }, 200

    else:
        return {'message': 'No predictions available', 'success': False}, 400


@ml_app.route(api.route['search_predictions'], methods=['GET'])
@cache.cached(timeout=Config.CACHE_TIMEOUT, key_prefix=geo_coordinates_cache_key)
def search_predictions():
    try:
        latitude = float(request.args.get('latitude'))
        longitude = float(request.args.get('longitude'))
        distance_in_metres = int(request.args.get('distance', 100))
        data = get_predictions_by_geo_coordinates(latitude=latitude,
                                                  longitude=longitude,
                                                  distance_in_metres=distance_in_metres
                                                  )
        if data:
            health_tips = get_health_tips()
            pm2_5 = data["pm2_5"]
            data["health_tips"] = list(
                filter(
                    lambda x: x["aqi_category"]["max"] >= pm2_5 >= x["aqi_category"]["min"],
                    health_tips,
                )
            )

        return {'success': True, 'data': data}, 200

    except Exception as ex:
        print(ex)
        traceback.print_exc()
        return {'message': 'Please contact support', 'success': False}, 500


if __name__ == '__main__':
    print(predictions_for_heatmap())
