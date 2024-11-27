# configure.py
import os
from pathlib import Path

import gcsfs
import joblib
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)


class Config:
    AIRQO_API_TOKEN = os.getenv("AIRQO_API_TOKEN")
    GRID_URL = os.getenv("GRID_URL_ID")
    BIGQUERY_HOURLY_CONSOLIDATED = os.getenv("BIGQUERY_HOURLY_CONSOLIDATED")
    CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_CLOUD_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    GOOGLE_APPLICATION_CREDENTIALS_EMAIL = os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS_EMAIL"
    )
    PROJECT_BUCKET = os.getenv("PROJECT_BUCKET")
    BIGQUERY_SATELLITE_MODEL_PREDICTIONS = os.getenv(
        "BIGQUERY_SATELLITE_MODEL_PREDICTIONS"
    )
    ANALTICS_URL = os.getenv("ANALTICS_URL")
    HUGGING_FACE_TOKEN = os.getenv("HUGGING_FACE_TOKEN")
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
class ProductionConfig(Config):
    DEBUG = False
    TESTING = False


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True


class TestingConfig(Config):
    DEBUG = True
    TESTING = True


app_config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": TestingConfig,
}

environment = os.getenv("FLASK_ENV", "staging")
print("ENVIRONMENT", environment or "staging")

configuration = app_config.get(environment, "staging")

satellite_collections = {
    "COPERNICUS/S5P/OFFL/L3_SO2": [
        "SO2_column_number_density",
        "SO2_column_number_density_amf",
        "SO2_slant_column_number_density",
        "absorbing_aerosol_index",
        "cloud_fraction",
        "sensor_azimuth_angle",
        "sensor_zenith_angle",
        "solar_azimuth_angle",
        "solar_zenith_angle",
        "SO2_column_number_density_15km",
    ],
    "COPERNICUS/S5P/OFFL/L3_CO": [
        "CO_column_number_density",
        "H2O_column_number_density",
        "cloud_height",
        "sensor_altitude",
        "sensor_azimuth_angle",
        "sensor_zenith_angle",
        "solar_azimuth_angle",
        "solar_zenith_angle",
    ],
    "COPERNICUS/S5P/OFFL/L3_NO2": [
        "NO2_column_number_density",
        "tropospheric_NO2_column_number_density",
        "stratospheric_NO2_column_number_density",
        "NO2_slant_column_number_density",
        "tropopause_pressure",
        "absorbing_aerosol_index",
        "cloud_fraction",
        "sensor_altitude",
        "sensor_azimuth_angle",
        "sensor_zenith_angle",
        "solar_azimuth_angle",
        "solar_zenith_angle",
    ],
    "COPERNICUS/S5P/OFFL/L3_HCHO": [
        "tropospheric_HCHO_column_number_density",
        "tropospheric_HCHO_column_number_density_amf",
        "HCHO_slant_column_number_density",
        "cloud_fraction",
        "solar_zenith_angle",
        "solar_azimuth_angle",
        "sensor_zenith_angle",
        "sensor_azimuth_angle",
    ],
    "COPERNICUS/S5P/OFFL/L3_O3": [
        "O3_column_number_density",
        "O3_effective_temperature",
        "cloud_fraction",
        "sensor_azimuth_angle",
        "sensor_zenith_angle",
        "solar_azimuth_angle",
        "solar_zenith_angle",
    ],
    "COPERNICUS/S5P/OFFL/L3_AER_AI": [
        "absorbing_aerosol_index",
        "sensor_altitude",
        "sensor_azimuth_angle",
        "sensor_zenith_angle",
        "solar_azimuth_angle",
        "solar_zenith_angle",
    ],
    "COPERNICUS/S5P/OFFL/L3_CH4": [
        "CH4_column_volume_mixing_ratio_dry_air",
        "aerosol_height",
        "aerosol_optical_depth",
        "sensor_zenith_angle",
        "sensor_azimuth_angle",
        "solar_azimuth_angle",
        "solar_zenith_angle",
    ],
    "COPERNICUS/S5P/OFFL/L3_CLOUD": [
        "cloud_fraction",
        "cloud_top_pressure",
        "cloud_top_height",
        "cloud_base_pressure",
        "cloud_base_height",
        "cloud_optical_depth",
        "surface_albedo",
        "sensor_azimuth_angle",
        "sensor_zenith_angle",
        "solar_azimuth_angle",
        "solar_zenith_angle",
    ],
}


def get_trained_model_from_gcs(project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)
    try:
        with fs.open(bucket_name + "/" + source_blob_name, "rb") as handle:
            job = joblib.load(handle)
    except Exception as e:
        print(f"Error loading model from GCS: {e}")
        job = None
    return job
