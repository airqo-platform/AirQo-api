# aqi_image_generator.py

import os
import numpy as np
from io import BytesIO
from PIL import Image
from scipy.interpolate import griddata
from matplotlib.colors import to_rgba
import base64
from flask import jsonify
import redis # Import the redis library
import json # Import json for serializing/deserializing data

from models.heatmapModel import (AirQualityData, AirQualityGrids, AirQualityPredictor)


class AQIImageGenerator:

    # Initialize Redis client
    # You should configure your Redis connection details appropriately,
    # e.g., from environment variables or a config file.
    # For demonstration, a basic connection to localhost:6379 is used.
    _redis_client = None

    @classmethod
    def get_redis_client(cls):
        if cls._redis_client is None:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            redis_db = int(os.getenv("REDIS_DB", 0))
            try:
                cls._redis_client = redis.StrictRedis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)
                cls._redis_client.ping() # Test connection
                print(f"Connected to Redis at {redis_host}:{redis_port}")
            except redis.exceptions.ConnectionError as e:
                print(f"Could not connect to Redis: {e}")
                cls._redis_client = None # Ensure client is None if connection fails
        return cls._redis_client

    @staticmethod
    def pm25_to_aqi(pm):
        if np.isnan(pm): return np.nan
        if pm < 0: return 0
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
        if np.isnan(aqi): return (0, 0, 0, 0)
        aqi = int(aqi)
        if aqi <= 50: return to_rgba("green", alpha)
        elif aqi <= 100: return to_rgba("yellow", alpha)
        elif aqi <= 150: return to_rgba("orange", alpha)
        elif aqi <= 200: return to_rgba("red", alpha)
        elif aqi <= 300: return to_rgba("purple", alpha)
        else: return to_rgba("maroon", alpha)

    @staticmethod
    def generate_image_for_city(data, city_name, resolution=150):
        if len(data) < 4:
            return None, None, f"⚠️ Not enough data for {city_name}"

        coords = np.array([[lat, lon] for lat, lon, _ in data])
        values = np.array([pm for _, _, pm in data])

        lat_min, lon_min = coords.min(axis=0)
        lat_max, lon_max = coords.max(axis=0)
        bounds = [[lat_min, lon_min], [lat_max, lon_max]]

        grid_lat, grid_lon = np.mgrid[lat_min:lat_max:complex(resolution), lon_min:lon_max:complex(resolution)]
        grid_points = np.vstack([grid_lat.ravel(), grid_lon.ravel()]).T
        interpolated_pm25 = griddata(coords, values, grid_points, method='cubic', fill_value=np.nan)

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
        redis_client = AQIImageGenerator.get_redis_client()
        cache_key_prefix = "aqi_image_"
        cache_ttl_seconds = 3600 # Cache for 1 hour

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

            results = []
            for city in predictions_df["city"].unique():
                city_cache_key = f"{cache_key_prefix}{city}"

                # Try to get from cache
                if redis_client:
                    cached_result = redis_client.get(city_cache_key)
                    if cached_result:
                        print(f"Serving {city} from Redis cache.")
                        results.append(json.loads(cached_result))
                        continue # Skip generation if found in cache

                city_df = predictions_df[predictions_df["city"] == city]
                city_data = list(zip(city_df["latitude"], city_df["longitude"], city_df["predicted_pm25"]))
                image_data, bounds, message = AQIImageGenerator.generate_image_for_city(city_data, city)

                city_result = {
                    "city": city,
                    "image": image_data,
                    "bounds": bounds,
                    "message": message
                }
                results.append(city_result)

                # Store in cache
                if redis_client and image_data: # Only cache if image was successfully generated
                    redis_client.setex(city_cache_key, cache_ttl_seconds, json.dumps(city_result))
                    print(f"Stored {city} in Redis cache.")

            return jsonify(results), 200

        except Exception as e:
            print(f"An error occurred: {e}")
            return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Example of how to use it (assuming a Flask app would call generate_aqi_image)
    # For a direct run, you might want to mock the Flask jsonify part or just print results
    response, status_code = AQIImageGenerator.generate_aqi_image()
    print(f"Status Code: {status_code}")
    print(response.get_data(as_text=True))