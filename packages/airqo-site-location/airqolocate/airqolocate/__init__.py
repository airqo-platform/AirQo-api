from typing import Any, Dict, Mapping, Optional, Sequence, Union

from .client import (
    DEFAULT_PLATFORM_BASE_URL,
    LocateClient,
    LocateClientError,
    build_polygon,
    build_request_payload,
    normalize_platform_response,
    polygon_from_place,
    resolve_polygon,
)

__version__ = "0.1.1"


def locate_sites(
    polygon: Union[str, Mapping[str, Any]],
    *,
    num_sensors: int,
    min_distance_km: Union[int, float] = 2.5,
    must_have_locations: Optional[Sequence[Sequence[Union[int, float]]]] = None,
    token: Optional[str] = None,
    base_url: str = DEFAULT_PLATFORM_BASE_URL,
    timeout: Union[int, float] = 60,
    options: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Create recommended AirQo sensor locations for a place or polygon."""
    return LocateClient(
        token=token,
        base_url=base_url,
        timeout=timeout,
    ).locate(
        polygon=polygon,
        num_sensors=num_sensors,
        min_distance_km=min_distance_km,
        must_have_locations=must_have_locations,
        options=options,
    )


__all__ = [
    "DEFAULT_PLATFORM_BASE_URL",
    "LocateClient",
    "LocateClientError",
    "__version__",
    "build_polygon",
    "build_request_payload",
    "locate_sites",
    "normalize_platform_response",
    "polygon_from_place",
    "resolve_polygon",
]
