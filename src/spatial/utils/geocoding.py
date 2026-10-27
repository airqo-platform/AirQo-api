"""Shared, bounded reverse-geocoding access for the spatial service."""

import logging
import os
import threading
import time

import requests


logger = logging.getLogger(__name__)


class ReverseGeocodingService:
    """Process-wide Nominatim client with caching and overload protection."""

    _cache = {}
    _cache_lock = threading.Lock()
    _request_lock = threading.BoundedSemaphore(
        max(1, int(os.getenv("SPATIAL_GEOCODING_CONCURRENCY", "1")))
    )
    _rate_lock = threading.Lock()
    _last_request_at = 0.0
    _max_cache_items = max(1, int(os.getenv("SPATIAL_GEOCODING_CACHE_MAX_ITEMS", "10000")))

    def __init__(self):
        self.cache_ttl_seconds = max(
            1, int(os.getenv("SPATIAL_GEOCODING_CACHE_TTL_SECONDS", "86400"))
        )
        self.acquire_timeout_seconds = max(
            0.0, float(os.getenv("SPATIAL_GEOCODING_ACQUIRE_TIMEOUT_SECONDS", "0.1"))
        )
        self.request_timeout_seconds = max(
            0.1, float(os.getenv("SPATIAL_GEOCODING_TIMEOUT_SECONDS", "3"))
        )
        self.min_interval_seconds = max(
            0.0, float(os.getenv("SPATIAL_GEOCODING_MIN_INTERVAL_SECONDS", "1"))
        )
        self.user_agent = os.getenv(
            "SPATIAL_OSM_USER_AGENT",
            "AirQo-Spatial/2.0 (https://airqo.net)",
        )

    @staticmethod
    def _cache_key(latitude, longitude):
        return round(float(latitude), 5), round(float(longitude), 5)

    @classmethod
    def clear_cache(cls):
        with cls._cache_lock:
            cls._cache.clear()

    def _get_cached(self, key):
        with self._cache_lock:
            cached = self._cache.get(key)
            if not cached:
                return None
            if time.monotonic() - cached["stored_at"] > self.cache_ttl_seconds:
                self._cache.pop(key, None)
                return None
            return cached["value"]

    def _set_cached(self, key, value):
        with self._cache_lock:
            if len(self._cache) >= self._max_cache_items:
                oldest_key = min(
                    self._cache,
                    key=lambda cache_key: self._cache[cache_key]["stored_at"],
                )
                self._cache.pop(oldest_key, None)
            self._cache[key] = {"stored_at": time.monotonic(), "value": value}

    @classmethod
    def _wait_for_rate_limit(cls, min_interval_seconds):
        with cls._rate_lock:
            wait_seconds = min_interval_seconds - (
                time.monotonic() - cls._last_request_at
            )
            if wait_seconds > 0:
                time.sleep(wait_seconds)
            cls._last_request_at = time.monotonic()

    def reverse(self, latitude, longitude):
        key = self._cache_key(latitude, longitude)
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        if not self._request_lock.acquire(timeout=self.acquire_timeout_seconds):
            return {"_error": "reverse_geocoder_busy"}

        try:
            cached = self._get_cached(key)
            if cached is not None:
                return cached
            self._wait_for_rate_limit(self.min_interval_seconds)
            response = requests.get(
                "https://nominatim.openstreetmap.org/reverse",
                headers={"User-Agent": self.user_agent, "Accept": "application/json"},
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "zoom": 18,
                },
                timeout=(2.5, self.request_timeout_seconds),
            )
            response.raise_for_status()
            result = response.json()
            self._set_cached(key, result)
            return result
        except Exception as error:
            logger.warning("Nominatim reverse lookup failed: %s", error)
            return {"_error": "reverse_geocode_failed"}
        finally:
            self._request_lock.release()
