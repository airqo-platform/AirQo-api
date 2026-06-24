import json
import math
import os
from typing import Any, Dict, Mapping, Optional, Union
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_PLATFORM_BASE_URL = "https://platform.airqo.net"
SOURCE_METADATA_PATH = "/api/v2/spatial/source_metadata"
PACKAGE_VERSION = "0.3.0"


class SourceMetadataClientError(RuntimeError):
    """Raised when a platform request or response cannot be processed."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        payload: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


def _unwrap_singleton_lists(payload: Any) -> Any:
    current = payload
    while isinstance(current, list) and len(current) == 1:
        current = current[0]
    return current


def normalize_platform_response(payload: Any) -> Dict[str, Any]:
    """Normalize an object or singleton-list AirQo response into one object."""
    normalized = _unwrap_singleton_lists(payload)

    if not isinstance(normalized, dict):
        raise ValueError("Platform response must resolve to a JSON object.")

    if "data" in normalized:
        if not isinstance(normalized["data"], dict):
            raise ValueError("Platform response field 'data' must be a JSON object.")
        response = dict(normalized)
        response.setdefault("message", "Operation successful")
        return response

    message = normalized.get("message", "Operation successful")
    data = {key: value for key, value in normalized.items() if key != "message"}
    return {"message": message, "data": data}


class SourceMetadataClient:
    """Client for the AirQo coordinate-based source metadata endpoint."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_PLATFORM_BASE_URL,
        token: Optional[str] = None,
        timeout: Union[int, float] = 30,
    ) -> None:
        if not str(base_url).strip():
            raise ValueError("base_url must not be empty.")
        if float(timeout) <= 0:
            raise ValueError("timeout must be greater than zero.")

        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    @staticmethod
    def _validate_coordinates(latitude: float, longitude: float) -> None:
        try:
            lat = float(latitude)
            lon = float(longitude)
        except (TypeError, ValueError) as ex:
            raise ValueError("Latitude and longitude must be numbers.") from ex

        if not math.isfinite(lat) or not math.isfinite(lon):
            raise ValueError("Latitude and longitude must be finite numbers.")
        if lat < -90 or lat > 90:
            raise ValueError("Latitude must be between -90 and 90.")
        if lon < -180 or lon > 180:
            raise ValueError("Longitude must be between -180 and 180.")

    def _resolve_token(self, token: Optional[str] = None) -> str:
        resolved = (
            token
            or self.token
            or os.getenv("AIRQO_PLATFORM_TOKEN")
            or os.getenv("AIRQO_API_TOKEN")
        )
        if not resolved:
            raise ValueError(
                "A platform API token is required. Pass token=... or set "
                "AIRQO_PLATFORM_TOKEN/AIRQO_API_TOKEN."
            )
        return resolved

    def fetch(
        self,
        *,
        latitude: float,
        longitude: float,
        include_satellite: bool = True,
        token: Optional[str] = None,
        extra_params: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Fetch and normalize source metadata for one coordinate."""
        self._validate_coordinates(latitude, longitude)

        params: Dict[str, Any] = {
            "latitude": latitude,
            "longitude": longitude,
            "include_satellite": str(bool(include_satellite)).lower(),
            "token": self._resolve_token(token),
        }
        if extra_params:
            reserved = params.keys() & extra_params.keys()
            if reserved:
                names = ", ".join(sorted(reserved))
                raise ValueError(
                    f"extra_params cannot override reserved parameters: {names}."
                )
            params.update(
                {key: value for key, value in extra_params.items() if value is not None}
            )

        query = urlencode(params)
        request = Request(
            f"{self.base_url}{SOURCE_METADATA_PATH}?{query}",
            headers={
                "Accept": "application/json",
                "User-Agent": f"airqosm/{PACKAGE_VERSION}",
            },
        )

        try:
            with urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8")
        except HTTPError as ex:
            raw_payload = ex.read().decode("utf-8", errors="replace")
            try:
                payload = self._safe_load_json(raw_payload)
            except SourceMetadataClientError:
                payload = {"error": raw_payload} if raw_payload else None
            message = self._extract_error_message(payload) or (
                f"Platform request failed with status {ex.code}."
            )
            raise SourceMetadataClientError(
                message, status_code=ex.code, payload=payload
            ) from ex
        except TimeoutError as ex:
            raise SourceMetadataClientError(
                "The platform source metadata request timed out."
            ) from ex
        except URLError as ex:
            if isinstance(getattr(ex, "reason", None), TimeoutError):
                raise SourceMetadataClientError(
                    "The platform source metadata request timed out."
                ) from ex
            raise SourceMetadataClientError(
                f"Unable to reach the platform source metadata API: {ex.reason}"
            ) from ex

        payload = self._safe_load_json(body)
        try:
            return normalize_platform_response(payload)
        except ValueError as ex:
            raise SourceMetadataClientError(str(ex), payload=payload) from ex

    @staticmethod
    def _safe_load_json(body: str) -> Any:
        try:
            return json.loads(body)
        except json.JSONDecodeError as ex:
            raise SourceMetadataClientError(
                "Platform response was not valid JSON."
            ) from ex

    @staticmethod
    def _extract_error_message(payload: Any) -> Optional[str]:
        if isinstance(payload, dict):
            return payload.get("message") or payload.get("error")
        return None
