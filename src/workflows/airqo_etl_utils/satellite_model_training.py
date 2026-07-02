"""Sentinel-2-compatible PM2.5 satellite model training utilities."""

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict
import logging
import math
import os

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from airqo_etl_utils.config import configuration
from airqo_etl_utils.storage import FileStorage, GCSFileStorage
from airqo_etl_utils.utils.machine_learning.mlflow_tracker import MlflowTracker

logger = logging.getLogger("airflow.task")


class SatelliteModelTrainer:
    """Train the model consumed by /api/v2/spatial/satellite_prediction."""

    FEATURE_ORDER = [
        "ndvi",
        "ndbi",
        "ndwi",
        "bare_soil_index",
        "normalized_burn_ratio",
        "aerosol_optical_thickness",
        "scene_cloud_cover",
        "latitude",
        "longitude",
        "year",
        "month",
        "day",
        "dayofweek",
        "week",
    ]
    STAC_URL = os.getenv("SENTINEL2_STAC_URL", "https://earth-search.aws.element84.com/v1")
    COLLECTION = "sentinel-2-l2a"
    REQUIRED_ASSETS = ("blue", "green", "red", "nir", "swir16", "swir22", "aot", "scl")
    CLOUD_SCL_CLASSES = {0, 1, 3, 8, 9, 10, 11}

    @staticmethod
    def _safe_index(numerator, denominator):
        if denominator is None or abs(denominator) < 1e-12:
            return None
        value = numerator / denominator
        return round(float(max(-1.0, min(1.0, value))), 4)

    @staticmethod
    def _sample_asset(asset_href, latitude, longitude, scale):
        import rasterio
        from rasterio.windows import Window
        from rasterio.warp import transform

        with rasterio.Env(
            AWS_NO_SIGN_REQUEST="YES",
            GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
            CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.TIF",
        ):
            with rasterio.open(asset_href) as dataset:
                xs, ys = transform("EPSG:4326", dataset.crs, [longitude], [latitude])
                row, col = dataset.index(xs[0], ys[0])
                values = dataset.read(1, window=Window(col - 1, row - 1, 3, 3), masked=True)
                if values.count() == 0:
                    return None
                value = float(np.ma.median(values))
                if not math.isfinite(value):
                    return None
                return value * scale

    @classmethod
    def _search_items(cls, latitude, longitude, start_date, end_date):
        from pystac_client import Client

        catalog = Client.open(cls.STAC_URL)
        search = catalog.search(
            collections=[cls.COLLECTION],
            intersects={"type": "Point", "coordinates": [longitude, latitude]},
            datetime=f"{start_date}/{end_date}",
            query={"eo:cloud_cover": {"lt": float(os.getenv("SENTINEL2_MAX_CLOUD_COVER", "50"))}},
            sortby=[
                {"field": "properties.eo:cloud_cover", "direction": "asc"},
                {"field": "properties.datetime", "direction": "desc"},
            ],
            max_items=5,
        )
        return list(search.items())

    @classmethod
    def _sample_item(cls, item, latitude, longitude):
        import rasterio
        from rasterio._env import set_proj_data_search_path

        rasterio_proj_data = os.path.join(os.path.dirname(rasterio.__file__), "proj_data")
        os.environ["PROJ_LIB"] = rasterio_proj_data
        os.environ["PROJ_DATA"] = rasterio_proj_data
        set_proj_data_search_path(rasterio_proj_data)

        missing_assets = [name for name in cls.REQUIRED_ASSETS if name not in item.assets]
        if missing_assets:
            raise ValueError(f"Sentinel-2 item is missing assets: {', '.join(missing_assets)}")

        reflectance_assets = ("blue", "green", "red", "nir", "swir16", "swir22")
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                asset_name: executor.submit(
                    cls._sample_asset,
                    item.assets[asset_name].href,
                    latitude,
                    longitude,
                    0.0001,
                )
                for asset_name in reflectance_assets
            }
            futures["aot"] = executor.submit(cls._sample_asset, item.assets["aot"].href, latitude, longitude, 0.001)
            futures["scl"] = executor.submit(cls._sample_asset, item.assets["scl"].href, latitude, longitude, 1.0)
            sampled = {asset_name: future.result() for asset_name, future in futures.items()}

        scl = sampled["scl"]
        if scl is None or int(round(scl)) in cls.CLOUD_SCL_CLASSES:
            raise ValueError(f"Cloudy or invalid Sentinel-2 point (SCL={scl})")
        if any(sampled[name] is None for name in reflectance_assets):
            raise ValueError("One or more Sentinel-2 reflectance bands had no valid data")

        blue = sampled["blue"]
        green = sampled["green"]
        red = sampled["red"]
        nir = sampled["nir"]
        swir16 = sampled["swir16"]
        swir22 = sampled["swir22"]

        return {
            "scene_id": item.id,
            "scene_datetime": item.datetime.isoformat() if item.datetime else None,
            "scene_cloud_cover": item.properties.get("eo:cloud_cover"),
            "ndvi": cls._safe_index(nir - red, nir + red),
            "ndbi": cls._safe_index(swir16 - nir, swir16 + nir),
            "ndwi": cls._safe_index(green - nir, green + nir),
            "bare_soil_index": cls._safe_index((swir16 + red) - (nir + blue), (swir16 + red) + (nir + blue)),
            "normalized_burn_ratio": cls._safe_index(nir - swir22, nir + swir22),
            "aerosol_optical_thickness": round(sampled["aot"], 4) if sampled["aot"] is not None else None,
        }

    @classmethod
    def _features_for_date(cls, latitude, longitude, timestamp):
        timestamp = pd.Timestamp(timestamp)
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize("UTC")
        else:
            timestamp = timestamp.tz_convert("UTC")

        search_days = max(7, min(int(os.getenv("SENTINEL2_SEARCH_DAYS", "60")), 365))
        end_date = timestamp.strftime("%Y-%m-%d")
        start_date = (timestamp - pd.Timedelta(days=search_days)).strftime("%Y-%m-%d")
        errors = []
        for item in cls._search_items(latitude, longitude, start_date, end_date):
            try:
                features = cls._sample_item(item, latitude, longitude)
                scene_datetime = features.get("scene_datetime")
                feature_timestamp = pd.Timestamp(scene_datetime).tz_convert("UTC") if scene_datetime else timestamp
                features.update(
                    {
                        "latitude": float(latitude),
                        "longitude": float(longitude),
                        "year": int(feature_timestamp.year),
                        "month": int(feature_timestamp.month),
                        "day": int(feature_timestamp.day),
                        "dayofweek": int(feature_timestamp.weekday()),
                        "week": int(feature_timestamp.strftime("%V")),
                    }
                )
                return features
            except Exception as error:
                errors.append(f"{item.id}: {error}")
        raise LookupError("No usable Sentinel-2 scene at the point: " + " | ".join(errors))

    @classmethod
    def enrich_airqo_daily_with_sentinel2(cls, data: pd.DataFrame) -> pd.DataFrame:
        required = {"timestamp", "latitude", "longitude", "pm2_5"}
        missing = required - set(data.columns)
        if missing:
            raise ValueError(f"Missing required columns for Sentinel-2 enrichment: {missing}")

        rows = []
        cache = {}
        for index, row in data.iterrows():
            timestamp = pd.Timestamp(row["timestamp"])
            if timestamp.tzinfo is None:
                timestamp = timestamp.tz_localize("UTC")
            else:
                timestamp = timestamp.tz_convert("UTC")
            cache_key = (
                round(float(row["latitude"]), 4),
                round(float(row["longitude"]), 4),
                timestamp.date().isoformat(),
            )
            row_data = row.to_dict()
            try:
                if cache_key not in cache:
                    cache[cache_key] = cls._features_for_date(row["latitude"], row["longitude"], timestamp)
                row_data.update(cache[cache_key])
                row_data["sentinel2_error"] = None
            except Exception as error:
                logger.warning("Skipping satellite training row %s: Sentinel-2 lookup failed: %s", index, error)
                row_data["sentinel2_error"] = str(error)
            rows.append(row_data)
        return pd.DataFrame(rows)

    @classmethod
    def train_and_upload(cls, data: pd.DataFrame) -> Dict[str, Any]:
        training_data = data.copy()
        training_data["pm2_5"] = pd.to_numeric(training_data["pm2_5"], errors="coerce")
        training_data = training_data[training_data["pm2_5"].between(0, 500)]
        for column in cls.FEATURE_ORDER:
            training_data[column] = pd.to_numeric(training_data[column], errors="coerce")
        training_data = training_data.dropna(subset=cls.FEATURE_ORDER + ["pm2_5"])
        if training_data.empty:
            raise ValueError("No satellite training rows remained after feature cleanup.")

        X = training_data[cls.FEATURE_ORDER]
        y = training_data["pm2_5"]
        if len(training_data) >= 10:
            X_train, X_val, y_train, y_val = train_test_split(
                X,
                y,
                test_size=0.2,
                random_state=42,
            )
        else:
            X_train, X_val, y_train, y_val = X, X, y, y

        params = {
            "random_state": 42,
            "n_estimators": 500,
            "learning_rate": 0.05,
            "num_leaves": 31,
            "objective": "regression",
            "n_jobs": -1,
        }
        model = LGBMRegressor(**params)
        model.fit(X_train, y_train)

        predictions = model.predict(X_val)
        metrics = {
            "rows_total": int(len(training_data)),
            "rows_train": int(len(X_train)),
            "rows_validation": int(len(X_val)),
            "mae": float(mean_absolute_error(y_val, predictions)),
            "rmse": float(np.sqrt(mean_squared_error(y_val, predictions))),
            "r2": float(r2_score(y_val, predictions)) if len(X_val) > 1 else 0.0,
        }

        bucket_name = configuration.SATELLITE_PREDICTION_BUCKET or configuration.FORECAST_MODELS_BUCKET
        destination_file = configuration.SATELLITE_PREDICTION_MODEL_FILE
        if not bucket_name:
            raise ValueError("Missing required config: SATELLITE_PREDICTION_BUCKET or FORECAST_MODELS_BUCKET.")

        storage: FileStorage = GCSFileStorage()
        uri = storage.save_file_object(bucket=bucket_name, obj=model, destination_file=destination_file)
        metadata = {
            **metrics,
            "feature_names": cls.FEATURE_ORDER,
            "bucket": bucket_name,
            "destination_file": destination_file,
            "uri": uri,
        }
        cls._log_mlflow(
            model=model,
            params=params,
            metrics=metrics,
            training_data=training_data,
            bucket_name=bucket_name,
            destination_file=destination_file,
            input_example=X_val.head(5) if not X_val.empty else None,
        )
        logger.info("Trained Sentinel-2 satellite prediction model: %s", metadata)
        return metadata

    @classmethod
    def _log_mlflow(
        cls,
        *,
        model: LGBMRegressor,
        params: Dict[str, Any],
        metrics: Dict[str, Any],
        training_data: pd.DataFrame,
        bucket_name: str,
        destination_file: str,
        input_example: pd.DataFrame = None,
    ) -> None:
        """Log the satellite training run to the configured Databricks MLflow tracker."""
        tracker = MlflowTracker(
            tracking_uri=configuration.MLFLOW_TRACKING_URI,
            registry_uri=configuration.MLFLOW_REGISTRY_URI,
            experiment_name=configuration.MLFLOW_EXPERIMENT_NAME,
            model_gating_enabled=configuration.MLFLOW_ENABLE_MODEL_GATING,
            enabled=True,
        )
        tracker.log_run(
            run_name="satellite-pm25-sentinel2-daily",
            params={
                **params,
                "feature_count": len(cls.FEATURE_ORDER),
                "bucket": bucket_name,
                "destination_file": destination_file,
            },
            metrics=metrics,
            tags={
                "pipeline": "satellite_prediction",
                "satellite_provider": "Element 84 Earth Search",
                "satellite_collection": cls.COLLECTION,
                "feature_schema": "sentinel2_l2a",
                "label_frequency": "daily",
                "deployed": "true",
            },
            model=model,
            model_artifact_path="model",
            dataset=training_data,
            dataset_date_col="timestamp",
            input_example=input_example,
            deployed=True,
        )