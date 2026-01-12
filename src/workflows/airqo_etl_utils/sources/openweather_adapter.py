from typing import Any, Dict, List, Optional, Tuple
from airqo_etl_utils.sources.adapter import DataSourceAdapter
from airqo_etl_utils.sources.http_client import HttpClient
from airqo_etl_utils.utils import Result
from airqo_etl_utils.config import configuration


class OpenWeatherAdapter(DataSourceAdapter):
    """Adapter for OpenWeather API.

    Expects `device` to contain either `latitude` and `longitude` or a
    `site_coordinates` tuple.
    """

    def __init__(self) -> None:
        self.http = HttpClient()

    def fetch(
        self,
        device: Dict[str, Any],
        dates: Optional[List[Tuple[str, str]]] = None,
        resolution: Optional[str] = None,
    ) -> Result:
        try:
            lat = (
                device.get("latitude")
                or (device.get("site_coordinates") or (None, None))[0]
            )
            lon = (
                device.get("longitude")
                or (device.get("site_coordinates") or (None, None))[1]
            )

            if lat is None or lon is None:
                return Result(
                    data={"records": [], "meta": {}}, error="Missing coordinates"
                )

            params = {
                "lat": lat,
                "lon": lon,
                "appid": configuration.OPENWEATHER_API_KEY,
                "units": "metric",
            }

            resp = self.http.get_json(configuration.OPENWEATHER_BASE_URL, params=params)
            # Return whatever the API returned under records for downstream consumers
            return Result(data={"records": resp or {}, "meta": {}}, error=None)
        except Exception as e:
            return Result(data={"records": [], "meta": {}}, error=str(e))
