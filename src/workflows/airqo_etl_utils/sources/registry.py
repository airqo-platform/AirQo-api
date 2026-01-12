from typing import Optional, Tuple, List, Dict, Any

from ..constants import DeviceNetwork
from ..utils import Result

from .adapter import DataSourceAdapter
from .thingspeak_adapter import ThingSpeakAdapter
from .iqair_adapter import IQAirAdapter
from .airgradient_adapter import AirGradientAdapter


def get_adapter(network: DeviceNetwork | str) -> Optional[DataSourceAdapter]:
    """Return an adapter instance for the given network, or None if not available.

    Args:
        network (DeviceNetwork | str): Network enum or string identifier.

    Returns:
        Optional[DataSourceAdapter]: Adapter instance or `None` when unsupported.
    """
    key = network.str if hasattr(network, "str") else network
    if key == DeviceNetwork.AIRQO.str:
        return ThingSpeakAdapter()
    if key == DeviceNetwork.IQAIR.str:
        return IQAirAdapter()
    if key == DeviceNetwork.AIRGRADIENT.str:
        return AirGradientAdapter()
    return None


def fetch_from_adapter(
    network: DeviceNetwork | str,
    device: Dict[str, Any],
    dates: List[Tuple[str, str]] = None,
    resolution: Any = None,
) -> Result[Dict[str, Any]]:
    """Call the adapter for `network` and return a canonical `Result`.

    Args:
        network (DeviceNetwork | str): Provider network enum or string.
        device (Dict[str, Any]): Device metadata.
        dates (List[Tuple[str, str]]): Optional list of (start, end) ISO ranges.
        resolution (Any): Optional resolution parameter passed to adapter.

    Returns:
        Result: Canonical `Result` object. `data` is a dict with `records` and `meta`.

    Notes:
        - Adapters are expected to implement the canonical `Result` contract.
        - The wrapper tolerates older adapter return shapes for backward compatibility.
    """
    adapter = get_adapter(network)
    if adapter is None:
        return Result(data=None, error="No adapter available")

    # Adapters now implement the canonical `Result` contract; delegate directly.
    try:
        return adapter.fetch(device, dates, resolution)
    except TypeError:
        # Some adapters may accept fewer args; try without resolution
        return adapter.fetch(device, dates)
    except Exception as ex:
        return Result(data=None, error=str(ex))
