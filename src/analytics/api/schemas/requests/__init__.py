"""
Pydantic Request Models for AirQo Analytics API

Defines the structure and validation for all incoming API requests.
Field names use camelCase aliases matching the wire format; internally
they are stored as snake_case via allow_population_by_field_name=True.

Ground-truth validation rules are derived from analytics/schemas/datadownload.py.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
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
_FILTER_KEYS = ("sites", "device_ids", "device_names", "grid_ids", "cohort_ids")

# Frequencies whose rows are raw or hourly measurements.  A filter request at
# one of these frequencies is limited to MAX_HOURLY_QUERY_DAYS.
_HOURLY_FREQUENCIES = {Frequency.RAW, Frequency.HOURLY}


def _is_hourly_frequency(frequency: Any) -> bool:
    """
    True for the raw and hourly frequencies.

    ``frequency`` is a ``Frequency`` member when it comes from a field default
    and a string when it comes from the request body (``use_enum_values``) or
    from a ``Literal`` field.  A string is compared with the member values.
    """
    if isinstance(frequency, str) and not isinstance(frequency, Frequency):
        return frequency in {member.value for member in _HOURLY_FREQUENCIES}
    return frequency in _HOURLY_FREQUENCIES


def _window_limit_days(frequency: Any) -> int:
    """The longest date range, in days, for a request at ``frequency``."""
    if _is_hourly_frequency(frequency):
        return settings.hourly_query_days()
    return settings.max_query_days


def _normalise_window(start: datetime, end: datetime) -> tuple:
    """Give a naive datetime the UTC zone when the other one carries a zone."""
    if (start.tzinfo is None) != (end.tzinfo is None):
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        else:
            end = end.replace(tzinfo=timezone.utc)
    return start, end


def _check_window_limit(
    start: datetime, end: datetime, max_days: int, label: str = ""
) -> None:
    """
    Reject a window longer than ``max_days`` whole days.

    The comparison uses the full span, so a window of ``max_days`` days plus
    any part of a day is rejected.
    """
    span = end - start
    if span > timedelta(days=max_days):
        raise ValueError(
            f"Date range must not exceed {max_days} days{label}; requested {span}"
        )


class BaseFilterRequest(BaseRequest):
    """
    Common date-range and filter fields shared by data-export and dashboard
    requests.  Enforces:
      - exactly one of sites / device_ids / device_names / grid_ids / cohort_ids
      - grid_ids currently capped at one ID per request
      - filter lists capped at MAX_FILTER_VALUES entries
      - end_date_time > start_date_time, within MAX_HOURLY_QUERY_DAYS for raw
        and hourly data and within MAX_QUERY_DAYS for daily and coarser data
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

    def validate_frequency(self) -> None:
        """
        Check the frequency against the rules of the request.

        Runs first in the cross-field validation, so a request with an invalid
        frequency reports that error before any error about its window.
        BaseFilterRequest accepts every frequency; a subclass with rules of its
        own overrides this method.
        """

    @model_validator(mode="after")
    def end_after_start_and_one_filter(self) -> "BaseFilterRequest":
        """Cross-field validation that runs after all fields are set."""
        self.validate_frequency()

        # Date range check
        start, end = _normalise_window(self.start_date_time, self.end_date_time)
        if start and end and end <= start:
            raise ValueError("endDateTime must be after startDateTime")

        # Window cap. BigQuery prunes by the timestamp partition, so the date
        # range decides how much each request scans. Raw and hourly data get
        # the shorter limit; daily and coarser data get MAX_QUERY_DAYS.
        if start and end:
            frequency = getattr(self, "frequency", None)
            label = f" for {getattr(frequency, 'value', frequency)} data"
            _check_window_limit(start, end, _window_limit_days(frequency), label)

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

    def validate_frequency(self) -> None:
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

    def offers_coarser_frequency(self) -> bool:
        """
        True when the same body is valid at a coarser frequency than the one
        it sent: the frequency is raw or hourly, and the device category
        accepts frequencies other than raw.
        """
        return (
            _is_hourly_frequency(self.frequency)
            and self.device_category != DeviceCategory.MOBILE
        )


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

    def offers_coarser_frequency(self) -> bool:
        """False: this body accepts the raw frequency only."""
        return False

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

    Filtered by country or city (not device/site IDs), and paged by the same
    cursor token the other download endpoints use.
    """

    start_date_time: datetime = Field(..., alias="startDateTime")
    end_date_time: datetime = Field(..., alias="endDateTime")
    country: Optional[str] = Field(None, description="Country filter")
    city: Optional[str] = Field(None, description="City filter")
    cursor: Optional[str] = Field(None, description="Pagination cursor token")

    @model_validator(mode="after")
    def validate_dates_and_filter(self) -> "ForecastDataExportRequest":
        start, end = _normalise_window(self.start_date_time, self.end_date_time)
        if end <= start:
            raise ValueError("endDateTime must be after startDateTime")
        _check_window_limit(start, end, settings.hourly_query_days())
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

    def offers_coarser_frequency(self) -> bool:
        """True when the frequency is raw or hourly."""
        return _is_hourly_frequency(self.frequency)


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


class _DashboardWindowRequest(BaseRequest):
    """
    startDate / endDate pair of the dashboard aggregation requests.

    Each aggregation request is limited to MAX_HOURLY_QUERY_DAYS.
    """

    start_date: datetime = Field(..., alias="startDate")
    end_date: datetime = Field(..., alias="endDate")

    @model_validator(mode="after")
    def within_window_limit(self) -> "_DashboardWindowRequest":
        start, end = _normalise_window(self.start_date, self.end_date)
        _check_window_limit(start, end, settings.hourly_query_days())
        return self


class DailyAveragesRequest(_DashboardWindowRequest):
    """POST /dashboard/historical/daily-averages — per-site averages."""

    pollutant: _DashboardPollutant
    sites: List[str] = Field(..., min_length=1)


class DeviceDailyAveragesRequest(_DashboardWindowRequest):
    """POST /dashboard/historical/daily-averages-devices — per-device averages."""

    pollutant: _DashboardPollutant
    devices: List[str] = Field(..., min_length=1)


class _ExceedancesBase(_DashboardWindowRequest):
    # STANDARDS_MAPPING only defines pm2_5/pm10 — narrowing here turns the
    # Flask KeyError-500 on other pollutants into a 422.
    pollutant: Literal["pm2_5", "pm10"]
    standard: Literal["aqi", "who"]

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


def _validate_report_window(start: datetime, end: datetime) -> None:
    """
    Check the start_time / end_time window of a report or summary request.

    The report and the summary read hourly rows, so the window is limited to
    MAX_HOURLY_QUERY_DAYS on both API versions.

    Raises:
        ValueError: window reversed, zero-length, or wider than the limit.
    """
    start, end = _normalise_window(start, end)

    if start == end:
        raise ValueError("start_time and end_time cannot be the same")
    # The order check runs before the cap, because a reversed window gives a
    # negative span, which is always below the cap.
    if end < start:
        raise ValueError("end_time must be after start_time")

    _check_window_limit(start, end, settings.hourly_query_days())


class AirQualityReportRequest(BaseRequest):
    """
    POST /report — PM aggregates for ONE grid or cohort.

    Body: snake_case ``start_time`` / ``end_time`` (ISO datetimes), window
    non-zero and within MAX_HOURLY_QUERY_DAYS, the limit every request that
    reads hourly rows carries.

    The entity is chosen in the body rather than by path, and DataSummaryRequest
    takes the identical body: grids and cohorts differ only in how membership
    resolves, so one endpoint serves both.
    """

    grid_id: Optional[str] = Field(None, description="Grid identifier")
    cohort_id: Optional[str] = Field(None, description="Cohort identifier")
    start_time: datetime = Field(..., description="Start of the reporting window")
    end_time: datetime = Field(..., description="End of the reporting window")

    @model_validator(mode="after")
    def validate_entity_and_window(self) -> "AirQualityReportRequest":
        provided = [
            kind
            for kind, value in (("grid", self.grid_id), ("cohort", self.cohort_id))
            if (value or "").strip()
        ]
        if len(provided) != 1:
            raise ValueError("Provide exactly one of: grid_id, cohort_id")

        # The stored datetimes are normalised as well, so every downstream
        # comparison sees the same pair the window check saw.
        self.start_time, self.end_time = _normalise_window(
            self.start_time, self.end_time
        )
        _validate_report_window(self.start_time, self.end_time)
        return self

    def entity(self) -> tuple:
        """(kind, entity_id) for the report builder — mirrors DataSummaryRequest."""
        for kind, value in (("grid", self.grid_id), ("cohort", self.cohort_id)):
            cleaned = (value or "").strip()
            if cleaned:
                return kind, cleaned
        raise ValueError("No report entity provided")  # unreachable post-validation


# ---------------------------------------------------------------------------
# Data summary (data-completeness report over the devices-summary table)
# ---------------------------------------------------------------------------


# Request field -> the filter kind the query builder and messages expect.
# devices_summary_query validates against SUMMARY_FILTER_KINDS ("grid",
# "cohort") and get_summary interpolates the bare kind into its no-data
# message, so the *_id suffix is dropped here rather than carried through.
# Module-level rather than a class attribute: pydantic v2 turns a leading
# underscore on a model class into a private attribute.
_SUMMARY_ENTITY_FIELDS = (("grid_id", "grid"), ("cohort_id", "cohort"))


class DataSummaryRequest(BaseRequest):
    """
    POST /summary — data-completeness counts for ONE grid or cohort.

    Body matches AirQualityReportRequest exactly: snake_case ``start_time`` /
    ``end_time`` plus one of ``grid_id`` / ``cohort_id``.  The two endpoints
    describe the same subject over the same window and differ only in what they
    report, so they no longer differ in how they are asked.

    This departs from the Flask wire contract, which used camelCase
    startDateTime/endDateTime and bare grid/cohort keys.  Flask also marked the
    entity optional and crashed with a 500 when none was given; requiring
    exactly one turns that into a clean 422.
    """

    start_time: datetime = Field(..., description="Start of the summary window")
    end_time: datetime = Field(..., description="End of the summary window")
    grid_id: Optional[str] = Field(None, description="Grid identifier")
    cohort_id: Optional[str] = Field(None, description="Cohort identifier")

    @model_validator(mode="after")
    def exactly_one_entity(self) -> "DataSummaryRequest":
        provided = [
            field
            for field, _ in _SUMMARY_ENTITY_FIELDS
            if (getattr(self, field) or "").strip()
        ]
        if len(provided) != 1:
            raise ValueError("Provide exactly one of: grid_id, cohort_id")
        return self

    @model_validator(mode="after")
    def within_window_limit(self) -> "DataSummaryRequest":
        _validate_report_window(self.start_time, self.end_time)
        return self

    def entity(self) -> tuple:
        """(filter_kind, filter_id) for the summary query builder."""
        for field, kind in _SUMMARY_ENTITY_FIELDS:
            value = (getattr(self, field) or "").strip()
            if value:
                return kind, value
        raise ValueError("No summary entity provided")  # unreachable post-validation


# ---------------------------------------------------------------------------
# Public (v3) variants.  Each carries the body and the validation of its v2
# counterpart, and the v3 routes declare these classes as their bodies.
# ---------------------------------------------------------------------------


class PublicAirQualityReportRequest(AirQualityReportRequest):
    """v3 /report body: the v2 body with the same window limit."""


class PublicDataSummaryRequest(DataSummaryRequest):
    """v3 /summary body: the v2 body with the same window limit."""


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
