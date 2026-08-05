# configure.py
import logging
import os
from pathlib import Path

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
        "satellite_prediction_model_v2.pkl",
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
