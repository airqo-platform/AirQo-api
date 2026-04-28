"""NOAA NOMADS GEFS-Chem point extraction helpers.

NOMADS exposes operational model fields as GRIB2 files. The fetcher requests a
small subregion around the target coordinate and extracts the nearest grid-cell
values for aerosol variables used by source metadata.
"""

from datetime import datetime, timezone
from pathlib import Path
import re
import tempfile
from typing import Dict, Iterable, List, Optional

import pandas as pd
import requests

from configure import Config


class NOAANOMADSFetcher:
    """Fetch aerosol fields from NOAA NOMADS GEFS-Chem."""

    POLLUTANT_VARIABLES = {
        "AOD": "AOTK",
        "PM2_5": "PMTF",
        "PM10": "PMTC",
    }

    GAS_VARIABLES = {
        "SO2": "sulphur_dioxide",
        "HCHO": "formaldehyde",
        "CO": "carbon_monoxide",
        "NO2": "nitrogen_dioxide",
        "O3": "ozone",
    }

    VARIABLE_ALIASES = {
        "AOD": {"aod", "aotk"},
        "PM2_5": {"pm2_5", "pmtf"},
        "PM10": {"pm10", "pmtc"},
    }

    DEFAULT_POLLUTANTS = ["AOD", "PM2_5", "PM10"]

    def __init__(self):
        self.base_url = Config.NOAA_NOMADS_BASE_URL.rstrip("/")
        self.timeout = Config.NOAA_NOMADS_TIMEOUT_SECONDS
        self.gas_timeout = Config.AIR_QUALITY_GAS_TIMEOUT_SECONDS
        self.forecast_hour = Config.NOAA_NOMADS_FORECAST_HOUR.zfill(3)
        self.padding = Config.NOAA_NOMADS_POINT_PADDING

    def get_pollutant_data(
        self,
        longitude: float,
        latitude: float,
        start_date: str,
        end_date: str,
        pollutants: Iterable[str],
    ) -> pd.DataFrame:
        pollutants = self._normalize_pollutants(pollutants)
        if not pollutants:
            return pd.DataFrame()

        aerosol_pollutants = [
            pollutant for pollutant in pollutants if pollutant in self.POLLUTANT_VARIABLES
        ]
        gas_pollutants = [
            pollutant for pollutant in pollutants if pollutant in self.GAS_VARIABLES
        ]
        frames = []

        if aerosol_pollutants:
            try:
                run = self._latest_run()
                url = self._build_filter_url(
                    run, longitude, latitude, aerosol_pollutants
                )

                with tempfile.TemporaryDirectory() as tmp_dir:
                    target = Path(tmp_dir) / "nomads-gefs-chem.grib2"
                    self._download_grib(url, target)
                    frames.append(
                        self._extract_grib_point(
                            target, longitude, latitude, aerosol_pollutants
                        )
                    )
            except Exception:
                if not gas_pollutants:
                    raise

        if gas_pollutants:
            frames.append(
                self._fetch_gas_data(
                    longitude, latitude, start_date, end_date, gas_pollutants
                )
            )

        if not frames:
            return pd.DataFrame()

        merged = frames[0]
        for frame in frames[1:]:
            merged = pd.merge(
                merged,
                frame,
                on=["date", "latitude", "longitude"],
                how="outer",
            )
        return merged

    def get_aod_data(
        self, longitude: float, latitude: float, start_date: str, end_date: str
    ) -> pd.DataFrame:
        df = self.get_pollutant_data(
            longitude=longitude,
            latitude=latitude,
            start_date=start_date,
            end_date=end_date,
            pollutants=["AOD"],
        )
        if "AOD" in df.columns:
            df["aod"] = df["AOD"]
        return df

    def _normalize_pollutants(self, pollutants: Iterable[str]) -> List[str]:
        normalized = []
        for pollutant in pollutants:
            pollutant = pollutant.upper().replace(".", "_")
            if pollutant == "PM25":
                pollutant = "PM2_5"
            if (
                pollutant in self.POLLUTANT_VARIABLES
                or pollutant in self.GAS_VARIABLES
            ) and pollutant not in normalized:
                normalized.append(pollutant)
        return normalized

    def _fetch_gas_data(
        self,
        longitude: float,
        latitude: float,
        start_date: str,
        end_date: str,
        pollutants: List[str],
    ) -> pd.DataFrame:
        variables = [self.GAS_VARIABLES[pollutant] for pollutant in pollutants]
        response = requests.get(
            Config.AIR_QUALITY_GAS_API_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "start_date": start_date,
                "end_date": end_date,
                "hourly": ",".join(variables),
                "timezone": "UTC",
            },
            timeout=self.gas_timeout,
        )
        response.raise_for_status()

        hourly = response.json().get("hourly") or {}
        times = hourly.get("time") or []
        records = []
        for index, timestamp in enumerate(times):
            row = {
                "date": str(timestamp)[:10],
                "longitude": longitude,
                "latitude": latitude,
            }
            for pollutant in pollutants:
                values = hourly.get(self.GAS_VARIABLES[pollutant]) or []
                row[pollutant] = values[index] if index < len(values) else None
            records.append(row)

        return pd.DataFrame(records)

    def _latest_run(self) -> Dict[str, str]:
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        page_url = f"{self.base_url}/gribfilter.php?ds={Config.NOAA_NOMADS_DATASET}"
        try:
            response = requests.get(page_url, timeout=self.timeout)
            response.raise_for_status()
            match = re.search(r"/gefs\.(\d{8})/(\d{2})/chem/pgrb2ap25", response.text)
            if match:
                return {"date": match.group(1), "cycle": match.group(2)}
        except Exception:
            pass
        return {"date": today, "cycle": "00"}

    def _build_filter_url(
        self,
        run: Dict[str, str],
        longitude: float,
        latitude: float,
        pollutants: List[str],
    ) -> str:
        variables = "".join(
            f"&var_{self.POLLUTANT_VARIABLES[pollutant]}=on"
            for pollutant in pollutants
        )
        levels = "&lev_surface=on&lev_entire_atmosphere=on"
        north = min(latitude + self.padding, 90.0)
        south = max(latitude - self.padding, -90.0)
        west = self._to_360(longitude - self.padding)
        east = self._to_360(longitude + self.padding)

        file_name = (
            f"gefs.chem.t{run['cycle']}z.a2d_0p25.f{self.forecast_hour}.grib2"
        )
        directory = f"/gefs.{run['date']}/{run['cycle']}/chem/pgrb2ap25"
        return (
            f"{self.base_url}/cgi-bin/filter_gefs_chem_0p25.pl"
            f"?file={file_name}"
            f"{variables}"
            f"{levels}"
            f"&subregion="
            f"&toplat={north}"
            f"&leftlon={west}"
            f"&rightlon={east}"
            f"&bottomlat={south}"
            f"&dir={directory}"
        )

    def _to_360(self, longitude: float) -> float:
        return longitude % 360.0

    def _download_grib(self, url: str, target: Path):
        response = requests.get(url, timeout=self.timeout)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "text/html" in content_type.lower():
            raise RuntimeError("NOAA NOMADS returned an HTML error page")
        target.write_bytes(response.content)

    def _extract_grib_point(
        self,
        target: Path,
        longitude: float,
        latitude: float,
        pollutants: List[str],
    ) -> pd.DataFrame:
        try:
            import cfgrib
        except Exception as ex:
            raise RuntimeError(
                "NOAA NOMADS GRIB2 extraction requires `cfgrib` and `eccodes`. "
                "Install the spatial requirements before using live NOMADS data."
            ) from ex

        records = {
            "date": None,
            "longitude": longitude,
            "latitude": latitude,
        }
        datasets = cfgrib.open_datasets(str(target))
        try:
            for dataset in datasets:
                point = self._select_nearest_point(dataset, latitude, longitude)
                if records["date"] is None:
                    records["date"] = self._dataset_time(point)
                for pollutant in pollutants:
                    value = self._extract_pollutant_value(point, pollutant)
                    if value is not None:
                        records[pollutant] = value
        finally:
            for dataset in datasets:
                dataset.close()

        if records["date"] is None:
            records["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return pd.DataFrame([records])

    def _select_nearest_point(self, dataset, latitude: float, longitude: float):
        selectors = {}
        if "latitude" in dataset.coords:
            selectors["latitude"] = latitude
        if "longitude" in dataset.coords:
            lon_values = dataset["longitude"].values
            selectors["longitude"] = longitude % 360.0 if lon_values.max() > 180 else longitude
        return dataset.sel(selectors, method="nearest") if selectors else dataset

    def _dataset_time(self, dataset) -> str:
        for name in ["valid_time", "time"]:
            if name in dataset.coords:
                return pd.to_datetime(dataset[name].values).strftime("%Y-%m-%d")
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _extract_pollutant_value(self, dataset, pollutant: str) -> Optional[float]:
        aliases = self.VARIABLE_ALIASES[pollutant]
        for variable in dataset.data_vars:
            attrs = dataset[variable].attrs
            names = {
                variable.lower(),
                str(attrs.get("GRIB_shortName", "")).lower(),
                str(attrs.get("long_name", "")).lower(),
                str(attrs.get("standard_name", "")).lower(),
            }
            if not aliases.intersection(names):
                continue
            value = dataset[variable].squeeze(drop=True).values
            try:
                if hasattr(value, "item"):
                    value = value.item()
                if pd.isna(value):
                    return None
                return float(value)
            except Exception:
                return None
        return None
