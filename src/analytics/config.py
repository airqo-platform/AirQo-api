"""
Application settings, resolved from the environment via pydantic-settings.
"""

import os
import re
from pathlib import Path
from typing import ClassVar, Dict, List, Optional, Any, Set
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, Field, field_validator, SecretStr
from constants import DataType, DeviceCategory, Frequency

# BigQuery identifiers: letters, digits, underscore and hyphen (project IDs
# carry hyphens), in one to three dot-separated parts. Shared with
# api.utils.utils.Utils.table_name so the startup check and the interpolation
# site agree on what is acceptable.
# The legacy ``project:dataset.table`` separator is accepted alongside the
# standard dotted form: rejecting it would turn a validly-configured
# deployment into a startup failure that takes down every endpoint.
TABLE_NAME_RE = re.compile(r"[A-Za-z0-9_-]+([.:][A-Za-z0-9_-]+){0,2}")


class BaseConfig(BaseSettings):
    """Base configuration shared across all environments."""

    # -------------------------------------------------------------------------
    # Pydantic v2 settings — unknown env vars are silently ignored so the
    # shared .env file can carry other services' variables without causing
    # validation errors.
    # -------------------------------------------------------------------------
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # silently discard unknown env vars
        populate_by_name=True,  # allow both alias and field name
    )

    # Application settings
    # validation_alias maps the env var name to the field when they differ.
    # APP_ENV is the current name; FLASK_ENV is accepted as a deprecated
    # fallback so existing configmaps keep working through the rename. The
    # value is load-bearing beyond logging — it selects the Mongo URI and
    # gates the API docs — so a silent default here picks the wrong database.
    app_env: str = Field(
        default="production",
        validation_alias=AliasChoices("APP_ENV", "FLASK_ENV"),
    )
    # Signs pagination cursor tokens (api/utils/cursor_utils.py). A predictable
    # key means forgeable cursors, and cursor contents reach a BigQuery WHERE
    # clause — so deployed environments must set a real one. The default exists
    # only so local dev and the test suite work out of the box.
    DEFAULT_SECRET_KEY: ClassVar[str] = "default-secret-key"
    secret_key: SecretStr = Field(
        default=DEFAULT_SECRET_KEY, validation_alias="SECRET_KEY"
    )

    @field_validator("secret_key")
    @classmethod
    def reject_default_secret_outside_dev(cls, v: SecretStr, info: Any) -> SecretStr:
        """Fail fast rather than ship a guessable cursor-signing key."""
        app_env = (info.data.get("app_env") or "").lower()
        if app_env not in ("development", "dev", "test", "testing"):
            secret = v.get_secret_value() if hasattr(v, "get_secret_value") else str(v)
            if secret == cls.DEFAULT_SECRET_KEY:
                raise ValueError(
                    "SECRET_KEY must be set to a non-default value when "
                    f"APP_ENV={app_env!r}. It signs pagination cursors; the "
                    "default key would let callers forge them."
                )
        return v

    # Google Cloud settings
    google_application_credentials: Optional[str] = Field(
        default=None, validation_alias="GOOGLE_APPLICATION_CREDENTIALS"
    )

    # Redis settings
    cache_key_prefix: str = Field(
        default="Analytics-production", validation_alias="CACHE_KEY_PREFIX"
    )
    cache_redis_host: str = Field(default="localhost", validation_alias="REDIS_SERVER")
    cache_redis_port: int = Field(default=6379, validation_alias="REDIS_PORT")
    # Built from host+port by the validator below; can be overridden directly.
    cache_redis_url: Optional[str] = Field(default=None)

    @field_validator("cache_redis_url", mode="before")
    @classmethod
    def build_redis_url(cls, v: Optional[str], info: Any) -> Optional[str]:
        """Auto-build Redis URL from host+port when not explicitly set."""
        if v is None:
            data = info.data
            host = data.get("cache_redis_host", "localhost")
            port = data.get("cache_redis_port", 6379)
            return f"redis://{host}:{port}"
        return v

    # HTTP surface settings — comma-separated to keep .env parsing simple.
    # Defaults are permissive for local dev; production must set both.
    cors_allowed_origins: str = Field(
        default="*", validation_alias="CORS_ALLOWED_ORIGINS"
    )
    allowed_hosts: str = Field(default="*", validation_alias="ALLOWED_HOSTS")

    # /docs, /redoc and /openapi.json. Defaults on outside production so local
    # dev and staging keep the interactive docs; set EXPOSE_API_DOCS=true to
    # publish them in production deliberately.
    expose_api_docs_override: Optional[bool] = Field(
        default=None, validation_alias="EXPOSE_API_DOCS"
    )

    @property
    def expose_api_docs(self) -> bool:
        if self.expose_api_docs_override is not None:
            return self.expose_api_docs_override
        return self.app_env.lower() != "production"

    # Identity asserted by the upstream API gateway (see api/dependencies.py).
    # Until the gateway is confirmed to send this header, endpoints fall back
    # to the client-supplied ?userId= parameter. Set REQUIRE_GATEWAY_IDENTITY
    # once it does, to close that fallback off.
    identity_header: str = Field(
        default="X-User-Id", validation_alias="IDENTITY_HEADER"
    )
    require_gateway_identity: bool = Field(
        default=False, validation_alias="REQUIRE_GATEWAY_IDENTITY"
    )

    # Rate limiting. X-Forwarded-For is client-settable, so trusting it from
    # any peer made the limit bypassable by rotating the header. It is only
    # honoured when the immediate peer is one of these networks.
    #
    # Deployment reality (k8s/nginx/*/analytics-vs.yaml + global-config.yaml):
    # the NGINX ingress proxies to airqo-analytics-api-svc:5000 and sets
    # X-Forwarded-For to $proxy_add_x_forwarded_for, appending the real client
    # IP — which it resolves from PROXY protocol (`real-ip-header:
    # proxy_protocol`), not from the header itself. So the right-most entry is
    # trustworthy and everything left of it is caller-supplied.
    #
    # The peer analytics sees is therefore always an in-cluster nginx pod, i.e.
    # RFC1918. Defaulting to the private ranges keeps per-client rate limiting
    # working out of the box; an empty value would key every request on the
    # single ingress pod IP and throttle all users as one client. Narrow this
    # to the actual ingress pod CIDR if you want to be stricter.
    trusted_proxies: str = Field(
        default="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8",
        validation_alias="TRUSTED_PROXIES",
    )

    # Per-request timeout for outbound AirQo API calls. urllib3 waits forever
    # by default, which parks a shared-executor thread on a hung socket.
    airqo_api_timeout: float = Field(default=10.0, validation_alias="AIRQO_API_TIMEOUT")

    # BigQuery cost/time ceilings, enforced server-side by BigQuery itself.
    # Starting deliberately tight at 1 GiB per job: rejections are logged
    # (see api/utils/bigquery_jobs.py) so the real distribution of query
    # sizes becomes visible before the cap is tuned upward.
    bigquery_max_bytes_billed: int = Field(
        default=1 * 1024**3, validation_alias="BIGQUERY_MAX_BYTES_BILLED"
    )
    bigquery_job_timeout_ms: int = Field(
        default=600_000, validation_alias="BIGQUERY_JOB_TIMEOUT_MS"
    )

    max_query_days: int = Field(default=365, validation_alias="MAX_QUERY_DAYS")
    max_filter_values: int = Field(default=1000, validation_alias="MAX_FILTER_VALUES")

    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    def allowed_hosts_list(self) -> List[str]:
        return [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]

    # External API settings
    airqo_api_base_url: str = Field(
        default="https://platform.airqo.net/api/v2",
        validation_alias="AIRQO_API_BASE_URL",
    )
    airqo_api_token: SecretStr = Field(
        default="test-token", validation_alias="AIRQO_API_TOKEN"
    )
    # Retry budget for AirQoRequests (privacy checks run on the request
    # path — keep the worst case to a few seconds, not the old ~75s).
    airqo_api_retries: int = Field(default=2, validation_alias="AIRQO_API_RETRIES")
    airqo_api_backoff_factor: float = Field(
        default=1.0, validation_alias="AIRQO_API_BACKOFF_FACTOR"
    )

    # MongoDB settings — legacy config selected the URI by environment:
    # development uses MONGO_LOCAL_URI, staging/production use MONGO_GCE_URI.
    # Per-network databases are named f"{mongo_db_name}_{network}".
    mongo_gce_uri: Optional[str] = Field(default=None, validation_alias="MONGO_GCE_URI")
    mongo_local_uri: Optional[str] = Field(
        default=None, validation_alias="MONGO_LOCAL_URI"
    )
    mongo_db_name: str = Field(
        default="airqo_analytics", validation_alias="MONGO_DB_NAME"
    )

    @property
    def mongo_uri(self) -> str:
        if self.app_env in ("development", "dev"):
            return self.mongo_local_uri or "mongodb://localhost:27017"
        return self.mongo_gce_uri or "mongodb://localhost:27017"

    # Data export settings
    data_export_decimal_places: int = Field(
        default=2, validation_alias="DATA_EXPORT_DECIMAL_PLACES"
    )
    data_export_limit: int = Field(default=10000, validation_alias="DATA_EXPORT_LIMIT")
    data_summary_days_interval: int = Field(
        default=2, validation_alias="DATA_SUMMARY_DAYS_INTERVAL"
    )
    data_export_bucket: str = Field(
        default="test-bucket", validation_alias="DATA_EXPORT_BUCKET"
    )
    data_export_dataset: str = Field(
        default="test_dataset", validation_alias="DATA_EXPORT_DATASET"
    )
    data_export_gcp_project: str = Field(
        default="test-project", validation_alias="DATA_EXPORT_GCP_PROJECT"
    )
    data_export_collection: str = Field(
        default="data_export", validation_alias="DATA_EXPORT_COLLECTION"
    )
    # BigQuery location of the export dataset — the old code hardcoded "EU"
    # in one extract path and "US" in the other; ops must confirm the real one.
    data_export_location: str = Field(
        default="EU", validation_alias="DATA_EXPORT_LOCATION"
    )

    # -------------------------------------------------------------------------
    # BigQuery table names — stored as fully-qualified strings in the form
    # "project.dataset.table" (dots are fine in plain str fields).
    # The env var names match what the rest of the platform already uses.
    # -------------------------------------------------------------------------
    bigquery_raw_data: str = Field(
        default="raw_data", validation_alias="BIGQUERY_RAW_DATA"
    )
    bigquery_hourly_data: str = Field(
        default="hourly_data", validation_alias="BIGQUERY_HOURLY_DATA"
    )
    bigquery_daily_data: str = Field(
        default="daily_data", validation_alias="BIGQUERY_DAILY_DATA"
    )
    bigquery_hourly_consolidated: str = Field(
        default="hourly_consolidated", validation_alias="BIGQUERY_HOURLY_CONSOLIDATED"
    )
    bigquery_raw_bam_data_table: str = Field(
        default="raw_bam_data", validation_alias="BIGQUERY_RAW_BAM_DATA_TABLE"
    )
    bigquery_bam_hourly_data: str = Field(
        default="bam_hourly_data", validation_alias="BIGQUERY_BAM_HOURLY_DATA"
    )
    bigquery_mobile_raw_data: str = Field(
        default="mobile_raw_data",
        validation_alias="BIGQUERY_AIRQO_MOBILE_EVENTS_RAW_TABLE",
    )
    bigquery_mobile_hourly_table: str = Field(
        default="mobile_hourly",
        validation_alias="BIGQUERY_AIRQO_MOBILE_EVENTS_AVERAGED_TABLE",
    )
    # Additional data tables present in the shared .env
    bigquery_latest_events: str = Field(
        default="latest_events", validation_alias="BIGQUERY_LATEST_EVENTS"
    )
    bigquery_satellite_data_table: str = Field(
        default="satellite_data",
        validation_alias="BIGQUERY_SATELLITE_DATA_CLEANED_MERGED_TABLE",
    )

    # Metadata / dimension tables
    bigquery_devices_devices: str = Field(
        default="devices", validation_alias="BIGQUERY_DEVICES_DEVICES"
    )
    bigquery_sites_sites: str = Field(
        default="sites", validation_alias="BIGQUERY_SITES_SITES"
    )
    bigquery_grids_sites: str = Field(
        default="grids_sites", validation_alias="BIGQUERY_GRIDS_SITES"
    )
    bigquery_grids: str = Field(default="grids", validation_alias="BIGQUERY_GRIDS")
    bigquery_cohorts_devices: str = Field(
        default="cohorts_devices", validation_alias="BIGQUERY_COHORTS_DEVICES"
    )
    bigquery_cohorts: str = Field(
        default="cohorts", validation_alias="BIGQUERY_COHORTS"
    )
    devices_summary_table: str = Field(
        default="devices_summary", validation_alias="DEVICES_SUMMARY_TABLE"
    )

    # Table names are interpolated into SQL rather than bound as parameters
    # (BigQuery has no parameter form for identifiers), so their shape is
    # checked here — at startup, where a bad value is obvious and fixable —
    # rather than surfacing as a syntax error on whichever endpoint hits it
    # first. Applies to every bigquery_* string setting plus the summary
    # table; the numeric bigquery_* settings are skipped.
    @field_validator(
        "bigquery_raw_data",
        "bigquery_hourly_data",
        "bigquery_daily_data",
        "bigquery_hourly_consolidated",
        "bigquery_raw_bam_data_table",
        "bigquery_bam_hourly_data",
        "bigquery_mobile_raw_data",
        "bigquery_mobile_hourly_table",
        "bigquery_latest_events",
        "bigquery_satellite_data_table",
        "bigquery_devices_devices",
        "bigquery_sites_sites",
        "bigquery_grids_sites",
        "bigquery_grids",
        "bigquery_cohorts_devices",
        "bigquery_cohorts",
        "devices_summary_table",
    )
    @classmethod
    def validate_table_name(cls, v: str, info: Any) -> str:
        if not v or not TABLE_NAME_RE.fullmatch(v):
            raise ValueError(
                f"{info.field_name}={v!r} is not a valid BigQuery table name. "
                "Expected 'table', 'dataset.table' or 'project.dataset.table' "
                "using letters, digits, underscores and hyphens."
            )
        return v

    # Filter field name mapping (API filter key → BigQuery column name)
    FILTER_FIELD_MAPPING: Dict[str, str] = {
        "devices": "device_id",
        "device_ids": "device_id",
        "device_names": "device_id",
        "sites": "site_id",
        "site_names": "site_id",
        "site_ids": "site_id",
        "country": "country",
        "city": "city",
        "grid_ids": "device_id",  # Not exactly mapped to device_id but just points to the name of
        # the column in the table that is used to filter the data. The actual
        # filtering is done by joining with the grids_sites table and filtering
        # on grid_id.
        "cohort_ids": "device_id",  # Not exactly mapped to device_id but just points to the name of the
        # column in the table that is used to filter the data. The actual
        # filtering is done by joining with the cohorts_devices table and filtering
        # on cohort_id.
    }

    @property
    def field_mappings(self) -> Dict[str, str]:
        """Alias used by BigQueryApi internals."""
        return self.FILTER_FIELD_MAPPING

    # Optional extra columns available per device category
    OPTIONAL_FIELDS: Dict = {
        DeviceCategory.LOWCOST: {
            "longitude",
            "latitude",
            "temperature",
            "humidity",
            "site_id",
        },
        DeviceCategory.BAM: {
            "longitude",
            "latitude",
            "temperature",
            "humidity",
            "site_id",
        },
        DeviceCategory.MOBILE: {
            "longitude",
            "latitude",
            "temperature",
            "humidity",
            "battery",
        },
        DeviceCategory.GAS: {"longitude", "latitude", "site_id"},
        DeviceCategory.GENERAL: {"longitude", "latitude", "site_id"},
        DeviceCategory.SATELLITE: {
            "longitude",
            "latitude",
            "wind_speed",
            "wind_direction",
        },
    }

    # Schema file mapping — resolved dynamically using table name fields above
    @property
    def SCHEMA_FILE_MAPPING(self) -> Dict[str, str]:
        """Map fully-qualified BigQuery table names to their local JSON schema files."""
        return {
            self.bigquery_hourly_data: "measurements.json",
            self.bigquery_daily_data: "measurements.json",
            self.bigquery_raw_data: "raw_measurements.json",
            self.bigquery_hourly_consolidated: "data_warehouse.json",
            self.bigquery_bam_hourly_data: "bam_measurements.json",
            self.bigquery_raw_bam_data_table: "bam_raw_measurements.json",
            self.bigquery_mobile_raw_data: "airqo_mobile_measurements.json",
            self.bigquery_mobile_hourly_table: "airqo_mobile_measurements.json",
            "all": None,
        }

    # Time grouping configurations (sets — query builders use set operations)
    extra_time_grouping: Set[str] = {"daily", "weekly", "monthly", "yearly"}
    all_time_grouping: Set[str] = {"hourly", "daily", "weekly", "monthly", "yearly"}
    cursor_field: Dict[str, str] = {
        "hourly": "timestamp",
        "daily": "timestamp",
        "weekly": "week",
        "monthly": "month",
        "yearly": "year",
    }
    download_export_time_fields: Dict[str, str] = {
        "weekly": "week",
        "monthly": "month",
        "yearly": "year",
    }

    def data_sources(self) -> Dict[str, Dict[str, Dict[str, str]]]:
        """
        Generate data source mapping for different data types, device categories, and frequencies.

        Returns:
            Dict containing nested mappings for data sources.
        """
        return {
            DataType.RAW: {
                DeviceCategory.LOWCOST: {
                    Frequency.RAW: self.bigquery_raw_data,
                    Frequency.HOURLY: self.bigquery_hourly_data,  # For hourly raw data use case
                    Frequency.DAILY: self.bigquery_daily_data,
                },
                DeviceCategory.BAM: {
                    Frequency.RAW: self.bigquery_raw_bam_data_table,
                    Frequency.HOURLY: self.bigquery_bam_hourly_data,
                    Frequency.DAILY: self.bigquery_daily_data,
                },
                DeviceCategory.SATELLITE: {
                    Frequency.RAW: self.bigquery_satellite_data_table,
                    Frequency.HOURLY: self.bigquery_satellite_data_table,
                },
            },
            DataType.AVERAGED: {
                DeviceCategory.LOWCOST: {
                    Frequency.HOURLY: self.bigquery_hourly_data,
                    Frequency.DAILY: self.bigquery_daily_data,
                },
                DeviceCategory.BAM: {
                    Frequency.HOURLY: self.bigquery_bam_hourly_data,
                    Frequency.DAILY: self.bigquery_daily_data,
                },
            },
        }

    @classmethod
    def init_logging(cls) -> None:
        """
        Initialize logging configuration.
        """
        import logging
        from logging.handlers import TimedRotatingFileHandler

        # Create logs directory if it doesn't exist
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)

        # Configure root logger
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                TimedRotatingFileHandler(
                    filename=log_dir / "analytics-api.log",
                    when="midnight",
                    interval=1,
                    backupCount=30,
                ),
                logging.StreamHandler(),
            ],
        )


# Create global config instance
settings = BaseConfig()


def export_google_credentials(config: BaseConfig) -> None:
    """Make the credentials path visible to the Google SDK.

    google.auth.default() reads GOOGLE_APPLICATION_CREDENTIALS from
    os.environ ONLY.  The Flask app got this for free because its config
    ran load_dotenv() (which exports the .env file into os.environ);
    pydantic-settings reads the env file into the settings object without
    exporting.  setdefault so a value already present in the real process
    environment always wins — the same precedence pydantic itself applies.

    Relative paths (the .env convention) are resolved against this file's
    directory, and a path that doesn't exist is NOT exported — exporting a
    bad path would make google.auth raise instead of falling back to ADC /
    workload identity.
    """
    if not config.google_application_credentials:
        return
    path = Path(config.google_application_credentials)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent / path
    if path.is_file():
        os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(path))


export_google_credentials(settings)

# Backward compatibility - expose commonly used attributes
CONFIGURATIONS = settings  # For backward compatibility during migration
API_V2_BASE_URL = "/api/v2/analytics"
API_V2_BASE_INTERNAL_URL = "/api/v2/internal/analytics"
API_V3_BASE_URL = "/api/v3/public/analytics"
