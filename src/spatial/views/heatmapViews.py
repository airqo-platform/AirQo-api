import os
import hashlib
import logging
import multiprocessing
import threading
from datetime import datetime, timezone
import numpy as np
from io import BytesIO
from PIL import Image
from scipy.interpolate import griddata
from scipy.spatial import QhullError
from matplotlib.colors import to_rgba
from shapely import intersects_xy
from shapely.geometry.base import BaseGeometry
import base64
from flask import jsonify
import redis
import json
from typing import Optional, Dict, Any, List, Tuple
from models.heatmapModel import AirQualityData, AirQualityGrids, AirQualityPredictor


def _run_heatmap_refresh_process():
    """Run refresh work in a process that the parent can terminate on timeout."""
    from app_factory import create_app

    app = create_app()
    AQIImageGenerator._redis_client = None
    redis_client = AQIImageGenerator.get_redis_client()
    if redis_client is None:
        raise RuntimeError("Redis is unavailable to the heatmap refresh process")
    AQIImageGenerator._refresh_if_source_changed(app, redis_client)


# Ensure matplotlib is not using a GUI backend for image generation
# This prevents it from trying to open a window on a server
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

class AQIImageGenerator:
    _redis_client = None
    ALL_CITIES_CACHE_KEY = "aqi_images_all_cities_v3"
    CITY_CACHE_PREFIX = "aqi_image_v3_"
    SOURCE_VERSION_KEY = "aqi_heatmap_source_version_v3"
    REFRESH_GATE_KEY = "aqi_heatmap_refresh_gate_v3"
    REFRESH_INTERVAL_SECONDS = int(
        os.getenv("HEATMAP_REFRESH_INTERVAL_SECONDS", "3600")
    )
    REFRESH_RETRY_SECONDS = int(
        os.getenv("HEATMAP_REFRESH_RETRY_SECONDS", "300")
    )
    REFRESH_TIMEOUT_SECONDS = int(
        os.getenv("HEATMAP_REFRESH_TIMEOUT_SECONDS", "600")
    )
    logger = logging.getLogger(__name__)

    @classmethod
    def get_redis_client(cls):
        """
        Initializes and returns a Redis client, or None if connection fails.
        """
        if cls._redis_client is None:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            redis_db = int(os.getenv("REDIS_DB", 0))
            try:
                cls._redis_client = redis.StrictRedis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    decode_responses=True
                )
                cls._redis_client.ping()
                print(f"Connected to Redis at {redis_host}:{redis_port}")
            except redis.exceptions.ConnectionError as e:
                print(f"Could not connect to Redis: ")
                cls._redis_client = None
        return cls._redis_client

    @staticmethod
    def _source_data_version(payload):
        """Build a stable version from the measurements that affect a heatmap."""
        def normalized(value):
            return "" if value is None else str(value)

        measurements = (payload or {}).get("measurements") or []
        version_rows = []
        for measurement in measurements:
            site = measurement.get("siteDetails") or {}
            version_rows.append(
                (
                    normalized(measurement.get("time")),
                    normalized(site.get("_id")),
                    normalized((measurement.get("pm2_5") or {}).get("value")),
                    normalized((measurement.get("pm10") or {}).get("value")),
                )
            )
        serialized = json.dumps(sorted(version_rows), separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @staticmethod
    def _result_time():
        """Return the heatmap generation time as an ISO-8601 UTC value."""
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    @classmethod
    def _city_result(
        cls, city_id, city_name, image_data, bounds, message, result_time=None
    ):
        return {
            "id": city_id,
            "city": city_name,
            "image": image_data,
            "bounds": bounds,
            "message": message,
            "time": result_time or cls._result_time(),
        }

    @classmethod
    def _defer_next_refresh(cls, redis_client, seconds=None):
        try:
            redis_client.set(
                cls.REFRESH_GATE_KEY,
                "1",
                ex=seconds or cls.REFRESH_INTERVAL_SECONDS,
            )
        except redis.RedisError:
            cls.logger.exception("Failed to update the heatmap refresh gate")

    @classmethod
    def _schedule_refresh_if_due(cls, redis_client):
        """Start at most one refresh check per interval across all API workers."""
        try:
            acquired = redis_client.set(
                cls.REFRESH_GATE_KEY,
                "1",
                nx=True,
                ex=cls.REFRESH_INTERVAL_SECONDS,
            )
        except redis.RedisError:
            cls.logger.exception("Failed to acquire the heatmap refresh gate")
            return

        if not acquired:
            return

        process = None
        try:
            process = multiprocessing.Process(
                target=_run_heatmap_refresh_process,
                name="heatmap-cache-refresh",
                daemon=True,
            )
            process.start()
            threading.Thread(
                target=cls._monitor_refresh_process,
                args=(process, redis_client),
                name="heatmap-cache-refresh-monitor",
                daemon=True,
            ).start()
        except Exception:
            cls.logger.exception("Failed to start the heatmap refresh worker")
            if process is not None and process.is_alive():
                process.terminate()
                process.join(timeout=5)
            cls._defer_next_refresh(redis_client, cls.REFRESH_RETRY_SECONDS)

    @classmethod
    def _monitor_refresh_process(cls, process, redis_client):
        """Terminate a refresh that exceeds its hard execution deadline."""
        process.join(timeout=cls.REFRESH_TIMEOUT_SECONDS)
        if process.is_alive():
            cls.logger.error(
                "Heatmap refresh exceeded %ss and will be terminated",
                cls.REFRESH_TIMEOUT_SECONDS,
            )
            process.terminate()
            process.join(timeout=5)
            cls._defer_next_refresh(redis_client, cls.REFRESH_RETRY_SECONDS)
        elif process.exitcode not in (0, None):
            cls.logger.error(
                "Heatmap refresh process exited with code %s", process.exitcode
            )
            cls._defer_next_refresh(redis_client, cls.REFRESH_RETRY_SECONDS)

    @classmethod
    def _refresh_if_source_changed(cls, app, redis_client):
        """Regenerate caches in the background only when /map data changed."""
        try:
            with app.app_context():
                aq_data = AirQualityData()
                if not aq_data.fetch_data():
                    raise RuntimeError("Could not fetch /map data for refresh")

                source_version = cls._source_data_version(aq_data.data)
                cached_version = redis_client.get(cls.SOURCE_VERSION_KEY)
                if cached_version == source_version:
                    return

                _, status = cls.generate_aqi_image(
                    force_refresh=True,
                    aq_data=aq_data,
                )
                if status != 200:
                    raise RuntimeError(
                        f"Heatmap background refresh returned HTTP {status}"
                    )
        except Exception:
            cls.logger.exception("Heatmap background refresh failed")
            cls._defer_next_refresh(redis_client, cls.REFRESH_RETRY_SECONDS)

    @staticmethod
    def pm25_to_aqi(pm):
        """
        Converts PM2.5 concentration to AQI value.
        """
        if np.isnan(pm):
            return np.nan
        if pm < 0:
            return 0
        if pm <= 12.0:
            return int((50 / 12.0) * pm)
        elif pm <= 35.4:
            return int(((100 - 51) / (35.4 - 12.1)) * (pm - 12.1) + 51)
        elif pm <= 55.4:
            return int(((150 - 101) / (55.4 - 35.5)) * (pm - 35.5) + 101)
        elif pm <= 150.4:
            return int(((200 - 151) / (150.4 - 55.5)) * (pm - 55.5) + 151)
        elif pm <= 250.4:
            return int(((300 - 201) / (250.4 - 150.5)) * (pm - 150.5) + 201)
        else:
            return int(((500 - 301) / (500.4 - 250.5)) * (pm - 250.5) + 301)

    @staticmethod
    def aqi_to_color(aqi, alpha=0.6):
        """
        Converts AQI value to an RGBA color.
        """
        if np.isnan(aqi):
            return (0, 0, 0, 0)
        aqi = int(aqi)
        if aqi <= 50:
            return to_rgba("green", alpha)
        elif aqi <= 100:
            return to_rgba("yellow", alpha)
        elif aqi <= 150:
            return to_rgba("orange", alpha)
        elif aqi <= 200:
            return to_rgba("red", alpha)
        elif aqi <= 300:
            return to_rgba("purple", alpha)
        else:
            return to_rgba("maroon", alpha)

    @staticmethod
    def generate_image_for_city(
        data: List[Tuple[float, float, float]],
        city_name: str,
        boundary: BaseGeometry,
        resolution: int = 150,
    ):
        """
        Generates a heatmap image for a city based on provided data.

        Args:
            data: List of tuples containing (latitude, longitude, pm25).
            city_name: Name of the city.
            boundary: Exact grid polygon used to mask the image.
            resolution: Image resolution (pixels per dimension).

        Returns:
            Tuple of (image_data_url, bounds, message).
        """
        if len(data) < 2:
            return None, None, f"⚠️ Not enough data for {city_name}"

        coords = np.array([[lat, lon] for lat, lon, _ in data])
        values = np.array([pm for _, _, pm in data])

        if boundary is None or boundary.is_empty:
            return None, None, f"No boundary available for {city_name}"

        lon_min, lat_min, lon_max, lat_max = boundary.bounds
        bounds = [[lat_min, lon_min], [lat_max, lon_max]]

        grid_lat, grid_lon = np.mgrid[lat_min:lat_max:complex(resolution), lon_min:lon_max:complex(resolution)]
        grid_points = np.vstack([grid_lat.ravel(), grid_lon.ravel()]).T
        # Vectorized predicate includes polygon edges without constructing one
        # Shapely Point object per image pixel.
        boundary_mask = intersects_xy(
            boundary, grid_lon.ravel(), grid_lat.ravel()
        )
        try:
            interpolated_pm25 = griddata(
                coords, values, grid_points, method='cubic', fill_value=np.nan
            )
        except (QhullError, ValueError):
            interpolated_pm25 = griddata(coords, values, grid_points, method='nearest')

        # Cubic interpolation only covers the samples' convex hull. Fill the
        # remaining pixels inside the polygon so there is no transparent fringe.
        missing_inside = np.isnan(interpolated_pm25) & boundary_mask
        if missing_inside.any():
            interpolated_pm25[missing_inside] = griddata(
                coords,
                values,
                grid_points[missing_inside],
                method='nearest',
            )
        interpolated_pm25 = np.clip(interpolated_pm25, 0, 500)

        # A map image overlay is rectangular. Make all pixels outside the actual
        # polygon transparent so the visible heatmap follows the grid boundary.
        interpolated_pm25[~boundary_mask] = np.nan

        # The AQI color bands map directly to the PM2.5 breakpoints. Assign the
        # six colors in NumPy instead of making 45,000 Python function calls.
        colors_flat = np.zeros((interpolated_pm25.size, 4), dtype=float)
        valid = np.isfinite(interpolated_pm25)
        color_indexes = np.digitize(
            interpolated_pm25[valid],
            [12.0, 35.4, 55.4, 150.4, 250.4],
            right=True,
        )
        palette = np.array(
            [
                to_rgba('green', 0.6),
                to_rgba('yellow', 0.6),
                to_rgba('orange', 0.6),
                to_rgba('red', 0.6),
                to_rgba('purple', 0.6),
                to_rgba('maroon', 0.6),
            ]
        )
        colors_flat[valid] = palette[color_indexes]
        rgba_image = colors_flat.reshape(resolution, resolution, 4)
        rgba_image = np.flipud(rgba_image)

        img = Image.fromarray((rgba_image * 255).astype(np.uint8))
        buf = BytesIO()
        img.save(buf, format='PNG')
        img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        data_url = f"data:image/png;base64,{img_b64}"

        return data_url, bounds, f"✅ AQI image generated for {city_name}"

    @staticmethod
    def generate_aqi_image(force_refresh=False, aq_data=None):
        """
        Generates AQI heatmap images for all available cities.

        Cached JSON is returned immediately. Once per configured interval, one
        caller schedules a background /map version check. A changed version
        regenerates and atomically replaces the persistent Redis cache.

        Returns:
            Flask response with JSON containing city heatmaps or an error message.
        """
        redis_client = AQIImageGenerator.get_redis_client()
        all_cities_cache_key = AQIImageGenerator.ALL_CITIES_CACHE_KEY
        
        if redis_client and not force_refresh:
            cached_all_results = redis_client.get(all_cities_cache_key)
            if cached_all_results:
                AQIImageGenerator._schedule_refresh_if_due(redis_client)
                print("Serving ALL cities AQI images from Redis cache (full response).")
                return jsonify(json.loads(cached_all_results)), 200

        try:
            aq_data = aq_data or AirQualityData()
            aq_grids = AirQualityGrids()
            predictor = AirQualityPredictor(aq_data, aq_grids)

            if not predictor.fetch_and_process_data():
                return jsonify({"error": "Failed to fetch or process input data"}), 500

            if not predictor.train_and_predict():
                return jsonify({"error": "Model training and prediction failed"}), 500

            _, predictions_df = predictor.get_results()
            if predictions_df.empty:
                return jsonify({"error": "No predictions available"}), 500

            grid_gdf = predictor.grids.gdf
            if grid_gdf is None or grid_gdf.empty:
                return jsonify({"error": "No grid data available"}), 500

            results = []
            result_time = AQIImageGenerator._result_time()
            cache_key_prefix = AQIImageGenerator.CITY_CACHE_PREFIX
            for _, city_row in grid_gdf.iterrows():
                city_id = city_row["id"]
                city_name = city_row["name"]
                city_cache_key = f"{cache_key_prefix}{city_id}"

                city_df = predictions_df[predictions_df["city"] == city_name]
                if city_df.empty:
                    print(f"No prediction data for {city_name} (ID: {city_id})")
                    continue

                city_data = list(zip(city_df["latitude"], city_df["longitude"], city_df["predicted_pm25"]))
                image_data, bounds, message = AQIImageGenerator.generate_image_for_city(
                    city_data, city_name, city_row["geometry"]
                )

                city_result = AQIImageGenerator._city_result(
                    city_id,
                    city_name,
                    image_data,
                    bounds,
                    message,
                    result_time,
                )
                results.append(city_result)

                # Store in individual city cache
                if redis_client and image_data:
                    redis_client.set(city_cache_key, json.dumps(city_result))
                    print(f"Stored {city_name} (ID: {city_id}) in Redis cache.")

            if not results:
                return jsonify({"error": "No valid city data processed"}), 500
            
            if redis_client:
                redis_client.set(all_cities_cache_key, json.dumps(results))
                redis_client.set(
                    AQIImageGenerator.SOURCE_VERSION_KEY,
                    AQIImageGenerator._source_data_version(aq_data.data),
                )
                AQIImageGenerator._defer_next_refresh(redis_client)
                print("Stored ALL cities AQI images response in Redis cache.")

            return jsonify(results), 200

        except Exception as e:
            print(f"An error occurred: {e}")
            return jsonify({"error": "An internal error has occurred with Redis cache.{e}"}), 500

    @staticmethod
    def generate_aqi_image_for_city(city_id):
        """
        Generates AQI heatmap image for a specific city by its grid ID.

        Args:
            city_id: The grid ID of the city.

        Returns:
            Flask response with JSON containing the city's heatmap or an error message.
        """
        redis_client = AQIImageGenerator.get_redis_client()
        cache_key = f"{AQIImageGenerator.CITY_CACHE_PREFIX}{city_id}"

        # Try to get from cache
        if redis_client:
            cached_result = redis_client.get(cache_key)
            if cached_result:
                AQIImageGenerator._schedule_refresh_if_due(redis_client)
                print(f"Serving city ID {city_id} from Redis cache.")
                return jsonify(json.loads(cached_result)), 200

        try:
            aq_data = AirQualityData()
            aq_grids = AirQualityGrids()
            predictor = AirQualityPredictor(aq_data, aq_grids)

            if not predictor.fetch_and_process_data():
                return jsonify({"error": "Failed to fetch or process input data"}), 500

            grid_gdf = predictor.grids.gdf
            if grid_gdf is None or grid_gdf.empty:
                return jsonify({"error": "No grid data available"}), 500

            city_row = grid_gdf[grid_gdf["id"] == city_id]
            if city_row.empty:
                return jsonify({"error": f"No city found with ID {city_id}"}), 404

            # A city request should only load or create the requested grid model.
            predictor.gdf_polygons = city_row
            if not predictor.train_and_predict():
                return jsonify({"error": "Model training and prediction failed"}), 500

            _, predictions_df = predictor.get_results()
            if predictions_df.empty:
                return jsonify({"error": "No predictions available"}), 500

            city_name = city_row.iloc[0]["name"]
            city_df = predictions_df[predictions_df["city"] == city_name]
            if city_df.empty:
                return jsonify({"error": f"No prediction data for city ID {city_id} ({city_name})"}), 404

            city_data = list(zip(city_df["latitude"], city_df["longitude"], city_df["predicted_pm25"]))
            image_data, bounds, message = AQIImageGenerator.generate_image_for_city(
                city_data, city_name, city_row.iloc[0]["geometry"]
            )

            if not image_data:
                return jsonify({"error": message}), 400

            result = AQIImageGenerator._city_result(
                city_id, city_name, image_data, bounds, message
            )

            # Store in cache
            if redis_client:
                redis_client.set(cache_key, json.dumps(result))
                AQIImageGenerator._defer_next_refresh(redis_client)
                print(f"Stored {city_name} (ID: {city_id}) in Redis cache.")

            return jsonify(result), 200

        except Exception as e:
            print(f"An error occurred for city ID {city_id}: ")
            return jsonify({"error": f"An internal error has occurred for city ID: {e}"}), 500

# ----------------------------- Example Usage ------------------------------ #
'''if __name__ == "__main__":
    # Example usage for testing
    response, status_code = AQIImageGenerator.generate_aqi_image()
    print(f"Status Code: {status_code}")
    print(response.get_data(as_text=True))

    # Test city-specific endpoint
    test_city_id = "example_city_id"  # Replace with a valid grid ID for testing
    response, status_code = AQIImageGenerator.generate_aqi_image_for_city(test_city_id)
    print(f"Status Code for city {test_city_id}: {status_code}")
    print(response.get_data(as_text=True))
'''
