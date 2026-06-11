"""Sentinel-2 land-surface context from the public Earth Search STAC API."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import math
import os
from pathlib import Path
import time

import numpy as np


class Sentinel2ContextModel:
    """Sample recent Sentinel-2 L2A COG assets around a coordinate."""

    STAC_URL = os.getenv(
        "SENTINEL2_STAC_URL",
        "https://earth-search.aws.element84.com/v1",
    )
    COLLECTION = "sentinel-2-l2a"
    REQUIRED_ASSETS = ("blue", "green", "red", "nir", "swir16", "swir22", "aot", "scl")
    CLOUD_SCL_CLASSES = {0, 1, 3, 8, 9, 10, 11}
    _CACHE = {}
    _CACHE_MAX_ITEMS = 2000

    def __init__(self):
        self.cache_ttl_seconds = max(
            60,
            int(os.getenv("SENTINEL2_CONTEXT_CACHE_TTL", "21600")),
        )
        self.max_cloud_cover = min(
            100.0,
            max(0.0, float(os.getenv("SENTINEL2_MAX_CLOUD_COVER", "50"))),
        )
        self.search_days = max(
            7,
            min(int(os.getenv("SENTINEL2_SEARCH_DAYS", "60")), 365),
        )

    @staticmethod
    def _parse_date(value, fallback):
        if not value:
            return fallback
        return datetime.strptime(str(value), "%Y-%m-%d").replace(tzinfo=timezone.utc)

    @staticmethod
    def _safe_index(numerator, denominator):
        if denominator is None or abs(denominator) < 1e-12:
            return None
        value = numerator / denominator
        return round(float(max(-1.0, min(1.0, value))), 4)

    @staticmethod
    def _cache_key(latitude, longitude, start_date, end_date):
        return (
            round(float(latitude), 4),
            round(float(longitude), 4),
            start_date,
            end_date,
        )

    def _get_cached(self, key):
        cached = self._CACHE.get(key)
        if not cached:
            return None
        if time.monotonic() - cached["stored_at"] > self.cache_ttl_seconds:
            self._CACHE.pop(key, None)
            return None
        return {**cached["value"], "cache_hit": True}

    @classmethod
    def _set_cached(cls, key, value):
        if len(cls._CACHE) >= cls._CACHE_MAX_ITEMS:
            oldest_key = min(
                cls._CACHE,
                key=lambda item_key: cls._CACHE[item_key]["stored_at"],
            )
            cls._CACHE.pop(oldest_key, None)
        cls._CACHE[key] = {"stored_at": time.monotonic(), "value": value}

    def _search_items(self, latitude, longitude, start_date, end_date):
        from pystac_client import Client

        catalog = Client.open(self.STAC_URL)
        search = catalog.search(
            collections=[self.COLLECTION],
            intersects={"type": "Point", "coordinates": [longitude, latitude]},
            datetime=f"{start_date}/{end_date}",
            query={"eo:cloud_cover": {"lt": self.max_cloud_cover}},
            sortby=[
                {"field": "properties.eo:cloud_cover", "direction": "asc"},
                {"field": "properties.datetime", "direction": "desc"},
            ],
            max_items=5,
        )
        return list(search.items())

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
                window = Window(col - 1, row - 1, 3, 3)
                values = dataset.read(1, window=window, masked=True)
                if values.count() == 0:
                    return None
                value = float(np.ma.median(values))
                if not math.isfinite(value):
                    return None
                return value * scale

    def _sample_item(self, item, latitude, longitude):
        import rasterio
        from rasterio._env import set_proj_data_search_path

        rasterio_proj_data = str(Path(rasterio.__file__).resolve().parent / "proj_data")
        os.environ["PROJ_LIB"] = rasterio_proj_data
        os.environ["PROJ_DATA"] = rasterio_proj_data
        set_proj_data_search_path(rasterio_proj_data)

        missing_assets = [name for name in self.REQUIRED_ASSETS if name not in item.assets]
        if missing_assets:
            raise ValueError(f"Sentinel-2 item is missing assets: {', '.join(missing_assets)}")

        reflectance_assets = ("blue", "green", "red", "nir", "swir16", "swir22")
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                asset_name: executor.submit(
                    self._sample_asset,
                    item.assets[asset_name].href,
                    latitude,
                    longitude,
                    0.0001,
                )
                for asset_name in reflectance_assets
            }
            futures["aot"] = executor.submit(
                self._sample_asset,
                item.assets["aot"].href,
                latitude,
                longitude,
                0.001,
            )
            futures["scl"] = executor.submit(
                self._sample_asset,
                item.assets["scl"].href,
                latitude,
                longitude,
                1.0,
            )
            sampled = {
                asset_name: future.result()
                for asset_name, future in futures.items()
            }

        scl = sampled["scl"]
        if scl is None or int(round(scl)) in self.CLOUD_SCL_CLASSES:
            raise ValueError(f"Cloudy or invalid Sentinel-2 point (SCL={scl})")

        reflectance = {
            asset_name: sampled[asset_name]
            for asset_name in reflectance_assets
        }
        aot = sampled["aot"]
        if any(value is None for value in reflectance.values()):
            raise ValueError("One or more Sentinel-2 reflectance bands had no valid data")

        blue = reflectance["blue"]
        green = reflectance["green"]
        red = reflectance["red"]
        nir = reflectance["nir"]
        swir16 = reflectance["swir16"]
        swir22 = reflectance["swir22"]

        return {
            "scene_id": item.id,
            "scene_datetime": item.datetime.isoformat() if item.datetime else None,
            "scene_cloud_cover": item.properties.get("eo:cloud_cover"),
            "scene_classification": int(round(scl)),
            "indices": {
                "ndvi": self._safe_index(nir - red, nir + red),
                "ndbi": self._safe_index(swir16 - nir, swir16 + nir),
                "ndwi": self._safe_index(green - nir, green + nir),
                "bare_soil_index": self._safe_index(
                    (swir16 + red) - (nir + blue),
                    (swir16 + red) + (nir + blue),
                ),
                "normalized_burn_ratio": self._safe_index(
                    nir - swir22,
                    nir + swir22,
                ),
            },
            "aerosol_optical_thickness": round(aot, 4) if aot is not None else None,
        }

    def get_context(self, latitude, longitude, start_date=None, end_date=None):
        started_at = time.perf_counter()
        now = datetime.now(timezone.utc)
        end = self._parse_date(end_date, now)
        start = self._parse_date(start_date, end - timedelta(days=self.search_days))
        if start > end:
            raise ValueError("start_date must be on or before end_date")

        start_text = start.strftime("%Y-%m-%d")
        end_text = end.strftime("%Y-%m-%d")
        cache_key = self._cache_key(
            latitude,
            longitude,
            start_text,
            end_text,
        )
        cached = self._get_cached(cache_key)
        if cached:
            return cached

        items = self._search_items(
            latitude,
            longitude,
            start_text,
            end_text,
        )
        errors = []
        for item in items:
            try:
                result = self._sample_item(item, latitude, longitude)
                result.update(
                    {
                        "provider": "Element 84 Earth Search",
                        "collection": self.COLLECTION,
                        "date_range": {
                            "start_date": start_text,
                            "end_date": end_text,
                        },
                        "elapsed_ms": round(
                            (time.perf_counter() - started_at) * 1000,
                            2,
                        ),
                        "cache_hit": False,
                    }
                )
                self._set_cached(cache_key, result)
                return result
            except Exception as error:
                errors.append(f"{item.id}: {error}")

        if not items:
            raise LookupError("No Sentinel-2 scenes matched the date and cloud filters")
        raise LookupError("No usable Sentinel-2 scene at the point: " + " | ".join(errors))
