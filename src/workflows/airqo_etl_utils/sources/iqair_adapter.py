from typing import List, Dict, Tuple, Any

import pandas as pd

from .adapter import DataSourceAdapter
from .http_client import HttpClient
from ..config import configuration
from ..constants import DeviceNetwork
from ..utils import Result


class IQAirAdapter(DataSourceAdapter):
    def __init__(self) -> None:
        self.client = HttpClient()

    def fetch(
        self,
        device: Dict[str, Any],
        dates: List[Tuple[str, str]] = None,
        resolution: Any = "instant",
    ) -> Result:
        """Fetch data from the IQAir API for a specific device and resolution.

        Args:
            device (Dict[str, Any]): A dictionary containing device details, such as:
                - `api_code` (str): The base URL or endpoint for the API.
                - `serial_number` (str): The unique identifier for the device.
            dates (List[Tuple[str, str]]): Optional date ranges (unused by IQAir adapter; kept for signature compatibility).
            resolution (str | Any): The data resolution to retrieve. Common values include:
                - `current`, `instant`, `hourly`, `daily`, `monthly`.

        Returns:
            Result: `Result.data` is a dict with:
                - `records`: List[dict] of IQAir measurements
                - `meta`: dict (provider-specific metadata)
            `Result.error` contains an error message or `None` on success.

        Raises:
            requests.exceptions.RequestException: For HTTP errors when calling IQAir.
            ValueError: For invalid resolution or malformed response data.
            Exception: For other unexpected errors.
        """
        # Map configured resolution to API resolution path (legacy behavior)
        mapping = configuration.DATA_RESOLUTION_MAPPING.get("iqair", {})
        resolution_str = mapping.get(resolution, resolution)

        valid_resolutions = {"current", "instant", "hourly", "daily", "monthly"}
        historical_resolutions = {"instant", "hourly", "daily", "monthly"}

        data: List[Dict[str, Any]] = []
        meta: Dict[str, Any] = {}
        try:
            base_url = (device.get("api_code") or "").rstrip("/")
            device_id = device.get("serial_number")
            if base_url and device_id and not pd.isna(base_url):
                url = f"{base_url}/{device_id}"
                response = self.client.get_json(url)
                # legacy API nests historical resolutions under 'historical'
                api_resolution = (
                    "historical"
                    if resolution_str in historical_resolutions
                    else resolution_str
                )
                if response and api_resolution in response:
                    if api_resolution == "current":
                        data = response.get("current")
                    else:
                        historical = response.get("historical", {})
                        data = historical.get(resolution_str, [])
        except Exception:
            # Preserve old resilience: return empty data on errors
            pass

        return Result(
            data={"records": data or [], "meta": meta or {}},
            error=None if data else "No data retrieved",
        )


# Self-register with the adapter registry
from .registry import register_adapter  # noqa: E402

register_adapter(DeviceNetwork.IQAIR, IQAirAdapter)
