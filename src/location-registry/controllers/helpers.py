from flask import Blueprint, request, jsonify
import logging
import datetime as dt
from bson import json_util, ObjectId
import json
from routes import api
import os
from http import HTTPStatus


_logger = logging.getLogger(__name__)
monitor_bp = Blueprint('monitor_bp', __name__)


@monitor_bp.route(api.route['root'], methods=['GET', 'POST'])
def root():
    if request.method == 'GET':
        _logger.info('root endpoint OK')
        return jsonify({"message": "ok", "status": True}), HTTPStatus.OK


@monitor_bp.route(api.route['health_check'], methods=['GET', 'POST'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return jsonify({"message": "ok", "status": True}), HTTPStatus.OK
