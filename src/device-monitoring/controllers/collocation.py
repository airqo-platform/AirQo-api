import logging

from flask import Blueprint, request, jsonify

import routes
from helpers.collocation import Collocation
from helpers.convert_dates import validate_date

_logger = logging.getLogger(__name__)

collocation_bp = Blueprint("collocation", __name__)


@collocation_bp.route(routes.DEVICE_COLLOCATION, methods=["POST"])
def get_device_collocation():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)
    completeness_threshold = json_data.get("completenessThreshold", 90)
    correlation_threshold = json_data.get("correlationThreshold", 80)
    parameters = json_data.get("parameters", None)

    errors = {}

    try:
        if parameters and not set(parameters).issubset(Collocation.valid_parameters()):
            raise Exception
    except Exception:
        errors["parameters"] = f"Accepted parameters are {parameters}"

    try:
        if completeness_threshold and not (1 <= completeness_threshold <= 100):
            raise Exception
    except Exception:
        errors["completenessThreshold"] = f"Must be a value between 1 and 100"

    try:
        if correlation_threshold and not (1 <= correlation_threshold <= 100):
            raise Exception
    except Exception:
        errors["correlationThreshold"] = f"Must be a value between 1 and 100"

    try:
        if not devices or not isinstance(devices, list):
            raise Exception
    except Exception:
        errors["devices"] = "Provide a list of devices"

    try:
        start_date = validate_date(start_date)
    except Exception:
        errors["startDate"] = (
            "This query param is required."
            "Please provide a valid date formatted datetime string (%Y-%m-%d)"
        )

    try:
        end_date = validate_date(end_date)
    except Exception:
        errors["endDate"] = (
            "This query param is required."
            "Please provide a valid date formatted datetime string (%Y-%m-%d)"
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

    if start_date > end_date:
        errors["dates"] = "endDate must be greater or equal to the startDate"
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
        start_date=start_date,
        end_date=end_date,
        correlation_threshold=correlation_threshold,
        completeness_threshold=completeness_threshold,
        parameters=parameters,
    )
    collocation.compute_correlation()
    results = collocation.results()

    return jsonify(results), 200
