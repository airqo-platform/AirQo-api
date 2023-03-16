import logging

from flask import Blueprint, request, jsonify

import routes
from helpers.convert_dates import str_to_date
from helpers.request_validators import validate_request_json
from helpers.uptime import DeviceUptime

_logger = logging.getLogger(__name__)

uptime_bp = Blueprint('uptime', __name__)


@uptime_bp.route(routes.UPTIME, methods=['POST'])
@validate_request_json(
        "startDateTime|required:datetime",
        "endDateTime|required:datetime",
        "expectedDataPointsEvery30Minutes|required:int",
        "airqlouds|optional:list",
        "sites|optional:list",
        "devices|optional:list",
    )
def get_uptime():

    json_data = request.get_json()
    start_date_time = str_to_date(json_data.get("startDateTime"))
    end_date_time = str_to_date(json_data.get("endDateTime"))
    sites = json_data.get("sites", [])
    devices = json_data.get("devices", [])
    airqlouds = json_data.get("airqlouds", [])
    expected_data_points = json_data.get("expectedDataPointsEvery30Minutes")
    errors = {}

    if sum([len(sites) != 0, len(devices) != 0, len(airqlouds) != 0]) != 1:
        errors = "You cannot specify airqlouds, sites and devices in one go"

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    if airqlouds:
        uptime = DeviceUptime(devices=airqlouds, start_date_time=start_date_time, end_date_time=end_date_time,
                              data_points_per_30_minutes=expected_data_points,)

    elif sites:
        uptime = DeviceUptime(devices=sites, start_date_time=start_date_time, end_date_time=end_date_time,
                              data_points_per_30_minutes=expected_data_points,)

    elif devices:
        uptime = DeviceUptime(devices=devices, start_date_time=start_date_time, end_date_time=end_date_time,
                              data_points_per_30_minutes=expected_data_points,)
    else:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    uptime.compute()
    response = dict(message="uptime calculation successful", data=uptime.results())
    return jsonify(response), 200

