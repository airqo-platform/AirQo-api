import json
from datetime import datetime
from typing import Any, Dict, List, Tuple

from .adapter import DataSourceAdapter
from .http_client import HttpClient
from ..config import configuration
from ..constants import DeviceNetwork
from ..utils import Result


class AirBeamAdapter(DataSourceAdapter):
    POLLUTANTS = ["pm2.5", "pm10", "pm1", "rh", "f"]

    def __init__(self) -> None:
        self.client = HttpClient()
        self.integration = configuration.INTEGRATION_DETAILS.get(
            DeviceNetwork.AIRBEAM.str
        )

    def fetch(
        self,
        device: Dict[str, Any],
        dates: List[Tuple[str, str]] = None,
        resolution: Any = None,
    ) -> Result:
        """Fetch AirBeam mobile session measurements over date ranges.

        Performs a two-step retrieval internally:
        1. Queries ``mobile/sessions.json`` per username × pollutant to collect stream IDs.
        2. Queries ``measurements.json`` per stream ID to collect the actual readings.

        Args:
            device (Dict[str, Any]): Optional dict with key ``"usernames"`` (comma-separated
                string or list). Falls back to ``configuration.AIR_BEAM_USERNAMES`` when absent.
            dates (List[Tuple[str, str]]): List of ``(start_iso, end_iso)`` tuples in
                ``"%Y-%m-%dT%H:%M:%SZ"`` format.
            resolution (Any): Unused; accepted for interface compatibility.

        Returns:
            Result: ``Result.data`` is a dict with:
                - ``records``: list of measurement dicts, each tagged with ``"pollutant"``
                  and ``"device_id"`` (``sensor_package_name`` from the session stream).
                - ``meta``: empty dict
            ``Result.error`` is ``None`` on success or an error message string on failure.
        """
        integration = self.integration or {}
        base_url = integration.get("url", "").rstrip("/")
        bbox = integration.get("extras", {})

        usernames_raw = (
            (device.get("usernames") if device else None)
            or configuration.AIR_BEAM_USERNAMES
            or ""
        )
        usernames = [
            u.strip()
            for u in (
                usernames_raw.split(",")
                if isinstance(usernames_raw, str)
                else list(usernames_raw)
            )
            if u.strip()
        ]
        if not usernames:
            return Result(
                data={"records": [], "meta": {}}, error="No usernames configured"
            )

        records: List[Dict[str, Any]] = []

        try:
            for start, end in dates or []:
                start_dt = datetime.strptime(start, "%Y-%m-%dT%H:%M:%SZ")
                end_dt = datetime.strptime(end, "%Y-%m-%dT%H:%M:%SZ")
                start_ts = int(start_dt.timestamp())
                end_ts = int(end_dt.timestamp())

                streams: List[
                    Tuple[int, str, str]
                ] = []  # (stream_id, pollutant, device_id)
                for username in usernames:
                    for pollutant in self.POLLUTANTS:
                        params = {
                            "q": json.dumps(
                                {
                                    "time_from": start_ts,
                                    "time_to": end_ts,
                                    "tags": "",
                                    "usernames": username,
                                    "west": bbox.get("west", 10.581214853439886),
                                    "east": bbox.get("east", 38.08577769782265),
                                    "south": bbox.get("south", -36.799337832603314),
                                    "north": bbox.get("north", -19.260169583742446),
                                    "limit": 100,
                                    "offset": 0,
                                    "sensor_name": f"airbeam3-{pollutant}",
                                    "measurement_type": "Particulate Matter",
                                    "unit_symbol": "µg/m³",
                                }
                            )
                        }
                        response = self.client.get_json(
                            f"{base_url}/mobile/sessions.json", params=params
                        )
                        if not response:
                            continue
                        for session in response.get("sessions", []):
                            for stream in session.get("streams", {}).values():
                                stream_id = stream.get("id")
                                device_id = stream.get("sensor_package_name")
                                if stream_id:
                                    streams.append((stream_id, pollutant, device_id))

                for stream_id, pollutant, device_id in streams:
                    params = {
                        "start_time": start_ts * 1000,
                        "end_time": end_ts * 1000,
                        "stream_ids": stream_id,
                    }
                    measurements = self.client.get_json(
                        f"{base_url}/measurements.json", params=params
                    )
                    if measurements:
                        for m in measurements:
                            m["pollutant"] = pollutant
                            m["device_id"] = device_id
                        records.extend(measurements)

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

register_adapter(DeviceNetwork.AIRBEAM, AirBeamAdapter)
