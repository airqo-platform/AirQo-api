"""
Pydantic Request Models for AirQo Analytics API

Defines the structure and validation for all incoming API requests.
Field names use camelCase aliases matching the wire format; internally
they are stored as snake_case via allow_population_by_field_name=True.

Ground-truth validation rules are derived from analytics/schemas/datadownload.py.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from enum import Enum

from config import settings


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class DataType(str, Enum):
    RAW = "raw"
    AVERAGED = "averaged"
    CALIBRATED = "calibrated"
    CONSOLIDATED = "consolidated"


class DeviceCategory(str, Enum):
    LOWCOST = "lowcost"
    BAM = "bam"
    MOBILE = "mobile"
    GAS = "gas"
    GENERAL = "general"


class Frequency(str, Enum):
    RAW = "raw"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class Network(str, Enum):
    AIRQO = "airqo"
    IQAIR = "iqair"
    AIRNOW = "airnow"
    METONE = "metone"


class ChartType(str, Enum):
    LINE = "line"
    PIE = "pie"
    BAR = "bar"


# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------


class BaseRequest(BaseModel):
    """Root configuration applied to all request models."""

    model_config = {
        "use_enum_values": True,
        "populate_by_name": True,  # accept both alias and field name (Pydantic v2)
        "json_encoders": {datetime: lambda v: v.isoformat()},
    }


# ---------------------------------------------------------------------------
# Shared filter base — inherited by DataExportRequest & DashboardChartRequest
# ---------------------------------------------------------------------------

_VALID_POLLUTANTS = {"pm2_5", "pm10"}
_VALID_META_FIELDS = {"latitude", "longitude", "site_id"}
_VALID_WEATHER_FIELDS = {"temperature", "humidity"}
_FILTER_KEYS = {"sites", "device_ids", "device_names", "grid_ids", "cohort_ids"}


class BaseFilterRequest(BaseRequest):
    """
    Common date-range and filter fields shared by data-export and dashboard
    requests.  Enforces:
      - exactly one of sites / device_ids / device_names / grid_ids / cohort_ids
      - grid_ids currently capped at one ID per request
      - filter lists capped at MAX_FILTER_VALUES entries
      - end_date_time > start_date_time, within MAX_QUERY_DAYS
      - start_date_time not in the future
    """

    start_date_time: datetime = Field(..., alias="startDateTime")
    end_date_time: datetime = Field(..., alias="endDateTime")

    network: Network = Field(Network.AIRQO, description="Network to query data from")
    device_category: DeviceCategory = Field(
        DeviceCategory.LOWCOST, description="Device category"
    )
    pollutants: List[Literal["pm2_5", "pm10"]] = Field(
        default_factory=list, description="Pollutants to include"
    )

    # Filter fields — exactly one must be supplied
    sites: Optional[List[str]] = Field(
        None, alias="sites", description="Site IDs to filter by"
    )
    device_ids: Optional[List[str]] = Field(
        None, alias="device_ids", description="Device IDs to filter by"
    )
    device_names: Optional[List[str]] = Field(
        None, alias="device_names", description="Device names to filter by"
    )
    grid_ids: Optional[List[str]] = Field(
        None,
        alias="grid_ids",
        description="Grid IDs to filter by (currently limited to one)",
    )
    cohort_ids: Optional[List[str]] = Field(
        None,
        alias="cohort_ids",
        description="Cohort IDs to filter by (currently limited to one)",
    )
    meta_data_fields: Optional[
        List[Literal["latitude", "longitude", "site_id"]]
    ] = Field(
        None, alias="metaDataFields", description="Extra metadata columns to include"
    )
    weather_fields: Optional[List[Literal["temperature", "humidity"]]] = Field(
        None, alias="weatherFields", description="Weather columns to include"
    )
    cursor: Optional[str] = Field(None, description="Pagination cursor token")

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("start_date_time", mode="after")
    @classmethod
    def start_not_in_future(cls, v: datetime) -> datetime:
        now = datetime.now(tz=timezone.utc)
        aware = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if aware > now:
            raise ValueError("startDateTime must not be in the future")
        return v

    @model_validator(mode="after")
    def end_after_start_and_one_filter(self) -> "BaseFilterRequest":
        """Cross-field validation that runs after all fields are set."""
        # Date range check
        start = self.start_date_time
        end = self.end_date_time
        if start and end and end <= start:
            raise ValueError("endDateTime must be after startDateTime")

        # Window cap. BigQuery prunes by the timestamp partition, so an
        # unbounded window is a full-table scan — billable, and reachable
        # unauthenticated on v3. GridReportRequest has always capped its own
        # window; this applies the same discipline to every filter request.
        if start and end:
            max_days = settings.max_query_days
            if (end - start).days > max_days:
                raise ValueError(
                    f"Date range must not exceed {max_days} days; "
                    f"requested {(end - start).days}"
                )

        # Filter exclusivity check
        provided = {
            k: v
            for k, v in {
                "sites": self.sites,
                "device_ids": self.device_ids,
                "device_names": self.device_names,
                "grid_ids": self.grid_ids,
                "cohort_ids": self.cohort_ids,
            }.items()
            if v is not None and len(v) > 0
        }
        if len(provided) == 0:
            raise ValueError(
                "Provide exactly one of: sites, device_ids, device_names, grid_ids, cohort_ids"
            )
        if len(provided) > 1:
            raise ValueError(
                f"Only one filter allowed at a time; received: {list(provided.keys())}"
            )

        # Each element becomes an entry in an IN UNNEST(...) array; an
        # unbounded list is both a huge query and a large request body.
        filter_name, filter_values = next(iter(provided.items()))
        if len(filter_values) > settings.max_filter_values:
            raise ValueError(
                f"{filter_name} must not exceed {settings.max_filter_values} "
                f"values; received {len(filter_values)}"
            )

        # TODO: Remove after reviewing grid sizes — grids can contain a large
        # number of devices, so cap requests to a single grid for now.
        if self.grid_ids is not None and len(self.grid_ids) > 1:
            raise ValueError("Only one grid ID is currently supported per request")
        if self.cohort_ids is not None and len(self.cohort_ids) > 1:
            raise ValueError("Only one cohort ID is currently supported per request")

        return self


# ---------------------------------------------------------------------------
# Data export / download
# ---------------------------------------------------------------------------


class DataExportRequest(BaseFilterRequest):
    """
    Request model for data export and download operations.

    Supports JSON and CSV output, calibrated and raw data types,
    and cursor-based pagination for large result sets.
    """

    frequency: Frequency = Field(
        Frequency.DAILY, description="Data aggregation frequency"
    )
    datatype: DataType = Field(DataType.CALIBRATED, description="Data type to export")
    download_type: Literal["json", "csv"] = Field(
        "json", alias="downloadType", description="Response format"
    )
    output_format: Literal["airqo-standard", "aqcsv"] = Field(
        "airqo-standard", alias="outputFormat", description="CSV column standard"
    )
    minimum: bool = Field(
        False, description="Return minimal column set (excludes metadata/weather)"
    )

    @model_validator(mode="after")
    def validate_datatype_frequency_category(self) -> "DataExportRequest":
        if self.datatype == DataType.CALIBRATED and self.frequency == Frequency.RAW:
            raise ValueError(
                "Calibrated data is not available at 'raw' frequency; "
                "use hourly, daily, weekly, monthly, or yearly."
            )
        if (
            self.device_category == DeviceCategory.MOBILE
            and self.frequency != Frequency.RAW
        ):
            raise ValueError("Mobile devices only support frequency='raw'")
        return self


# ---------------------------------------------------------------------------
# Raw data download (subset of DataExportRequest, always raw datatype)
# ---------------------------------------------------------------------------


class RawDataExportRequest(BaseFilterRequest):
    """
    Request model for raw (unprocessed) data downloads.

    Frequency must be 'raw'; datatype is fixed to 'raw'.
    """

    frequency: Literal["raw"] = Field(
        "raw", description="Must be 'raw' for this endpoint"
    )
    datatype: Literal["raw"] = Field("raw", description="Always raw data")
    download_type: Literal["json", "csv"] = Field(
        "json", alias="downloadType", description="Response format"
    )
    output_format: Literal["airqo-standard", "aqcsv"] = Field(
        "airqo-standard", alias="outputFormat"
    )


# ---------------------------------------------------------------------------
# Forecast data download
# ---------------------------------------------------------------------------


class ForecastDataExportRequest(BaseRequest):
    """
    Request model for forecast data downloads.

    Filtered by country or city (not device/site IDs).
    """

    start_date_time: datetime = Field(..., alias="startDateTime")
    end_date_time: datetime = Field(..., alias="endDateTime")
    country: Optional[str] = Field(None, description="Country filter")
    city: Optional[str] = Field(None, description="City filter")

    @model_validator(mode="after")
    def validate_dates_and_filter(self) -> "ForecastDataExportRequest":
        if (
            self.start_date_time
            and self.end_date_time
            and self.end_date_time <= self.start_date_time
        ):
            raise ValueError("endDateTime must be after startDateTime")
        if not self.country and not self.city:
            raise ValueError("At least one of 'country' or 'city' must be provided")
        return self


# ---------------------------------------------------------------------------
# Dashboard chart
# ---------------------------------------------------------------------------


class DashboardChartRequest(BaseFilterRequest):
    """
    Request model for dashboard chart data.

    Inherits all filter and date-range validation from BaseFilterRequest.
    """

    frequency: Frequency = Field(
        Frequency.DAILY, description="Data aggregation frequency"
    )
    chart_type: ChartType = Field(
        ..., alias="chartType", description="Chart type to render"
    )
    organisation_name: Optional[str] = Field(
        None, alias="organisationName", description="Organisation name filter"
    )


# ---------------------------------------------------------------------------
# Dashboard historical aggregations (daily averages / exceedances)
#
# Wire contract inherited from the Flask dashboard endpoints: a SINGULAR
# `pollutant`, `startDate`/`endDate` aliases, and a plain sites/devices list
# (no exactly-one-filter rule).  Flask marked the lists optional but crashed
# with a 500 when they were absent/empty; requiring min_length=1 turns that
# into a clean 422 without losing any working behaviour.
# ---------------------------------------------------------------------------

# Flask whitelist for the daily-averages queries (events.py guard)
_DashboardPollutant = Literal["pm2_5", "pm10", "no2", "pm1"]


class DailyAveragesRequest(BaseRequest):
    """POST /dashboard/historical/daily-averages — per-site averages."""

    pollutant: _DashboardPollutant
    start_date: datetime = Field(..., alias="startDate")
    end_date: datetime = Field(..., alias="endDate")
    sites: List[str] = Field(..., min_length=1)


class DeviceDailyAveragesRequest(BaseRequest):
    """POST /dashboard/historical/daily-averages-devices — per-device averages."""

    pollutant: _DashboardPollutant
    start_date: datetime = Field(..., alias="startDate")
    end_date: datetime = Field(..., alias="endDate")
    devices: List[str] = Field(..., min_length=1)


class _ExceedancesBase(BaseRequest):
    # STANDARDS_MAPPING only defines pm2_5/pm10 — narrowing here turns the
    # Flask KeyError-500 on other pollutants into a 422.
    pollutant: Literal["pm2_5", "pm10"]
    standard: Literal["aqi", "who"]
    start_date: datetime = Field(..., alias="startDate")
    end_date: datetime = Field(..., alias="endDate")

    @field_validator("standard", mode="before")
    @classmethod
    def _lowercase_standard(cls, v: Any) -> Any:
        return str(v).lower() if isinstance(v, str) else v


class ExceedancesRequest(_ExceedancesBase):
    """POST /dashboard/exceedances — per-site exceedance averages (MongoDB)."""

    sites: List[str] = Field(..., min_length=1)


class DeviceExceedancesRequest(_ExceedancesBase):
    """POST /dashboard/exceedances-devices — per-device counts (BigQuery)."""

    devices: List[str] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Grid air-quality report
# ---------------------------------------------------------------------------


class GridReportRequest(BaseRequest):
    """
    Request model for the grid air-quality report endpoints
    (POST /grid/report and /grid/report/diurnal).

    Wire contract is inherited from the original Flask API: snake_case body
    keys ``grid_id``, ``start_time``, ``end_time`` (ISO datetimes), window
    must be non-zero and at most 12 months.
    """

    grid_id: str = Field(..., min_length=1, description="Grid identifier")
    start_time: datetime = Field(..., description="Start of the reporting window")
    end_time: datetime = Field(..., description="End of the reporting window")

    @model_validator(mode="after")
    def validate_window(self) -> "GridReportRequest":
        # Normalise mixed naive/aware datetimes so the subtraction below (and
        # all downstream comparisons) can't raise TypeError.
        if (self.start_time.tzinfo is None) != (self.end_time.tzinfo is None):
            if self.start_time.tzinfo is None:
                self.start_time = self.start_time.replace(tzinfo=timezone.utc)
            else:
                self.end_time = self.end_time.replace(tzinfo=timezone.utc)

        if self.start_time == self.end_time:
            raise ValueError("start_time and end_time cannot be the same")
        if (self.end_time - self.start_time).days > 365:
            raise ValueError("Time range must not exceed 12 months")
        return self


# ---------------------------------------------------------------------------
# Data summary (data-completeness report over the devices-summary table)
# ---------------------------------------------------------------------------


class DataSummaryRequest(BaseRequest):
    """
    POST /data/summary — Flask wire contract: startDateTime/endDateTime plus
    ONE of grid / cohort.  (Flask marked them optional and crashed with a 500
    when none was given — requiring exactly one turns that into a clean 422.)
    """

    start_date_time: datetime = Field(..., alias="startDateTime")
    end_date_time: datetime = Field(..., alias="endDateTime")
    grid: Optional[str] = None
    cohort: Optional[str] = None

    @model_validator(mode="after")
    def exactly_one_entity(self) -> "DataSummaryRequest":
        provided = [
            kind for kind in ("grid", "cohort") if (getattr(self, kind) or "").strip()
        ]
        if len(provided) != 1:
            raise ValueError("Provide exactly one of: grid, cohort")
        return self

    def entity(self) -> tuple:
        """(filter_kind, filter_id) for the summary query builder."""
        for kind in ("grid", "cohort"):
            value = (getattr(self, kind) or "").strip()
            if value:
                return kind, value
        raise ValueError("No summary entity provided")  # unreachable post-validation


# ---------------------------------------------------------------------------
# Report templates (MongoDB-backed CRUD)
# ---------------------------------------------------------------------------


class ReportRequest(BaseRequest):
    """Create a report template (default or monthly). Flask wire contract:
    camelCase keys userId / reportName / reportBody, all required."""

    user_id: str = Field(..., alias="userId", min_length=1)
    report_name: str = Field(..., alias="reportName", min_length=1)
    report_body: Dict[str, Any] = Field(..., alias="reportBody")


class ReportUpdateRequest(BaseRequest):
    """Partial update — any subset of the create fields. An all-empty body
    is rejected at the service layer with the Flask 400 message."""

    user_id: Optional[str] = Field(None, alias="userId")
    report_name: Optional[str] = Field(None, alias="reportName")
    report_body: Optional[Dict[str, Any]] = Field(None, alias="reportBody")

    def update_fields(self) -> Dict[str, Any]:
        """Fields present in the request body, keyed by their snake_case
        storage names.  exclude_unset (not exclude_none) so an explicit
        {"reportBody": null} stores null for the field ($set, not $unset),
        as Flask did."""
        return self.model_dump(by_alias=False, exclude_unset=True)


# ---------------------------------------------------------------------------
# Scheduled data export (MongoDB-backed, processed by the Celery worker)
# ---------------------------------------------------------------------------


class ScheduledExportRequest(BaseFilterRequest):
    """
    Request model for creating a scheduled data-export request
    (POST /data-export).

    Unlike the synchronous download endpoints, this only *registers* the
    request (MongoDB, status SCHEDULED); the Celery worker executes the
    export to GCS and attaches download links.
    """

    # Constrained because user_id is not just a lookup key: DataExportRecord
    # interpolates it into a GCS blob path, into the prefix of a
    # list_blobs()+delete() sweep, and into a WRITE_TRUNCATE BigQuery table
    # name. Unrestricted, a caller could write outside their own folder,
    # delete other users' exports, or break the table reference with a dot.
    user_id: str = Field(
        ...,
        alias="userId",
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="Requesting user ID (alphanumeric, underscore and hyphen only)",
    )
    frequency: Literal["hourly", "daily", "raw"] = Field(
        ..., description="Export data frequency"
    )
    export_format: Literal["csv", "json"] = Field(
        ..., alias="exportFormat", description="File format of the exported data"
    )
    meta_data: Optional[Dict[str, Any]] = Field(
        default_factory=dict, alias="metaData", description="Optional export metadata"
    )

    @model_validator(mode="after")
    def reject_unsupported_worker_filters(self) -> "ScheduledExportRequest":
        # The Celery worker's data_export_query only handles sites/devices —
        # accepting grid_ids here would register a request that fails on every
        # beat tick until its retries are exhausted.
        # Truthiness (not `is not None`): an empty list means "no grid
        # filter", same as the base validator treats it.
        if self.grid_ids or self.cohort_ids:
            raise ValueError(
                "grid_ids and cohort_ids are not yet supported for scheduled exports"
            )
        return self


# ---------------------------------------------------------------------------
# Monitoring sites
# ---------------------------------------------------------------------------


class MonitoringSiteRequest(BaseRequest):
    """Request model for monitoring site information."""

    network: Optional[Network] = Field(None, description="Network filter")
    site_ids: Optional[List[str]] = Field(
        None, alias="siteIds", description="Specific site IDs"
    )
    include_device_info: bool = Field(True, alias="includeDeviceInfo")
    include_location: bool = Field(True, alias="includeLocation")
