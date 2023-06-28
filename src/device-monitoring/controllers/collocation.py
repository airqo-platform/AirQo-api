import datetime
import logging
import re
import uuid

from flask import Blueprint, request, jsonify

import routes
from config.constants import CollocationDefaults
from helpers.collocation import Collocation
from helpers.collocation_utils import (
    validate_collocation_request,
)
from helpers.convert_dates import str_to_date
from helpers.exceptions import CollocationBatchNotFound
from helpers.utils import decode_user_token
from models import (
    CollocationBatch,
    CollocationBatchStatus,
    CollocationBatchResult,
)

_logger = logging.getLogger(__name__)

collocation_bp = Blueprint(
    name="collocation", import_name=__name__, url_prefix=routes.COLLOCATION_BASE_URL
)


@collocation_bp.before_request
def check_batch_id():
    if request.method == "GET" or request.method == "DELETE":
        if re.match("/api/v2/monitor/collocation/summary", request.path) or re.match(
            "/api/v2/monitor/collocation/log-data", request.path
        ):
            return None
        batch_id = request.args.get("batchId")
        if not batch_id:
            return (
                jsonify({"message": "Please specify batchId as a query parameter"}),
                400,
            )


@collocation_bp.errorhandler(CollocationBatchNotFound)
def batch_not_found_exception(error):
    return jsonify({"message": error.message}), 404


@collocation_bp.route("log-data", methods=["GET"])
def log_collocation_data():
    collocation = Collocation()
    collocation.log_collection()
    return (
        jsonify({}),
        200,
    )


