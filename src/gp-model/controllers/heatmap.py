from flask import Blueprint, request
from flask_caching import Cache
import sys
sys.path.append('..')
from routes import api
from helpers.utils import get_gp_predictions
from flask_cors import CORS
import os
import logging
from dotenv import load_dotenv
load_dotenv()

cache = Cache(config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_HOST': os.getenv('REDIS_SERVER'),
    'CACHE_REDIS_PORT': os.getenv('REDIS_PORT'),
    'CACHE_REDIS_URL': f"redis://{os.getenv('REDIS_SERVER')}:{os.getenv('REDIS_PORT')}",
})

_logger = logging.getLogger(__name__)

ml_app = Blueprint('ml_app', __name__)

@ml_app.route(api.route['predict_for_heatmap'], methods=['GET'])
@cache.cached(timeout=3600)
def predictions_for_kampala_heatmap():
    '''
    makes predictions for a specified location at a given time.
    '''
    if request.method == 'GET':
        try:
            data = get_gp_predictions()
            return {'success': True, 'data': data}, 200
        except:
            return {'message': 'An error occured. Please try again.', 'success': False}, 400
    else:
        return {'message': 'Wrong request method. This is a GET endpoint.', 'success': False}, 400

if __name__=='__main__':
    print('I am daft')

