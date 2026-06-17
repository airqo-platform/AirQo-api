"""NASA FIRMS active-fire retrieval for Africa."""

from __future__ import annotations

import csv
from datetime import datetime
from io import StringIO
from typing import Dict, Iterable, List, Optional, Tuple

import requests
from shapely.geometry import Point, Polygon

from configure import Config


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
    DEFAULT_SOURCE = "VIIRS_SNPP_NRT"
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
    ):
        self.map_key = map_key or Config.FIRMS_MAP_KEY
        self.base_url = (base_url or Config.FIRMS_API_BASE_URL).rstrip("/")
        self.timeout_seconds = timeout_seconds or Config.FIRMS_REQUEST_TIMEOUT_SECONDS

    def fetch_africa_active_fires(
        self,
        source: str = DEFAULT_SOURCE,
        day_range: int = 1,
        date: Optional[str] = None,
        min_confidence: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict:
        source = self._validate_source(source)
        day_range = self._validate_day_range(day_range)
        date = self._validate_date(date)
        min_confidence = self._validate_min_confidence(min_confidence)
        limit = self._validate_limit(limit)

        if not self.map_key:
            raise ActiveFireConfigurationError("FIRMS_MAP_KEY is not configured.")

        rows = self._fetch_firms_rows(source=source, day_range=day_range, date=date)
        fires = [
            self._normalize_fire(row)
            for row in rows
            if self._row_is_in_africa(row)
            and self._row_meets_confidence(row, min_confidence)
        ]
        fires = sorted(
            fires,
            key=lambda item: (item.get("acquisition_date") or "", item.get("acquisition_time") or ""),
            reverse=True,
        )
        if limit is not None:
            fires = fires[:limit]

        return {
            "source": "NASA FIRMS",
            "product": source,
            "scope": "Africa",
            "query": {
                "area_coordinates": self._format_bbox(),
                "day_range": day_range,
                "date": date,
                "min_confidence": min_confidence,
                "limit": limit,
            },
            "count": len(fires),
            "fires": fires,
        }

    def _fetch_firms_rows(self, source: str, day_range: int, date: Optional[str]) -> List[Dict[str, str]]:
        url_parts = [
            self.base_url,
            "api",
            "area",
            "csv",
            self.map_key,
            source,
            self._format_bbox(),
            str(day_range),
        ]
        if date:
            url_parts.append(date)
        url = "/".join(url_parts)

        try:
            response = requests.get(url, timeout=self.timeout_seconds)
            response.raise_for_status()
        except requests.RequestException as error:
            raise ActiveFireUpstreamError("Failed to fetch active fire data from FIRMS.") from error

        content = response.text.strip()
        if not content:
            return []
        if content.lower().startswith("invalid") or "error" in content[:100].lower():
            raise ActiveFireUpstreamError("FIRMS returned an error response.")
        return list(csv.DictReader(StringIO(content)))

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

    @staticmethod
    def _normalize_fire(row: Dict[str, str]) -> Dict:
        latitude = ActiveFireModel._to_float(row.get("latitude"))
        longitude = ActiveFireModel._to_float(row.get("longitude"))
        return {
            "latitude": latitude,
            "longitude": longitude,
            "brightness": ActiveFireModel._to_float(row.get("bright_ti4") or row.get("brightness")),
            "scan": ActiveFireModel._to_float(row.get("scan")),
            "track": ActiveFireModel._to_float(row.get("track")),
            "acquisition_date": row.get("acq_date"),
            "acquisition_time": row.get("acq_time"),
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

    @classmethod
    def _format_bbox(cls) -> str:
        return ",".join(str(value) for value in cls.AFRICA_BBOX)
