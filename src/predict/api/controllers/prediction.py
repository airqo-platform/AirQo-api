import logging
import traceback
import os

from dotenv import load_dotenv
from flask import Blueprint, request

from config import constants
from flask_caching import Cache
from helpers.utils import get_gp_predictions, get_forecasts_helper, \
    get_predictions_by_geo_coordinates, get_health_tips, convert_to_geojson
from routes import api

import math

load_dotenv()

_logger = logging.getLogger(__name__)

ml_app = Blueprint('ml_app', __name__)

app_configuration = constants.app_config.get(os.getenv('FLASK_ENV'))
cache = Cache(config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_HOST': app_configuration.REDIS_SERVER,
    'CACHE_REDIS_PORT': os.getenv('REDIS_PORT'),
    'CACHE_REDIS_URL': f"redis://{app_configuration.REDIS_SERVER}:{os.getenv('REDIS_PORT')}",
})


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
    """
    makes predictions for a specified location at a given time.
    """
    if request.method == 'GET':
        try:
            airqloud = request.args.get('airqloud').lower()
            page = int(request.args.get('page', 1))
            limit = 1000
            data = get_gp_predictions(airqloud)
            data = convert_to_geojson(data)
            total = len(data)  # get the total number of records
            pages = math.ceil(total / limit)  # calculate the number of pages
            start = (page - 1) * limit  # calculate the start index of the page
            end = start + limit  # calculate the end index of the page
            data = data[start:end]  # slice the data for the page
        except:
            return {'message': 'Please specify a valid airqloud', 'success': False}, 400

        if not len(data) > 0:
            return {'message': 'No predictions available', 'success': False}, 400
        if len(data) > 0:
            return {'success': True, 'data': data, 'page': page, 'pages': pages, 'total': total}, 200
    else:
        return {'message': 'Wrong request method. This is a GET endpoint.', 'success': False}, 400


@ml_app.route(api.route['search_predictions'], methods=['GET'])
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
