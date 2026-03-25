"""Adapter for the Copernicus Atmosphere Monitoring Service (CAMS) Global Atmospheric
Composition Forecasts, accessed via the Climate Data Store (CDS) API.

Downloads PM10 and PM2.5 NetCDF-ZIP files for the latest available forecast run.
Files that already exist on disk are skipped to avoid redundant downloads.

CAMS forecast schedule
----------------------
CAMS issues global composition forecasts at 00:00 UTC and 12:00 UTC.
Data becomes available on the CDS roughly 5 hours after the nominal run time
(i.e. 00Z data available ~05:00 UTC, 12Z data available ~17:00 UTC).
The ``leadtime_hour`` parameter selects the forecast offset from the run time
(0 = analysis, 1, 2, …, 120).
"""
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
from pathlib import Path
import concurrent.futures

import cdsapi

from airqo_etl_utils.constants import DeviceNetwork
from airqo_etl_utils.sources.adapter import DataSourceAdapter
from airqo_etl_utils.utils import Result

import logging

logger = logging.getLogger("airflow.task")

# CDS dataset identifier for CAMS global composition forecasts.
_CAMS_DATASET = "cams-global-atmospheric-composition-forecasts"

# CAMS model runs are issued at 00Z and 12Z UTC.
_CAMS_RUNS_UTC: Tuple[int, ...] = (0, 12)

# ~5 hours after the run time before data appears on CDS.
_CAMS_AVAILABILITY_DELAY_HRS: int = 5

# Maximum leadtime supported by the CAMS global forecast (hours).
_CAMS_MAX_LEADTIME_HRS: int = 120

# Variables to download: short-name → CDS API name + default local path.
CAMS_VARIABLES: Dict[str, Dict[str, str]] = {
    "pm10": {
        "cds_name": "particulate_matter_10um",
        "default_path": "/tmp/cams_pm10.zip",
    },
    "pm2p5": {
        "cds_name": "particulate_matter_2.5um",
        "default_path": "/tmp/cams_pm2p5.zip",
    },
}


