"""CSV upload limits and Flask request handlers."""

from flask import jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

MAX_CSV_BYTES = 20 * 1024 * 1024


def upload_too_large(error):
    return jsonify(
        success=False,
        message="The uploaded file is bigger than the 20 MB limit (20,971,520 bytes). Please upload a smaller CSV file.",
    ), 413


def limit_csv_size():
    if request.endpoint not in {
        "calibrate_v2_bp.calibrate_tool",
        "training_bp.submit_training",
        "training_bp.calibrate_with_trained_model",
    }:
        return
    for upload in request.files.getlist("file"):
        position = upload.stream.tell()
        upload.stream.seek(0, 2)
        size = upload.stream.tell()
        upload.stream.seek(position)
        if size > MAX_CSV_BYTES:
            raise RequestEntityTooLarge()


def configure_upload_limits(app):
    # Allow multipart boundaries and mapping fields beyond the file's own limit.
    app.config["MAX_CONTENT_LENGTH"] = MAX_CSV_BYTES + 1024 * 1024
    app.config["MAX_CSV_BYTES"] = MAX_CSV_BYTES
    app.register_error_handler(RequestEntityTooLarge, upload_too_large)
    app.before_request(limit_csv_size)
