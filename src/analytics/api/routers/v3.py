"""
FastAPI Router for API v3 (Public)

Public-facing API.  Every route carries the per-route limit
(route_rate_limit): 5 requests per minute per IP on raw-data and 10 on every
other route.  On the routes that page, that limit counts the request that
starts an export, and a request that carries a cursor passes it.  The global
RateLimiterMiddleware applies 100 requests per minute per IP to every
request, the same pair of limits the v2 routes carry.
"""

from fastapi import APIRouter, Depends
from typing import Any, Dict

from api.schemas.requests import (
    DataExportRequest,
    ForecastDataExportRequest,
    PublicAirQualityReportRequest,
    PublicDataSummaryRequest,
    RawDataExportRequest,
)
from api.schemas.responses import DataExportResponse, DOWNLOAD_RESPONSES
from api.services import AirQualityReportService, DataExportService
from api.middlewares.rate_limiter import route_rate_limit

router = APIRouter(dependencies=[Depends(route_rate_limit)])


@router.post(
    "/data-download",
    response_model=DataExportResponse,
    responses=DOWNLOAD_RESPONSES,
)
async def export_data(
    request: DataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """
    Export air quality data (Public API v3).

    The route allows 10 exports per minute for each client IP.  The per-route
    limit counts the request that starts an export, and the requests for later
    pages count only against the global limit of 100 requests per minute.
    """
    return await service.export_data(request)


@router.post(
    "/raw-data",
    response_model=DataExportResponse,
    responses=DOWNLOAD_RESPONSES,
)
async def raw_data_export(
    request: RawDataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """
    Export raw air quality data (Public API v3).

    The route allows 5 exports per minute for each client IP.  The per-route
    limit counts the request that starts an export, and the requests for later
    pages count only against the global limit of 100 requests per minute.
    """
    return await service.export_raw_data(request)


@router.post(
    "/forecast-data",
    response_model=DataExportResponse,
)
async def forecast_data_export(
    request: ForecastDataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """
    Export satellite forecast data filtered by country or city (Public API v3).

    Requires at least one of `country` or `city` along with the date range.
    The route allows 10 exports per minute for each client IP.  The per-route
    limit counts the request that starts an export, and the requests for later
    pages count only against the global limit of 100 requests per minute.
    """
    return await service.export_forecast_data(request)


@router.post("/report")
async def air_quality_report(
    request: PublicAirQualityReportRequest,
    service: AirQualityReportService = Depends(),
) -> Dict[str, Any]:
    """
    Air-quality report for one grid or cohort (Public API v3).

    Takes the same body, applies the same window ceiling and returns the same
    response as the v2 route.  The one difference that follows from being
    public: members marked private in the device registry are dropped before
    the query runs.

    That screening is not yet user-aware — it withholds every private member,
    including ones belonging to the caller.  See _screen_private_members in
    api/models/base/data_processing.py for what closing that gap needs.

    The route allows 10 requests per minute for each client IP, and each
    request runs one BigQuery scan.
    """
    return await service.get_report(request, screen_private=True)


@router.post("/summary")
async def data_summary(
    request: PublicDataSummaryRequest,
    service: DataExportService = Depends(),
) -> Dict[str, Any]:
    """
    Data-completeness counts for one grid or cohort (Public API v3).

    Takes the same body, applies the same window ceiling and returns the same
    response as the v2 route.

    Unlike /report, this is not screened for private members.  The summary
    resolves membership inside its SQL, as a join through the grid and cohort
    metadata tables rather than as a Python list, so there is no list of site
    or device identifiers to hand the registry.  Screening it would mean
    filtering the result rows instead, which is tracked separately.

    Rate-limited to 10 requests per minute per IP.
    """
    return await service.get_summary(request)
