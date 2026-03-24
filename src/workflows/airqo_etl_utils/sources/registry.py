from typing import Optional, Tuple, List, Dict, Any

from ..constants import DeviceNetwork
from ..utils import Result

from .adapter import DataSourceAdapter
from .thingspeak_adapter import ThingSpeakAdapter
from .iqair_adapter import IQAirAdapter
from .airgradient_adapter import AirGradientAdapter
from .tahmo_adapter import TahmoAdapter


def get_adapter(network: DeviceNetwork | str) -> Optional[DataSourceAdapter]:
    """Return an adapter instance for the given network, or ``None`` if unsupported.

    Args:
        network (DeviceNetwork | str): Network enum value or its string representation.

    Returns:
        Optional[DataSourceAdapter]: A fresh adapter instance, or ``None`` when the
        network has no registered adapter.
    """
    key = network.str if hasattr(network, "str") else network
    match key:
        case DeviceNetwork.AIRQO.str:
            return ThingSpeakAdapter()
        case DeviceNetwork.IQAIR.str:
            return IQAirAdapter()
        case DeviceNetwork.AIRGRADIENT.str:
            return AirGradientAdapter()
        case DeviceNetwork.TAHMO.str:
            return TahmoAdapter()
    return None


def fetch_from_adapter(
    network: DeviceNetwork | str,
    dates: Optional[List[Tuple[str, str]]] = None,
    resolution: Any = None,
    device: Optional[Dict[str, Any]] = None,
    site: Optional[Dict[str, Any]] = None,
    stations: Optional[List[str]] = None,
) -> Result:
    """Resolve the correct adapter for ``network`` and delegate the fetch call.

    Different adapters are scoped to different entity types.  This function
    accepts all three entity types as explicit keyword arguments and composes
    the right input for each adapter so callers do not need to know internal
    adapter conventions.

    Entity mapping per network
    --------------------------
    * **AirQo / ThingSpeak** — ``device`` dict with ``device_number`` + ``key``.
    * **IQAir** — ``device`` dict with ``api_code`` + ``serial_number``.
    * **AirGradient** — ``device`` dict with ``api_code`` + ``serial_number``.
    * **TAHMO** — ``stations`` list (e.g. ``["TA00001", "TA00002"]``) extracted
      from a site's ``weather_stations`` attribute.  Falls back to
      ``site["weather_stations"]`` when ``stations`` is not supplied directly.
    * **OpenWeather** — ``site`` dict carrying ``latitude`` / ``longitude``
      (or ``site_coordinates`` tuple).  Falls back to ``device`` when ``site``
      is absent.
    * **NOMADS / other** — no entity required; pass nothing.

    Args:
        network (DeviceNetwork | str): Target provider network.
        dates (Optional[List[Tuple[str, str]]]): List of ``(start_iso, end_iso)``
            tuples defining the time windows to fetch.  May be ``None`` for
            adapters that do not use date ranges (e.g. OpenWeather, Nomads).
        resolution (Any): Provider-specific resolution hint (e.g. ``"hourly"``).
            Pass ``None`` when not applicable.
        device (Optional[Dict[str, Any]]): Device metadata dict.  Required for
            device-scoped adapters (AirQo, IQAir, AirGradient).
        site (Optional[Dict[str, Any]]): Site metadata dict.  Used by
            site-scoped adapters (OpenWeather) and as a fallback source of
            ``weather_stations`` for TAHMO.
        stations (Optional[List[str]]): Explicit list of TAHMO station codes.
            Takes precedence over ``site["weather_stations"]`` when provided.

    Returns:
        Result: Canonical ``Result`` object whose ``data`` is a dict with
        ``"records"`` (list) and ``"meta"`` (dict) keys.  ``error`` is ``None``
        on success or an error message string on failure.
    """
    # TODO: Consider using generics for types.
    adapter = get_adapter(network)
    if adapter is None:
        return Result(data=None, error=f"No adapter available for network: {network}")

    # Build the first-arg entity dict each adapter's fetch() expects.
    if network == DeviceNetwork.TAHMO:
        # TAHMO is site/station-scoped: resolve station codes from explicit
        # `stations` arg first, then fall back to site's weather_stations list.
        resolved_stations = stations or [
            ws.get("station_code")
            for ws in (site or {}).get("weather_stations", [])
            if ws.get("station_code")
        ]
        entity: Dict[str, Any] = {"stations": resolved_stations}
    elif network in (
        DeviceNetwork.AIRQO,
        DeviceNetwork.IQAIR,
        DeviceNetwork.AIRGRADIENT,
    ):
        # Device-scoped adapters receive the device dict directly.
        entity = device or {}
    else:
        # Site-scoped adapters (OpenWeather) prefer `site`; Nomads ignores all.
        entity = site or device or {}

    try:
        return adapter.fetch(entity, dates, resolution)
    except Exception as ex:
        return Result(data=None, error=str(ex))
