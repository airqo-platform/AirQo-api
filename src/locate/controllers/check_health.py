from flask import Blueprint, request, jsonify
import logging
import routes
from config import environment


_logger = logging.getLogger(__name__)
check_health_blueprint = Blueprint('check_health_blueprint', __name__)


@check_health_blueprint.route(routes.HEALTH_CHECK, methods=['GET', 'POST'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return jsonify({"message": f'health check passed. ENVIROMNET: {environment}', "status": True}), 200