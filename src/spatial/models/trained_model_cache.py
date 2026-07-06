import logging
import os
from pathlib import Path
import shutil
import tempfile
from threading import Event, RLock
from typing import Optional, Tuple

import gcsfs
import joblib

from configure import Config, _resolve_credentials_path


logger = logging.getLogger(__name__)

_MODEL_MEMORY_CACHE = {}
_MODEL_LOAD_IN_FLIGHT = {}
_MODEL_CACHE_LOCK = RLock()


def _model_cache_key(project_name, bucket_name, source_blob_name):
    return (
        project_name or "",
        bucket_name.strip("/"),
        source_blob_name.lstrip("/"),
    )


def _model_cache_path(bucket_name, source_blob_name):
    cache_dir = Path(
        Config.SATELLITE_MODEL_CACHE_DIR
        or os.path.join(tempfile.gettempdir(), "airqo_spatial_models")
    )
    safe_name = "__".join(
        part.replace("/", "_").replace("\\", "_")
        for part in (bucket_name.strip("/"), source_blob_name.lstrip("/"))
    )
    return cache_dir / safe_name


def _clear_trained_model_cache_for_tests():
    with _MODEL_CACHE_LOCK:
        _MODEL_MEMORY_CACHE.clear()
        for state in _MODEL_LOAD_IN_FLIGHT.values():
            state["result"] = (None, "Prediction model cache was cleared.")
            state["event"].set()
        _MODEL_LOAD_IN_FLIGHT.clear()


def _get_memory_cache(cache_key, object_path):
    with _MODEL_CACHE_LOCK:
        cached_model = _MODEL_MEMORY_CACHE.get(cache_key)
    if cached_model is not None:
        logger.info(
            "SATELLITE_PREDICTION_MODEL_SOURCE=memory object=gs://%s",
            object_path,
        )
    return cached_model


def _set_memory_cache(cache_key, model):
    with _MODEL_CACHE_LOCK:
        _MODEL_MEMORY_CACHE[cache_key] = model


def _reserve_model_load(cache_key):
    with _MODEL_CACHE_LOCK:
        state = _MODEL_LOAD_IN_FLIGHT.get(cache_key)
        if state is not None:
            return state, False

        state = {"event": Event(), "result": None}
        _MODEL_LOAD_IN_FLIGHT[cache_key] = state
        return state, True


def _finish_model_load(cache_key, state, result):
    with _MODEL_CACHE_LOCK:
        state["result"] = result
        _MODEL_LOAD_IN_FLIGHT.pop(cache_key, None)
        state["event"].set()


def _load_model_from_disk_cache(cache_key, cache_path, object_path):
    if not cache_path.is_file():
        return None

    logger.warning(
        "SATELLITE_PREDICTION_MODEL_SOURCE=tmp status=attempt path=%s object=gs://%s",
        cache_path,
        object_path,
    )
    try:
        model = joblib.load(cache_path)
        _set_memory_cache(cache_key, model)
        logger.warning(
            "SATELLITE_PREDICTION_MODEL_SOURCE=tmp path=%s object=gs://%s",
            cache_path,
            object_path,
        )
        return model, None
    except Exception:
        logger.exception(
            "Failed to load cached prediction model from %s",
            cache_path,
        )
        try:
            cache_path.unlink()
        except OSError:
            logger.warning(
                "Could not remove invalid cached model: %s",
                cache_path,
            )
        return None


def _download_model_from_gcs(
    project_name,
    bucket_name,
    source_blob_name,
    cache_key,
    cache_path,
    object_path,
):
    credentials_path = _resolve_credentials_path(Config.CREDENTIALS)
    try:
        logger.warning(
            "SATELLITE_PREDICTION_MODEL_SOURCE=gcs status=attempt object=gs://%s",
            object_path,
        )
        token = credentials_path if credentials_path else "google_default"
        fs = gcsfs.GCSFileSystem(
            project=project_name or None,
            token=token,
        )
        if not fs.exists(object_path):
            return None, f"Model object gs://{object_path} was not found."

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with fs.open(object_path, "rb") as source:
            with tempfile.NamedTemporaryFile(
                dir=cache_path.parent,
                delete=False,
            ) as destination:
                temp_path = Path(destination.name)
                shutil.copyfileobj(source, destination)

        try:
            temp_path.replace(cache_path)
            model = joblib.load(cache_path)
        finally:
            if temp_path.exists():
                temp_path.unlink()

        _set_memory_cache(cache_key, model)
        logger.warning(
            "SATELLITE_PREDICTION_MODEL_SOURCE=gcs object=gs://%s cached_at=%s",
            object_path,
            cache_path,
        )
        return model, None
    except Exception:
        logger.exception("Failed to load trained model from gs://%s", object_path)
        if Config.CREDENTIALS and not credentials_path:
            return (
                None,
                "The configured GOOGLE_APPLICATION_CREDENTIALS file does not "
                "exist at the configured path or the supported spatial mount "
                f"locations: {Config.CREDENTIALS}",
            )
        return None, "Failed to load prediction model from cloud storage."


def _load_model_uncached(
    project_name,
    bucket_name,
    source_blob_name,
    cache_key,
    cache_path,
    object_path,
):
    disk_result = _load_model_from_disk_cache(cache_key, cache_path, object_path)
    if disk_result is not None:
        return disk_result

    return _download_model_from_gcs(
        project_name,
        bucket_name,
        source_blob_name,
        cache_key,
        cache_path,
        object_path,
    )


def get_trained_model_from_gcs(
    project_name,
    bucket_name,
    source_blob_name,
) -> Tuple[Optional[object], Optional[str]]:
    if not bucket_name:
        return None, "Prediction model bucket is not configured."
    if not source_blob_name:
        return None, "Prediction model object name is not configured."

    object_path = f"{bucket_name.strip('/')}/{source_blob_name.lstrip('/')}"
    cache_key = _model_cache_key(project_name, bucket_name, source_blob_name)
    cache_path = _model_cache_path(bucket_name, source_blob_name)

    cached_model = _get_memory_cache(cache_key, object_path)
    if cached_model is not None:
        return cached_model, None

    state, should_load = _reserve_model_load(cache_key)
    if not should_load:
        state["event"].wait()
        result = state.get("result")
        if result is not None:
            return result

        cached_model = _get_memory_cache(cache_key, object_path)
        if cached_model is not None:
            return cached_model, None

    try:
        result = _load_model_uncached(
            project_name,
            bucket_name,
            source_blob_name,
            cache_key,
            cache_path,
            object_path,
        )
    except Exception:
        logger.exception("Unexpected trained model cache failure")
        result = None, "Failed to load prediction model from cloud storage."
    finally:
        _finish_model_load(cache_key, state, result)
    return result
