"""Data-source adapters for external APIs and services.

This package provides a unified interface (:class:`DataSourceAdapter`) for
fetching time-series data from heterogeneous providers (ThingSpeak, IQAir,
AirGradient, TAHMO, OpenWeather, NOMADS, etc.).

Quick start::

    from airqo_etl_utils.sources import get_adapter, fetch_from_adapter
    from airqo_etl_utils.constants import DeviceNetwork

    # Option A — use the convenience function
    result = fetch_from_adapter(
        DeviceNetwork.AIRQO,
        device={"device_number": 123, "key": "abc"},
        dates=[("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z")],
    )

    # Option B — resolve + call manually
    adapter = get_adapter(DeviceNetwork.AIRQO)
    result = adapter.fetch(device, dates)

Adding a new adapter
--------------------
1. Create ``sources/my_adapter.py`` implementing :class:`DataSourceAdapter`.
2. At module level call ``register_adapter(DeviceNetwork.MY_NET, MyAdapter)``.
3. Import the module here so registration runs at package load time.
"""

from .adapter import DataSourceAdapter
from .registry import get_adapter, fetch_from_adapter, register_adapter, list_adapters
from .http_client import HttpClient

# Import adapter modules to trigger self-registration.
# Each module calls ``register_adapter(...)`` at the bottom of its file.
from . import thingspeak_adapter as _thingspeak  # noqa: F401
from . import iqair_adapter as _iqair  # noqa: F401
from . import airgradient_adapter as _airgradient  # noqa: F401
from . import tahmo_adapter as _tahmo  # noqa: F401
from . import openweather_adapter as _openweather  # noqa: F401
from . import nomads_adapter as _nomads  # noqa: F401
from . import bigquery_source_adapter as _bigquery  # noqa: F401

__all__ = [
    "DataSourceAdapter",
    "get_adapter",
    "fetch_from_adapter",
    "register_adapter",
    "list_adapters",
    "HttpClient",
]
