import datetime as dt
import logging
import os

from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from flask_caching import Cache

from config import constants
from helpers.utils import get_all_gp_predictions, get_gp_predictions, get_gp_predictions_id
from models.predict import get_next_1_week_forecasts_for_channel, get_next_24hr_forecasts_for_channel
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
def get_next_24hr_forecasts(device_channel_id, forecast_start_time):
    """
    Get forecasts for the next 24 hours from specified start time.
    """
    if request.method == 'GET':
        if type(device_channel_id) is not int:
            device_channel_id = int(device_channel_id)

        if type(forecast_start_time) is not int:
            try:
                prediction_start_time = int(forecast_start_time)
            except ValueError:
                error = {
                    "message": "Invalid prediction start time. expected unix timestamp format like 1500000000",
                    "success": False}
                return jsonify(error, 400)

        prediction_start_timestamp = dt.datetime.fromtimestamp(
            prediction_start_time)
        prediction_start_datetime = dt.datetime.strftime(
            prediction_start_timestamp, "%Y-%m-%d %H:00:00")
        print(prediction_start_datetime)
        result = get_next_24hr_forecasts_for_channel(
            device_channel_id, prediction_start_datetime)
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
def get_next_1_week_forecasts(device_channel_id, forecast_start_date):
    """
    Get forecasts for the next 1 week from specified start day.
    """
    if request.method == 'GET':
        if type(device_channel_id) is not int:
            device_channel_id = int(device_channel_id)

        if type(forecast_start_date) is not int:
            try:
                forecast_start_date = int(forecast_start_date)
            except ValueError:
                error = {
                    "message": "Invalid prediction start date. expected unix timestamp format like 1500000000",
                    "success": False}
                return jsonify(error, 400)

        # change prediction_start_date to datetime format
        forecast_start_timestamp = dt.datetime.fromtimestamp(
            forecast_start_date)
        forecast_start_timestamp = dt.datetime.strftime(
            forecast_start_timestamp, "%Y-%m-%d %H:00:00")

        print(forecast_start_timestamp)
        result = get_next_1_week_forecasts_for_channel(
            device_channel_id, forecast_start_timestamp)
        if result:
            response = result
        else:
            response = {
                "message": "predictions for channel are not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@ml_app.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'


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
