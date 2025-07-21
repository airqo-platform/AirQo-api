from flask import Blueprint, request, jsonify
import logging
import routes

_logger = logging.getLogger(__name__)

health_check_bp = Blueprint('monitor_bp', __name__)


@health_check_bp.route(routes.HEALTH, methods=['GET', 'POST'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return jsonify({"message": 'App status - OK.', "success": True}), 200
