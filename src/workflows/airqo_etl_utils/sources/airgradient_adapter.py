from typing import List, Dict, Tuple, Any
from urllib.parse import quote
from datetime import datetime

import pandas as pd

from .adapter import DataSourceAdapter
from ..config import configuration
from ..data_api import DataApi
from ..constants import DeviceNetwork
from ..utils import Result


class AirGradientAdapter(DataSourceAdapter):
    def __init__(self) -> None:
        self.data_api = DataApi()
        self.integration = configuration.INTEGRATION_DETAILS.get(
            DeviceNetwork.AIRGRADIENT.str
        )

    def fetch(
        self,
        device: Dict[str, Any],
        dates: List[Tuple[str, str]] = None,
        resolution: Any = None,
    ) -> Result:
        """Fetch data from the AirGradient API for a specific device over date ranges.

        Args:
            device (Dict[str, Any]): A dictionary containing device details, such as:
                - `api_code` (str): The base URL or endpoint for the API.
                - `serial_number` (str): The unique identifier for the device.
            dates (List[Tuple[str, str]]): List of (start_iso, end_iso) tuples to request.
            resolution (Any): Optional resolution parameter (unused but accepted for interface parity).

        Returns:
            Result: `Result.data` is a dict with:
                - `records`: List[dict] of raw AirGradient entries
                - `meta`: dict (provider metadata)
            `Result.error` contains an error message or `None` on success.

        Raises:
            ValueError: If date parsing fails or inputs are malformed.
            requests.exceptions.RequestException: For network/HTTP errors via underlying `DataApi`.
            Exception: For other unexpected errors.
        """
        params = {"token": quote(configuration.AIR_GRADIENT_API_KEY, safe="-")}
        data: List[Dict[str, Any]] = []
        meta: Dict[str, Any] = {}

        integration = configuration.INTEGRATION_DETAILS.get(
            DeviceNetwork.AIRGRADIENT.str
        )

        try:
            for start, end in dates:
                params.update(
                    {
                        "from": datetime.strptime(start, "%Y-%m-%dT%H:%M:%SZ").strftime(
                            "%Y%m%d%H%M%SZ"
                        ),
                        "to": datetime.strptime(end, "%Y-%m-%dT%H:%M:%SZ").strftime(
                            "%Y%m%d%H%M%SZ"
                        ),
                    }
                )

                base_url = (device.get("api_code", "") or "").rstrip("/")
                # Use serial_number as the device identifier to match legacy callers
                device_identifier = device.get("serial_number") or device.get(
                    "device_number"
                )
                end_point = (
                    integration.get("endpoints", {})
                    .get("raw", "")
                    .lstrip("/")
                    .rstrip("/")
                )

                if base_url and device_identifier and not pd.isna(base_url):
                    url = f"{base_url}/{device_identifier}"
                    api_data = self.data_api._request(
                        end_point,
                        params=params,
                        base_url=url,
                        network=DeviceNetwork.AIRGRADIENT,
                    )
                    if api_data is not None:
                        data.extend(api_data)
                else:
                    # invalid configuration; return partial data and an error in Result
                    return Result(
                        data={
                            "records": data or [],
                            "meta": {
                                "error": f"Invalid api code for device: {device.get('device_id', 'unknown')}"
                            },
                        },
                        error=f"Invalid api code for device: {device.get('device_id', 'unknown')}",
                    )

            return Result(
                data={"records": data or [], "meta": meta or {}},
                error=None if data else "No data retrieved",
            )
        except Exception:
            # maintain backward-compatible resilience
            return Result(
                data={"records": [], "meta": {}}, error="An unexpected error occurred"
            )
