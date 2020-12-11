
from flask import Blueprint, request, jsonify
import logging
import datetime as dt
from bson import json_util, ObjectId
import json
from datetime import datetime, timedelta
from config import config, db_connection, constants
from routes import api
import os
from dotenv import load_dotenv
load_dotenv()


_logger = logging.getLogger(__name__)
monitor_bp = Blueprint('monitor_bp', __name__)


@monitor_bp.route(api.route['root'], methods=['GET', 'POST'])
def root():
    if request.method == 'GET':
        _logger.info('root endpoint OK')
        return jsonify({"message": "ok", "status": True}), 200


@monitor_bp.route(api.route['health'], methods=['GET', 'POST'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return jsonify({"message": f'health check passed. DB_URL: {db_connection.app_configuration.MONGO_URI}, DB_NAME: {app_configuration.DB_NAME}', "status": True}), 200
