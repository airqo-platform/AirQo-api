from datetime import datetime
from typing import Any, Dict, List, Tuple

from .adapter import DataSourceAdapter
from .http_client import HttpClient
from ..config import configuration
from ..constants import DeviceNetwork
from ..utils import Result


class AirNowAdapter(DataSourceAdapter):
    def __init__(self) -> None:
        self.client = HttpClient()
        self.integration = configuration.INTEGRATION_DETAILS.get(
            DeviceNetwork.METONE.str
        )

    def fetch(
        self,
        device: Dict[str, Any],
        dates: List[Tuple[str, str]] = None,
        resolution: Any = None,
    ) -> Result:
        """Fetch BAM data from the AirNow API for a bounding-box region over date ranges.

        AirNow returns all stations within the configured geographic bounding box — the
        ``device`` parameter is accepted for interface parity but is not used.

        Args:
            device (Dict[str, Any]): Unused; accepted for interface compatibility.
            dates (List[Tuple[str, str]]): List of ``(start_iso, end_iso)`` tuples in
                ``"%Y-%m-%dT%H:%M:%SZ"`` format defining the time windows to fetch.
            resolution (Any): Unused; accepted for interface compatibility.

        Returns:
            Result: ``Result.data`` is a dict with:
                - ``records``: list of raw AirNow measurement dicts (one per station/parameter)
                - ``meta``: empty dict (AirNow returns no top-level metadata)
            ``Result.error`` is ``None`` on success or an error message string on failure.
        """
        integration = self.integration or {}
        base_url = integration.get("url", "").rstrip("/")
        endpoint = (
            integration.get("endpoints", {}).get("get_data", "aq/data").lstrip("/")
        )
        boundary_box = integration.get("extras", {}).get("boundary_box", "")
        parameters = integration.get("extras", {}).get("parameters", "")
        auth = integration.get("auth", {}) or {}

        records: List[Dict[str, Any]] = []
        url = f"{base_url}/{endpoint}"

        try:
            for start, end in dates or []:
                start_fmt = datetime.strptime(start, "%Y-%m-%dT%H:%M:%SZ").strftime(
                    "%Y-%m-%dT%H:%M"
                )
                end_fmt = datetime.strptime(end, "%Y-%m-%dT%H:%M:%SZ").strftime(
                    "%Y-%m-%dT%H:%M"
                )
                params = {
                    "startDate": start_fmt,
                    "endDate": end_fmt,
                    "parameters": parameters,
                    "BBOX": boundary_box,
                    "format": "application/json",
                    "verbose": 1,
                    "nowcastonly": 1,
                    "includerawconcentrations": 1,
                    "dataType": "B",
                    **auth,
                }
                data = self.client.get_json(url, params=params)
                if data:
                    records.extend(data)
        except Exception:
            return Result(
                data={"records": records, "meta": {}},
                error="An unexpected error occurred",
            )

        return Result(
            data={"records": records, "meta": {}},
            error=None if records else "No data retrieved",
        )


# Self-register with the adapter registry
from .registry import register_adapter  # noqa: E402

register_adapter(DeviceNetwork.METONE, AirNowAdapter)
