"""
Business Logic Services for AirQo Analytics API

Each service:
  - Accepts a validated Pydantic request model
  - Resolves the correct BigQuery table from config
  - Delegates I/O to AsyncBigQueryApi (thread-pool-wrapped)
  - Raises HTTPException for client errors (400) and server errors (500)
    so the global exception handler in main.py formats the response

Services intentionally do *not* swallow exceptions silently — callers
(route handlers) rely on HTTPException propagation.
"""

from __future__ import annotations

import asyncio
import io
import logging
import math
from abc import ABC
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd
from bson.errors import InvalidId
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from google.cloud import bigquery
from api.utils.bigquery_jobs import query_job_config

from api.models.async_bigquery_api import AsyncBigQueryApi
from api.models.exceedances_repo import ExceedanceRepository
from api.models.base.data_processing import (
    build_grid_diurnal_report,
    build_grid_report,
)
from api.models.data_export import (
    DataExportModel,
    DataExportRequest as DataExportRecord,
)
from api.models.report_template import ReportTemplateModel
from api.models.summary_queries import devices_summary_query
from api.schemas.requests import (
    DailyAveragesRequest,
    DashboardChartRequest,
    DataExportRequest,
    DataSummaryRequest,
    DeviceDailyAveragesRequest,
    DeviceExceedancesRequest,
    ExceedancesRequest,
    ForecastDataExportRequest,
    GridReportRequest,
    MonitoringSiteRequest,
    RawDataExportRequest,
    ReportRequest,
    ReportUpdateRequest,
    ScheduledExportRequest,
)
from api.schemas.responses import (
    DailyAveragesData,
    DailyAveragesResponse,
    DashboardChartResponse,
    DataExportResponse,
    ExceedancesResponse,
    MonitoringSiteResponse,
    SiteInfo,
)
from api.utils.data_cleaning import CleaningContext, build_download_pipeline
from api.utils.data_formatters import (
    compute_airqloud_summary,
    filter_non_private_sites_devices,
    format_to_aqcsv,
    get_validated_filter,
)
from api.utils.messages import FILTER_MSG
from api.utils.pollutants import set_pm25_category_background
from api.utils.pollutants.exceedances import count_standard_categories
from api.utils.utils import Utils
from api.utils.exceptions import ExportRequestNotFound
from config import settings
from constants import (
    DataExportFormat,
    DataExportStatus,
    DataType,
    DeviceCategory,
    Frequency,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_table(datatype: str, device_category: str, frequency: str) -> str:
    """
    Map (datatype, device_category, frequency) → BigQuery table name.

    Calibrated data lives in averaged tables (hourly/daily aggregations).
    """
    # "calibrated" requests use the averaged data tables
    dt = DataType.RAW if datatype == "raw" else DataType.AVERAGED
    dc = DeviceCategory(device_category)
    freq = Frequency(frequency)

    # Weekly/monthly/yearly are computed from daily tables at query time
    if freq in (Frequency.WEEKLY, Frequency.MONTHLY, Frequency.YEARLY):
        freq = Frequency.DAILY

    sources = settings.data_sources()
    table = sources.get(dt, {}).get(dc, {}).get(freq)
    if not table:
        raise HTTPException(
            status_code=400,
            detail=f"No data source configured for datatype={datatype}, "
            f"device_category={device_category}, frequency={frequency}",
        )
    return table


# Filter types that device-registry can screen for private entries.
# airqlouds/grid_ids/cohort_ids have no filterNonPrivate* endpoint and pass
# through: the registry screens site and device IDs, not the containers that
# resolve to them, so a grid or cohort reaches its private members unscreened.
_PRIVACY_FILTERED_TYPES = {"sites", "device_ids", "device_names"}


async def _strip_private(filter_type: str, filter_value: List[str]) -> List[str]:
    """
    Strip private site/device IDs via the device-registry service.

    Fail-closed: if device-registry cannot be reached (the helper swallows
    transport errors and returns None) or reports an error, the request is
    rejected with 503 rather than served unfiltered.  The helper is sync
    urllib3, so it runs off the event loop.
    """
    try:
        result = await asyncio.to_thread(
            filter_non_private_sites_devices, filter_type, filter_value
        )
    except ValueError as exc:
        # The helper rejects empty input lists; schemas prevent this today.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not result or result.get("status") != "success":
        raise HTTPException(
            status_code=503,
            detail="Unable to verify site/device privacy status. "
            "Please try again later.",
        )
    # An all-private request yields an empty list; the parameterized
    # IN UNNEST(...) then matches zero rows, producing the standard
    # "no data found" response.
    return result.get("data", [])


async def _filter_from_request(
    data: Dict[str, Any], *, privacy: bool = True
) -> Tuple[str, List[str]]:
    """
    Extract filter_type and filter_value from a request dict, optionally
    stripping private site/device IDs via the device-registry service.

    Delegates to the shared get_validated_filter utility which already
    handles the sites / device_ids / device_names precedence logic.

    Privacy filtering applies to the data-download / raw-data / scheduled
    export paths only; dashboard and chart endpoints pass privacy=False
    (deliberate — revisit before public cutover).
    """
    filter_type, filter_value = get_validated_filter(data)

    if not filter_type or not filter_value:
        raise HTTPException(status_code=400, detail=FILTER_MSG)

    if privacy and filter_type in _PRIVACY_FILTERED_TYPES:
        filter_value = await _strip_private(filter_type, filter_value)

    return filter_type, filter_value


def _safe_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Convert a DataFrame to JSON-serialisable records (casts non-native types)."""
    serializable = ["int64", "float64", "bool", "object"]
    non_ser = df.select_dtypes(exclude=serializable).columns
    if not non_ser.empty:
        df = df.copy()
        df[non_ser] = df[non_ser].astype(str)
    return df.to_dict("records")


def _csv_response(records: List[Dict[str, Any]], file_name: str) -> StreamingResponse:
    """Render records as a downloadable CSV attachment."""
    buffer = io.StringIO()
    pd.DataFrame(records).to_csv(buffer, index=False)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{file_name}.csv"'},
    )


# Stateless and reusable — steps hold no per-request state and the pipeline
# copies each input, so this single instance is safe under concurrency.
_download_pipeline = build_download_pipeline()


async def _clean_dataframe(
    df: pd.DataFrame,
    *,
    datatype: DataType,
    frequency: Frequency,
    device_category: DeviceCategory,
    pollutants: List[str],
    extra_columns: List[str],
) -> pd.DataFrame:
    """
    Post-process a raw BigQuery result into the API response shape.

    Runs the cleaning pipeline in a worker thread so the (CPU-bound) pandas
    work never blocks the event loop. Empty frames short-circuit inside the
    pipeline. The device category's optional-field set is resolved from config
    here and passed in, keeping the pipeline itself config-free.
    """
    if df.empty:
        return df

    ctx = CleaningContext(
        datatype=datatype,
        frequency=frequency,
        device_category=device_category,
        pollutants=list(pollutants or []),
        extra_columns=list(extra_columns or []),
        optional_fields=set(settings.OPTIONAL_FIELDS.get(device_category, set())),
    )
    return await asyncio.to_thread(_download_pipeline.run, df, ctx)


# ---------------------------------------------------------------------------
# Base service
# ---------------------------------------------------------------------------


class BaseService(ABC):
    """Provides a logger scoped to the concrete subclass name."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(self.__class__.__name__)


# ---------------------------------------------------------------------------
# Data export service
# ---------------------------------------------------------------------------


class DataExportService(BaseService):
    """
    Handles data export and download operations.

    All methods raise HTTPException on validation or data-warehouse failures
    so the global handler can return a consistent error envelope.  When the
    request asks for downloadType=csv, a streaming CSV attachment is returned
    instead of the JSON envelope (optionally in AQCSV column standard).
    """

    async def export_data(
        self, request: DataExportRequest
    ) -> Union[DataExportResponse, StreamingResponse]:
        """Export calibrated or raw air quality data with cursor-based pagination."""
        return await self._run_export(
            request,
            datatype=request.datatype,
            frequency=Frequency(request.frequency),
            dynamic_query=True,
        )

    async def export_raw_data(
        self, request: RawDataExportRequest
    ) -> Union[DataExportResponse, StreamingResponse]:
        """Export unprocessed (raw frequency) air quality data."""
        return await self._run_export(
            request,
            datatype="raw",
            frequency=Frequency.RAW,
            dynamic_query=False,
        )

    @staticmethod
    def _summary_hour(dt: datetime) -> datetime:
        """Truncate to the hour in UTC (Flask formatted "%Y-%m-%dT%H:00:00Z")."""
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        else:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.replace(minute=0, second=0, microsecond=0)

    async def get_summary(self, request: DataSummaryRequest) -> Dict[str, Any]:
        """
        Data-completeness report over the devices-summary table (Flask
        /data/summary): hourly/calibrated/uncalibrated record counts and
        percentages per device and per site, for one grid/cohort.
        """
        filter_kind, filter_id = request.entity()
        start = self._summary_hour(request.start_date_time)
        end = self._summary_hour(request.end_date_time)
        start_str = start.strftime("%Y-%m-%dT%H:00:00Z")
        end_str = end.strftime("%Y-%m-%dT%H:00:00Z")

        query, params = devices_summary_query(filter_kind, filter_id, start, end)
        bq = AsyncBigQueryApi()
        try:
            df = await bq.execute_query_async(
                query, query_job_config(query_parameters=params)
            )
        except Exception as exc:
            self.logger.exception("BigQuery query failed during data summary")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve data"
            ) from exc

        try:
            summary = await asyncio.to_thread(
                compute_airqloud_summary, df, start_str, end_str
            )
        except Exception as exc:
            self.logger.exception("Summary computation failed")
            raise HTTPException(
                status_code=500, detail="Failed to process summary data"
            ) from exc

        if not summary:
            return {
                "status": "success",
                # Flask interpolated the (possibly empty) grid value here —
                # use the requested entity id for a more useful message.
                "message": f"No data found for {filter_kind} {filter_id} "
                f"from {start_str} to {end_str}",
                "data": {},
                "metadata": None,
            }

        return {
            "status": "success",
            "message": "successful",
            "data": summary,
            "metadata": None,
        }

    async def export_forecast_data(
        self, request: ForecastDataExportRequest
    ) -> DataExportResponse:
        """
        Export satellite forecast data filtered by country or city.

        Schema validation guarantees at least one of country/city is present;
        country takes precedence when both are supplied.
        """
        filter_type = "country" if request.country else "city"
        filter_value = request.country or request.city

        table = _resolve_table(
            datatype="raw",
            device_category=DeviceCategory.SATELLITE.value,
            frequency=Frequency.HOURLY.value,
        )

        bq = AsyncBigQueryApi()
        try:
            df, metadata = await bq.query_data_async(
                table=table,
                start_date_time=request.start_date_time.isoformat(),
                end_date_time=request.end_date_time.isoformat(),
                device_category=DeviceCategory.SATELLITE,
                frequency=Frequency.HOURLY,
                data_type=DataType.RAW,
                columns=["pm2_5"],
                where_fields={filter_type: filter_value},
                dynamic_query=False,
                use_cache=True,
            )
        except RuntimeError as exc:
            self.logger.error("BigQuery query failed during forecast data export")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve data"
            ) from exc

        try:
            df = await _clean_dataframe(
                df,
                datatype=DataType.RAW,
                frequency=Frequency.HOURLY,
                device_category=DeviceCategory.SATELLITE,
                pollutants=["pm2_5"],
                extra_columns=[],
            )
        except Exception as exc:
            self.logger.exception("Data cleaning failed during forecast export")
            raise HTTPException(
                status_code=500, detail="Failed to process data"
            ) from exc

        if df.empty:
            return DataExportResponse(
                status="success",
                message="No forecast data found for the specified criteria.",
                data=[],
                metadata={**metadata, "total_count": 0},
            )

        records = _safe_records(df)
        metadata["total_count"] = len(records)
        return DataExportResponse(
            status="success",
            message="Forecast data retrieved successfully.",
            data=records,
            metadata=metadata,
        )

    async def _run_export(
        self,
        request: Union[DataExportRequest, RawDataExportRequest],
        datatype: str,
        frequency: Frequency,
        dynamic_query: bool,
    ) -> Union[DataExportResponse, StreamingResponse]:
        """Shared export pipeline: filter → table → query → format response."""
        req_dict = request.model_dump(by_alias=False)
        filter_type, filter_value = await _filter_from_request(req_dict, privacy=False)

        table = _resolve_table(
            datatype=datatype,
            device_category=request.device_category,
            frequency=frequency.value,
        )

        bq = AsyncBigQueryApi()
        try:
            df, metadata = await bq.query_data_async(
                table=table,
                start_date_time=request.start_date_time.isoformat(),
                end_date_time=request.end_date_time.isoformat(),
                device_category=DeviceCategory(request.device_category),
                frequency=frequency,
                # data_type drives pollutant column selection (calibrated vs
                # raw columns) inside the query builder; distinct from the
                # table resolution above.  Must be a DataType enum, not None.
                data_type=DataType(datatype),
                columns=list(request.pollutants),
                where_fields={filter_type: filter_value},
                dynamic_query=dynamic_query,
                use_cache=True,
                cursor_token=request.cursor,
            )
        except RuntimeError as exc:
            self.logger.error("BigQuery query failed during data export")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve data"
            ) from exc

        try:
            df = await _clean_dataframe(
                df,
                datatype=DataType(datatype),
                frequency=frequency,
                device_category=DeviceCategory(request.device_category),
                pollutants=request.pollutants,
                extra_columns=(request.meta_data_fields or [])
                + (request.weather_fields or []),
            )
        except Exception as exc:
            self.logger.exception("Data cleaning failed during export")
            raise HTTPException(
                status_code=500, detail="Failed to process data"
            ) from exc

        if df.empty:
            return DataExportResponse(
                status="success",
                message="No data found for the specified criteria.",
                data=[],
                metadata={**metadata, "total_count": 0},
            )

        records = _safe_records(df)

        if getattr(request, "download_type", "json") == "csv":
            output_format = getattr(request, "output_format", "airqo-standard")
            if output_format == "aqcsv":
                records = format_to_aqcsv(
                    data=records,
                    pollutants=list(request.pollutants),
                    frequency=frequency,
                )
            return _csv_response(records, f"{frequency.value}-air-quality-data")

        # total_count must describe the records actually returned; the value
        # the query layer set is the pre-cleaning page size.
        metadata["total_count"] = len(records)
        return DataExportResponse(
            status="success",
            message="Data retrieved successfully.",
            data=records,
            metadata=metadata,
        )


