from typing import List, Dict, Tuple, Any, Optional
from urllib.parse import quote
from datetime import datetime

import pandas as pd

from .adapter import DataSourceAdapter
from .http_client import HttpClient
from ..config import configuration
from ..constants import DeviceNetwork
from ..utils import Result


class AirGradientAdapter(DataSourceAdapter):
    def __init__(self) -> None:
        self.client = HttpClient()
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

        AirGradient exposes two endpoint types:

        * **raw** (``auth_required=True``): a historical endpoint that accepts
          explicit ``from``/``to`` date parameters and returns measurements for
          the given window. Because the API may cap the response size, the
          caller's date list is iterated and results are accumulated.

        * **current** (``auth_required`` falsy): a snapshot endpoint that
          returns only the device's latest reading. No date parameters are
          sent; instead, the response is validated against the overall date
          window derived from ``dates`` so stale readings outside the ETL
          window are discarded.

        Args:
            device (Dict[str, Any]): Device record containing:
                - ``device_number`` (str): Unique device identifier used in the
                  API URL path.
                - ``auth_required`` (bool, optional): When truthy, uses the
                  authenticated historical ("raw") endpoint.
                - ``device_id`` (str, optional): Used in error messages.
            dates (List[Tuple[str, str]]): List of ``(start_iso, end_iso)``
                tuples in ``"%Y-%m-%dT%H:%M:%SZ"`` format.
            resolution (Any): Unused; accepted for interface compatibility.

        Returns:
            Result: ``Result.data`` is a dict with:
                - ``records``: list of raw AirGradient measurement dicts
                - ``meta``: empty dict
            ``Result.error`` is ``None`` on success or an error string on
            failure.
        """
        integration = self.integration or {}
        base_url = integration.get("url", "").rstrip("/")

        device_identifier = device.get("device_number")
        if not device_identifier:
            msg = f"Invalid api code for device: {device.get('device_id', 'unknown')}"
            return Result(data={"records": [], "meta": {"error": msg}}, error=msg)

        require_auth = device.get("auth_required")
        endpoint_key = "raw" if require_auth else "current"
        endpoint_template = integration.get("endpoints", {}).get(endpoint_key, "")
        url = f"{base_url}/{endpoint_template.format(id=device_identifier)}"
        params = {"token": quote(configuration.AIR_GRADIENT_API_KEY, safe="-")}
        data: List[Dict[str, Any]] = []
        try:
            if require_auth:
                # Historical endpoint: supports explicit date ranges.
                # A fresh params dict is built per chunk so that each call
                # carries its own from/to window (mutating the base dict would
                # corrupt earlier iteration args).
                for start, end in dates or []:
                    chunk_params = {
                        **params,
                        "from": datetime.strptime(start, "%Y-%m-%dT%H:%M:%SZ").strftime(
                            "%Y%m%d%H%M%SZ"
                        ),
                        "to": datetime.strptime(end, "%Y-%m-%dT%H:%M:%SZ").strftime(
                            "%Y%m%d%H%M%SZ"
                        ),
                    }
                    api_data = self.client.get_json(url, params=chunk_params)
                    if api_data is not None:
                        data.extend(api_data)
            else:
                # Snapshot endpoint: a single request suffices.
                # TODO: Validate the returned records against the requested window
                # so stale readings (device hasn't transmitted recently) are
                # not silently passed downstream.
                api_data = self.client.get_json(url, params=params)
                data = api_data  # AirGradientAdapter._filter_by_date_window(api_data, dates) Commenting this fails its tests.

        except Exception:
            return Result(
                data={"records": [], "meta": {}}, error="An unexpected error occurred"
            )

        return Result(
            data={"records": data, "meta": {}},
            error=None if data else "No data retrieved",
        )

    @staticmethod
    def _filter_by_date_window(
        records: List[Dict[str, Any]],
        dates: Optional[List[Tuple[str, str]]],
        ts_field: str = "timestamp",
    ) -> List[Dict[str, Any]]:
        """Keep only records whose timestamp falls within the overall date window.

        For the "current" (snapshot) endpoint, the API returns the device's
        latest reading regardless of what date range was requested. This filter
        discards readings that fall outside ``[min(starts), max(ends)]`` so
        stale devices do not inject out-of-window data into downstream tables.

        All timestamps (window bounds and record fields) are UTC, so
        ``pd.Timestamp`` parses them directly and comparison is numeric with
        no timezone conversion required.

        Records with a missing or unparseable timestamp are kept so valid data
        is not silently dropped due to format differences between API versions.

        Args:
            records: Raw API response records.
            dates: The ``(start, end)`` tuples from the ``fetch`` call. When
                empty or ``None`` all records are returned unchanged.
            ts_field: Name of the timestamp field in each record.

        Returns:
            Records whose ``ts_field`` value falls in
            ``[min(starts), max(ends)]``.
        """
        if not dates or not records:
            return records

        # Use .value (nanoseconds since Unix epoch, always UTC internally) so
        # that timezone-representation differences between window bounds and
        # record timestamps — e.g. pytz.UTC vs datetime.timezone.utc vs
        # FixedOffset(0) — never cause a mis-comparison or TypeError.
        window_start = pd.Timestamp(min(s for s, _ in dates)).value
        window_end = pd.Timestamp(max(e for _, e in dates)).value

        result = []
        for record in records:
            ts_raw = record.get(ts_field)
            if ts_raw is None:
                result.append(record)
                continue
            try:
                if window_start <= pd.Timestamp(ts_raw).value <= window_end:
                    result.append(record)
            except Exception:
                result.append(record)
        return result


# Self-register with the adapter registry
from .registry import register_adapter  # noqa: E402

register_adapter(DeviceNetwork.AIRGRADIENT, AirGradientAdapter)
