"""
FastAPI Router for API v2

Internal analytics API.  All routes are protected by the global
RateLimiterMiddleware (100 req/min per IP).  Error handling is done via
global exception handlers in main.py — services raise HTTPException
directly, so route handlers stay thin.
"""

from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, Optional

from api.dependencies import optional_caller_id, resolve_user_id
from api.schemas.requests import (
    DailyAveragesRequest,
    DataExportRequest,
    DataSummaryRequest,
    DashboardChartRequest,
    DeviceDailyAveragesRequest,
    DeviceExceedancesRequest,
    ExceedancesRequest,
    GridReportRequest,
    RawDataExportRequest,
    ReportRequest,
    ReportUpdateRequest,
    ScheduledExportRequest,
)
from api.schemas.responses import (
    DailyAveragesResponse,
    DataExportResponse,
    DashboardChartResponse,
    ExceedancesResponse,
    MonitoringSiteResponse,
)
from api.services import (
    DashboardService,
    DataExportService,
    ExportRequestService,
    GridReportService,
    MonitoringService,
    ReportTemplateService,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Data export / download
# ---------------------------------------------------------------------------


@router.post("/data-download", response_model=DataExportResponse)
async def data_download(
    request: DataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """Download calibrated air quality data with flexible filtering and format options."""
    return await service.export_data(request)


@router.post("/raw-data", response_model=DataExportResponse)
async def raw_data_export(
    request: RawDataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """Export raw (unprocessed) air quality measurements."""
    return await service.export_raw_data(request)


@router.post("/data/summary")
async def data_summary(
    request: DataSummaryRequest,
    service: DataExportService = Depends(),
) -> Dict[str, Any]:
    """Data-completeness report for one airqloud/grid/cohort: hourly,
    calibrated, and uncalibrated record counts and percentages per site
    and device over the requested window."""
    return await service.get_summary(request)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@router.post("/dashboard/chart/data", response_model=DashboardChartResponse)
async def chart_data(
    request: DashboardChartRequest,
    service: DashboardService = Depends(),
) -> DashboardChartResponse:
    """Get formatted chart data for dashboard visualisation (line, bar, pie)."""
    return await service.get_chart_data(request)


@router.post("/dashboard/chart/d3/data", response_model=DashboardChartResponse)
async def d3_chart_data(
    request: DashboardChartRequest,
    service: DashboardService = Depends(),
) -> DashboardChartResponse:
    """Get data formatted specifically for D3.js chart libraries."""
    return await service.get_chart_data(request)


@router.get("/dashboard/sites", response_model=MonitoringSiteResponse)
async def monitoring_sites(
    service: MonitoringService = Depends(),
) -> MonitoringSiteResponse:
    """Retrieve monitoring site information including location and status."""
    return await service.get_sites()


@router.post(
    "/dashboard/historical/daily-averages", response_model=DailyAveragesResponse
)
async def daily_averages(
    request: DailyAveragesRequest,
    network: str = Query("airqo"),
    service: DashboardService = Depends(),
) -> DailyAveragesResponse:
    """Per-site daily average of one pollutant as three parallel arrays."""
    return await service.get_daily_averages(request, network)


@router.post(
    "/dashboard/historical/daily-averages-devices", response_model=DailyAveragesResponse
)
async def daily_averages_devices(
    request: DeviceDailyAveragesRequest,
    network: str = Query("airqo"),
    service: DashboardService = Depends(),
) -> DailyAveragesResponse:
    """Per-device daily average of one pollutant as three parallel arrays."""
    return await service.get_device_daily_averages(request, network)


@router.post("/dashboard/exceedances", response_model=ExceedancesResponse)
async def exceedances(
    request: ExceedancesRequest,
    network: str = Query("airqo"),
    service: DashboardService = Depends(),
) -> ExceedancesResponse:
    """Per-site exceedance averages (aqi/who standards) from precomputed data."""
    return await service.get_exceedances(request, network)


@router.post("/dashboard/exceedances-devices", response_model=ExceedancesResponse)
async def exceedances_devices(
    request: DeviceExceedancesRequest,
    network: str = Query("airqo"),
    service: DashboardService = Depends(),
) -> ExceedancesResponse:
    """Per-device counts of days in each exceedance category."""
    return await service.get_device_exceedances(request, network)


# ---------------------------------------------------------------------------
# Grid air-quality report
# ---------------------------------------------------------------------------


@router.post("/grid/report")
async def grid_report(
    request: GridReportRequest,
    service: GridReportService = Depends(),
) -> Dict[str, Any]:
    """
    Full air-quality report for a grid: daily/monthly/annual PM aggregates
    plus site, city, country and region-level statistics.

    Body: {"grid_id": "...", "start_time": ISO, "end_time": ISO} (max 12 months).
    """
    return await service.get_report(request)


@router.post("/grid/report/diurnal")
async def grid_report_diurnal(
    request: GridReportRequest,
    service: GridReportService = Depends(),
) -> Dict[str, Any]:
    """
    Diurnal (hour-of-day) air-quality report for a grid.

    Same request contract as /grid/report; response contains only the
    hourly-pattern aggregates.
    """
    return await service.get_diurnal_report(request)


# ---------------------------------------------------------------------------
# Scheduled data export (MongoDB-backed, executed by the Celery worker)
# ---------------------------------------------------------------------------


@router.post("/data-export", status_code=201)
async def create_export_request(
    request: ScheduledExportRequest,
    service: ExportRequestService = Depends(),
) -> Dict[str, Any]:
    """
    Register a scheduled data-export request.

    The request is stored with status SCHEDULED; the Celery worker exports
    the data to GCS and attaches download links when done.
    """
    return await service.create(request)


@router.get("/data-export")
async def list_export_requests(
    user_id: str = Depends(resolve_user_id),
    service: ExportRequestService = Depends(),
) -> Dict[str, Any]:
    """List all scheduled export requests for a user."""
    return await service.list_for_user(user_id)


@router.patch("/data-export")
async def retry_export_request(
    requestId: str = Query(
        ..., min_length=1, description="Export request to reschedule"
    ),
    caller_id: Optional[str] = Depends(optional_caller_id),
    service: ExportRequestService = Depends(),
) -> Dict[str, Any]:
    """Reset an export request to SCHEDULED with fresh retries.

    When the gateway asserts an identity, the request must belong to that
    user — otherwise any caller could reschedule anyone's export.
    """
    return await service.retry(requestId, caller_id=caller_id)


# ---------------------------------------------------------------------------
# Report templates (MongoDB-backed CRUD; Flask wire contract).
# Note: POST on /report/monthly/{report_name} is an UPDATE — the original
# Flask API bound the update to POST, so the verb is preserved.
# ---------------------------------------------------------------------------


@router.post("/report/default_template", status_code=201)
async def create_default_report_template(
    request: ReportRequest,
    network: str = Query("airqo"),
    service: ReportTemplateService = Depends(),
) -> Dict[str, Any]:
    """Create the default report template (400 if one already exists)."""
    return await service.create_default(request, network)


@router.get("/report/default_template")
async def get_default_report_template(
    network: str = Query("airqo"),
    service: ReportTemplateService = Depends(),
) -> Dict[str, Any]:
    """Fetch the default report template ({} when none exists)."""
    return await service.get_default(network)


@router.patch("/report/default_template", status_code=202)
async def update_default_report_template(
    request: ReportUpdateRequest,
    network: str = Query("airqo"),
    service: ReportTemplateService = Depends(),
) -> Dict[str, Any]:
    """Partially update the default report template."""
    return await service.update_default(request, network)


@router.post("/report/monthly", status_code=201)
async def create_monthly_report(
    request: ReportRequest,
    network: str = Query("airqo"),
    service: ReportTemplateService = Depends(),
) -> Dict[str, Any]:
    """Save a monthly report."""
    return await service.create_monthly(request, network)


@router.get("/report/monthly")
async def get_monthly_reports(
    user_id: str = Depends(resolve_user_id),
    network: str = Query("airqo"),
    service: ReportTemplateService = Depends(),
) -> Dict[str, Any]:
    """List a user's monthly reports (404 when none exist)."""
    return await service.list_monthly(user_id, network)


@router.post("/report/monthly/{report_name}", status_code=202)
async def update_monthly_report(
    report_name: str,
    request: ReportUpdateRequest,
    network: str = Query("airqo"),
    service: ReportTemplateService = Depends(),
) -> Dict[str, Any]:
    """Update a monthly report by name (Flask bound updates to POST)."""
    return await service.update_monthly(report_name, request, network)


@router.delete("/report/monthly/{report_name}")
async def delete_monthly_report(
    report_name: str,
    network: str = Query("airqo"),
    service: ReportTemplateService = Depends(),
) -> Dict[str, Any]:
    """Delete a monthly report by name."""
    return await service.delete_monthly(report_name, network)
