from typing import Any, Dict, Optional
from datetime import datetime

from .adapter import DataSourceAdapter
from ..constants import DeviceNetwork
from .http_client import HttpClient
from ..utils import Result, Utils


class NomadsAdapter(DataSourceAdapter):
    """Adapter to download NOMADS GRIB2 files using DataApi's util."""

    def __init__(self) -> None:
        self.client = HttpClient()

    def fetch(
        self,
        device: Dict[str, Any] = None,
        dates: Optional[list] = None,
        resolution: Optional[str] = None,
    ) -> Result:
        try:
            base_url, endpoint, file_name = self.__nomads_url_util()
            url = f"{base_url}{endpoint}"
            response = self.client.download_file(url, timeout=30)
            downloaded_file = Utils.parse_api_response(
                response, base_url, file_name=file_name
            )
            if downloaded_file:
                return Result(
                    data={"records": [], "meta": {"file": downloaded_file}}, error=None
                )
            return Result(
                data={"records": [], "meta": {}}, error="Failed to download nomads file"
            )
        except Exception as e:
            return Result(data={"records": [], "meta": {}}, error=str(e))

    def __nomads_url_util(
        self, grib_filename: str = "gdas.t00z.pgrb2.0p25.f000"
    ) -> str:
        """
        Constructs a URL to download filtered GDAS 0.25-degree GRIB2 data from the NOMADS (NOAA Operational Model Archive and Distribution System) server.

        The URL includes:
        - A default or user-specified GRIB2 file name.
        - Automatically resolved date using today's date in YYYYMMDD format.
        - Parameters for UGRD and VGRD (wind components) at 10 meters above ground.

        Parameters:
            grib_filename(str): The GRIB2 file name to fetch. Defaults to GDAS 00z forecast step 0.

        Returns:
            str: Fully formed NOMADS data request URL.
        """
        today_str = datetime.today().strftime("%Y%m%d")
        base_url = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gdas_0p25.pl"
        endpoint = (
            f"?dir=%2Fgdas.{today_str}%2F00%2Fatmos"
            f"&file={grib_filename}"
            f"&var_UGRD=on&var_VGRD=on"
            f"&lev_10_m_above_ground=on"
        )

        return base_url, endpoint, grib_filename


# Self-register with the adapter registry
from .registry import register_adapter  # noqa: E402

register_adapter(DeviceNetwork.NOMADS, NomadsAdapter)
