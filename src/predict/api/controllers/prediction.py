import logging
import os

from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from flask_caching import Cache

from config import constants
from helpers.utils import get_all_gp_predictions, get_gp_predictions, get_gp_predictions_id
from models.predict import get_forecasts
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
    if request.method == 'GET':
        site_id = request.args.get('site_id')
        result = get_forecasts(site_id, 'hourly_forecasts')
        if result:
            response = result
        else:
            response = {
                "message": "forecasts for channel are not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@ml_app.route(api.route['next_1_week_forecasts'], methods=['GET'])
def get_next_1_week_forecasts():
    """
    Get forecasts for the next 1 week from specified start day.
    """
    if request.method == 'GET':
        site_id = request.args.get('site_id', type=str)
        result = get_forecasts(site_id, db_name='daily_forecasts')
        if result:
            response = result
        else:
            response = {
                "message": "predictions for channel are not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@ml_app.route(api.route['predict_for_heatmap'], methods=['GET'])
def predictions_for_heatmap():
    """
    makes predictions for a specified location at a given time.
    """
    if request.method == 'GET':
        try:
            airqloud = request.args.get('airqloud').lower()
            data = get_gp_predictions(airqloud)
        except:
            try:
                aq_id = request.args.get('id')
                data = get_gp_predictions_id(aq_id)
            except:
                return {'message': 'Please specify an airqloud', 'success': False}, 400

        print(request.args.get('airqloud'))
        if request.args.get('airqloud') == None:
            data = get_all_gp_predictions()
            if not len(data) > 0:
                return {'message': 'No predictions available', 'success': False}, 400
        if len(data) > 0:
            return {'success': True, 'data': data}, 200
        else:
            return {'message': 'No data for specified airqloud', 'success': False}, 400
    else:
        return {'message': 'Wrong request method. This is a GET endpoint.', 'success': False}, 400


if __name__ == '__main__':
    print(predictions_for_heatmap())
