from typing import Any, Dict, List, Mapping, Optional, Union

from .client import (
    DEFAULT_PLATFORM_BASE_URL,
    SourceMetadataClient,
    SourceMetadataClientError,
    normalize_platform_response,
)


__version__ = "0.3.0"


def _response_data(response: Dict[str, Any]) -> Dict[str, Any]:
    data = response.get("data")
    if not isinstance(data, dict):
        raise SourceMetadataClientError(
            "Platform response did not contain an object 'data' field."
        )
    return data


def source_metadata(
    latitude: float,
    longitude: float,
    *,
    include_satellite: bool = True,
    token: Optional[str] = None,
    base_url: str = DEFAULT_PLATFORM_BASE_URL,
    timeout: Union[int, float] = 30,
    extra_params: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Return the complete normalized source metadata response."""
    client = SourceMetadataClient(base_url=base_url, token=token, timeout=timeout)
    return client.fetch(
        latitude=latitude,
        longitude=longitude,
        include_satellite=include_satellite,
        extra_params=extra_params,
    )


def primary_source(
    latitude: float,
    longitude: float,
    *,
    include_satellite: bool = True,
    token: Optional[str] = None,
    base_url: str = DEFAULT_PLATFORM_BASE_URL,
    timeout: Union[int, float] = 30,
    extra_params: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Return only the API's primary source object."""
    response = source_metadata(
        latitude=latitude,
        longitude=longitude,
        include_satellite=include_satellite,
        token=token,
        base_url=base_url,
        timeout=timeout,
        extra_params=extra_params,
    )
    value = _response_data(response).get("primary_source", {})
    if not isinstance(value, dict):
        raise SourceMetadataClientError(
            "Platform response field 'primary_source' must be an object."
        )
    return value


def candidate_sources(
    latitude: float,
    longitude: float,
    *,
    include_satellite: bool = True,
    token: Optional[str] = None,
    base_url: str = DEFAULT_PLATFORM_BASE_URL,
    timeout: Union[int, float] = 30,
    extra_params: Optional[Mapping[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Return the API's ranked candidate source list."""
    response = source_metadata(
        latitude=latitude,
        longitude=longitude,
        include_satellite=include_satellite,
        token=token,
        base_url=base_url,
        timeout=timeout,
        extra_params=extra_params,
    )
    value = _response_data(response).get("candidate_sources", [])
    if not isinstance(value, list):
        raise SourceMetadataClientError(
            "Platform response field 'candidate_sources' must be a list."
        )
    return value


__all__ = [
    "DEFAULT_PLATFORM_BASE_URL",
    "SourceMetadataClient",
    "SourceMetadataClientError",
    "__version__",
    "candidate_sources",
    "normalize_platform_response",
    "primary_source",
    "source_metadata",
]