@collocation_bp.route("", methods=["POST"])
def save_collocation_batch():
    token = request.headers.get("Authorization", "")
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    base_device = json_data.get("baseDevice", None)
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)

    if start_date is None or end_date is None:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": "startDate and endDate are missing",
                }
            ),
            400,
        )

    expected_records_per_hour = json_data.get(
        "expectedRecordsPerHour", CollocationDefaults.ExpectedRecordsPerHour
    )

    batch_name = json_data.get(
        "batchName", str(str(uuid.uuid4()).replace("-", "")[:8]).upper()
    )

    data_completeness_threshold = json_data.get(
        "dataCompletenessThreshold", CollocationDefaults.DataCompletenessThreshold
    )

    intra_correlation_threshold = json_data.get(
        "intraCorrelationThreshold", CollocationDefaults.IntraCorrelationThreshold
    )
    intra_correlation_r2_threshold = json_data.get(
        "intraCorrelationR2Threshold", CollocationDefaults.IntraCorrelationR2Threshold
    )

    inter_correlation_threshold = json_data.get(
        "interCorrelationThreshold", CollocationDefaults.InterCorrelationThreshold
    )
    inter_correlation_r2_threshold = json_data.get(
        "interCorrelationR2Threshold", CollocationDefaults.InterCorrelationR2Threshold
    )

    differences_threshold = json_data.get(
        "differencesThreshold", CollocationDefaults.DifferencesThreshold
    )

    inter_correlation_parameter = json_data.get(
        "interCorrelationParameter", CollocationDefaults.InterCorrelationParameter
    )
    intra_correlation_parameter = json_data.get(
        "intraCorrelationParameter", CollocationDefaults.IntraCorrelationParameter
    )
    data_completeness_parameter = json_data.get(
        "dataCompletenessParameter", CollocationDefaults.DataCompletenessParameter
    )
    differences_parameter = json_data.get(
        "differencesParameter", CollocationDefaults.DifferencesParameter
    )

    inter_correlation_additional_parameters = json_data.get(
        "interCorrelationAdditionalParameters",
        CollocationDefaults.InterCorrelationAdditionalParameters,
    )

    errors = validate_collocation_request(
        start_date=start_date,
        end_date=end_date,
        devices=devices,
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

    user_details = decode_user_token(token)
    start_date = str_to_date(start_date, str_format="%Y-%m-%d")
    end_date = str_to_date(end_date, str_format="%Y-%m-%d")

    batch = CollocationBatch(
        batch_id="",
        batch_name=batch_name,
        devices=list(set(devices)),
        base_device=base_device,
        start_date=start_date,
        end_date=end_date,
        date_created=datetime.datetime.utcnow(),
        expected_hourly_records=expected_records_per_hour,
        inter_correlation_threshold=inter_correlation_threshold,
        intra_correlation_threshold=intra_correlation_threshold,
        inter_correlation_r2_threshold=inter_correlation_r2_threshold,
        intra_correlation_r2_threshold=intra_correlation_r2_threshold,
        data_completeness_threshold=data_completeness_threshold,
        differences_threshold=differences_threshold,
        data_completeness_parameter=data_completeness_parameter,
        inter_correlation_parameter=inter_correlation_parameter,
        intra_correlation_parameter=intra_correlation_parameter,
        differences_parameter=differences_parameter,
        inter_correlation_additional_parameters=inter_correlation_additional_parameters,
        created_by=user_details,
        status=CollocationBatchStatus.SCHEDULED,
        results=CollocationBatchResult.empty_results(),
        summary=[],
        errors=[],
    )

    batch.update_status()
    if batch == CollocationBatchStatus.COMPLETED:
        batch.status = CollocationBatchStatus.OVERDUE

    collocation = Collocation()
    batch = collocation.save_batch(batch)

    return (
        jsonify({"message": "success", "data": batch.to_dict(retain_batch_id=True)}),
        200,
    )


@collocation_bp.route("", methods=["DELETE"])
def delete_collocation_batch():
    devices = request.args.get("devices", "")
    batch_id = request.args.get("batchId")

    devices = [] if devices.strip() == "" else str(devices).split(",")
    collocation = Collocation()
    batch: CollocationBatch = collocation.delete_batch(
        batch_id=batch_id, devices=devices
    )

    if batch is None:
        return jsonify({"message": "Successful"}), 204
    return (
        jsonify({"message": "Successful", "data": batch.to_dict(retain_batch_id=True)}),
        200,
    )


@collocation_bp.route("", methods=["GET"])
def get_collocation_batch():
    batch_id = request.args.get("batchId")
    collocation = Collocation()
    batch: CollocationBatch = collocation.get_batch(batch_id=batch_id)

    if batch is None:
        return jsonify({"message": "Successful"}), 404
    return (
        jsonify({"message": "Successful", "data": batch.to_dict(retain_batch_id=True)}),
        200,
    )


@collocation_bp.route("/summary", methods=["GET"])
def collocation_summary():
    collocation = Collocation()
    summary = collocation.summary()
    return jsonify({"data": list(map(lambda x: x.to_dict(), summary))}), 200


@collocation_bp.route("/data", methods=["GET"])
def collocation_batch_data():
    devices = request.args.get("devices", "")
    batch_id = request.args.get("batchId")

    devices = [] if devices.strip() == "" else str(devices).split(",")
    collocation = Collocation()
    results = collocation.get_hourly_data(batch_id=batch_id, devices=devices)
    return jsonify({"data": results}), 200


@collocation_bp.route("/results", methods=["GET"])
def collocation_batch_results():
    batch_id = request.args.get("batchId")
    collocation = Collocation()
    results = collocation.get_results(batch_id=batch_id)
    return jsonify({"data": results.to_dict()}), 200


@collocation_bp.route("/data-completeness", methods=["GET"])
def collocation_data_completeness():
    devices = request.args.get("devices", "")
    batch_id = request.args.get("batchId")

    devices = [] if devices.strip() == "" else str(devices).split(",")
    collocation = Collocation()
    completeness = collocation.get_data_completeness(batch_id=batch_id, devices=devices)
    return jsonify({"data": completeness}), 200


@collocation_bp.route("/statistics", methods=["GET"])
def collocation_data_statistics():
    devices = request.args.get("devices", "")
    batch_id = request.args.get("batchId")

    devices = [] if devices.strip() == "" else str(devices).split(",")
    collocation = Collocation()
    completeness = collocation.get_statistics(batch_id=batch_id, devices=devices)
    return jsonify({"data": completeness}), 200


@collocation_bp.route("/intra", methods=["GET"])
def collocation_intra():
    devices = request.args.get("devices", "")
    batch_id = request.args.get("batchId")

    devices = [] if devices.strip() == "" else str(devices).split(",")
    collocation = Collocation()
    # intra_sensor_correlation = collocation.get_intra_sensor_correlation(
    #     batch_id=batch_id, devices=devices
    # )
    intra_sensor_correlation = collocation.get_hourly_intra_sensor_correlation(
        batch_id=batch_id, devices=devices
    )
    return jsonify({"data": intra_sensor_correlation}), 200