# ---------------------------------------------------------------------------
# Dashboard service
# ---------------------------------------------------------------------------


class DashboardService(BaseService):
    """Handles chart and visualisation data for the dashboard."""

    async def get_chart_data(
        self, request: DashboardChartRequest
    ) -> DashboardChartResponse:
        """Fetch time-series data and format it for the requested chart type."""
        req_dict = request.model_dump(by_alias=False)
        # Dashboard/chart endpoints are not privacy-filtered (user decision;
        # revisit before public cutover).
        filter_type, filter_value = await _filter_from_request(req_dict, privacy=False)

        table = _resolve_table(
            datatype="calibrated",
            device_category=request.device_category,
            frequency=request.frequency,
        )

        bq = AsyncBigQueryApi()
        try:
            df, metadata = await bq.query_data_async(
                table=table,
                start_date_time=request.start_date_time.isoformat(),
                end_date_time=request.end_date_time.isoformat(),
                device_category=DeviceCategory(request.device_category),
                frequency=Frequency(request.frequency),
                data_type=DataType.CALIBRATED,
                columns=list(request.pollutants) if request.pollutants else ["pm2_5"],
                where_fields={filter_type: filter_value},
                dynamic_query=True,
                use_cache=True,
            )
        except RuntimeError as exc:
            self.logger.error("BigQuery query failed during get_chart_data")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve chart data"
            ) from exc

        try:
            df = await _clean_dataframe(
                df,
                datatype=DataType.CALIBRATED,
                frequency=Frequency(request.frequency),
                device_category=DeviceCategory(request.device_category),
                pollutants=list(request.pollutants)
                if request.pollutants
                else ["pm2_5"],
                extra_columns=request.meta_data_fields or [],
            )
        except Exception as exc:
            self.logger.exception("Data cleaning failed during chart data retrieval")
            raise HTTPException(
                status_code=500, detail="Failed to process chart data"
            ) from exc

        if df.empty:
            return DashboardChartResponse(
                status="success",
                message="No data found for the specified criteria.",
                chart_type=request.chart_type,
                data=[],
                metadata={**metadata, "total_count": 0},
            )

        records = _safe_records(df)
        chart_data = self._format_for_chart(
            records, request.chart_type, request.pollutants
        )

        # total_count must describe the points actually returned: the value
        # the query layer set is the pre-cleaning row count, and the pie
        # formatter additionally collapses many rows into one point per site.
        metadata["total_count"] = len(chart_data)
        return DashboardChartResponse(
            status="success",
            message="Chart data retrieved successfully.",
            chart_type=request.chart_type,
            data=chart_data,
            metadata=metadata,
        )

    def _format_for_chart(
        self,
        records: List[Dict[str, Any]],
        chart_type: str,
        pollutants: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Reshape flat records into chart-friendly dicts.

        line / bar  →  [{datetime, site_id, <pollutant>: value}, ...]
        pie         →  [{label: site_id, value: mean(<pollutant>)}, ...]
        """
        if not records:
            return []

        pollutant = pollutants[0] if pollutants else "pm2_5"

        if chart_type == "pie":
            # Aggregate mean per site
            from collections import defaultdict

            totals: Dict[str, List[float]] = defaultdict(list)
            for r in records:
                site = r.get("site_id") or r.get("site_name", "unknown")
                val = r.get(pollutant)
                if val is not None:
                    try:
                        totals[site].append(float(val))
                    except (TypeError, ValueError):
                        pass
            return [
                {"label": site, "value": round(sum(vals) / len(vals), 2)}
                for site, vals in totals.items()
                if vals
            ]

        # line / bar — return records as-is (datetime + value columns present)
        return records

    # ------------------------------------------------------------------
    # Historical daily averages
    # ------------------------------------------------------------------

    async def get_daily_averages(
        self, request: DailyAveragesRequest, network: str = "airqo"
    ) -> DailyAveragesResponse:
        """
        Per-site averages over the window (Flask /dashboard/historical/daily-averages).

        Queries the hourly table (as the original did, despite the name) and
        returns three positionally-aligned arrays. `network` only routed Mongo
        lookups in Flask; site labels now come from the BigQuery sites table,
        so it is accepted for wire parity and unused.
        """
        # Not privacy-filtered — dashboard endpoint (user decision).
        sites = list(request.sites)

        df = await self._query_averages(
            request, group_column="site_id", id_list=sites, id_column="site_id"
        )

        bq = AsyncBigQueryApi()
        try:
            sites_df = (
                await bq.get_sites_async(site_ids=sites) if sites else pd.DataFrame()
            )
        except Exception as exc:
            self.logger.exception("Site lookup failed during daily averages")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve data"
            ) from exc

        labels_by_id: Dict[str, str] = {}
        if not sites_df.empty:
            for row in sites_df.itertuples():
                # NaN-safe: a NULL site name must not push a float into labels
                labels_by_id[row.id] = (
                    row.name if isinstance(row.name, str) and row.name else row.id
                )

        values, labels, colors = self._collect_averages(
            df, id_column="site_id", labels_by_id=labels_by_id
        )
        return DailyAveragesResponse(
            status="success",
            message="daily averages successfully fetched",
            data=DailyAveragesData(
                average_values=values, labels=labels, background_colors=colors
            ),
        )

    async def get_device_daily_averages(
        self, request: DeviceDailyAveragesRequest, network: str = "airqo"
    ) -> DailyAveragesResponse:
        """
        Per-device averages (Flask /dashboard/historical/daily-averages-devices).

        Labels are the raw device IDs — the original did no metadata lookup.
        `network` is accepted for wire parity and unused.
        """
        # Not privacy-filtered — dashboard endpoint (user decision).
        devices = list(request.devices)

        df = await self._query_averages(
            request, group_column="device_id", id_list=devices, id_column="device_id"
        )
        values, labels, colors = self._collect_averages(
            df, id_column="device_id", labels_by_id=None
        )
        return DailyAveragesResponse(
            status="success",
            message="daily averages successfully fetched",
            data=DailyAveragesData(
                average_values=values, labels=labels, background_colors=colors
            ),
        )

    async def _query_averages(
        self,
        request: Union[DailyAveragesRequest, DeviceDailyAveragesRequest],
        group_column: str,
        id_list: List[str],
        id_column: str,
    ) -> pd.DataFrame:
        """AVG(pollutant) per site/device over the hourly table, parameterized."""
        table = Utils.table_name(settings.bigquery_hourly_data)
        # request.pollutant is a validated Literal — safe to interpolate;
        # dates and IDs are bound as query parameters.
        query = (
            f"SELECT ROUND(AVG({request.pollutant}), 2) AS value, {group_column} "
            f"FROM {table} "
            f"WHERE timestamp >= @start_date AND timestamp <= @end_date "
            f"AND {id_column} IN UNNEST(@ids) "
            f"GROUP BY {group_column}"
        )
        job_config = query_job_config(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "start_date", "TIMESTAMP", request.start_date
                ),
                bigquery.ScalarQueryParameter(
                    "end_date", "TIMESTAMP", request.end_date
                ),
                bigquery.ArrayQueryParameter("ids", "STRING", id_list),
            ]
        )
        bq = AsyncBigQueryApi()
        try:
            return await bq.execute_query_async(query, job_config)
        except Exception as exc:
            self.logger.exception("BigQuery query failed during daily averages")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve data"
            ) from exc

    @staticmethod
    def _collect_averages(
        df: pd.DataFrame,
        id_column: str,
        labels_by_id: Optional[Dict[str, str]],
    ) -> Tuple[List[float], List[str], List[Optional[str]]]:
        """
        Build the three parallel arrays, preserving Flask's skip rules:
        falsy id, falsy value (0.0 averages are dropped), NaN value, and —
        when a label map is supplied — ids absent from it.
        """
        values: List[float] = []
        labels: List[str] = []
        colors: List[Optional[str]] = []

        if df.empty:
            return values, labels, colors

        for row in df.to_dict("records"):
            entity_id = row.get(id_column)
            value = row.get("value")
            if not entity_id or not value:
                continue
            if isinstance(value, float) and math.isnan(value):
                continue
            if labels_by_id is not None:
                if entity_id not in labels_by_id:
                    continue
                label = labels_by_id[entity_id]
            else:
                label = entity_id
            values.append(float(value))
            labels.append(label)
            # PM2.5 colour scale applied regardless of pollutant — Flask parity
            colors.append(set_pm25_category_background(float(value)))

        return values, labels, colors

    # ------------------------------------------------------------------
    # Exceedances
    # ------------------------------------------------------------------

    # Mongo date_range parses strings with exactly this format (end exclusive)
    _MONGO_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"

    @classmethod
    def _mongo_date_str(cls, dt: datetime) -> str:
        """Render a datetime for the Mongo pipeline in UTC wall-clock.

        strftime discards the UTC offset, so an aware datetime must be
        converted first — otherwise "2024-01-01T00:00:00+03:00" would match
        Mongo documents as 00:00 UTC (a silent 3-hour shift).  Naive
        datetimes are treated as UTC, matching the stored documents.
        """
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime(cls._MONGO_DATE_FORMAT)

    async def get_exceedances(
        self, request: ExceedancesRequest, network: str = "airqo"
    ) -> ExceedancesResponse:
        """
        Per-site exceedance averages from the precomputed MongoDB collection
        (Flask /dashboard/exceedances).  `network` selects the Mongo database.
        Data key is `exceedance` — singular — per the Flask wire contract.
        """
        # Not privacy-filtered — dashboard endpoint (user decision).  The
        # schema requires a non-empty sites list; ExceedanceRepository treats
        # a falsy sites value as "no site filter", so callers must guard.
        sites = list(request.sites)

        start_str = self._mongo_date_str(request.start_date)
        end_str = self._mongo_date_str(request.end_date)
        try:
            docs = await asyncio.to_thread(
                ExceedanceRepository(network).get_exceedances,
                start_str,
                end_str,
                request.pollutant,
                request.standard,
                sites,
            )
        except InvalidId as exc:
            raise HTTPException(status_code=400, detail="Invalid site id") from exc
        except Exception as exc:
            self.logger.exception("Mongo aggregation failed during exceedances")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve data"
            ) from exc

        return ExceedancesResponse(
            status="success",
            message="exceedance data successfully fetched",
            data=docs,
        )

    async def get_device_exceedances(
        self, request: DeviceExceedancesRequest, network: str = "airqo"
    ) -> ExceedancesResponse:
        """
        Per-device exceedance day-counts computed from BigQuery hourly data
        (Flask /dashboard/exceedances-devices).  Data key is `exceedances` —
        plural — per the Flask wire contract (asymmetric with the site
        variant; do not "fix").  `network` is wire parity only.
        """
        # Not privacy-filtered — dashboard endpoint (user decision).
        devices = list(request.devices)

        table = Utils.table_name(settings.bigquery_hourly_data)
        # Hourly rows collapsed to a daily mean per device (UTC calendar day).
        # request.pollutant is a validated Literal — safe to interpolate.
        query = (
            f"SELECT ROUND(AVG({request.pollutant}), 2) AS {request.pollutant}, "
            f"device_id, TIMESTAMP(DATE(timestamp), 'UTC') AS timestamp "
            f"FROM {table} "
            f"WHERE timestamp >= @start_date AND timestamp <= @end_date "
            f"AND device_id IN UNNEST(@devices) "
            f"GROUP BY device_id, timestamp "
            f"ORDER BY device_id, timestamp"
        )
        job_config = query_job_config(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "start_date", "TIMESTAMP", request.start_date
                ),
                bigquery.ScalarQueryParameter(
                    "end_date", "TIMESTAMP", request.end_date
                ),
                bigquery.ArrayQueryParameter("devices", "STRING", devices),
            ]
        )
        bq = AsyncBigQueryApi()
        try:
            df = await bq.execute_query_async(query, job_config)
        except Exception as exc:
            self.logger.exception("BigQuery query failed during device exceedances")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve data"
            ) from exc

        counts = await asyncio.to_thread(
            count_standard_categories, df, request.standard, request.pollutant
        )
        data = [
            {"device_id": device_id, "total": sum(cat.values()), "exceedances": cat}
            for device_id, cat in counts.items()
        ]
        return ExceedancesResponse(
            status="success",
            message="exceedance data successfully fetched",
            data=data,
        )


# ---------------------------------------------------------------------------
# Monitoring service
# ---------------------------------------------------------------------------


class MonitoringService(BaseService):
    """Handles monitoring site information queries."""

    async def get_sites(
        self, request: Optional[MonitoringSiteRequest] = None
    ) -> MonitoringSiteResponse:
        """Retrieve site metadata from BigQuery."""
        bq = AsyncBigQueryApi()
        try:
            site_ids = request.site_ids if request else None
            df = await bq.get_sites_async(site_ids=site_ids)
        except RuntimeError as exc:
            self.logger.error("BigQuery query failed during get_sites")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve site data"
            ) from exc

        if df.empty:
            return MonitoringSiteResponse(
                status="success",
                message="No sites found.",
                sites=[],
                total_sites=0,
                networks=[],
            )

        sites: List[SiteInfo] = []
        networks: set = set()
        for row in df.to_dict("records"):
            try:
                network = str(row.get("network", "unknown"))
                networks.add(network)
                sites.append(
                    SiteInfo(
                        site_id=str(row.get("id", row.get("site_id", ""))),
                        name=str(row.get("name", "")),
                        latitude=float(row["latitude"])
                        if row.get("latitude") is not None
                        else None,
                        longitude=float(row["longitude"])
                        if row.get("longitude") is not None
                        else None,
                        network=network,
                    )
                )
            except Exception:
                continue  # skip malformed rows

        return MonitoringSiteResponse(
            status="success",
            message="Sites retrieved successfully.",
            sites=sites,
            total_sites=len(sites),
            networks=sorted(networks),
        )


# ---------------------------------------------------------------------------
# Grid report service
# ---------------------------------------------------------------------------


class GridReportService(BaseService):
    """
    Handles the grid air-quality report endpoints.

    The heavy lifting (external Grid API call, BigQuery query, pandas
    aggregation) lives in framework-free functions in
    api/models/base/data_processing.py; this service maps their exceptions
    to HTTP status codes and keeps the blocking work off the event loop.
    """

    async def get_report(self, request: GridReportRequest) -> Dict[str, Any]:
        """Full grid report: daily/monthly/annual + site/city/region aggregates."""
        return await self._run(build_grid_report, request)

    async def get_diurnal_report(self, request: GridReportRequest) -> Dict[str, Any]:
        """Diurnal grid report: hour-of-day and day/hour aggregates only."""
        return await self._run(build_grid_diurnal_report, request)

    async def _run(self, builder, request: GridReportRequest) -> Dict[str, Any]:
        """Shared execution path: thread off the blocking builder, map errors."""
        try:
            return await asyncio.to_thread(
                builder, request.grid_id, request.start_time, request.end_time
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            self.logger.exception("Grid report generation failed")
            raise HTTPException(
                status_code=500, detail="Failed to generate grid report"
            ) from exc


# ---------------------------------------------------------------------------
# Scheduled export request service (MongoDB-backed, executed by Celery)
# ---------------------------------------------------------------------------


class ExportRequestService(BaseService):
    """
    Manages scheduled data-export requests.

    POST registers a request in MongoDB with status SCHEDULED; the Celery
    worker (celery_app.py) picks it up, exports to GCS, and attaches
    download links. pymongo is synchronous, so all model calls run via
    asyncio.to_thread.
    """

    async def create(self, request: ScheduledExportRequest) -> Dict[str, Any]:
        """Register a new export request (status SCHEDULED)."""
        req_dict = request.model_dump(by_alias=False)
        filter_type, filter_value = await _filter_from_request(req_dict, privacy=False)

        record = DataExportRecord(
            status=DataExportStatus.SCHEDULED,
            frequency=Frequency(request.frequency),
            export_format=DataExportFormat(request.export_format),
            request_date=datetime.now(timezone.utc),
            start_date=request.start_date_time,
            end_date=request.end_date_time,
            data_links=[],
            request_id="",
            user_id=request.user_id,
            filter_type=filter_type,
            filter_value=filter_value,
            pollutants=list(request.pollutants),
            retries=3,
            meta_data=request.meta_data or {},
        )

        try:
            await asyncio.to_thread(DataExportModel().create_request, record)
        except Exception as exc:
            self.logger.exception("Failed to create export request")
            raise HTTPException(
                status_code=500, detail="Failed to create export request"
            ) from exc

        return {
            "status": "success",
            "message": "Export request successfully created.",
            "data": record.to_api_format(),
        }

    async def list_for_user(self, user_id: str) -> Dict[str, Any]:
        """List all export requests belonging to a user."""
        try:
            requests = await asyncio.to_thread(
                DataExportModel().get_user_requests, user_id
            )
        except Exception as exc:
            self.logger.exception("Failed to list export requests")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve export requests"
            ) from exc

        return {
            "status": "success",
            "message": "Export requests retrieved successfully.",
            "data": [r.to_api_format() for r in requests],
        }

    async def retry(
        self, request_id: str, caller_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reset a request to SCHEDULED with fresh retries so the worker re-runs it.

        Args:
            request_id: The export request to reschedule.
            caller_id: Gateway-asserted user id, when available. Ownership is
                enforced only when it is — see api/dependencies.py for the
                staged rollout. `None` means "unenforceable", not "allowed for
                everyone", and stops being possible once
                REQUIRE_GATEWAY_IDENTITY is on.
        """
        model = DataExportModel()
        try:
            record = await asyncio.to_thread(model.get_request_by_id, request_id)
        except ExportRequestNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc.message)) from exc
        except Exception as exc:
            self.logger.exception("Failed to fetch export request")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve export request"
            ) from exc

        if caller_id is not None and record.user_id != caller_id:
            # 404 rather than 403: a 403 would confirm the id exists, turning
            # this into an oracle for enumerating other users' request ids.
            raise HTTPException(status_code=404, detail="Export request not found")

        record.status = DataExportStatus.SCHEDULED
        record.retries = 3
        success = await asyncio.to_thread(
            model.update_request_status_and_retries, record
        )
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to update export request"
            )

        return {
            "status": "success",
            "message": "Export request rescheduled successfully.",
            "data": record.to_api_format(),
        }


