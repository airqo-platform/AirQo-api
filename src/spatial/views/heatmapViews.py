import os
import numpy as np
from io import BytesIO
from PIL import Image
from scipy.interpolate import griddata
from matplotlib.colors import to_rgba
import base64
from flask import jsonify
import redis
import json
from typing import Optional, Dict, Any, List, Tuple
from models.heatmapModel import AirQualityData, AirQualityGrids, AirQualityPredictor


# Ensure matplotlib is not using a GUI backend for image generation
# This prevents it from trying to open a window on a server
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

class AQIImageGenerator:
    _redis_client = None

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
    def generate_image_for_city(data: List[Tuple[float, float, float]], city_name: str, resolution: int = 150):
        """
        Generates a heatmap image for a city based on provided data.

        Args:
            data: List of tuples containing (latitude, longitude, pm25).
            city_name: Name of the city.
            resolution: Image resolution (pixels per dimension).

        Returns:
            Tuple of (image_data_url, bounds, message).
        """
        if len(data) < 2:
            return None, None, f"⚠️ Not enough data for {city_name}"

        coords = np.array([[lat, lon] for lat, lon, _ in data])
        values = np.array([pm for _, _, pm in data])

        lat_min, lon_min = coords.min(axis=0)
        lat_max, lon_max = coords.max(axis=0)
        bounds = [[lat_min, lon_min], [lat_max, lon_max]]

        grid_lat, grid_lon = np.mgrid[lat_min:lat_max:complex(resolution), lon_min:lon_max:complex(resolution)]
        grid_points = np.vstack([grid_lat.ravel(), grid_lon.ravel()]).T
        interpolated_pm25 = griddata(coords, values, grid_points, method='cubic', fill_value=np.nan)
        interpolated_pm25 = np.clip(interpolated_pm25, 0, 500)

        aqi_flat = np.array([AQIImageGenerator.pm25_to_aqi(pm) for pm in interpolated_pm25])
        colors_flat = np.array([AQIImageGenerator.aqi_to_color(aqi) for aqi in aqi_flat])
        rgba_image = colors_flat.reshape(resolution, resolution, 4)
        rgba_image = np.flipud(rgba_image)

        img = Image.fromarray((rgba_image * 255).astype(np.uint8))
        buf = BytesIO()
        img.save(buf, format='PNG')
        img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        data_url = f"data:image/png;base64,{img_b64}"

        return data_url, bounds, f"✅ AQI image generated for {city_name}"

    @staticmethod
    def generate_aqi_image():
        """
        Generates AQI heatmap images for all available cities.

        This function first checks for a cached response for all cities.
        If not found, it proceeds to check for cached individual city images.
        If an individual city image is not cached, it is generated and then
        the full response for all cities is cached before being returned.

        Returns:
            Flask response with JSON containing city heatmaps or an error message.
        """
        redis_client = AQIImageGenerator.get_redis_client()
        cache_ttl_seconds = 3600  # Cache for 60 minutes
        all_cities_cache_key = "aqi_images_all_cities"
        
        # --- NEW: Check for the entire 'all cities' response in cache first ---
        if redis_client:
            cached_all_results = redis_client.get(all_cities_cache_key)
            if cached_all_results:
                print("Serving ALL cities AQI images from Redis cache (full response).")
                return jsonify(json.loads(cached_all_results)), 200

        try:
            aq_data = AirQualityData()
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
            cache_key_prefix = "aqi_image_"
            for _, city_row in grid_gdf.iterrows():
                city_id = city_row["id"]
                city_name = city_row["name"]
                city_cache_key = f"{cache_key_prefix}{city_id}"

                # Try to get from individual city cache
                if redis_client:
                    cached_result = redis_client.get(city_cache_key)
                    if cached_result:
                        print(f"Serving {city_name} (ID: {city_id}) from Redis cache.")
                        results.append(json.loads(cached_result))
                        continue

                city_df = predictions_df[predictions_df["city"] == city_name]
                if city_df.empty:
                    print(f"No prediction data for {city_name} (ID: {city_id})")
                    continue

                city_data = list(zip(city_df["latitude"], city_df["longitude"], city_df["predicted_pm25"]))
                image_data, bounds, message = AQIImageGenerator.generate_image_for_city(city_data, city_name)

                city_result = {
                    "id": city_id,
                    "city": city_name,
                    "image": image_data,
                    "bounds": bounds,
                    "message": message
                }
                results.append(city_result)

                # Store in individual city cache
                if redis_client and image_data:
                    redis_client.setex(city_cache_key, cache_ttl_seconds, json.dumps(city_result))
                    print(f"Stored {city_name} (ID: {city_id}) in Redis cache.")

            if not results:
                return jsonify({"error": "No valid city data processed"}), 500
            
            # --- NEW: Store the full 'all cities' response in cache before returning ---
            if redis_client:
                redis_client.setex(all_cities_cache_key, cache_ttl_seconds, json.dumps(results))
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
        cache_key = f"aqi_image_{city_id}"
        cache_ttl_seconds = 3600  # Cache for 60 minutes

        # Try to get from cache
        if redis_client:
            cached_result = redis_client.get(cache_key)
            if cached_result:
                print(f"Serving city ID {city_id} from Redis cache.")
                return jsonify(json.loads(cached_result)), 200

        try:
            aq_data = AirQualityData()
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

            city_row = grid_gdf[grid_gdf["id"] == city_id]
            if city_row.empty:
                return jsonify({"error": f"No city found with ID {city_id}"}), 404

            city_name = city_row.iloc[0]["name"]
            city_df = predictions_df[predictions_df["city"] == city_name]
            if city_df.empty:
                return jsonify({"error": f"No prediction data for city ID {city_id} ({city_name})"}), 404

            city_data = list(zip(city_df["latitude"], city_df["longitude"], city_df["predicted_pm25"]))
            image_data, bounds, message = AQIImageGenerator.generate_image_for_city(city_data, city_name)

            if not image_data:
                return jsonify({"error": message}), 400

            result = {
                "id": city_id,
                "city": city_name,
                "image": image_data,
                "bounds": bounds,
                "message": message
            }

            # Store in cache
            if redis_client:
                redis_client.setex(cache_key, cache_ttl_seconds, json.dumps(result))
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