# configure.py
import logging
import os
from pathlib import Path
import tempfile
from threading import RLock
from typing import Optional, Tuple

import gcsfs
import joblib
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

logger = logging.getLogger(__name__)
class Config:
    AIRQO_API_TOKEN = os.getenv("AIRQO_API_TOKEN")
    AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL")
    REDIS_CACHE_TTL = os.getenv("REDIS_CACHE_TTL")
    REDIS_HOST = os.getenv("REDIS_HOST")
    REDIS_PORT=os.getenv("REDIS_PORT") 
    REDIS_URL=os.getenv("REDIS_URL")
    GRID_URL = os.getenv("GRID_URL_ID")
    REDIS_DB = os.getenv("REDIS_DB")
    REDIS_PASSWORD=os.getenv("REDIS_PASSWORD")
    BIGQUERY_HOURLY_CONSOLIDATED = os.getenv("BIGQUERY_HOURLY_CONSOLIDATED")
    CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_CLOUD_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    PROJECT_BUCKET = os.getenv("PROJECT_BUCKET", "airqo_prediction_bucket")
    SATELLITE_PREDICTION_BUCKET = os.getenv(
        "SATELLITE_PREDICTION_BUCKET",
        "airqo_prediction_bucket",
    )
    SPATIAL_PROJECT_BUCKET = os.getenv("SPATIAL_PROJECT_BUCKET")
    BIGQUERY_SATELLITE_MODEL_PREDICTIONS = os.getenv(
        "BIGQUERY_SATELLITE_MODEL_PREDICTIONS"
    )
    SATELLITE_PREDICTION_MODEL_FILE = os.getenv(
        "SATELLITE_PREDICTION_MODEL_FILE",
        "satellite_prediction_model_new.pkl",
    )
    SATELLITE_MODEL_CACHE_DIR = os.getenv(
        "SATELLITE_MODEL_CACHE_DIR",
        "/tmp/airqo_spatial_models",
    )
    ANALTICS_URL = os.getenv("ANALTICS_URL")
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY")
    FIRMS_API_BASE_URL = os.getenv(
        "FIRMS_API_BASE_URL",
        "https://firms.modaps.eosdis.nasa.gov",
    )
   
    _firms_timeout_seconds = os.getenv("FIRMS_REQUEST_TIMEOUT_SECONDS", "30")
    try:
        FIRMS_REQUEST_TIMEOUT_SECONDS = int(_firms_timeout_seconds)
    except (ValueError, TypeError):
        FIRMS_REQUEST_TIMEOUT_SECONDS = 30
    ACTIVE_FIRE_CACHE_TTL_SECONDS = os.getenv(
        "ACTIVE_FIRE_CACHE_TTL_SECONDS",
        "43200",
    )

    OVERPASS_API_URLS = os.getenv(
        "OVERPASS_API_URLS",
        ",".join(
            [
                "https://overpass-api.de/api/interpreter",
                "https://overpass.private.coffee/api/interpreter",
                "https://overpass.osm.jp/api/interpreter",
            ]
        ),
    )
    CACHE_KEY = "airqo:predicted_pm25"
    MODEL_DIR = os.getenv("MODEL_DIR_FILE", "./models")
    CITY_LIST_FILE = os.path.join(
        MODEL_DIR, "processed_cities.json"
    )  # JSON file for city list
    ENVIRONMENT = "base"

class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    ENVIRONMENT = "production"
    CITY_LIST_FILE = f"gs://{Config.SPATIAL_PROJECT_BUCKET}/processed_cities.json"
    

class StagingConfig(Config):
    """
    Configuration for staging environment.
    """
    DEBUG = True
    TESTING = True
    ENVIRONMENT = "staging"
    CITY_LIST_FILE = f"gs://{Config.SPATIAL_PROJECT_BUCKET}/processed_cities.json"
class DevelopmentConfig(Config):
    """
    Configuration for development environment.
    """
    DEVELOPMENT = True
    DEBUG = True
    ENVIRONMENT = "development"
    # uses default CITY_LIST_FILE (local)

class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    ENVIRONMENT = "testing"
    # uses default CITY_LIST_FILE (local)
app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": StagingConfig,
}


def get_environment() -> str:
    # Flask 2.3 removed FLASK_ENV. Keep a fallback for older deployments.
    return (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "staging").lower()


configuration = app_config.get(get_environment(), StagingConfig)


def _resolve_credentials_path(credentials_path):
    if not credentials_path:
        return None

    configured = Path(credentials_path)
    candidates = [configured]
    if not configured.is_absolute():
        candidates.extend(
            [
                BASE_DIR / configured,
                Path("/etc/config") / configured.name,
                Path("/app") / configured.name,
            ]
        )

    for candidate in candidates:
        if candidate.is_file():
            return str(candidate.resolve())
    return None


_MODEL_MEMORY_CACHE = {}
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

    with _MODEL_CACHE_LOCK:
        cached_model = _MODEL_MEMORY_CACHE.get(cache_key)
        if cached_model is not None:
            logger.warning(
                "SATELLITE_PREDICTION_MODEL_SOURCE=memory object=gs://%s",
                object_path,
            )
            return cached_model, None

        if cache_path.is_file():
            logger.warning(
                "SATELLITE_PREDICTION_MODEL_SOURCE=tmp status=attempt path=%s object=gs://%s",
                cache_path,
                object_path,
            )
            try:
                model = joblib.load(cache_path)
                _MODEL_MEMORY_CACHE[cache_key] = model
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

        credentials_path = _resolve_credentials_path(Config.CREDENTIALS)
        try:
            logger.warning(
                "SATELLITE_PREDICTION_MODEL_SOURCE=gcs status=attempt object=gs://%s",
                object_path,
            )
            token = (
                credentials_path
                if credentials_path
                else "google_default"
            )
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
                    destination.write(source.read())

            try:
                temp_path.replace(cache_path)
                model = joblib.load(cache_path)
            finally:
                if temp_path.exists():
                    temp_path.unlink()

            _MODEL_MEMORY_CACHE[cache_key] = model
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
