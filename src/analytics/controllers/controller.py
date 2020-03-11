from flask import Blueprint, request, jsonify
import logging
import datetime as dt

_logger = logging.getLogger(__name__)

analytics_app = Blueprint('analytics_app', __name__)

@analytics_app.route('/api/v1/locations', methods=['GET'])
def get_locations():
    if request.method == 'GET':
        all_locations = ['Kampala','Mukono']
        return jsonify({'locations': all_locations})
       
        
@analytics_app.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'


       
        
        
        

        

