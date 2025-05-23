# models/cams_data_controller.py
import os
import json
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from flask import jsonify, send_file, Response
from redis import Redis
from sqlalchemy import create_engine, text
import rasterio
from rasterio.transform import from_origin
import geopandas as gpd
from shapely.geometry import Point
import tempfile
import logging
import math

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CamsDataController:
    def __init__(self, db_name: str, table_name: str, variable: str):
        self.table_name = table_name
        self.variable = variable
        self.redis = Redis(
            host=self._get_env_var("REDIS_HOST", "localhost"),
            port=int(self._get_env_var("REDIS_PORT", "6379")),
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5
        )
        db_user = self._get_env_var("DB_USER")
        db_pass = self._get_env_var("DB_PASS")
        db_host = self._get_env_var("DB_HOST", "localhost")
        db_port = self._get_env_var("DB_PORT", "5432")
        self.engine = create_engine(
            f"postgresql+psycopg2://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}",
            pool_size=2,
            max_overflow=5,
            pool_timeout=15,
            pool_pre_ping=True
        )

    @staticmethod
    def _get_env_var(key: str, default: str | None = None) -> str:
        value = os.getenv(key, default)
        if not value:
            raise RuntimeError(f"Environment variable '{key}' is not set and no default was provided.")
        return value

    def _create_geotiff(self, df: pd.DataFrame, variable: str, output_path: str, x_min: float, x_max: float, y_min: float, y_max: float, grid_resolution: float):
        cols = int((x_max - x_min) / grid_resolution) + 1
        rows = int((y_max - y_min) / grid_resolution) + 1

        data_array = np.full((rows, cols), np.nan, dtype=np.float16)
        for _, row in df.iterrows():
            col = int((row['longitude'] - x_min) / grid_resolution)
            row_idx = int((y_max - row['latitude']) / grid_resolution)
            if 0 <= col < cols and 0 <= row_idx < rows:
                data_array[row_idx, col] = row[variable]

        transform = from_origin(x_min, y_max, grid_resolution, grid_resolution)
        profile = {
            'driver': 'GTiff',
            'height': rows,
            'width': cols,
            'count': 1,
            'dtype': rasterio.float16,
            'crs': 'EPSG:4326',
            'transform': transform,
            'nodata': np.nan,
            'compress': 'lzw'
        }

        with rasterio.open(output_path, 'w', **profile) as dst:
            dst.write(data_array, 1)

    def handle_request(self, request):
        date_str = request.args.get("date")
        output_format = request.args.get("format", "json")
        grid_resolution = float(request.args.get("resolution", 0.01))
        target_area_km2 = float(request.args.get("area_km2", 50))

        if date_str:
            try:
                query_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        else:
            query_date = datetime.now().date() - timedelta(days=1)

        cache_key = f"{self.table_name}:{query_date}:{output_format}:{grid_resolution}:{target_area_km2}"
        if (cached := self.redis.get(cache_key)) is not None:
            if output_format == "geotiff":
                return send_file(cached, mimetype='image/tiff', as_attachment=True, download_name=f"{self.variable}_{query_date}.tiff")
            return Response(cached, mimetype='application/json')

        bbox = request.args.get("bbox")
        where_clause = f"DATE(time) = :query_date"
        params = {"query_date": query_date}
        if bbox:
            try:
                min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(","))
                where_clause += " AND longitude BETWEEN :min_lon AND :max_lon AND latitude BETWEEN :min_lat AND :max_lat"
                params.update({"min_lon": min_lon, "max_lon": max_lon, "min_lat": min_lat, "max_lat": max_lat})
            except ValueError:
                return jsonify({"error": "Invalid bbox format. Use min_lon,min_lat,max_lon,max_lat"}), 400

        try:
            sql = text(f"""
                SELECT time, latitude, longitude, {self.variable}
                FROM {self.table_name}
                WHERE {where_clause} 
            """)
            df = pd.read_sql(sql, self.engine, params=params)
        except Exception as exc:
            logger.error(f"Database query failed: {exc}")
            return jsonify({"error": "Database query failed"}), 500

        if df.empty:
            return jsonify({"message": "No data found", "date": str(query_date)}), 404

        df[self.variable] = df[self.variable] * 100

        if not bbox:
            avg_lat = df['latitude'].mean() if not df['latitude'].empty else 0
            km_per_deg_lat = 111
            km_per_deg_lon = km_per_deg_lat * math.cos(math.radians(avg_lat))
            target_side_km = math.sqrt(target_area_km2)
            deg_per_side_lat = target_side_km / km_per_deg_lat
            deg_per_side_lon = target_side_km / km_per_deg_lon
            x_center = df['longitude'].mean() if not df['longitude'].empty else 0
            y_center = df['latitude'].mean() if not df['latitude'].empty else 0
            x_min = x_center - deg_per_side_lon / 2
            x_max = x_center + deg_per_side_lon / 2
            y_min = y_center - deg_per_side_lat / 2
            y_max = y_center + deg_per_side_lat / 2
        else:
            x_min, y_min, x_max, y_max = min_lon, min_lat, max_lon, max_lat

        df = df[
            (df['longitude'] >= x_min) & (df['longitude'] <= x_max) &
            (df['latitude'] >= y_min) & (df['latitude'] <= y_max)
        ]

        if len(df) > 1000:
            df = df.sample(n=1000, random_state=42)

        if output_format == "geotiff":
            with tempfile.NamedTemporaryFile(suffix=".tiff", delete=False) as tmp_file:
                output_path = tmp_file.name
                try:
                    self._create_geotiff(df, self.variable, output_path, x_min, x_max, y_min, y_max, grid_resolution)
                    self.redis.setex(cache_key, timedelta(hours=6), output_path)
                    response = send_file(output_path, mimetype='image/tiff', as_attachment=True, download_name=f"{self.variable}_{query_date}.tiff")
                    def cleanup():
                        try:
                            os.remove(output_path)
                        except Exception as e:
                            logger.warning(f"Failed to delete temp file {output_path}: {e}")
                    response.call_on_close = cleanup
                    return response
                except Exception as e:
                    logger.error(f"GeoTIFF creation failed: {e}")
                    return jsonify({"error": "GeoTIFF creation failed"}), 500

        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [row["longitude"], row["latitude"]]
                },
                "properties": {
                    self.variable: row[self.variable],
                    "time": row["time"].strftime("%Y-%m-%dT%H:%M:%S") if "time" in row and pd.notna(row["time"]) else None
                }
            } for _, row in df.iterrows()
        ]

        geojson_result = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "bounds": {"min_lon": x_min, "max_lon": x_max, "min_lat": y_min, "max_lat": y_max},
                "area_km2": target_area_km2,
                "resolution_deg": grid_resolution
            }
        }

        geojson_str = json.dumps(geojson_result, separators=(',', ':'))
        self.redis.setex(cache_key, timedelta(hours=6), geojson_str)
        return Response(geojson_str, mimetype='application/json')

    def get_pm10_tile(self, z: int, x: int, y: int):
        cache_key = f"{self.table_name}:tile:{z}:{x}:{y}"
        if (cached := self.redis.get(cache_key)) is not None:
            return Response(cached, mimetype='application/json')

        try:
            sql = text("""
                SELECT tile_id, zoom, pm10, ST_AsGeoJSON(geometry)::json AS geometry
                FROM cams_pm10_tiles
                WHERE zoom = :zoom AND tile_id = :tile_id 
            """)
            tile_id = f"{x}_{y}"
            df = pd.read_sql(sql, self.engine, params={"zoom": z, "tile_id": tile_id})
        except Exception as exc:
            logger.error(f"Tile query failed: {exc}")
            return jsonify({"error": "Tile query failed"}), 500

        if df.empty:
            return jsonify({"message": "Tile not found", "tile_id": tile_id}), 404

        features = [
            {
                "type": "Feature",
                "geometry": row["geometry"],
                "properties": {
                    "tile_id": row["tile_id"],
                    "zoom": row["zoom"],
                    "pm10": row["pm10"]
                }
            } for _, row in df.iterrows()
        ]

        result = {
            "type": "FeatureCollection",
            "features": features
        }

        geojson_str = json.dumps(result, separators=(',', ':'))
        self.redis.setex(cache_key, timedelta(hours=6), geojson_str)
        return Response(geojson_str, mimetype='application/json')