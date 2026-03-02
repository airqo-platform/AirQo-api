import json
import os
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_PLATFORM_BASE_URL = "https://platform.airqo.net"


class SourceMetadataClientError(RuntimeError):
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
    normalized = _unwrap_singleton_lists(payload)

    if not isinstance(normalized, dict):
        raise ValueError("Platform response must resolve to a JSON object.")

    if "data" in normalized and isinstance(normalized.get("data"), dict):
        response = dict(normalized)
        response.setdefault("message", "Operation successful")
        return response

    message = normalized.get("message", "Operation successful")
    data = {key: value for key, value in normalized.items() if key != "message"}

    return {
        "message": message,
        "data": data,
    }


class SourceMetadataClient:
    def __init__(
        self,
        *,
        base_url: str = DEFAULT_PLATFORM_BASE_URL,
        token: Optional[str] = None,
        timeout: int = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    @staticmethod
    def _validate_coordinates(latitude: float, longitude: float) -> None:
        lat = float(latitude)
        lon = float(longitude)
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
        extra_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self._validate_coordinates(latitude, longitude)

        params: Dict[str, Any] = {
            "latitude": latitude,
            "longitude": longitude,
            "include_satellite": str(bool(include_satellite)).lower(),
            "token": self._resolve_token(token),
        }

        if extra_params:
            params.update({key: value for key, value in extra_params.items() if value is not None})

        query = urlencode(params)
        url = f"{self.base_url}/api/v2/spatial/source_metadata?{query}"
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "airqosm/0.2.0",
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
                message,
                status_code=ex.code,
                payload=payload,
            ) from ex
        except URLError as ex:
            raise SourceMetadataClientError(
                f"Unable to reach the platform source metadata API: {ex.reason}"
            ) from ex

        payload = self._safe_load_json(body)
        return normalize_platform_response(payload)

    @staticmethod
    def _safe_load_json(body: str) -> Any:
        try:
            return json.loads(body)
        except json.JSONDecodeError as ex:
            raise SourceMetadataClientError("Platform response was not valid JSON.") from ex

    @staticmethod
    def _extract_error_message(payload: Any) -> Optional[str]:
        if isinstance(payload, dict):
            return payload.get("message") or payload.get("error")
        return None
