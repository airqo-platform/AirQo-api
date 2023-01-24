import logging

from flask import Blueprint, request, jsonify

import routes
from helpers.collocation import Collocation
from helpers.convert_dates import validate_datetime

_logger = logging.getLogger(__name__)

collocation_bp = Blueprint("collocation", __name__)


@collocation_bp.route(routes.DEVICE_COLLOCATION, methods=["POST"])
def get_device_collocation():
    json_data = request.get_json()
    devices = json_data.get("devices", None)
    start_date_time = json_data.get("startDateTime", None)
    end_date_time = json_data.get("endDateTime", None)
    completeness_threshold = json_data.get("completeness_threshold", None)
    correlation_threshold = json_data.get("correlation_threshold", None)
    parameters = json_data.get("parameters", None)

    errors = {}

    if not devices:
        errors["devices"] = "Provide a list of devices"

    try:
        start_date_time = validate_datetime(start_date_time)
    except Exception:
        errors["startDateTime"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    try:
        end_date_time = validate_datetime(end_date_time)
    except Exception:
        errors["endDateTime"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

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

    collocation = Collocation(
        devices=devices,
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        correlation_threshold=correlation_threshold,
        completeness_threshold=completeness_threshold,
        parameters=parameters,
    )
    collocation.compute_correlation()
    results = collocation.results()

    return jsonify(results), 200
