from flask import Blueprint, request, jsonify
import logging
from routes import api
from dotenv import load_dotenv
load_dotenv()


_logger = logging.getLogger(__name__)
health_check_bp = Blueprint('monitor_bp', __name__)


@health_check_bp.route(api.route['health_check'], methods=['GET', 'POST'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return jsonify({"message": 'App status - OK.', "success": True}), 200
