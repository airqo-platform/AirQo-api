import logging

from flask import Blueprint, request, jsonify

import routes
from helpers.convert_dates import str_to_date
from helpers.request_validators import validate_request_json
from helpers.uptime import DeviceUptime, MetaData

_logger = logging.getLogger(__name__)

uptime_bp = Blueprint("uptime", __name__)


@uptime_bp.route(routes.UPTIME, methods=["POST"])
@validate_request_json(
    "startDateTime|required:datetime",
    "endDateTime|required:datetime",
    "expectedDataPointsEvery30Minutes|required:int",
    "airqloud|optional:str",
    "site|optional:str",
    "devices|optional:list",
)
def get_uptime():
    tenant = request.args.get("tenant")
    json_data = request.get_json()
    start_date_time = str_to_date(json_data.get("startDateTime"))
    end_date_time = str_to_date(json_data.get("endDateTime"))
    devices = json_data.get("devices", [])
    site = json_data.get("site", "")
    airqloud = json_data.get("airqloud", "")
    expected_data_points = json_data.get("expectedDataPointsEvery30Minutes")
    errors = {}

    if len(devices) != 0 and site != "" and airqloud != "":
        errors = {
            "inputs": "You cannot specify an airqloud, site and devices in one go"
        }

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    if airqloud != "":
        meta_data = MetaData(airqlouds=[airqloud], sites=[], tenant=tenant)
        devices = meta_data.get_devices()

        if len(devices) == 0:
            response = dict(
                message="uptime calculation unsuccessful",
                data={"devices": f"airqloud {airqloud} does not have devices"},
            )
            return jsonify(response), 400
        uptime = DeviceUptime(
            devices=devices,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_points_per_30_minutes=expected_data_points,
        )

    elif site != "":
        meta_data = MetaData(airqlouds=[], sites=[site], tenant=tenant)
        devices = meta_data.get_devices()
        if len(devices) == 0:
            response = dict(
                message="uptime calculation unsuccessful",
                data={"devices": f"site {site} does not have devices"},
            )
            return jsonify(response), 400
        uptime = DeviceUptime(
            devices=devices,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_points_per_30_minutes=expected_data_points,
        )

    elif devices:
        uptime = DeviceUptime(
            devices=devices,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_points_per_30_minutes=expected_data_points,
        )
    else:
        errors = {
            "inputs": "You must specify an airqloud, site or list of device names"
        }
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    uptime.compute()
    response = dict(message="uptime calculation successful", data=uptime.results())
    return jsonify(response), 200
