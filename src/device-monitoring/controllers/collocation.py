import datetime
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
    expected_records_per_day = json_data.get("expectedRecordsPerDay", 24)
    correlation_threshold = json_data.get("correlationThreshold", 80)
    verbose = json_data.get("verbose", False)
    # parameters = json_data.get("parameters", None)  # Temporarily disabled parameters

    errors = {}

    # Temporarily disabled parameters
    # try:
    #     if parameters and not set(parameters).issubset(Collocation.valid_parameters()):
    #         raise Exception
    # except Exception:
    #     errors["parameters"] = f"Accepted parameters are {Collocation.valid_parameters()}"

    if not isinstance(verbose, bool):
        verbose = False

    try:
        if not (0 <= completeness_threshold <= 1):
            raise Exception
    except Exception:
        errors["completenessThreshold"] = f"Must be a value between 0 and 1"

    try:
        if not (0 <= correlation_threshold <= 1):
            raise Exception
    except Exception:
        errors["correlationThreshold"] = f"Must be a value between 0 and 1"

    try:
        if not (1 <= expected_records_per_day <= 24):
            raise Exception
    except Exception:
        errors["expectedRecordsPerDay"] = f"Must be a value between 1 and 24"

    try:
        if not devices or not isinstance(
            devices, list
        ):  # TODO add device restrictions e.g not more that 3 devices
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

    if (
        start_date > end_date
    ):  # TODO add interval restrictions e.g not more that 10 days
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
        devices=list(set(devices)),
        start_date=start_date,
        end_date=end_date,
        correlation_threshold=correlation_threshold,
        completeness_threshold=completeness_threshold,
        parameters=None,  # Temporarily disabled parameters
        expected_records_per_day=expected_records_per_day,
        verbose=verbose,
    )
    collocation.perform_collocation()
    results = collocation.results()

    return jsonify({"data": results}), 200


@collocation_bp.route(routes.DEVICE_COLLOCATION_RESULTS, methods=["POST"])
def get_collocation_results():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)

    errors = {}

    try:
        if not devices or not isinstance(
            devices, list
        ):  # TODO add device restrictions e.g not more that 3 devices
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

    if (
        start_date > end_date
    ):  # TODO add interval restrictions e.g not more that 10 days
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
        devices=list(set(devices)),
        start_date=start_date,
        end_date=end_date,
        correlation_threshold=0,
        completeness_threshold=0,
        parameters=None,
        expected_records_per_day=0,
        verbose=False,
    )

    results = collocation.results()

    return jsonify({"data": results}), 200


@collocation_bp.route(routes.DEVICE_COLLOCATION_SUMMARY, methods=["GET"])
def get_collocation_summary():
    collocation = Collocation(
        devices=[],
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow(),
        correlation_threshold=0,
        completeness_threshold=0,
        parameters=None,
        expected_records_per_day=0,
        verbose=False,
    )

    summary = collocation.summary()

    return jsonify({"data": summary}), 200
