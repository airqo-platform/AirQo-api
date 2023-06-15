import logging

from flask import Blueprint, request, jsonify

import routes
from helpers.convert_dates import str_to_date
from helpers.request_validators import validate_request_json
from helpers.uptime import Uptime, MetaData

_logger = logging.getLogger(__name__)


uptime_bp = Blueprint(
    name="uptime", import_name=__name__, url_prefix=routes.UPTIME_BASE_URL
)


@uptime_bp.route("", methods=["POST"])
@validate_request_json(
    "startDateTime|required:datetime",
    "endDateTime|required:datetime",
    "airqloud|optional:str",
    "site|optional:str",
    "devices|optional:list",
)
def get_uptime():
    json_data = request.get_json()
    start_date_time = str_to_date(json_data.get("startDateTime"))
    end_date_time = str_to_date(json_data.get("endDateTime"))
    devices = json_data.get("devices", [])
    site = json_data.get("site", "")
    airqloud = json_data.get("airqloud", "")

    data = Uptime.get_uptime(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        devices=devices,
        site=site,
        airqloud=airqloud,
    )
    response = dict(message="Successful", data=data)
    return jsonify(response), 200
