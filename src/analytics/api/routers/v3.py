"""
FastAPI Router for API v3 (Public)

Public-facing API.  In addition to the global RateLimiterMiddleware (100/min),
each endpoint applies a stricter per-route limit via RouteRateLimit (10/min),
matching the original Flask-based v3 behaviour.
"""

from fastapi import APIRouter, Depends

from api.schemas.requests import (
    DataExportRequest,
    ForecastDataExportRequest,
    RawDataExportRequest,
)
from api.schemas.responses import DataExportResponse
from api.services import DataExportService
from api.middlewares.rate_limiter import RouteRateLimit

router = APIRouter()

# Stricter per-route limit applied to every public endpoint
_v3_rate_limit = RouteRateLimit(limit=10, window=60)


@router.post(
    "/data-download",
    response_model=DataExportResponse,
    dependencies=[Depends(_v3_rate_limit)],
)
async def export_data(
    request: DataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """
    Export air quality data (Public API v3).

    Rate-limited to 10 requests per minute per IP, on top of the global
    100/min middleware.
    """
    return await service.export_data(request)


@router.post(
    "/raw-data",
    response_model=DataExportResponse,
    dependencies=[Depends(_v3_rate_limit)],
)
async def raw_data_export(
    request: RawDataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """
    Export raw air quality data (Public API v3).

    Rate-limited to 10 requests per minute per IP.
    """
    return await service.export_raw_data(request)


@router.post(
    "/forecast-data",
    response_model=DataExportResponse,
    dependencies=[Depends(_v3_rate_limit)],
)
async def forecast_data_export(
    request: ForecastDataExportRequest,
    service: DataExportService = Depends(),
) -> DataExportResponse:
    """
    Export satellite forecast data filtered by country or city (Public API v3).

    Requires at least one of `country` or `city` along with the date range.
    Rate-limited to 10 requests per minute per IP.
    """
    return await service.export_forecast_data(request)