# ---------------------------------------------------------------------------
# Report template service
# ---------------------------------------------------------------------------


class ReportTemplateService(BaseService):
    """
    MongoDB-backed CRUD for report templates (Flask /report/* rebuild).

    Responses use the Flask create_response envelope:
    {"status", "message", "data"?, "metadata": None}; business errors raise
    HTTPException (400/404) with the original Flask messages.  pymongo is
    synchronous, so all model calls run via asyncio.to_thread.
    """

    _VALID_UPDATE_KEYS = ["userId", "reportName", "reportBody"]

    @staticmethod
    def _envelope(message: str, data: Optional[Any] = None) -> Dict[str, Any]:
        return {"status": "success", "message": message, "data": data, "metadata": None}

    async def create_default(
        self, request: ReportRequest, network: str
    ) -> Dict[str, Any]:
        model = ReportTemplateModel(network)
        try:
            if await asyncio.to_thread(model.default_template_exists):
                raise HTTPException(
                    status_code=400, detail="A default template already exist"
                )
            await asyncio.to_thread(
                model.insert_default,
                request.user_id,
                request.report_name,
                request.report_body,
            )
        except HTTPException:
            raise
        except Exception as exc:
            self.logger.exception("Failed to create default report template")
            raise HTTPException(
                status_code=500, detail="Failed to save template"
            ) from exc
        return self._envelope("Default Report Template Saved Successfully")

    async def get_default(self, network: str) -> Dict[str, Any]:
        try:
            report = await asyncio.to_thread(ReportTemplateModel(network).get_default)
        except Exception as exc:
            self.logger.exception("Failed to fetch default report template")
            raise HTTPException(
                status_code=500, detail="Failed to fetch template"
            ) from exc
        return self._envelope(
            "default report successfully fetched", data={"report": report}
        )

    async def update_default(
        self, request: ReportUpdateRequest, network: str
    ) -> Dict[str, Any]:
        update_fields = request.update_fields()
        if not update_fields:
            raise HTTPException(
                status_code=400,
                detail=f"The update fields are empty. "
                f"valid keys are {self._VALID_UPDATE_KEYS}",
            )
        try:
            result = await asyncio.to_thread(
                ReportTemplateModel(network).update_default, update_fields
            )
        except Exception as exc:
            self.logger.exception("Failed to update default report template")
            raise HTTPException(
                status_code=500, detail="Failed to update template"
            ) from exc
        if result.modified_count > 0 or result.matched_count > 0:
            return self._envelope("default reporting template updated successfully")
        raise HTTPException(status_code=404, detail="could not update default template")

    async def create_monthly(
        self, request: ReportRequest, network: str
    ) -> Dict[str, Any]:
        try:
            await asyncio.to_thread(
                ReportTemplateModel(network).insert_monthly,
                request.user_id,
                request.report_name,
                request.report_body,
            )
        except Exception as exc:
            self.logger.exception("Failed to save monthly report")
            raise HTTPException(
                status_code=500, detail="Failed to save report"
            ) from exc
        return self._envelope("Monthly Report Saved Successfully")

    async def list_monthly(self, user_id: str, network: str) -> Dict[str, Any]:
        try:
            reports = await asyncio.to_thread(
                ReportTemplateModel(network).list_for_user, user_id
            )
        except Exception as exc:
            self.logger.exception("Failed to list monthly reports")
            raise HTTPException(
                status_code=500, detail="Failed to fetch reports"
            ) from exc
        if reports:
            return self._envelope(
                "reports successfully fetched", data={"reports": reports}
            )
        raise HTTPException(status_code=404, detail="report(s) not found")

    async def update_monthly(
        self, report_name: str, request: ReportUpdateRequest, network: str
    ) -> Dict[str, Any]:
        update_fields = request.update_fields()
        if not update_fields:
            raise HTTPException(
                status_code=400,
                detail=f"the update fields is empty. "
                f"valid keys are {self._VALID_UPDATE_KEYS}",
            )
        try:
            result = await asyncio.to_thread(
                ReportTemplateModel(network).update_by_name, report_name, update_fields
            )
        except Exception as exc:
            self.logger.exception("Failed to update monthly report")
            raise HTTPException(
                status_code=500, detail="Failed to update report"
            ) from exc
        if result.modified_count > 0 or result.matched_count > 0:
            return self._envelope("report updated successfully")
        raise HTTPException(status_code=404, detail="report not found")

    async def delete_monthly(self, report_name: str, network: str) -> Dict[str, Any]:
        try:
            result = await asyncio.to_thread(
                ReportTemplateModel(network).delete_by_name, report_name
            )
        except Exception as exc:
            self.logger.exception("Failed to delete monthly report")
            raise HTTPException(
                status_code=500, detail="Failed to delete report"
            ) from exc
        if result.deleted_count > 0:
            return self._envelope(f"monthly report {report_name} deleted successfully")
        raise HTTPException(status_code=404, detail="report not found")
