from typing import Any, Dict, Optional, Tuple
import requests
from airqo_etl_utils.sources.adapter import DataSourceAdapter
from airqo_etl_utils.utils import Result, Utils
from airqo_etl_utils.data_api import DataApi


class NomadsAdapter(DataSourceAdapter):
    """Adapter to download NOMADS GRIB2 files using DataApi's util."""

    def __init__(self) -> None:
        self.data_api = DataApi()

    def fetch(
        self,
        device: Dict[str, Any] = None,
        dates: Optional[list] = None,
        resolution: Optional[str] = None,
    ) -> Result:
        try:
            # Use DataApi's internal nomads URL util
            base_url, endpoint, file_name = self.data_api._DataApi__nomads_url_util()
            url = f"{base_url}{endpoint}"
            response = requests.get(url, timeout=30)
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
