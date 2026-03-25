from typing import Any, Dict, Optional, Tuple
from datetime import datetime, timezone, timedelta
from pathlib import Path

from .adapter import DataSourceAdapter
from ..constants import DeviceNetwork
from .http_client import HttpClient
from ..utils import Result, Utils

# GDAS runs are published on a 6-hourly cycle (00z, 06z, 12z, 18z).
# Data for a given cycle typically becomes available ~3.5 hours after the
# nominal run time; we use this delay to select the latest *available* cycle.
_GDAS_CYCLES = (0, 6, 12, 18)  # UTC hours
_AVAILABILITY_DELAY_HRS = 3.5
_NOMADS_BASE_URL = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gdas_0p25.pl"


class NomadsAdapter(DataSourceAdapter):
    """Adapter to download NOMADS GDAS 0.25° GRIB2 wind files.

    By default the adapter automatically determines the latest available GDAS
    cycle based on the current UTC time and the known ~3.5-hour publication
    delay.  You can override the cycle and forecast hour via the ``dates`` or
    ``resolution`` arguments if you need a specific window.

    GDAS cycles and naming
    ----------------------
    GDAS runs 4 times a day at 00z, 06z, 12z, and 18z UTC.  The file name
    follows the pattern::

        gdas.tCCz.pgrb2.0p25.fFFF

    where ``CC`` is the two-digit cycle hour and ``FFF`` is the three-digit
    forecast offset (``000`` = analysis, ``003``, ``006``, …).

    Fetched variables: ``UGRD`` and ``VGRD`` (10 m above ground wind).
    """

    def __init__(self) -> None:
        self.client = HttpClient()

    # ------------------------------------------------------------------
    # DataSourceAdapter interface
    # ------------------------------------------------------------------

    def fetch(
        self,
        device: Dict[str, Any] = None,
        dates: Optional[list] = None,
        resolution: Optional[str] = None,
    ) -> Result:
        """Download the latest available GDAS GRIB2 file.

        Args:
            device: Unused; accepted for interface parity.
            dates: Unused; accepted for interface parity.
            resolution: Optional forecast-hour string (e.g. ``"003"``).
                Defaults to ``"000"`` (analysis).

        Returns:
            Result whose ``data["meta"]["file"]`` holds the path to the
            downloaded GRIB2 file on success.
        """
        try:
            fhr = resolution or "000"
            base_url, endpoint, file_name = self._build_url(forecast_hour=fhr)
            url = f"{base_url}{endpoint}"

            # Check if file already exists (e.g. from a previous run) before downloading
            if file_name and Path(f"/tmp/{file_name}").exists():
                return Result(
                    data={"records": [], "meta": {"file": f"/tmp/{file_name}"}},
                    error=None,
                )
            response = self.client.download_file(url, timeout=30)
            downloaded_file = Utils.parse_api_response(
                response, base_url, file_name=file_name
            )
            if downloaded_file:
                return Result(
                    data={"records": [], "meta": {"file": f"/tmp/{file_name}"}},
                    error=None,
                )
            return Result(
                data={"records": [], "meta": {}}, error="Failed to download NOMADS file"
            )
        except Exception as e:
            return Result(data={"records": [], "meta": {}}, error=str(e))

    @classmethod
    def _build_url(
        cls,
        forecast_hour: str = "000",
        _now: Optional[datetime] = None,
    ) -> Tuple[str, str, str]:
        """Build the NOMADS request URL for the latest available GDAS cycle.

        Args:
            forecast_hour: Three-digit forecast offset string (``"000"``,
                ``"003"``, ``"006"``, …).  Defaults to ``"000"`` (analysis).
            _now: Override the current UTC time (used in tests).

        Returns:
            ``(base_url, endpoint, grib_filename)`` tuple.
        """
        date_str, cycle = cls._latest_cycle(_now=_now)
        grib_filename = f"gdas.t{cycle}z.pgrb2.0p25.f{forecast_hour}"
        endpoint = (
            f"?dir=%2Fgdas.{date_str}%2F{cycle}%2Fatmos"
            f"&file={grib_filename}"
            f"&var_UGRD=on&var_VGRD=on"
            f"&lev_10_m_above_ground=on"
        )
        return _NOMADS_BASE_URL, endpoint, grib_filename

    @staticmethod
    def _latest_cycle(_now: Optional[datetime] = None) -> Tuple[str, str]:
        """Return the ``(date_str, cycle_str)`` for the latest available GDAS run.

        The algorithm:
        1. Subtract the publication delay from the current UTC time to find
           the latest moment whose data should already be on the server.
        2. Snap down to the nearest 6-hour cycle boundary (0, 6, 12, 18).
        3. The resulting date may be the previous calendar day if the delay
           pushes us past midnight.

        Args:
            _now: Override for the current UTC time (useful in unit tests).

        Returns:
            ``(date_str, cycle_str)`` e.g. ``("20240324", "06")``.

        Examples:
            Current UTC = 04:00  →  available at 00:30  →  cycle 00z same day
            Current UTC = 10:00  →  available at 06:30  →  cycle 06z same day
            Current UTC = 02:00  →  available at 22:30 prev day  →  cycle 18z prev day
        """
        now = _now or datetime.now(timezone.utc)
        available_at = now - timedelta(hours=_AVAILABILITY_DELAY_HRS)
        # Snap down to nearest 6h cycle boundary
        cycle_hour = (available_at.hour // 6) * 6
        cycle_dt = available_at.replace(
            hour=cycle_hour, minute=0, second=0, microsecond=0
        )
        return cycle_dt.strftime("%Y%m%d"), f"{cycle_hour:02d}"


# Self-register with the adapter registry
from .registry import register_adapter  # noqa: E402

register_adapter(DeviceNetwork.NOMADS, NomadsAdapter)
