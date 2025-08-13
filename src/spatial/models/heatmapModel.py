import json
import logging
import os
from typing import Any, Callable, Dict, List, Optional, Tuple

# Third-party imports
import geopandas as gpd
import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from requests import Session
from requests.adapters import HTTPAdapter
from shapely.geometry import Point, shape
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from urllib3.util.retry import Retry
import joblib 

# Attempt to import optional dependency
try:
    import redis  # pip install redis
except ImportError:
    redis = None


# ----------------------------- Base / Shared ----------------------------- #
class BaseAirQoAPI:
    """
    Base client for the AirQo API.

    Handles environment configuration, logging, session management with retries,
    optional Redis caching, and a robust JSON GET helper method.
    """

    def __init__(
        self,
        base_url_env: str = "AIRQO_API_BASE_URL",
        token_env: str = "AIRQO_API_TOKEN",
        cache_ttl_env: str = "REDIS_CACHE_TTL",
        logger_name: Optional[str] = None,
    ) -> None:
        """
        Initializes the base API client.

        Args:
            base_url_env: The name of the environment variable for the API base URL.
            token_env: The name of the environment variable for the API token.
            cache_ttl_env: The name of the environment variable for Redis cache TTL in seconds.
            logger_name: Optional name for the logger. Defaults to the class name.

        Raises:
            ValueError: If required environment variables are not set.
        """
        load_dotenv()

        self.api_token = os.getenv(token_env)
        if not self.api_token:
            raise ValueError(f"Environment variable '{token_env}' is missing or invalid.")

        base_url = os.getenv(base_url_env)
        if not base_url:
            raise ValueError(f"Environment variable '{base_url_env}' is missing.")
        self.base_url_root = base_url.rstrip("/")

        self.cache_ttl: int = int(os.getenv(cache_ttl_env, "600"))

        self.logger = self._setup_logger(logger_name or self.__class__.__name__)
        self.session = self._build_session()
        self.redis_client = self._init_redis()

    # ---- Setup Methods ----
    def _setup_logger(self, name: str) -> logging.Logger:
        """Configures and returns a logger instance."""
        logger = logging.getLogger(name)
        if not logger.handlers:
            logger.setLevel(logging.INFO)
            handler = logging.StreamHandler()
            formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        return logger

    def _build_session(self) -> Session:
        """Builds a requests.Session with a retry strategy."""
        s = requests.Session()
        retry_strategy = Retry(
            total=5,
            read=5,
            connect=5,
            backoff_factor=0.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset(["GET"]),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        s.mount("http://", adapter)
        s.mount("https://", adapter)
        return s

    # ---- Redis Caching ----
    def _init_redis(self) -> Optional[redis.Redis]:
        """
        Initializes and returns a Redis client if configured, otherwise None.
        Prioritizes connection via REDIS_URL, then falls back to host/port settings.
        """
        if redis is None:
            self.logger.info("Redis library not installed; caching is disabled.")
            return None

        redis_url = os.getenv("REDIS_URL")
        try:
            if redis_url:
                client = redis.from_url(redis_url, decode_responses=False)
                client.ping()
                self.logger.info("Redis connection successful via URL.")
                return client

            redis_host = os.getenv("REDIS_HOST")
            redis_port = os.getenv("REDIS_PORT")
            if redis_host and redis_port:
                client = redis.Redis(
                    host=redis_host,
                    port=int(redis_port),
                    db=int(os.getenv("REDIS_DB", "0")),
                    password=os.getenv("REDIS_PASSWORD"),
                    decode_responses=False,
                )
                client.ping()
                self.logger.info("Redis connection successful via host/port.")
                return client

        except Exception as e:
            self.logger.warning(f"Redis connection failed: {e}. Caching is disabled.")
            return None

        self.logger.info("Redis not configured; caching is disabled.")
        return None

    def _cache_set(self, key: str, payload: Dict[str, Any]) -> None:
        """Serializes and stores a payload in the Redis cache with a TTL."""
        if not self.redis_client:
            return
        try:
            blob = json.dumps(payload).encode("utf-8")
            self.redis_client.set(key, blob, ex=self.cache_ttl)
            self.logger.info("Cached payload to Redis key='%s' (TTL %ss).", key, self.cache_ttl)
        except Exception as e:
            self.logger.warning(f"Failed to write to Redis cache: {e}")

    def _cache_get(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieves and deserializes a payload from the Redis cache."""
        if not self.redis_client:
            return None
        try:
            raw = self.redis_client.get(key)
            if raw:
                payload = json.loads(raw.decode("utf-8"))
                self.logger.info("Loaded payload from Redis key='%s'.", key)
                return payload
        except Exception as e:
            self.logger.warning(f"Failed to read from Redis cache: {e}")
        return None

    # ---- Helper Methods ----
    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        """Safely converts a value to a float, returning None on failure."""
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def _get_json(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: Tuple[float, float] = (5.0, 30.0),
        *,
        validator: Optional[Callable[[Dict[str, Any]], bool]] = None,
        cache_key: Optional[str] = None,
        use_cache_on_error: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """
        Performs a GET request and returns the JSON payload.

        Features include session-based retries, optional validation, and cache-fallback.

        Args:
            path: API endpoint path (e.g., "/api/v2/devices").
            params: Dictionary of query parameters.
            timeout: A (connect, read) timeout tuple for the request.
            validator: An optional function to validate the received payload.
            cache_key: The Redis key for caching. If None, caching is skipped.
            use_cache_on_error: If True, returns cached data on API or validation failure.

        Returns:
            A dictionary with the JSON payload or None if the request fails and no valid cache is available.
        """
        url = f"{self.base_url_root}{path}"
        query_params = {"token": self.api_token}
        if params:
            query_params.update(params)

        try:
            resp = self.session.get(url, params=query_params, timeout=timeout)
            if resp.status_code == 200:
                payload = resp.json()
                if validator is None or validator(payload):
                    if cache_key:
                        self._cache_set(cache_key, payload)
                    return payload
                else:
                    self.logger.warning("Validation failed for payload from %s.", url)
            else:
                self.logger.error("HTTP %s from %s: %s", resp.status_code, url, resp.text[:200])
        except requests.RequestException as e:
            self.logger.error("Request to %s failed: %s", url, e)

        if use_cache_on_error and cache_key:
            cached = self._cache_get(cache_key)
            if cached and (validator is None or validator(cached)):
                self.logger.warning("Using cached data due to API failure or invalid new data.")
                return cached

        return None


# ----------------------------- AirQualityData ----------------------------- #
class AirQualityData(BaseAirQoAPI):
    """
    Fetches, processes, and analyzes air quality measurement data from the AirQo API.

    Behavior:
     - On successful API fetch with non-empty 'measurements', the cache is updated.
     - On API error or if 'measurements' is empty, it falls back to the most recent cache.
    """

    REDIS_KEY = "airqo:devices_readings_map"

    def __init__(self, *args, **kwargs) -> None:
        """Initializes the AirQualityData client."""
        super().__init__(*args, **kwargs)
        self.data: Optional[Dict[str, Any]] = None
        self.df: Optional[pd.DataFrame] = None
        self.gdf: Optional[gpd.GeoDataFrame] = None

    @staticmethod
    def _is_valid_payload(payload: Dict[str, Any]) -> bool:
        """Validates that the payload contains a non-empty list of measurements."""
        measurements = payload.get("measurements")
        return isinstance(measurements, list) and len(measurements) > 0

    def fetch_data(self) -> bool:
        """
        Fetches the latest air quality measurements from the API.

        Returns:
            True if data was fetched successfully (from API or cache), False otherwise.
        """
        self.logger.info("Fetching air quality measurements...")
        payload = self._get_json(
            path="/api/v2/devices/readings/map",
            validator=self._is_valid_payload,
            cache_key=self.REDIS_KEY,
            use_cache_on_error=True,
        )
        if payload is None:
            self.logger.error("Data fetch failed and no usable cache was available.")
            return False

        self.data = payload
        self.logger.info("Successfully fetched %d measurement records.", len(payload.get("measurements", [])))
        return True

    def process_data(self) -> bool:
        """
        Processes raw data into a pandas DataFrame and a GeoDataFrame.

        The process involves cleaning, transforming, and aggregating data by site.

        Returns:
            True if processing was successful, False otherwise.
        """
        if not self.data or "measurements" not in self.data:
            self.logger.error("No data available to process.")
            return False

        try:
            records = []
            for m in self.data["measurements"]:
                site = m.get("siteDetails") or {}
                pm2_5 = self._safe_float((m.get("pm2_5") or {}).get("value"))
                site_id = site.get("_id")

                if pm2_5 is None or not site_id:
                    continue

                records.append({
                    "site_id": site_id,
                    "site_name": site.get("name") or "Unknown",
                    "latitude": self._safe_float(site.get("approximate_latitude")),
                    "longitude": self._safe_float(site.get("approximate_longitude")),
                    "region": site.get("region") or "Unknown",
                    "country": site.get("country") or "Unknown",
                    "pm2_5": pm2_5,
                    "pm10": self._safe_float((m.get("pm10") or {}).get("value")),
                    "timestamp": m.get("time"),
                    "device_id": m.get("device_id"),
                })

            if not records:
                self.logger.warning("No valid measurement records found after cleaning.")
                return False

            df = pd.DataFrame.from_records(records)
            df = df.dropna(subset=["latitude", "longitude"])
            df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

            self.df = df
            self.logger.info("Created raw DataFrame with %d records.", len(df))

            # Aggregate data by site, calculating mean PM values
            grouped_df = df.groupby(["site_id", "site_name"], as_index=False).agg(
                latitude=("latitude", "mean"),
                longitude=("longitude", "mean"),
                pm2_5=("pm2_5", "mean"),
                pm10=("pm10", "mean"),
                region=("region", "first"),
                country=("country", "first"),
            )
            grouped_df["pm25"] = grouped_df["pm2_5"].round(2)

            self.gdf = gpd.GeoDataFrame(
                grouped_df,
                geometry=gpd.points_from_xy(grouped_df["longitude"], grouped_df["latitude"]),
                crs="EPSG:4326",
            )
            self.logger.info("Created aggregated GeoDataFrame with %d sites.", len(self.gdf))
            return True

        except Exception as e:
            self.logger.error(f"Error during data processing: {e}", exc_info=True)
            return False


# ----------------------------- AirQualityGrids ---------------------------- #
class AirQualityGrids(BaseAirQoAPI):
    """Fetches and processes administrative grid polygons from the AirQo API."""

    def __init__(self, *args, **kwargs) -> None:
        """Initializes the AirQualityGrids client."""
        super().__init__(*args, **kwargs)
        self.data: Optional[Dict[str, Any]] = None
        self.df: Optional[pd.DataFrame] = None
        self.gdf: Optional[gpd.GeoDataFrame] = None

    @staticmethod
    def _is_valid_grids(payload: Dict[str, Any]) -> bool:
        """Validates that the payload contains a non-empty list of grids."""
        grids = payload.get("grids")
        return isinstance(grids, list) and len(grids) > 0

    def fetch_data(self) -> bool:
        """
        Fetches grid data from the API. Caching is disabled by default for this endpoint.

        Returns:
            True if data was fetched successfully, False otherwise.
        """
        self.logger.info("Fetching grid polygons...")
        payload = self._get_json(
            path="/api/v2/devices/grids",
            validator=self._is_valid_grids,
            cache_key=None,  # Grids are less dynamic; caching can be enabled if desired
            use_cache_on_error=False,
        )
        if payload is None:
            self.logger.error("Failed to fetch grid data.")
            return False

        self.data = payload
        self.logger.info("Successfully fetched %d grid records.", len(payload.get("grids", [])))
        return True

    def process_data(
        self,
        exclude_admin_levels: Optional[List[str]] = None,
        exclude_names: Optional[List[str]] = None,
    ) -> bool:
        """
        Processes raw grid data into a pandas DataFrame and a GeoDataFrame.

        Args:
            exclude_admin_levels: A list of admin levels to exclude (e.g., ["country"]).
            exclude_names: A list of grid names to exclude (case-insensitive).

        Returns:
            True if processing was successful, False otherwise.
        """
        if not self.data or "grids" not in self.data:
            self.logger.error("No grid data available to process.")
            return False

        # Set default exclusion lists if none are provided
        exclude_admin_levels = exclude_admin_levels or ["country"]
        exclude_names = exclude_names or [
            "rubaga", "makindye", "nakawa", "kawempe", "kampala_central", "greater_kampala" ]
        exclude_names_set = {n.lower() for n in exclude_names}

        try:
            records = []
            for grid in self.data.get("grids", []):
                shape_geojson = grid.get("shape")
                if not shape_geojson:
                    continue
                try:
                    geometry = shape(shape_geojson)
                    records.append({
                        "name": grid.get("name"),
                        "admin_level": grid.get("admin_level"),
                        "geometry": geometry,
                    })
                except Exception as e:
                    self.logger.error(f"Error processing geometry for grid '{grid.get('name')}': {e}")
                    continue

            if not records:
                self.logger.warning("No valid grid records found after processing shapes.")
                return False

            df = pd.DataFrame(records)

            # Filter out excluded grids
            if exclude_admin_levels:
                df = df[~df["admin_level"].isin(exclude_admin_levels)]
            if exclude_names:
                df = df[~df["name"].str.lower().isin(exclude_names_set)]

            if df.empty:
                self.logger.warning("DataFrame is empty after filtering.")
                self.df = df
                self.gdf = gpd.GeoDataFrame(df, geometry="geometry", crs="EPSG:4326")
                return True

            self.df = df.reset_index(drop=True)
            self.gdf = gpd.GeoDataFrame(self.df, geometry="geometry", crs="EPSG:4326")
            self.logger.info("Grid data processed successfully into a GeoDataFrame with %d polygons.", len(self.gdf))
            return True

        except Exception as e:
            self.logger.error(f"Error processing grid data: {e}", exc_info=True)
            return False


# ----------------------------- Air Quality Prediction --------------------- #
class AirQualityPredictor:
    CACHE_KEY = "airqo:predicted_pm25"
    MODEL_DIR = os.getenv("MODEL_DIR_FILE", "./models")
    CITY_LIST_FILE = os.path.join(MODEL_DIR, "processed_cities.json")  # JSON file for city list
    
    def __init__(self, air_quality_data: AirQualityData, air_quality_grids: AirQualityGrids):
        """
        Initializes the AirQualityPredictor.

        Args:
            air_quality_data: An initialized instance of AirQualityData.
            air_quality_grids: An initialized instance of AirQualityGrids.
        """
        self.aq_data = air_quality_data
        self.grids = air_quality_grids
        self.gdf: Optional[gpd.GeoDataFrame] = None
        self.gdf_polygons: Optional[gpd.GeoDataFrame] = None
        self.results: List[Dict[str, Any]] = []
        self.predictions: List[pd.DataFrame] = []
        self.logger = self.aq_data.logger
        self.models: Dict[str, RandomForestRegressor] = {}  # Cache loaded models
        os.makedirs(self.MODEL_DIR, exist_ok=True)  # Create model directory if it doesn't exist

    def _get_processed_cities(self) -> set:
        """
        Retrieves the set of previously processed cities from the JSON file.

        Returns:
            A set of city names that have been processed.
        """
        if os.path.exists(self.CITY_LIST_FILE):
            try:
                with open(self.CITY_LIST_FILE, "r") as f:
                    data = json.load(f)
                    cities = set(data.get("cities", []))
                    self.logger.info(f"Loaded {len(cities)} processed cities from {self.CITY_LIST_FILE}")
                    return cities
            except Exception as e:
                self.logger.warning(f"Failed to read processed cities from {self.CITY_LIST_FILE}: {e}")
        else:
            self.logger.info(f"No processed cities file found at {self.CITY_LIST_FILE}")
        return set()

    def _save_processed_cities(self, cities: set) -> None:
        """
        Saves the list of processed cities to the JSON file.

        Args:
            cities: A set of city names to save.
        """
        cities_list = list(cities)
        try:
            with open(self.CITY_LIST_FILE, "w") as f:
                json.dump({"cities": cities_list}, f, indent=2)
            self.logger.info(f"Saved {len(cities_list)} processed cities to {self.CITY_LIST_FILE}")
        except Exception as e:
            self.logger.error(f"Failed to save processed cities to {self.CITY_LIST_FILE}: {e}")

    def _load_model(self, city_name: str) -> Optional[RandomForestRegressor]:
        """
        Loads a saved Random Forest model for a city.

        Args:
            city_name: The name of the city.

        Returns:
            The loaded model or None if loading fails.
        """
        model_path = os.path.join(self.MODEL_DIR, f"{city_name}_rf_model.joblib")
        if os.path.exists(model_path):
            try:
                model = joblib.load(model_path)
                self.logger.info(f"Loaded model for '{city_name}' from {model_path}")
                return model
            except Exception as e:
                self.logger.error(f"Failed to load model for '{city_name}': {e}")
        return None

    def _save_model(self, city_name: str, model: RandomForestRegressor) -> None:
        """
        Saves a Random Forest model for a city.

        Args:
            city_name: The name of the city.
            model: The trained Random Forest model.
        """
        model_path = os.path.join(self.MODEL_DIR, f"{city_name}_rf_model.joblib")
        try:
            joblib.dump(model, model_path)
            self.logger.info(f"Saved model for '{city_name}' to {model_path}")
        except Exception as e:
            self.logger.error(f"Failed to save model for '{city_name}': {e}")

    def fetch_and_process_data(self) -> bool:
        """
        Orchestrates fetching and processing for both measurement and grid data.

        Returns:
            True if all data was successfully fetched and processed, False otherwise.
        """
        try:
            if not (self.aq_data.fetch_data() and self.aq_data.process_data()):
                self.logger.error("Failed to fetch or process air quality measurement data.")
                return False

            if not (self.grids.fetch_data() and self.grids.process_data()):
                self.logger.error("Failed to fetch or process grid data.")
                return False

            self.gdf = self.aq_data.gdf
            self.gdf_polygons = self.grids.gdf
            return True

        except Exception as e:
            self.logger.error(f"Error during data fetching and processing orchestration: {e}", exc_info=True)
            return False

    def train_and_predict(
        self, buffer_distance: float = 0.001, grid_resolution: int = 15, force_retrain: bool = False
    ) -> bool:
        """
        Trains or loads Random Forest models for each grid polygon and predicts PM2.5 values.

        Args:
            buffer_distance: Buffer around each polygon to include nearby points (in degrees).
            grid_resolution: Number of points per dimension for the prediction grid.
            force_retrain: If True, retrain models for all cities regardless of existing models.

        Returns:
            True if the process completes successfully, False otherwise.
        """
        if self.gdf is None or self.gdf_polygons is None:
            self.logger.error("GeoDataFrames not initialized. Run fetch_and_process_data() first.")
            return False

        self.results.clear()
        self.predictions.clear()
        self.models.clear()

        # Get current and previously processed cities
        current_cities = set(self.gdf_polygons["name"])
        processed_cities = self._get_processed_cities()
        new_cities = current_cities - processed_cities
        self.logger.info(f"Found {len(new_cities)} new cities: {new_cities}")

        try:
            for _, city in self.gdf_polygons.iterrows():
                city_name = city["name"]
                city_poly = city["geometry"].buffer(buffer_distance)
                city_data = self.gdf[self.gdf.geometry.intersects(city_poly)]

                known = city_data[city_data["pm25"].notna()].copy()
                if len(known) < 4:
                    self.logger.warning(f"Skipping '{city_name}': Only {len(known)} valid PM2.5 data points.")
                    continue

                # Decide whether to train a new model
                train_model = force_retrain or (city_name in new_cities)
                model = None
                if not train_model:
                    model = self._load_model(city_name)
                    if model is None:
                        self.logger.info(f"No model found for '{city_name}'; will train a new one.")
                        train_model = True

                if train_model:
                    self.logger.info(f"Training model for '{city_name}' with {len(known)} data points...")
                    # Define features (X) and target (y)
                    X = known[["latitude", "longitude"]]
                    y = known["pm25"]

                    # Split data for training and evaluation
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

                    # Train the model
                    model = RandomForestRegressor(n_estimators=100, random_state=42)
                    model.fit(X_train, y_train)

                    # Save the model
                    self._save_model(city_name, model)

                    # Evaluate the model if the test set is non-empty
                    if not y_test.empty:
                        y_pred = model.predict(X_test)
                        self.results.append({
                            "city": city_name,
                            "R²": r2_score(y_test, y_pred),
                            "RMSE": np.sqrt(mean_squared_error(y_test, y_pred)),
                            "MAE": mean_absolute_error(y_test, y_pred),
                            "n_samples_train": len(y_train),
                            "n_samples_test": len(y_test)
                        })

                self.models[city_name] = model
                self.logger.info(f"Using model for '{city_name}' (trained={train_model}).")

                # Create a prediction grid within the city polygon
                x_min, y_min, x_max, y_max = city_poly.bounds
                x_coords = np.linspace(x_min, x_max, grid_resolution)
                y_coords = np.linspace(y_min, y_max, grid_resolution)
                xx, yy = np.meshgrid(x_coords, y_coords)
                grid_points_all = [Point(x, y) for x, y in zip(xx.ravel(), yy.ravel())]

                grid_gdf = gpd.GeoDataFrame(geometry=grid_points_all, crs="EPSG:4326")
                grid_gdf = grid_gdf[grid_gdf.geometry.within(city_poly)]

                # Predict PM2.5 for the grid points
                if not grid_gdf.empty:
                    grid_locations = pd.DataFrame({
                        "latitude": [pt.y for pt in grid_gdf.geometry],
                        "longitude": [pt.x for pt in grid_gdf.geometry]
                    })
                    grid_pred_pm25 = model.predict(grid_locations)

                    grid_results_df = pd.DataFrame({
                        "city": city_name,
                        "latitude": grid_locations["latitude"],
                        "longitude": grid_locations["longitude"],
                        "predicted_pm25": grid_pred_pm25,
                        "source": "grid_prediction"
                    })

                    # Prepare original data for combination
                    original_data_df = known[["site_name", "latitude", "longitude", "pm25"]].copy()
                    original_data_df.rename(columns={"pm25": "predicted_pm25"}, inplace=True)
                    original_data_df["source"] = "original"
                    original_data_df["city"] = city_name

                    combined = pd.concat([original_data_df, grid_results_df], ignore_index=True)
                    self.predictions.append(combined)

            # Update the processed cities list
            processed_cities.update(current_cities)
            self._save_processed_cities(processed_cities)

            self.logger.info("Training and prediction completed successfully.")
            return True

        except Exception as e:
            self.logger.error(f"Error during model training and prediction: {e}", exc_info=True)
            return False

    def retrain_cities(self, city_names: Optional[List[str]] = None) -> bool:
        """
        Forces retraining of models for specified cities or all cities.

        Args:
            city_names: List of city names to retrain. If None, retrains all cities.

        Returns:
            True if retraining completes successfully, False otherwise.
        """
        if self.gdf is None or self.gdf_polygons is None:
            self.logger.error("GeoDataFrames not initialized. Run fetch_and_process_data() first.")
            return False

        if city_names is None:
            city_names = self.gdf_polygons["name"].tolist()
        else:
            city_names = [name for name in city_names if name in self.gdf_polygons["name"].values]
            if not city_names:
                self.logger.warning("No valid city names provided for retraining.")
                return False

        self.logger.info(f"Retraining models for {len(city_names)} cities: {city_names}")
        return self.train_and_predict(force_retrain=True)

    def get_results(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Retrieves the model evaluation metrics and the combined predictions.

        Returns:
            A tuple containing:
            - A DataFrame with evaluation metrics (R², RMSE, MAE) for each city model.
            - A DataFrame with the combined original and grid-based PM2.5 predictions.
        """
        results_df = pd.DataFrame(self.results)
        predictions_df = pd.concat(self.predictions, ignore_index=True) if self.predictions else pd.DataFrame()
        return results_df, predictions_df


# ----------------------------- Example Usage ------------------------------ #
if __name__ == "__main__":
    # Initialize data handlers
    aq_data_handler = AirQualityData()
    grids_handler = AirQualityGrids()

    # Initialize the predictor with the handlers
    predictor = AirQualityPredictor(aq_data_handler, grids_handler)

    # Step 1: Fetch and process all required data
    if predictor.fetch_and_process_data():
        print("\n--- Intermediate Data ---")
        if predictor.grids.gdf is not None:
            print(f"Loaded {len(predictor.grids.gdf)} grid polygons.")
            # print(predictor.grids.gdf.head().to_string())

        if predictor.aq_data.gdf is not None:
            print(f"Loaded {len(predictor.aq_data.gdf)} aggregated measurement sites.")
            # print(predictor.aq_data.gdf.head().to_string())

        print("\n--- Starting Prediction Workflow ---")
        # Step 2: Train models and generate predictions
        if predictor.train_and_predict():
            # Step 3: Retrieve and display results
            eval_results_df, predictions_df = predictor.get_results()

            if not eval_results_df.empty:
                print("\n--- Model Evaluation Metrics by City ---")
                print(eval_results_df.to_string(index=False))
            else:
                print("\nNo model evaluation results were generated.")
            
            if not predictions_df.empty:
                print("\n--- Combined PM2.5 Predictions (Original + Grid) Sample ---")
                print(predictions_df.sample(5).to_string(index=False))
            else:
                print("\nNo predictions were generated.")