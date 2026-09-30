"""
Pydantic Response Models for AirQo Analytics API

Defines consistent response envelopes for all API endpoints.

The data payload for BigQuery-backed responses (DataExportResponse,
DashboardChartResponse) intentionally uses List[Dict[str, Any]] rather
than a tightly-typed inner model because the column set varies by pollutant
selection, frequency, and device category.  Tightly-typed sub-models are
kept for endpoints where the shape is fully known (site listing).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BaseResponse(BaseModel):
    """Envelope fields present on every response."""

    status: str = Field(..., description="'success' or 'error'")
    message: Optional[str] = Field(None, description="Human-readable summary")

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ---------------------------------------------------------------------------
# Data export / download
# ---------------------------------------------------------------------------


class DataExportResponse(BaseResponse):
    """
    Response for data export and download endpoints.

    data is a list of flat record dicts whose keys depend on the requested
    pollutants, metadata fields, and weather fields.
    """

    data: List[Dict[str, Any]] = Field(
        default_factory=list, description="Exported records"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "Pagination info: {total_count, has_more, next}; total_count is "
            "the number of records in data"
        ),
    )


#: OpenAPI description of the two media types a download route answers with.
#: ``downloadType: "csv"`` returns a CSV attachment whose pagination state
#: travels in response headers, so the schema names both the CSV content type
#: and those headers alongside the JSON envelope ``response_model`` supplies.
DOWNLOAD_RESPONSES: Dict[int, Dict[str, Any]] = {
    200: {
        "description": (
            "The JSON envelope, or a CSV attachment when the request sets "
            '"downloadType": "csv".'
        ),
        "content": {
            "text/csv": {
                "schema": {
                    "type": "string",
                    "format": "binary",
                    "description": "One header row and up to one page of data rows.",
                }
            }
        },
        "headers": {
            "X-Total-Count": {
                "description": "Records in the CSV body for this page.",
                "schema": {"type": "integer"},
            },
            "X-Has-More": {
                "description": "Whether another page exists.",
                "schema": {"type": "string", "enum": ["true", "false"]},
            },
            "X-Next-Cursor": {
                "description": (
                    "Token to send as cursor on the following request. Present "
                    "while another page exists."
                ),
                "schema": {"type": "string"},
            },
        },
    }
}


# ---------------------------------------------------------------------------
# Dashboard chart
# ---------------------------------------------------------------------------


class DashboardChartResponse(BaseResponse):
    """
    Response for dashboard chart endpoints.

    data is a list of chart-ready dicts; the exact keys depend on chart type
    and the underlying data model (line/bar: {datetime, value, site_id, ...};
    pie: {label, value}).
    """

    chart_type: str = Field(..., description="Chart type that was rendered")
    data: List[Dict[str, Any]] = Field(
        default_factory=list, description="Chart data points"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "Pagination info: {total_count, has_more, next}; total_count is "
            "the number of chart points in data"
        ),
    )


# ---------------------------------------------------------------------------
# Dashboard historical aggregations — wire shapes preserved from Flask,
# including the ever-present "metadata": null in the envelope.
# ---------------------------------------------------------------------------


class DailyAveragesData(BaseModel):
    """Three positionally-aligned parallel arrays (Flask contract)."""

    average_values: List[float] = Field(default_factory=list)
    labels: List[str] = Field(default_factory=list)
    background_colors: List[Optional[str]] = Field(default_factory=list)


class DailyAveragesResponse(BaseResponse):
    data: DailyAveragesData
    metadata: Optional[Any] = None


class ExceedancesResponse(BaseResponse):
    """
    data items: {"total": int, "exceedance"|"exceedances": dict|number,
    plus "site" (site variant) or "device_id" (device variant)}.
    Key naming asymmetry (singular vs plural) is Flask wire contract.
    """

    data: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Optional[Any] = None


# ---------------------------------------------------------------------------
# Monitoring sites  (shape is well-known, use typed sub-model)
# ---------------------------------------------------------------------------


class SiteInfo(BaseModel):
    """Information about a single monitoring site."""

    site_id: str
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    network: str
    device_count: int = 0
    last_measurement: Optional[datetime] = None
    status: str = "unknown"


class MonitoringSiteResponse(BaseResponse):
    """
    Response for monitoring site listing.

    This envelope names its payload `sites` and its count `total_sites`, where
    the export and chart endpoints use `data` and a `metadata` block.  The
    listing returns every site in one pass, so `metadata` stays null here.
    """

    sites: List[SiteInfo] = Field(default_factory=list)
    total_sites: int = 0
    networks: List[str] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
