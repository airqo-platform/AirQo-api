from typing import Any, Dict, List, Optional

from .client import (
    DEFAULT_PLATFORM_BASE_URL,
    SourceMetadataClient,
    SourceMetadataClientError,
    normalize_platform_response,
)
from .engine import SourceMetadataEngine


__version__ = "0.2.3"


def source_metadata(
    latitude: float,
    longitude: float,
    *,
    include_satellite: bool = True,
    token: Optional[str] = None,
    base_url: str = DEFAULT_PLATFORM_BASE_URL,
    timeout: int = 30,
    extra_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    client = SourceMetadataClient(
        base_url=base_url,
        token=token,
        timeout=timeout,
    )
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
    timeout: int = 30,
    extra_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    response = source_metadata(
        latitude=latitude,
        longitude=longitude,
        include_satellite=include_satellite,
        token=token,
        base_url=base_url,
        timeout=timeout,
        extra_params=extra_params,
    )
    return response.get("data", {}).get("primary_source", {})


def candidate_sources(
    latitude: float,
    longitude: float,
    *,
    include_satellite: bool = True,
    token: Optional[str] = None,
    base_url: str = DEFAULT_PLATFORM_BASE_URL,
    timeout: int = 30,
    extra_params: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    response = source_metadata(
        latitude=latitude,
        longitude=longitude,
        include_satellite=include_satellite,
        token=token,
        base_url=base_url,
        timeout=timeout,
        extra_params=extra_params,
    )
    return response.get("data", {}).get("candidate_sources", [])


__all__ = [
    "DEFAULT_PLATFORM_BASE_URL",
    "SourceMetadataClient",
    "SourceMetadataClientError",
    "SourceMetadataEngine",
    "__version__",
    "candidate_sources",
    "normalize_platform_response",
    "primary_source",
    "source_metadata",
]
