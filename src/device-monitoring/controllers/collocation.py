import logging
import traceback

from flask import Blueprint, request, jsonify

import routes
from helpers.collocation import Collocation, validate_collocation_request
from helpers.convert_dates import validate_date, str_to_date
from helpers.utils import decode_user_token

_logger = logging.getLogger(__name__)

collocation_bp = Blueprint("collocation", __name__)


@collocation_bp.route(routes.DEVICE_COLLOCATION, methods=["POST"])
def collocate():
    token = request.headers.get("Authorization", "")
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
    try:
        user_details = decode_user_token(token)
        collocation = Collocation(
            devices=list(set(devices)),
            start_date=start_date,
            end_date=end_date,
            correlation_threshold=correlation_threshold,
            completeness_threshold=completeness_threshold,
            parameters=None,  # Temporarily disabled parameters
            expected_records_per_day=expected_records_per_day,
            verbose=verbose,
            added_by=user_details,
        )
        results = collocation.collocate()
        errors = results.get("errors", {})
        if len(errors) != 0:
            return jsonify({"errors": errors}), 400

        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_DATA, methods=["POST"])
def data():
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
    try:
        _, results = Collocation.get_data(
            start_date_time=start_date, end_date_time=end_date, devices=devices
        )
        results = Collocation.format_collocation_data(results)

        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.INTER_SENSOR_CORRELATION_DATA, methods=["POST"])
def inter_sensor_correlation():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)
    threshold = json_data.get("threshold", 0.5)

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
    try:
        raw_data, _ = Collocation.get_data(
            start_date_time=start_date,
            end_date_time=end_date,
            devices=devices,
        )

        results = Collocation.get_inter_sensor_correlation(
            raw_data=raw_data,
            threshold=threshold,
        )

        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.INTRA_SENSOR_CORRELATION, methods=["POST"])
def intra_sensor_correlation():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)
    threshold = json_data.get("threshold", 0.5)

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
    try:
        raw_data, resampled_data = Collocation.get_data(
            start_date_time=start_date,
            end_date_time=end_date,
            devices=devices,
        )

        results = Collocation.get_intra_sensor_correlation(
            raw_data=raw_data,
            threshold=threshold,
        )

        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_DATA_COMPLETENESS, methods=["POST"])
def data_completeness():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)
    threshold = json_data.get("threshold", 0.5)
    expected_records_per_hour = json_data.get("expectedRecordsPerHour", 10)

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
    try:
        raw_data, _ = Collocation.get_data(
            start_date_time=start_date,
            end_date_time=end_date,
            devices=devices,
        )

        results = Collocation.get_data_completeness(
            start_date_time=start_date,
            end_date_time=end_date,
            raw_data=raw_data,
            threshold=threshold,
            expected_records_per_hour=expected_records_per_hour,
        )

        results = Collocation.flatten_completeness(results)

        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_STATISTICS, methods=["POST"])
def data_statistics():
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
    try:
        raw_data, _ = Collocation.get_data(
            start_date_time=start_date,
            end_date_time=end_date,
            devices=devices,
        )

        results = Collocation.get_statistics(
            raw_data=raw_data,
        )

        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_DIFFERENCES, methods=["POST"])
def data_differences():
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
    try:
        raw_data, _ = Collocation.get_data(
            start_date_time=start_date,
            end_date_time=end_date,
            devices=devices,
        )

        statistics = Collocation.get_statistics(
            raw_data=raw_data,
        )

        differences = Collocation.get_differences(
            statistics=statistics,
        )

        return jsonify({"data": differences}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.SCHEDULE_COLLOCATION, methods=["POST"])
def schedule_collocation():
    token = request.headers.get("Authorization", "")
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)
    completeness_threshold = json_data.get("completenessThreshold", 90)
    expected_records_per_day = json_data.get("expectedRecordsPerDay", 24)
    correlation_threshold = json_data.get("correlationThreshold", 80)
    verbose = json_data.get("verbose", False)

    if not isinstance(verbose, bool):
        verbose = False

    errors = validate_collocation_request(
        start_date=start_date,
        end_date=end_date,
        devices=devices,
        completeness_threshold=completeness_threshold,
        expected_records_per_day=expected_records_per_day,
        correlation_threshold=correlation_threshold,
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

    try:
        user_details = decode_user_token(token)
        start_date = str_to_date(start_date, str_format="%Y-%m-%d")
        end_date = str_to_date(end_date, str_format="%Y-%m-%d")
        collocation = Collocation(
            devices=list(set(devices)),
            start_date=start_date,
            end_date=end_date,
            correlation_threshold=correlation_threshold,
            completeness_threshold=completeness_threshold,
            parameters=None,  # Temporarily disabled parameters
            expected_records_per_day=expected_records_per_day,
            verbose=verbose,
            added_by=user_details,
        )
        results = collocation.schedule()
        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.DEVICE_COLLOCATION_RESULTS, methods=["GET"])
def get_collocation_results():
    devices = request.args.get("devices", "")
    start_date = request.args.get("startDate", "")
    end_date = request.args.get("endDate", "")

    errors = {}

    try:
        if not devices or not isinstance(
            devices, str
        ):  # TODO add device restrictions e.g not more that 3 devices
            raise Exception
        devices = devices.split(",")
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

    try:
        collocation = Collocation(
            devices=list(set(devices)),
            start_date=start_date,
            end_date=end_date,
            correlation_threshold=0,
            completeness_threshold=0,
            parameters=None,
            expected_records_per_day=0,
            verbose=False,
            added_by={},
        )

        results = collocation.get_collocation_results()
        if results is None:
            return jsonify({"message": "No data found", "data": None}), 400

        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.DEVICE_COLLOCATION_SUMMARY, methods=["GET"])
def get_collocation_summary():
    start_date = request.args.get("startDate", None)
    end_date = request.args.get("endDate", None)

    try:
        start_date = validate_date(start_date)
    except Exception:
        start_date = None

    try:
        end_date = validate_date(end_date)
    except Exception:
        end_date = None

    try:
        collocation = Collocation(
            devices=[],
            start_date=start_date,
            end_date=end_date,
            correlation_threshold=0,
            completeness_threshold=0,
            parameters=None,
            expected_records_per_day=0,
            verbose=False,
            added_by={},
        )

        summary = collocation.summary()

        return jsonify({"data": summary}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500
