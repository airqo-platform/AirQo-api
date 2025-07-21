import logging

from flask import Blueprint, request, jsonify

import routes
from helpers.request_validators import validate_request_json
from helpers.uptime import Uptime

_logger = logging.getLogger(__name__)


uptime_bp = Blueprint(
    name="uptime", import_name=__name__, url_prefix=routes.UPTIME_BASE_URL
)


@uptime_bp.route("", methods=["POST"])
@validate_request_json(
    "startDateTime|required:datetime",
    "endDateTime|required:datetime",
    "airqloud|optional:str",
    "cohort|optional:str",
    "grid|optional:str",
    "threshold|optional:int",
    "site|optional:str",
    "devices|optional:list",
)
def get_uptime():
    json_data = request.get_json()
    start_date_time = json_data.get("startDateTime")
    end_date_time = json_data.get("endDateTime")
    devices = json_data.get("devices", [])
    site = json_data.get("site", "")
    threshold = json_data.get("threshold", None)
    airqloud = json_data.get("airqloud", "")
    cohort = json_data.get("cohort", "")
    grid = json_data.get("grid", "")

    data = Uptime.get_uptime(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        devices=devices,
        site=site,
        airqloud=airqloud,
        cohort=cohort,
        grid=grid,
    )
    uptime = Uptime.compute_uptime_summary(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        data=data,
        devices=devices,
        site=site,
        airqloud=airqloud,
        cohort=cohort,
        grid=grid,
        threshold=threshold,
    )
    response = dict(message="Successful", data=uptime)
    return jsonify(response), 200
