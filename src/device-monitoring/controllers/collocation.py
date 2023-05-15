import datetime
import logging
import traceback
import uuid

from flask import Blueprint, request, jsonify

import routes
from config.constants import CollocationDefaults
from helpers.collocation import CollocationScheduling
from helpers.collocation_utils import (
    validate_collocation_request,
)
from helpers.convert_dates import str_to_date
from helpers.utils import decode_user_token
from models import (
    CollocationBatch,
    CollocationBatchStatus,
    CollocationBatchResult,
)

_logger = logging.getLogger(__name__)

collocation_bp = Blueprint("collocation", __name__)


@collocation_bp.route(routes.COLLOCATION, methods=["POST"])
def save_collocation_batch():
    token = request.headers.get("Authorization", "")
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    base_device = json_data.get("baseDevice", None)
    start_date = json_data.get("startDate", None)
    end_date = json_data.get("endDate", None)

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

    try:
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
        )

        collocation_scheduling = CollocationScheduling()
        batch = collocation_scheduling.save_batch(batch)

        return jsonify({"message": "success", "data": batch.to_dict()}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION, methods=["DELETE"])
def delete_collocation_batch():
    json_data = request.get_json()
    batch_id = json_data.get("batchId")
    devices = json_data.get("devices", [])

    try:
        collocation_scheduling = CollocationScheduling()
        batch: CollocationBatch = collocation_scheduling.delete_batch(
            batch_id=batch_id, devices=devices
        )

        if batch is None:
            return jsonify({"message": "Successful"}), 404
        return jsonify({"message": "Successful", "data": batch.to_dict()}), 200

    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_SUMMARY, methods=["GET"])
def collocation_summary():
    try:
        collocation_scheduling = CollocationScheduling()
        summary = collocation_scheduling.summary()
        return jsonify({"data": list(map(lambda x: x.to_dict(), summary))}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_DATA, methods=["POST"])
def collocation_batch_data():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    batch_id = json_data.get("batchId")

    try:
        collocation_scheduling = CollocationScheduling()
        results = collocation_scheduling.get_hourly_data(
            batch_id=batch_id, devices=devices
        )
        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_RESULTS, methods=["POST"])
def collocation_batch_results():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    batch_id = json_data.get("batchId")

    try:
        collocation_scheduling = CollocationScheduling()
        results = collocation_scheduling.get_hourly_data(
            batch_id=batch_id, devices=devices
        )
        return jsonify({"data": results}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_DATA_COMPLETENESS, methods=["POST"])
def collocation_data_completeness():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    batch_id = json_data.get("batchId")

    try:
        collocation_scheduling = CollocationScheduling()
        completeness = collocation_scheduling.get_data_completeness(
            batch_id=batch_id, devices=devices
        )
        return jsonify({"data": completeness}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_STATISTICS, methods=["POST"])
def collocation_data_statistics():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    batch_id = json_data.get("batchId")

    try:
        collocation_scheduling = CollocationScheduling()
        completeness = collocation_scheduling.get_statistics(
            batch_id=batch_id, devices=devices
        )
        return jsonify({"data": completeness}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500


@collocation_bp.route(routes.COLLOCATION_INTRA, methods=["POST"])
def collocation_intra():
    json_data = request.get_json()
    devices = json_data.get("devices", [])
    batch_id = json_data.get("batchId")

    try:
        collocation_scheduling = CollocationScheduling()
        intra_sensor_correlation = collocation_scheduling.get_intra_sensor_correlation(
            batch_id=batch_id, devices=devices
        )
        return jsonify({"data": intra_sensor_correlation}), 200
    except Exception as ex:
        traceback.print_exc()
        print(ex)
        return jsonify({"error": "Error occurred. Contact support"}), 500
