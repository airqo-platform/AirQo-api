import json
import logging
import os

from dotenv import load_dotenv
from flask import Blueprint, request, make_response
from flask_caching import Cache

from config import constants
from helpers.utils import get_gp_predictions, get_forecasts_helper, convert_to_geojson, CustomEncoder
from routes import api

load_dotenv()

app_configuration = constants.app_config.get(os.getenv('FLASK_ENV'))

cache = Cache(config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_HOST': app_configuration.REDIS_SERVER,
    'CACHE_REDIS_PORT': os.getenv('REDIS_PORT'),
    'CACHE_REDIS_URL': f"redis://{app_configuration.REDIS_SERVER}:{os.getenv('REDIS_PORT')}",
})

_logger = logging.getLogger(__name__)

ml_app = Blueprint('ml_app', __name__)


@ml_app.route(api.route['next_24hr_forecasts'], methods=['GET'])
def get_next_24hr_forecasts():
    """
    Get forecasts for the next 24 hours from specified start time.
    """
    return get_forecasts_helper(db_name='hourly_forecasts')


@ml_app.route(api.route['next_1_week_forecasts'], methods=['GET'])
def get_next_1_week_forecasts():
    """
    Get forecasts for the next 1 week from specified start day.
    """
    return get_forecasts_helper(db_name='daily_forecasts')


@ml_app.route(api.route['predict_for_heatmap'], methods=['GET'])
def predictions_for_heatmap():
    """Makes predictions for a specified location at a given time."""
    if request.method != 'GET':
        return {
            'message': 'Wrong request method. This is a GET endpoint.',
            'success': False
        }, 400

    airqloud = request.args.get('airqloud')
    aq_id = request.args.get('aq_id')

    if not (airqloud or aq_id):
        return {
            'message': 'Please specify either an airqloud name or an id',
            'success': False
        }, 400

    if airqloud and not isinstance(airqloud, str):
        return {
            'message': 'airqloud must be a string',
            'success': False
        }, 400

    if aq_id and not isinstance(aq_id, str):
        return {
            'message': 'aq_id must be a string',
            'success': False
        }, 400

    if airqloud and aq_id:
        aq_id = None
    try:
        data = get_gp_predictions(airqloud, aq_id)
        geojson_data = convert_to_geojson(data)
    except Exception as e:
        _logger.error(e)
        return {
            'message': 'Error occurred while fetching predictions',
            'success': False
        }, 500

    if data:
        geojson_string = json.dumps(geojson_data, cls=CustomEncoder)
        response = make_response(geojson_string)
        response.headers['Content-Type'] = 'application/json'
        return response, 200
    else:
        return {
            'message': 'No data for the specified airqloud',
            'success': False
        }, 400