class CAMSAdapter(DataSourceAdapter):
    """Adapter for the CAMS Global Atmospheric Composition Forecasts (CDS API).

    Downloads PM10 and PM2.5 NetCDF-ZIP files for the latest available forecast
    run, skipping any file that already exists on disk.
    """

    def __init__(self) -> None:
        pass

    def fetch(
        self,
        device: Dict[str, Any] = None,
        dates: Optional[list] = None,
        resolution: Optional[str] = None,
    ) -> Result:
        """Download CAMS PM10 and PM2.5 files for the latest available forecast run.

        Args:
            device: Unused; accepted for interface parity.
            dates: Optional list of ``(start_iso, end_iso)`` tuples. When supplied,
                the first tuple's start date overrides the auto-detected run date.
            resolution: Optional leadtime-hour override as a string (e.g. ``"3"``).
                Defaults to the integer hours elapsed since the latest available run,
                capped at 120.

        Returns:
            :class:`Result` whose ``data`` contains:

            - ``"records"``: empty list (no per-device time-series).
            - ``"meta"``: dict with:

              - ``"files"``: mapping of variable short-name → local file path.
              - ``"run_date"``: ``"YYYY-MM-DD"`` string of the selected forecast run.
              - ``"run_hour"``: UTC run hour (0 or 12).
              - ``"leadtime_hour"``: the forecast lead time requested.
              - ``"skipped"``: list of variable short-names whose files already
                existed and were not re-downloaded.
        """
        try:
            run_date, run_hour, leadtime_hour = self._latest_available_run()

            if dates:
                # Allow callers to pin the date via the dates parameter.
                start_iso = (
                    dates[0][0] if isinstance(dates[0], (tuple, list)) else dates[0]
                )
                try:
                    run_date = datetime.fromisoformat(
                        start_iso.replace("Z", "+00:00")
                    ).strftime("%Y-%m-%d")
                except (ValueError, AttributeError):
                    pass  # keep auto-detected date

            if resolution is not None:
                try:
                    leadtime_hour = int(resolution)
                except (ValueError, TypeError):
                    pass

            downloaded: Dict[str, str] = {}
            skipped: List[str] = []

            def _download_one(short_name: str, cds_name: str, path: str) -> None:
                if Path(path).exists():
                    logger.info(
                        "CAMS: '%s' already exists at '%s', skipping download.",
                        short_name,
                        path,
                    )
                    skipped.append(short_name)
                    downloaded[short_name] = path
                    return

                self._download_variable(
                    cds_name=cds_name,
                    run_date=run_date,
                    run_hour=run_hour,
                    leadtime_hour=leadtime_hour,
                    output_path=path,
                )
                downloaded[short_name] = path
                logger.info("CAMS: '%s' downloaded to '%s'.", short_name, path)

            with concurrent.futures.ThreadPoolExecutor(
                max_workers=len(CAMS_VARIABLES)
            ) as executor:
                futures = {
                    executor.submit(
                        _download_one,
                        short_name,
                        meta["cds_name"],
                        meta["default_path"],
                    ): short_name
                    for short_name, meta in CAMS_VARIABLES.items()
                }
                for future in concurrent.futures.as_completed(futures):
                    exc = future.exception()
                    if exc:
                        raise exc

            return Result(
                data={
                    "records": [],
                    "meta": {
                        "files": downloaded,
                        "run_date": run_date,
                        "run_hour": run_hour,
                        "leadtime_hour": leadtime_hour,
                        "skipped": skipped,
                    },
                },
                error=None,
            )

        except Exception as exc:
            logger.exception("CAMSAdapter.fetch failed: %s", exc)
            return Result(data={"records": [], "meta": {}}, error=str(exc))

    @staticmethod
    def _latest_available_run(
        _now: Optional[datetime] = None,
    ) -> Tuple[str, int, int]:
        """Return ``(date_str, run_hour, leadtime_hour)`` for the most recent
        CAMS forecast run that is already published on the CDS.

        The algorithm walks backwards over run times (12Z today → 00Z today →
        12Z yesterday → …) and returns the first whose expected publication
        time (run time + 5 h) has already passed.

        Args:
            _now: Override the current UTC time (used in tests).

        Returns:
            ``(date_str, run_hour, leadtime_hour)`` where *date_str* is
            ``"YYYY-MM-DD"``, *run_hour* is 0 or 12, and *leadtime_hour* is
            the integer hours elapsed since the run, capped at
            ``_CAMS_MAX_LEADTIME_HRS``.
        """
        now = _now or datetime.now(timezone.utc)

        for days_back in range(3):
            check_date = (now - timedelta(days=days_back)).date()
            for run_hour in reversed(_CAMS_RUNS_UTC):
                run_dt = datetime(
                    check_date.year,
                    check_date.month,
                    check_date.day,
                    run_hour,
                    tzinfo=timezone.utc,
                )
                available_at = run_dt + timedelta(hours=_CAMS_AVAILABILITY_DELAY_HRS)
                if now >= available_at:
                    elapsed = int((now - run_dt).total_seconds() // 3600)
                    leadtime = min(elapsed, _CAMS_MAX_LEADTIME_HRS)
                    return check_date.strftime("%Y-%m-%d"), run_hour, leadtime

        # Hard fallback: yesterday 00Z, leadtime 0.
        fallback = (now - timedelta(days=1)).date()
        return fallback.strftime("%Y-%m-%d"), 0, 0

    @staticmethod
    def _download_variable(
        cds_name: str,
        run_date: str,
        run_hour: int,
        leadtime_hour: int,
        output_path: str,
    ) -> None:
        """Issue a single CDS API request and save the result to *output_path*.

        Args:
            cds_name: CDS variable name (e.g. ``"particulate_matter_10um"``).
            run_date: ``"YYYY-MM-DD"`` string for the forecast base date.
            run_hour: Run initiation time in UTC — must be 0 or 12.
            leadtime_hour: Forecast offset in hours (0–120).
            output_path: Local path where the NetCDF-ZIP file will be saved.

        Raises:
            Exception: Re-raised from ``cdsapi`` if the download fails.
        """
        time_str = f"{run_hour:02d}:00"
        request_payload = {
            "date": run_date,
            "type": "forecast",
            "format": "netcdf_zip",
            "time": time_str,
            "leadtime_hour": str(leadtime_hour),
            "variable": cds_name,
        }
        logger.info(
            "CAMS: requesting '%s' | date=%s time=%s leadtime=%s → '%s'",
            cds_name,
            run_date,
            time_str,
            leadtime_hour,
            output_path,
        )
        try:
            client = cdsapi.Client()
            client.retrieve(_CAMS_DATASET, request_payload, output_path)
        except Exception as exc:
            raise Exception(
                f"CAMS download failed for '{cds_name}' "
                f"(date={run_date}, time={time_str}, leadtime={leadtime_hour}): {exc}"
            ) from exc


# Self-register with the adapter registry.
from airqo_etl_utils.sources.registry import register_adapter  # noqa: E402

register_adapter(DeviceNetwork.COPERNICUS, CAMSAdapter)


def retrieve_cams_variable(variable_name: str, output_zip_path: str) -> None:
    """Download a single CAMS variable to *output_zip_path*.

    This thin wrapper exists so that legacy code (e.g. ``SatelliteUtils``) that
    still calls this function signature continues to work without modification.
    New code should use :class:`CAMSAdapter` directly.

    Args:
        variable_name: CDS API variable name
            (e.g. ``"particulate_matter_10um"``).
        output_zip_path: Local destination path for the downloaded ZIP.

    Raises:
        Exception: If the download fails.
    """
    if Path(output_zip_path).exists():
        logger.info(
            "CAMS (shim): '%s' already exists at '%s', skipping.",
            variable_name,
            output_zip_path,
        )
        return

    run_date, run_hour, leadtime_hour = CAMSAdapter._latest_available_run()
    CAMSAdapter._download_variable(
        cds_name=variable_name,
        run_date=run_date,
        run_hour=run_hour,
        leadtime_hour=leadtime_hour,
        output_path=output_zip_path,
    )
