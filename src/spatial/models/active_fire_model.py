"""NASA FIRMS active-fire retrieval for Africa."""

from __future__ import annotations

import csv
import hashlib
import json
import logging
import math
import os
from datetime import datetime, timedelta, timezone
from io import StringIO
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote, urlsplit, urlunsplit

import requests
from shapely.geometry import Point, Polygon

from configure import Config

try:
    import redis
except ImportError:  # pragma: no cover - redis is optional at runtime
    redis = None


logger = logging.getLogger(__name__)


class ActiveFireError(Exception):
    """Base error for active-fire retrieval failures."""


class ActiveFireConfigurationError(ActiveFireError):
    """Raised when required FIRMS configuration is missing."""


class ActiveFireValidationError(ActiveFireError):
    """Raised when caller-supplied active-fire options are invalid."""


class ActiveFireUpstreamError(ActiveFireError):
    """Raised when FIRMS cannot return usable data."""


class ActiveFireModel:
    """Fetch and normalize active fire detections from NASA FIRMS."""

    AFRICA_BBOX = (-25.5, -35.0, 63.5, 38.5)
    CACHE_KEY_PREFIX = "airqo:spatial:active_fires:firms:v2"
    DEFAULT_CACHE_TTL_SECONDS = 12 * 60 * 60
    DEFAULT_SOURCE = "VIIRS_NOAA20_NRT"
    SUPPORTED_SOURCES = {
        "MODIS_NRT",
        "MODIS_SP",
        "VIIRS_NOAA20_NRT",
        "VIIRS_NOAA20_SP",
        "VIIRS_NOAA21_NRT",
        "VIIRS_SNPP_NRT",
        "VIIRS_SNPP_SP",
    }
    CONFIDENCE_ORDER = {
        "low": 1,
        "l": 1,
        "nominal": 2,
        "n": 2,
        "medium": 2,
        "high": 3,
        "h": 3,
    }

    # Coarse continent masks used after FIRMS' rectangular area query. They keep
    # the API Africa-scoped without adding a heavyweight boundary dataset.
    AFRICA_GEOMETRIES = (
        Polygon(
            [
                (-17.8, 37.4),
                (-6.0, 35.9),
                (10.0, 37.4),
                (25.0, 32.5),
                (34.8, 31.6),
                (36.3, 22.0),
                (43.5, 12.0),
                (51.5, 11.5),
                (51.5, -1.0),
                (43.5, -12.5),
                (40.0, -18.5),
                (35.0, -25.5),
                (31.0, -34.9),
                (18.0, -34.9),
                (11.5, -18.0),
                (8.0, -5.0),
                (-5.0, 5.0),
                (-17.5, 14.0),
                (-17.8, 37.4),
            ]
        ),
        Polygon([(43.0, -11.5), (50.5, -12.0), (50.8, -25.7), (43.2, -25.7)]),
        Polygon([(55.1, -21.5), (63.5, -20.0), (63.5, -11.0), (55.1, -10.0)]),
        Polygon([(-25.5, 12.0), (-21.0, 12.0), (-21.0, 18.0), (-25.5, 18.0)]),
        Polygon([(39.0, -7.0), (46.0, -7.0), (46.0, -13.5), (39.0, -13.5)]),
    )

    def __init__(
        self,
        map_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        redis_client=None,
        cache_ttl_seconds: Optional[int] = None,
    ):
        self.map_key = map_key or Config.FIRMS_MAP_KEY
        self.base_url = self._sanitize_base_url(base_url or Config.FIRMS_API_BASE_URL)
        resolved_timeout = (
            timeout_seconds 
            if timeout_seconds is not None 
            else Config.FIRMS_REQUEST_TIMEOUT_SECONDS
        )
        try:
            self.timeout_seconds = int(resolved_timeout)
        except (ValueError, TypeError) as error:
            raise ActiveFireConfigurationError(
                "FIRMS timeout must be a positive integer."
            ) from error 
        if self.timeout_seconds <= 0:
            raise ActiveFireConfigurationError(
                "FIRMS timeout must be greater than zero."
            )

        self.cache_ttl_seconds = self._resolve_cache_ttl(cache_ttl_seconds)
        self.redis_client = (
            redis_client if redis_client is not None else self._init_redis_client()
        )

    def fetch_africa_active_fires(
        self,
        source: str = DEFAULT_SOURCE,
        day_range: int = 1,
        date: Optional[str] = None,
        min_confidence: Optional[str] = None,
        limit: Optional[int] = None,
        hours: Optional[int] = None,
        now: Optional[datetime] = None,
    ) -> Dict:
        source = self._validate_source(source)
        day_range = self._validate_day_range(day_range)
        date = self._validate_date(date)
        min_confidence = self._validate_min_confidence(min_confidence)
        limit = self._validate_limit(limit)
        requested_day_range = day_range

        if not self.map_key:
            raise ActiveFireConfigurationError("FIRMS_MAP_KEY is not configured.")

        window_end = self._normalize_now(now)
        if hours in (None, ""):
            query_date = date or window_end.date().isoformat()
            window_start, window_end = self._date_window(query_date, window_end)
            fetch_date = query_date
            hours = None
        else:
            hours = self._validate_hours(hours)
            day_range = max(day_range, math.ceil(hours / 24))
            window_start = window_end - timedelta(hours=hours)
            fetch_date = date

        rows = self._fetch_firms_rows(
            source=source,
            day_range=day_range,
            date=fetch_date,
        )
        fires = [
            self._normalize_fire(row)
            for row in rows
            if self._row_is_in_africa(row)
            and self._row_meets_confidence(row, min_confidence)
            and self._row_is_within_window(row, window_start, window_end)
        ]
        def _sort_time(value):
            try:
                return f"{int(value):04d}"
            except (ValueError, TypeError):
                return ""
        fires = sorted(
            fires,
            key=lambda item: (
                item.get("acquisition_date") or "",
                _sort_time(item.get("acquisition_time")),
            ),
            reverse=True,
        )
        if limit is not None:
            fires = fires[:limit]

        return {
            "source": "NASA FIRMS",
            "product": source,
            "source_options": {
                "available": sorted(self.SUPPORTED_SOURCES),
                "selected": source,
                "default": self.DEFAULT_SOURCE,
            },
            "scope": "Africa",
            "query": {
                "area_coordinates": self._format_bbox(),
                "day_range": day_range,
                "requested_day_range": requested_day_range,
                "date": fetch_date,
                "hours": hours,
                "window_start": window_start.isoformat(),
                "window_end": window_end.isoformat(),
                "min_confidence": min_confidence,
                "limit": limit,
            },
            "count": len(fires),
            "fires": fires,
        }

    @staticmethod
    def _sanitize_base_url(base_url: str) -> str:
        candidate = (base_url or "").strip()
        parsed = urlsplit(candidate)
        if parsed.scheme.lower() != "https" or not parsed.netloc:
            raise ActiveFireConfigurationError(
                "FIRMS API base URL must be an absolute HTTPS URL."
            )
        return urlunsplit(
            (
                parsed.scheme.lower(),
                parsed.netloc,
                parsed.path.rstrip("/"),
                "",
                "",
            )
        )

    def _build_firms_url(
        self,
        source: str,
        day_range: int,
        date: Optional[str],
    ) -> str:
        path_segments = [
            "api",
            "area",
            "csv",
            self.map_key,
            source,
            self._format_bbox(),
            day_range,
        ]
        if date:
            path_segments.append(date)

        encoded_path = "/".join(
            quote(str(segment), safe=",") for segment in path_segments
        )
        base = urlsplit(self.base_url)
        base_path = base.path.rstrip("/")
        full_path = f"{base_path}/{encoded_path}" if base_path else f"/{encoded_path}"
        return urlunsplit((base.scheme, base.netloc, full_path, "", ""))

    def _assert_allowed_firms_url(self, url: str) -> None:
        configured = urlsplit(self.base_url)
        candidate = urlsplit(url)
        if (
            candidate.scheme.lower() != configured.scheme.lower()
            or candidate.netloc.lower() != configured.netloc.lower()
        ):
            raise ActiveFireUpstreamError("Resolved FIRMS URL is not allowed.")

    def _fetch_firms_rows(
        self,
        source: str,
        day_range: int,
        date: Optional[str],
    ) -> List[Dict[str, str]]:
        cache_key = self._cache_key(source=source, day_range=day_range, date=date)
        cached_rows = self._get_cached_rows(cache_key)
        if cached_rows is not None:
            return cached_rows

        url = self._build_firms_url(source=source, day_range=day_range, date=date)
        self._assert_allowed_firms_url(url)

        try:
            response = requests.get(url, timeout=self.timeout_seconds)
            response.raise_for_status()
        except requests.RequestException as error:
            raise ActiveFireUpstreamError("Failed to fetch active fire data from FIRMS.") from error

        content = response.text.strip()
        if not content:
            rows = []
            self._set_cached_rows(cache_key, rows)
            return rows
        if content.lower().startswith("invalid") or "error" in content[:100].lower():
            raise ActiveFireUpstreamError("FIRMS returned an error response.")
        rows = list(csv.DictReader(StringIO(content)))
        self._set_cached_rows(cache_key, rows)
        return rows

    @staticmethod
    def _resolve_cache_ttl(cache_ttl_seconds: Optional[int]) -> int:
        configured_ttl = (
            cache_ttl_seconds
            if cache_ttl_seconds is not None
            else getattr(Config, "ACTIVE_FIRE_CACHE_TTL_SECONDS", None)
        )
        if configured_ttl is None:
            configured_ttl = os.getenv(
                "ACTIVE_FIRE_CACHE_TTL_SECONDS",
                str(ActiveFireModel.DEFAULT_CACHE_TTL_SECONDS),
            )
        try:
            ttl_seconds = int(configured_ttl)
        except (TypeError, ValueError):
            ttl_seconds = ActiveFireModel.DEFAULT_CACHE_TTL_SECONDS
        return max(1, min(ttl_seconds, ActiveFireModel.DEFAULT_CACHE_TTL_SECONDS))

    @staticmethod
    def _init_redis_client():
        if redis is None:
            logger.info("Redis library not installed; active-fire caching is disabled.")
            return None

        redis_url = getattr(Config, "REDIS_URL", None) or os.getenv("REDIS_URL")
        try:
            if redis_url:
                client = redis.from_url(redis_url, decode_responses=True)
                client.ping()
                return client

            redis_host = getattr(Config, "REDIS_HOST", None) or os.getenv("REDIS_HOST")
            redis_port = getattr(Config, "REDIS_PORT", None) or os.getenv("REDIS_PORT")
            if redis_host and redis_port:
                client = redis.Redis(
                    host=redis_host,
                    port=int(redis_port),
                    db=int(getattr(Config, "REDIS_DB", None) or os.getenv("REDIS_DB", 0)),
                    password=getattr(Config, "REDIS_PASSWORD", None) or os.getenv("REDIS_PASSWORD"),
                    decode_responses=True,
                )
                client.ping()
                return client
        except Exception:
            logger.warning("Redis connection failed; active-fire caching is disabled.")
        return None

    def _cache_key(self, source: str, day_range: int, date: Optional[str]) -> str:
        payload = {
            "base_url": self.base_url,
            "bbox": self._format_bbox(),
            "date": date,
            "day_range": day_range,
            "map_key": self._map_key_fingerprint(),
            "source": source,
        }
        digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        return f"{self.CACHE_KEY_PREFIX}:{digest}"

    def _map_key_fingerprint(self) -> Optional[str]:
        if not self.map_key:
            return None
        return hashlib.sha256(self.map_key.encode("utf-8")).hexdigest()

    def _get_cached_rows(self, cache_key: str) -> Optional[List[Dict[str, str]]]:
        if not self.redis_client:
            return None
        try:
            raw = self.redis_client.get(cache_key)
            if not raw:
                return None
            payload = json.loads(raw)
            rows = payload.get("rows")
            if isinstance(rows, list):
                return rows
        except Exception:
            logger.warning("Failed to read active-fire FIRMS cache.", exc_info=True)
        return None

    def _set_cached_rows(self, cache_key: str, rows: List[Dict[str, str]]) -> None:
        if not self.redis_client:
            return
        payload = {
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "latest_acquisition_datetime": self._latest_acquisition_datetime(rows),
            "rows": rows,
        }
        try:
            self.redis_client.set(
                cache_key,
                json.dumps(payload),
                ex=self.cache_ttl_seconds,
            )
        except Exception:
            logger.warning("Failed to write active-fire FIRMS cache.", exc_info=True)

    @classmethod
    def _latest_acquisition_datetime(cls, rows: List[Dict[str, str]]) -> Optional[str]:
        latest = None
        for row in rows:
            acquired_at = cls._parse_acquisition_datetime(row)
            if acquired_at and (latest is None or acquired_at > latest):
                latest = acquired_at
        return latest.isoformat() if latest else None

    @classmethod
    def _row_is_in_africa(cls, row: Dict[str, str]) -> bool:
        try:
            latitude = float(row["latitude"])
            longitude = float(row["longitude"])
        except (KeyError, TypeError, ValueError):
            return False
        west, south, east, north = cls.AFRICA_BBOX
        if not (west <= longitude <= east and south <= latitude <= north):
            return False
        point = Point(longitude, latitude)
        return any(geometry.covers(point) for geometry in cls.AFRICA_GEOMETRIES)

    @classmethod
    def _row_meets_confidence(cls, row: Dict[str, str], min_confidence: Optional[str]) -> bool:
        if not min_confidence:
            return True
        confidence = str(row.get("confidence", "")).strip().lower()
        if confidence in cls.CONFIDENCE_ORDER:
            return cls.CONFIDENCE_ORDER[confidence] >= cls.CONFIDENCE_ORDER[min_confidence]
        try:
            return float(confidence) >= float(min_confidence)
        except ValueError:
            return False

    @classmethod
    def _row_is_within_window(
        cls,
        row: Dict[str, str],
        window_start: datetime,
        window_end: datetime,
    ) -> bool:
        acquired_at = cls._parse_acquisition_datetime(row)
        if acquired_at is None:
            return False
        return window_start <= acquired_at <= window_end

    @staticmethod
    def _normalize_fire(row: Dict[str, str]) -> Dict:
        latitude = ActiveFireModel._to_float(row.get("latitude"))
        longitude = ActiveFireModel._to_float(row.get("longitude"))
        acquired_at = ActiveFireModel._parse_acquisition_datetime(row)
        return {
            "latitude": latitude,
            "longitude": longitude,
            "brightness": ActiveFireModel._to_float(row.get("bright_ti4") or row.get("brightness")),
            "scan": ActiveFireModel._to_float(row.get("scan")),
            "track": ActiveFireModel._to_float(row.get("track")),
            "acquisition_date": row.get("acq_date"),
            "acquisition_time": row.get("acq_time"),
            "acquisition_datetime": acquired_at.isoformat() if acquired_at else None,
            "satellite": row.get("satellite"),
            "instrument": row.get("instrument"),
            "confidence": row.get("confidence"),
            "version": row.get("version"),
            "bright_t31": ActiveFireModel._to_float(row.get("bright_t31") or row.get("bright_ti5")),
            "frp": ActiveFireModel._to_float(row.get("frp")),
            "daynight": row.get("daynight"),
        }

    @staticmethod
    def _to_float(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_acquisition_datetime(row: Dict[str, str]) -> Optional[datetime]:
        date = row.get("acq_date")
        time = str(row.get("acq_time", "")).strip().zfill(4)
        try:
            return datetime.strptime(
                f"{date} {time}",
                "%Y-%m-%d %H%M",
            ).replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _validate_source(cls, source: Optional[str]) -> str:
        source = (source or cls.DEFAULT_SOURCE).strip().upper()
        if source not in cls.SUPPORTED_SOURCES:
            raise ActiveFireValidationError(
                f"Unsupported source. Expected one of: {', '.join(sorted(cls.SUPPORTED_SOURCES))}."
            )
        return source

    @staticmethod
    def _validate_day_range(day_range) -> int:
        try:
            day_range = int(day_range)
        except (TypeError, ValueError):
            raise ActiveFireValidationError("day_range must be an integer from 1 to 5.")
        if day_range < 1 or day_range > 5:
            raise ActiveFireValidationError("day_range must be between 1 and 5.")
        return day_range

    @staticmethod
    def _validate_date(date: Optional[str]) -> Optional[str]:
        if not date:
            return None
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise ActiveFireValidationError("date must use YYYY-MM-DD format.")
        return date

    @classmethod
    def _validate_min_confidence(cls, min_confidence: Optional[str]) -> Optional[str]:
        if not min_confidence:
            return None
        confidence = str(min_confidence).strip().lower()
        if confidence in cls.CONFIDENCE_ORDER:
            return confidence
        try:
            numeric = float(confidence)
        except ValueError:
            raise ActiveFireValidationError(
                "min_confidence must be low, nominal, high, or a numeric threshold."
            )
        if numeric < 0 or numeric > 100:
            raise ActiveFireValidationError("Numeric min_confidence must be between 0 and 100.")
        return confidence

    @staticmethod
    def _validate_limit(limit) -> Optional[int]:
        if limit in (None, ""):
            return None
        try:
            limit = int(limit)
        except (TypeError, ValueError):
            raise ActiveFireValidationError("limit must be a positive integer.")
        if limit < 1:
            raise ActiveFireValidationError("limit must be a positive integer.")
        return limit

    @staticmethod
    def _validate_hours(hours) -> int:
        try:
            hours = int(hours)
        except (TypeError, ValueError):
            raise ActiveFireValidationError("hours must be an integer from 1 to 120.") from None
        if hours < 1 or hours > 120:
            raise ActiveFireValidationError("hours must be between 1 and 120.")
        return hours

    @staticmethod
    def _normalize_now(now: Optional[datetime]) -> datetime:
        if now is None:
            return datetime.now(timezone.utc)
        if now.tzinfo is None:
            return now.replace(tzinfo=timezone.utc)
        return now.astimezone(timezone.utc)

    @staticmethod
    def _date_window(date: str, now: datetime) -> Tuple[datetime, datetime]:
        window_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if window_start.date() == now.date():
            return window_start, now
        return window_start, window_start + timedelta(days=1)

    @classmethod
    def _format_bbox(cls) -> str:
        return ",".join(str(value) for value in cls.AFRICA_BBOX)
