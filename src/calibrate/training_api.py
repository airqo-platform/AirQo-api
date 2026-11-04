"""Authenticated reference-training submissions, polling, and downloads."""

import io
import uuid

import pandas as pd
from flask import Blueprint, current_app, g, jsonify, request, send_file, url_for
from werkzeug.exceptions import RequestEntityTooLarge

from routes import route
from training_auth import login_required
from training_core import REQUIRED, SECONDARY
from training_store import TrainingStore

training_bp = Blueprint("training_bp", __name__)


def error(message, status):
    return jsonify(success=False, message=message), status


@training_bp.after_request
def private_response(response):
    response.headers["Cache-Control"] = "private, no-store"
    return response


@training_bp.route(route["train_calibrate_tool_v2"], methods=["POST"])
@login_required
def submit_training():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return error("Upload paired sensor and reference measurements using the 'file' field.", 400)
    upload.stream.seek(0, 2)
    size = upload.stream.tell()
    upload.stream.seek(0)
    if size > current_app.config["MAX_CSV_BYTES"]:
        raise RequestEntityTooLarge()
    try:
        header = pd.read_csv(upload, nrows=0).columns
    except (ValueError, pd.errors.ParserError, UnicodeDecodeError):
        return error("The uploaded file could not be read as CSV.", 400)
    finally:
        upload.stream.seek(0)
    options = {key: request.form[key].strip() for key in (
        *REQUIRED, *SECONDARY, "reference_pm2_5", "reference_pm10",
        "pollutant", "averaging_interval") if key in request.form}
    pollutant = options.get("pollutant")
    if pollutant is None:
        available = [p for p in ("pm2_5", "pm10")
                     if options.get("reference_" + p, "reference_" + p) in header]
        pollutant = "both" if len(available) == 2 else (available[0] if available else "both")
    if pollutant not in {"pm2_5", "pm10", "both"}:
        return error("pollutant must be pm2_5, pm10, or both.", 400)
    options["pollutant"] = pollutant
    options.setdefault("averaging_interval", "1h")
    if options["averaging_interval"] not in {"1h", "raw"}:
        return error("averaging_interval must be 1h or raw.", 400)
    pollutants = ["pm2_5", "pm10"] if pollutant == "both" else [pollutant]
    fields = [*REQUIRED, *["reference_" + p for p in pollutants]]
    fields += [field for field in SECONDARY if field in options or field in header]
    columns = [options.get(field, field) for field in fields]
    if not all(columns) or len(set(columns)) != len(columns):
        return error("Each training field must map to a distinct nonempty CSV column.", 400)
    missing = [column for column in columns if column not in header]
    if missing:
        return error("Missing CSV columns: " + ", ".join(missing), 400)
    store = None
    try:
        store = TrainingStore()
        job = store.submit(g.training_owner, upload.stream, options)
    except Exception:
        current_app.logger.exception("Training submission failed")
        return error("Training queue is unavailable.", 503)
    finally:
        if store:
            store.close()
    status_url = url_for("training_bp.training_status", job_id=job["_id"])
    response = jsonify(success=True, job_id=job["_id"], status="queued", status_url=status_url)
    response.status_code = 202
    response.headers["Location"] = status_url
    response.headers["Retry-After"] = "5"
    return response


def get_owned_job(store, job_id):
    try:
        if str(uuid.UUID(job_id)) != job_id:
            return None
    except ValueError:
        return None
    return store.owned_job(job_id, g.training_owner)


@training_bp.route(route["training_job_v2"], methods=["GET"])
@login_required
def training_status(job_id):
    store = None
    try:
        store = TrainingStore()
        job = get_owned_job(store, job_id)
        if job is None:
            return error("Training job not found.", 404)
        payload = {"success": True, "job_id": job_id, "status": job["status"],
                   "created_at": job["created_at"].isoformat(),
                   "expires_at": job["expires_at"].isoformat()}
        if job["status"] == "completed":
            payload.update(job["summary"])
            payload["result_url"] = url_for("training_bp.training_result", job_id=job_id)
            payload["model_url"] = url_for("training_bp.training_model", job_id=job_id)
        elif job["status"] == "failed":
            payload["message"] = job["message"]
        return jsonify(payload)
    except Exception:
        current_app.logger.exception("Training status lookup failed")
        return error("Training queue is unavailable.", 503)
    finally:
        if store:
            store.close()


def download(job_id, kind):
    store = None
    try:
        store = TrainingStore()
        job = get_owned_job(store, job_id)
        if job is None:
            return error("Training job not found.", 404)
        if job["status"] != "completed":
            return error("Training results are not ready.", 409)
        with store.files.get(job[kind + "_id"]) as source:
            content = io.BytesIO(source.read())
        filename = "validation.csv" if kind == "result" else "model.joblib"
        return send_file(content, mimetype="text/csv" if kind == "result" else "application/octet-stream",
                         as_attachment=True, download_name=filename)
    except Exception:
        current_app.logger.exception("Training download failed")
        return error("Training download is unavailable.", 503)
    finally:
        if store:
            store.close()


@training_bp.route(route["training_job_v2"] + "/result", methods=["GET"])
@login_required
def training_result(job_id):
    return download(job_id, "result")


@training_bp.route(route["training_job_v2"] + "/model", methods=["GET"])
@login_required
def training_model(job_id):
    return download(job_id, "model")
