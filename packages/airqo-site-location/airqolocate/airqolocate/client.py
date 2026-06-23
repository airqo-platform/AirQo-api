import json
import math
import os
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

DEFAULT_PLATFORM_BASE_URL = "https://platform.airqo.net"
SITE_LOCATION_PATH = "/api/v2/spatial/site_location"
PACKAGE_VERSION = "0.1.1"

Number = Union[int, float]
Coordinate = Tuple[float, float]


class LocateClientError(RuntimeError):
    """Raised when an AirQo site-location request cannot be completed."""

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
    """Return the site-location response as a JSON object."""
    normalized = _unwrap_singleton_lists(payload)
    if not isinstance(normalized, dict):
        raise ValueError("Platform response must resolve to a JSON object.")
    return normalized


def _finite_number(value: Any, field: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{field} must be a number.")
    try:
        number = float(value)
    except (TypeError, ValueError) as ex:
        raise ValueError(f"{field} must be a number.") from ex
    if not math.isfinite(number):
        raise ValueError(f"{field} must be a finite number.")
    return number


def _coordinate_pair(value: Any, *, order: str, field: str) -> Coordinate:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError(f"{field} must contain exactly two coordinates.")

    first = _finite_number(value[0], f"{field}[0]")
    second = _finite_number(value[1], f"{field}[1]")
    if order == "longitude_latitude":
        longitude, latitude = first, second
    else:
        latitude, longitude = first, second

    if not -90 <= latitude <= 90:
        raise ValueError(f"{field} latitude must be between -90 and 90.")
    if not -180 <= longitude <= 180:
        raise ValueError(f"{field} longitude must be between -180 and 180.")
    return first, second


def build_polygon(
    coordinates: Sequence[Sequence[Sequence[Number]]],
) -> Dict[str, Any]:
    """Validate polygon coordinates and return the API polygon object.

    Polygon positions use GeoJSON order: ``[longitude, latitude]``.
    """
    if not isinstance(coordinates, (list, tuple)) or not coordinates:
        raise ValueError("polygon coordinates must contain at least one linear ring.")

    rings: List[List[List[float]]] = []
    for ring_index, ring in enumerate(coordinates):
        if not isinstance(ring, (list, tuple)) or len(ring) < 3:
            raise ValueError(
                f"polygon.coordinates[{ring_index}] must contain at least three positions."
            )
        positions = [
            list(
                _coordinate_pair(
                    position,
                    order="longitude_latitude",
                    field=f"polygon.coordinates[{ring_index}][{position_index}]",
                )
            )
            for position_index, position in enumerate(ring)
        ]
        if positions[0] != positions[-1]:
            positions.append(list(positions[0]))
        if len({tuple(position) for position in positions[:-1]}) < 3:
            raise ValueError(
                f"polygon.coordinates[{ring_index}] must contain at least three distinct positions."
            )
        rings.append(positions)

    return {"coordinates": rings}


def polygon_from_place(place_name: str) -> Dict[str, Any]:
    """Resolve a named place to its largest OSM administrative polygon."""
    name = str(place_name).strip()
    if not name:
        raise ValueError("place name must not be empty.")

    try:
        import osmnx as ox
    except ImportError as ex:
        raise ImportError(
            "Place-name lookup requires OSMnx. Reinstall airqolocate to "
            "restore its required dependencies."
        ) from ex

    try:
        result = ox.geocode_to_gdf(name)
    except Exception as ex:
        raise ValueError(f"Unable to resolve place '{name}' with OpenStreetMap.") from ex

    if result is None or result.empty:
        raise ValueError(f"No OpenStreetMap boundary was found for '{name}'.")

    geometry = result.geometry.iloc[0]
    if geometry is None or geometry.is_empty:
        raise ValueError(f"OpenStreetMap returned an empty boundary for '{name}'.")

    if geometry.geom_type == "MultiPolygon":
        geometry = max(geometry.geoms, key=lambda item: item.area)
    elif geometry.geom_type != "Polygon":
        polygons = [
            item
            for item in getattr(geometry, "geoms", [])
            if item.geom_type == "Polygon" and not item.is_empty
        ]
        if not polygons:
            raise ValueError(
                f"OpenStreetMap did not return a polygon boundary for '{name}'."
            )
        geometry = max(polygons, key=lambda item: item.area)

    coordinates = [[float(x), float(y)] for x, y in geometry.exterior.coords]
    return build_polygon([coordinates])


def resolve_polygon(polygon: Union[str, Mapping[str, Any]]) -> Dict[str, Any]:
    """Resolve a place name or validate an explicit polygon object."""
    if isinstance(polygon, str):
        return polygon_from_place(polygon)
    if not isinstance(polygon, Mapping):
        raise ValueError("polygon must be a place name or an object containing coordinates.")
    return build_polygon(polygon.get("coordinates"))


def build_request_payload(
    *,
    polygon: Union[str, Mapping[str, Any]],
    num_sensors: int,
    min_distance_km: Number = 2.5,
    must_have_locations: Optional[Sequence[Sequence[Number]]] = None,
    options: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate and build a site-location request payload."""
    normalized_polygon = resolve_polygon(polygon)

    if isinstance(num_sensors, bool) or not isinstance(num_sensors, int):
        raise ValueError("num_sensors must be an integer.")
    if num_sensors < 1:
        raise ValueError("num_sensors must be at least 1.")

    distance = _finite_number(min_distance_km, "min_distance_km")
    if distance <= 0:
        raise ValueError("min_distance_km must be greater than zero.")

    required_locations: List[List[float]] = []
    if must_have_locations is not None:
        if not isinstance(must_have_locations, (list, tuple)):
            raise ValueError("must_have_locations must be a list of coordinate pairs.")
        required_locations = [
            list(
                _coordinate_pair(
                    location,
                    order="latitude_longitude",
                    field=f"must_have_locations[{index}]",
                )
            )
            for index, location in enumerate(must_have_locations)
        ]
        if len(required_locations) > num_sensors:
            raise ValueError(
                "must_have_locations cannot contain more entries than num_sensors."
            )

    payload: Dict[str, Any] = {
        "polygon": normalized_polygon,
        "min_distance_km": distance,
        "num_sensors": num_sensors,
    }
    if required_locations:
        payload["must_have_locations"] = required_locations

    if options is not None:
        if not isinstance(options, Mapping):
            raise ValueError("options must be a mapping of additional request fields.")
        reserved = payload.keys() & options.keys()
        if reserved or "must_have_locations" in options:
            names = sorted(reserved | ({"must_have_locations"} & options.keys()))
            raise ValueError(
                "options cannot override core fields: " + ", ".join(names) + "."
            )
        payload.update({key: value for key, value in options.items() if value is not None})

    return payload


class LocateClient:
    """Client for the AirQo site-location endpoint."""

    def __init__(
        self,
        *,
        token: Optional[str] = None,
        base_url: str = DEFAULT_PLATFORM_BASE_URL,
        timeout: Union[int, float] = 60,
    ) -> None:
        base_url_value = str(base_url).strip()
        if not base_url_value:
            raise ValueError("base_url must not be empty.")
        parsed_base_url = urlparse(base_url_value)
        if parsed_base_url.scheme not in ("http", "https") or not parsed_base_url.netloc:
            raise ValueError("base_url must be a valid HTTP or HTTPS URL.")
        timeout_value = _finite_number(timeout, "timeout")
        if timeout_value <= 0:
            raise ValueError("timeout must be greater than zero.")

        self.token = token
        self.base_url = base_url_value.rstrip("/")
        self.timeout = timeout_value

    def _resolve_token(self, token: Optional[str]) -> str:
        resolved = (
            token
            or self.token
            or os.getenv("AIRQO_PLATFORM_TOKEN")
            or os.getenv("AIRQO_API_TOKEN")
        )
        if isinstance(resolved, str):
            resolved = resolved.strip()
        if not resolved:
            raise ValueError(
                "An AirQo API token is required. Pass token=... or set "
                "AIRQO_PLATFORM_TOKEN/AIRQO_API_TOKEN."
            )
        return resolved

    def locate(
        self,
        *,
        polygon: Union[str, Mapping[str, Any]],
        num_sensors: int,
        min_distance_km: Number = 2.5,
        must_have_locations: Optional[Sequence[Sequence[Number]]] = None,
        token: Optional[str] = None,
        options: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create recommended sensor locations inside a place or polygon."""
        request_payload = build_request_payload(
            polygon=polygon,
            num_sensors=num_sensors,
            min_distance_km=min_distance_km,
            must_have_locations=must_have_locations,
            options=options,
        )
        query = urlencode({"token": self._resolve_token(token)})
        request = Request(
            f"{self.base_url}{SITE_LOCATION_PATH}?{query}",
            data=json.dumps(request_payload).encode("utf-8"),
            method="POST",
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": f"airqolocate/{PACKAGE_VERSION}",
            },
        )

        try:
            with urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8")
        except HTTPError as ex:
            raw_body = ex.read().decode("utf-8", errors="replace")
            error_payload = self._load_error_payload(raw_body)
            message = self._error_message(error_payload) or (
                f"Platform request failed with status {ex.code}."
            )
            raise LocateClientError(
                message,
                status_code=ex.code,
                payload=error_payload,
            ) from ex
        except URLError as ex:
            raise LocateClientError(
                f"Unable to reach the AirQo site-location API: {ex.reason}"
            ) from ex
        except TimeoutError as ex:
            raise LocateClientError(
                "The AirQo site-location request timed out."
            ) from ex

        try:
            decoded = json.loads(body)
        except json.JSONDecodeError as ex:
            raise LocateClientError("Platform response was not valid JSON.") from ex

        try:
            return normalize_platform_response(decoded)
        except ValueError as ex:
            raise LocateClientError(str(ex), payload=decoded) from ex

    @staticmethod
    def _load_error_payload(body: str) -> Any:
        if not body:
            return None
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {"error": body}

    @staticmethod
    def _error_message(payload: Any) -> Optional[str]:
        if isinstance(payload, dict):
            return payload.get("message") or payload.get("error")
        return None
