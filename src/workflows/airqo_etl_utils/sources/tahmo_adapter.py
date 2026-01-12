from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from airqo_etl_utils.sources.adapter import DataSourceAdapter
from airqo_etl_utils.utils import Result
from airqo_etl_utils.data_api import DataApi


class TahmoAdapter(DataSourceAdapter):
    """Adapter for TAHMO data via `DataApi.get_tahmo_data`.

    Expects `device` to optionally provide a `stations` list. `dates` should be
    a list of (start_iso, end_iso) tuples. The adapter aggregates station
    measurements into a list of records.
    """

    def __init__(self) -> None:
        self.data_api = DataApi()

    def fetch(
        self,
        device: Dict[str, Any],
        dates: Optional[List[Tuple[str, str]]] = None,
        resolution: Optional[str] = None,
    ) -> Result:
        try:
            stations = device.get("stations") or device.get("station_codes") or []
            if not stations:
                return Result(
                    data={"records": [], "meta": {}}, error="No stations provided"
                )

            records: List[Dict[str, Any]] = []
            for start, end in dates or []:
                df = self.data_api.get_tahmo_data(start, end, stations)
                if isinstance(df, pd.DataFrame) and not df.empty:
                    records.extend(df.to_dict(orient="records"))

            return Result(
                data={"records": records, "meta": {}},
                error=None if records else "No data retrieved",
            )
        except Exception as e:
            return Result(data={"records": [], "meta": {}}, error=str(e))
