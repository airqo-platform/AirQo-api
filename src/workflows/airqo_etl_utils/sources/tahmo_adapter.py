from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed


from airqo_etl_utils.sources.adapter import DataSourceAdapter
from airqo_etl_utils.utils import Result
from ..constants import DeviceNetwork
from airqo_etl_utils.data_api import DataApi
from .http_client import HttpClient
from airqo_etl_utils.utils.auth import AuthHeaderBuilder
from ..config import configuration

import logging


logger = logging.getLogger("airflow.task")


class TahmoAdapter(DataSourceAdapter):
    """Adapter for TAHMO data via `DataApi.get_tahmo_data`.

    Expects `device` to optionally provide a `stations` list. `dates` should be
    a list of (start_iso, end_iso) tuples. The adapter aggregates station
    measurements into a list of records.
    """

    def __init__(self) -> None:
        self.client = HttpClient()
        self.data_api = DataApi()
        network = DeviceNetwork.TAHMO
        self.integration = configuration.INTEGRATION_DETAILS.get(network.str)
        self.base_url = self.integration.get("url", "")
        self.headers, _ = AuthHeaderBuilder.build(
            network=network, integration=self.integration, headers={}, params={}
        )

    def fetch(
        self,
        device: Dict[str, Any],
        dates: Optional[List[Tuple[str, str]]] = None,
        resolution: Optional[str] = None,
    ) -> Result:
        """Fetch TAHMO weather-station measurements for the given date ranges.

        Args:
            device (Dict[str, Any]): Entity dict.  Expected keys (first match wins):
                - ``"stations"`` (List[str]): Station codes, e.g. ``["TA00001"]``.
                - ``"station_codes"`` (List[str]): Alias accepted for compatibility.
            dates (Optional[List[Tuple[str, str]]]): List of ``(start_iso, end_iso)``
                tuples.  Each tuple is fetched separately and results are merged.
            resolution (Optional[str]): Unused; accepted for interface parity.

        Returns:
            Result: ``data["records"]`` is a list of measurement dicts
            (one row per station observation).  ``error`` is ``None`` on success.
        """
        try:
            stations = (
                (device or {}).get("stations")
                or (device or {}).get("station_codes")
                or []
            )
            if not stations:
                return Result(
                    data={"records": [], "meta": {}}, error="No stations provided"
                )
            if dates is None:
                return Result(
                    data={"records": [], "meta": {}}, error="No dates provided"
                )
            # Accept a single (start, end) tuple as well as a list of tuples
            if (
                isinstance(dates, tuple)
                and len(dates) == 2
                and isinstance(dates[0], str)
            ):
                dates = [dates]
            records: List[Dict[str, Any]] = []
            for start, end in dates:
                df = self.get_tahmo_data(start, end, stations)
                if isinstance(df, pd.DataFrame) and not df.empty:
                    records.extend(df.to_dict(orient="records"))
            return Result(data={"records": records, "meta": {}}, error=None)
        except Exception as e:
            return Result(data=None, error=str(e))

    def get_tahmo_data(
        self, start_time: str, end_time: str, stations: List[str]
    ) -> pd.DataFrame:
        """
        Extracts measurement data from the TAHMO API for a list of station codes over a specified time range.
        """
        all_data: List = []
        params = {
            "start": start_time,
            "end": end_time,
        }
        columns = ["value", "variable", "station", "time"]
        unique_stations = list(set(stations))
        max_workers = min(
            len(unique_stations), getattr(configuration, "MAX_WORKERS", 4) or 4
        )

        def fetch_station(code: str) -> Optional[pd.DataFrame]:
            try:
                url = (
                    self.base_url
                    + f"/services/measurements/v2/stations/{code}/measurements/controlled"
                )
                response = self.client.get_json(
                    url, params=params, headers=self.headers
                )
                results = response.get("results") or []
                if not results:
                    logger.warning(f"No data returned from station: {code}")
                    return None
                series = results[0].get("series")
                if not series:
                    logger.warning(f"No series for station: {code}")
                    return None
                values = series[0].get("values", [])
                cols = series[0].get("columns", columns)
                df = pd.DataFrame(data=values, columns=cols)
                return df if not df.empty else None
            except Exception as e:
                logger.exception(f"Error fetching TAHMO station {code}: {e}")
                return None

        with ThreadPoolExecutor(max_workers=max_workers) as exc:
            futures = {
                exc.submit(fetch_station, code): code for code in unique_stations
            }
            for fut in as_completed(futures):
                df = fut.result()
                if isinstance(df, pd.DataFrame):
                    all_data.append(df)

        if all_data:
            return pd.concat(all_data, ignore_index=True)
        return pd.DataFrame(columns=columns)
