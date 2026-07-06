"""PM2.5 prediction features sourced from free Sentinel-2 STAC data."""

from datetime import datetime, timedelta, timezone
import math
import os

import pandas as pd
import requests

from models.sentinel2_context_model import Sentinel2ContextModel


class SatellitePredictionModel:
    """Build schema-aware model input from the free Sentinel-2 archive."""

    @staticmethod
    def _normalize_utc_timestamp(value):
        timestamp = pd.Timestamp(value)
        if pd.isna(timestamp):
            raise ValueError("date must be a valid ISO date or timestamp.")
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize("UTC")
        else:
            timestamp = timestamp.tz_convert("UTC")
        return timestamp

    @staticmethod
    def _nasa_power_weather(latitude, longitude, timestamp):
        latitude = float(latitude)
        longitude = float(longitude)
        date_text = timestamp.strftime("%Y%m%d")
        fallback_days = max(
            0,
            int(os.getenv("NASA_POWER_WEATHER_FALLBACK_DAYS", "7")),
        )
        start_text = (timestamp - timedelta(days=fallback_days)).strftime("%Y%m%d")
        end_text = (timestamp + timedelta(days=fallback_days)).strftime("%Y%m%d")
        url = (
            "https://power.larc.nasa.gov/api/temporal/daily/point"
            "?parameters=T2M,RH2M"
            "&community=AG"
            f"&longitude={longitude}"
            f"&latitude={latitude}"
            f"&start={start_text}"
            f"&end={end_text}"
            "&format=JSON"
        )
        timeout = float(os.getenv("NASA_POWER_REQUEST_TIMEOUT_SECONDS", "30"))
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            parameters = response.json()["properties"]["parameter"]
        except (requests.RequestException, KeyError, ValueError):
            return {"temperature": None, "humidity": None, "weather_source": None}

        requested_midnight = timestamp.normalize().to_pydatetime()
        candidates = []
        for candidate_date, temperature in (parameters.get("T2M") or {}).items():
            humidity = (parameters.get("RH2M") or {}).get(candidate_date)
            if temperature in (None, -999) or humidity in (None, -999):
                continue
            try:
                candidate_timestamp = datetime.strptime(
                    candidate_date,
                    "%Y%m%d",
                ).replace(tzinfo=timezone.utc)
                candidates.append(
                    (
                        abs((candidate_timestamp - requested_midnight).days),
                        candidate_date,
                        float(temperature),
                        float(humidity),
                    )
                )
            except (TypeError, ValueError):
                continue

        if not candidates:
            return {"temperature": None, "humidity": None, "weather_source": None}

        _, weather_date, temperature, humidity = min(
            candidates,
            key=lambda item: (item[0], abs(int(item[1]) - int(date_text))),
        )
        weather_timestamp = datetime.strptime(weather_date, "%Y%m%d").replace(
            tzinfo=timezone.utc
        )

        return {
            "temperature": round(float(temperature), 2),
            "humidity": round(float(humidity), 2),
            "weather_source": "NASA POWER",
            "weather_date": weather_timestamp.strftime("%Y-%m-%d"),
            "weather_date_offset_days": int(
                (weather_timestamp - requested_midnight).days
            ),
        }
    @staticmethod
    def _relative_humidity_from_temp_dewpoint(temp_c, dewpoint_c):
        humidity = 100 * (
            math.exp((17.625 * dewpoint_c) / (243.04 + dewpoint_c))
            / math.exp((17.625 * temp_c) / (243.04 + temp_c))
        )
        return float(max(0.0, min(100.0, humidity)))

    @classmethod
    def _era5_weather(cls, latitude, longitude, timestamp):
        from pystac_client import Client
        import planetary_computer
        import xarray as xr

        latitude = float(latitude)
        longitude = float(longitude)
        timestamp = cls._normalize_utc_timestamp(timestamp)
        month_text = timestamp.strftime("%Y-%m")
        stac_url = os.getenv(
            "PLANETARY_COMPUTER_STAC_URL",
            "https://planetarycomputer.microsoft.com/api/stac/v1",
        )
        collection = os.getenv("ERA5_COLLECTION", "era5-pds")

        catalog = Client.open(
            stac_url,
            modifier=planetary_computer.sign_inplace,
        )
        search = catalog.search(
            collections=[collection],
            datetime=month_text,
            query={"era5:kind": {"eq": "an"}},
            max_items=1,
        )
        items = list(search.items())
        if not items:
            raise LookupError(f"No ERA5 item found for {month_text}")

        item = items[0]
        if "zarr-abfs" not in item.assets:
            raise ValueError(
                "ERA5 item does not have zarr-abfs asset. "
                f"Available assets: {list(item.assets.keys())}"
            )

        asset = item.assets["zarr-abfs"]
        dataset = xr.open_zarr(
            asset.href,
            storage_options=asset.extra_fields.get("xarray:storage_options", {}),
            consolidated=True,
        )

        variable_options = {
            "temperature": (
                "air_temperature_at_2_metres",
                "2m_temperature",
                "t2m",
            ),
            "dewpoint": (
                "dew_point_temperature_at_2_metres",
                "2m_dewpoint_temperature",
                "d2m",
            ),
        }
        temp_var = next(
            name for name in variable_options["temperature"]
            if name in dataset.data_vars
        )
        dewpoint_var = next(
            name for name in variable_options["dewpoint"]
            if name in dataset.data_vars
        )
        lat_name = "lat" if "lat" in dataset.coords else "latitude"
        lon_name = "lon" if "lon" in dataset.coords else "longitude"
        time_name = "time"

        era5_longitude = longitude
        try:
            lon_max = float(dataset[lon_name].max())
            if lon_max > 180 and era5_longitude < 0:
                era5_longitude += 360
        except Exception:
            pass

        selection = {
            time_name: timestamp.to_datetime64(),
            lat_name: latitude,
            lon_name: era5_longitude,
        }
        temp_k = dataset[temp_var].sel(selection, method="nearest").values.item()
        dewpoint_k = dataset[dewpoint_var].sel(
            selection,
            method="nearest",
        ).values.item()

        temp_c = float(temp_k) - 273.15
        dewpoint_c = float(dewpoint_k) - 273.15
        humidity = cls._relative_humidity_from_temp_dewpoint(temp_c, dewpoint_c)

        return {
            "temperature": round(temp_c, 2),
            "humidity": round(humidity, 2),
            "weather_source": "ERA5 Planetary Computer",
            "weather_date": timestamp.strftime("%Y-%m-%d"),
            "weather_date_offset_days": 0,
        }

    @classmethod
    def _weather_features(cls, latitude, longitude, timestamp):
        weather = cls._nasa_power_weather(
            latitude=latitude,
            longitude=longitude,
            timestamp=timestamp,
        )
        if weather.get("temperature") is not None and weather.get("humidity") is not None:
            return weather

        try:
            return cls._era5_weather(
                latitude=latitude,
                longitude=longitude,
                timestamp=timestamp,
            )
        except Exception:
            return weather

    @staticmethod
    def _needs_weather(feature_names):
        weather_features = {
            "temperature",
            "humidity",
            "air_temperature",
            "relative_humidity",
        }
        return bool(weather_features.intersection(feature_names or []))

    @classmethod
    def extract_data_for_location(
        cls,
        latitude,
        longitude,
        date=None,
        start_date=None,
        end_date=None,
        feature_names=None,
    ):
        requested_timestamp = (
            cls._normalize_utc_timestamp(date)
            if date
            else None
        )
        if requested_timestamp is not None and not end_date:
            end_date = requested_timestamp.strftime("%Y-%m-%d")

        context = Sentinel2ContextModel().get_context(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
        )
        indices = context.get("indices") or {}
        scene_datetime = context.get("scene_datetime")
        scene_timestamp = (
            datetime.fromisoformat(scene_datetime.replace("Z", "+00:00"))
            if scene_datetime
            else datetime.now(timezone.utc)
        )
        scene_timestamp = cls._normalize_utc_timestamp(scene_timestamp)
        feature_timestamp = requested_timestamp or scene_timestamp

        features = {
            "ndvi": indices.get("ndvi"),
            "ndbi": indices.get("ndbi"),
            "ndwi": indices.get("ndwi"),
            "bare_soil_index": indices.get("bare_soil_index"),
            "normalized_burn_ratio": indices.get("normalized_burn_ratio"),
            "aerosol_optical_thickness": context.get(
                "aerosol_optical_thickness"
            ),
            "scene_cloud_cover": context.get("scene_cloud_cover"),
            "latitude": float(latitude),
            "longitude": float(longitude),
            "year": int(feature_timestamp.year),
            "month": int(feature_timestamp.month),
            "day": int(feature_timestamp.day),
            "dayofweek": int(feature_timestamp.weekday()),
            "week": int(feature_timestamp.strftime("%V")),
        }
        cls._add_interaction_features(features)
        if requested_timestamp is not None:
            features["requested_date"] = requested_timestamp.strftime("%Y-%m-%d")
        features["scene_date"] = scene_timestamp.strftime("%Y-%m-%d")

        if cls._needs_weather(feature_names):
            weather = cls._weather_features(
                latitude=latitude,
                longitude=longitude,
                timestamp=feature_timestamp,
            )
            features.update(weather)
            features["air_temperature"] = weather["temperature"]
            features["relative_humidity"] = weather["humidity"]

        return features, context

    @staticmethod
    def _multiply_feature(features, *names):
        result = 1.0
        for name in names:
            value = features.get(name)
            if value is None:
                return None
            result *= float(value)
        return result

    @classmethod
    def _add_interaction_features(cls, features):
        features["day_aod"] = cls._multiply_feature(
            features,
            "day",
            "aerosol_optical_thickness",
        )
        features["ndvi_aod"] = cls._multiply_feature(
            features,
            "ndvi",
            "aerosol_optical_thickness",
        )
        features["ndvi_bsi"] = cls._multiply_feature(
            features,
            "ndvi",
            "bare_soil_index",
        )
        features["lat_aod"] = cls._multiply_feature(
            features,
            "latitude",
            "aerosol_optical_thickness",
        )
        features["lon_aod"] = cls._multiply_feature(
            features,
            "longitude",
            "aerosol_optical_thickness",
        )

    @classmethod
    def get_feature_names(cls, model):
        feature_names = getattr(model, "feature_names_in_", None)
        if feature_names is not None:
            return [str(name) for name in feature_names]

        booster = getattr(model, "booster_", None)
        if booster is not None:
            booster_names = booster.feature_name()
            if booster_names and not all(
                name.startswith("Column_") for name in booster_names
            ):
                return [str(name) for name in booster_names]

        configured_order = os.getenv("SATELLITE_PREDICTION_FEATURE_ORDER", "")
        return [
            name.strip()
            for name in configured_order.split(",")
            if name.strip()
        ]

    @classmethod
    def prepare_model_input(cls, model, features):
        feature_names = cls.get_feature_names(model)
        if not feature_names:
            raise ValueError(
                "The prediction model does not declare feature names. Retrain it "
                "with Sentinel-2 features or configure "
                "SATELLITE_PREDICTION_FEATURE_ORDER."
            )

        missing = [
            name
            for name in feature_names
            if name not in features or features[name] is None
        ]
        if missing:
            raise ValueError(
                "The deployed model is incompatible with the available Sentinel-2 "
                f"feature schema. Missing features: {', '.join(missing)}"
            )

        return pd.DataFrame(
            [{name: features[name] for name in feature_names}],
            columns=feature_names,
        )

    @classmethod
    def predict(
        cls,
        model,
        latitude,
        longitude,
        date=None,
        start_date=None,
        end_date=None,
    ):
        feature_names = cls.get_feature_names(model)
        features, context = cls.extract_data_for_location(
            latitude=latitude,
            longitude=longitude,
            date=date,
            start_date=start_date,
            end_date=end_date,
            feature_names=feature_names,
        )
        model_input = cls.prepare_model_input(model, features)
        prediction = model.predict(model_input)[0]
        return float(prediction), features, context
