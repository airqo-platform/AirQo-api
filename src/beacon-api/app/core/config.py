from typing import List, Union, Any, Dict
from pydantic import AnyHttpUrl, field_validator, PostgresDsn, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "AirQo Beacon Service"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: Union[PostgresDsn, str, None] = None

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            return str(self.DATABASE_URL)
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Platform JWT verification (app/core/security.py). Users sign in on the
    # AirQo platform, whose auth-service signs HS256 JWTs with JWT_SECRET; set
    # the same value here for the environment beacon serves. Verification is on
    # by default and fails closed: with no JWT_SECRET, requests that need a
    # token get 503. Set JWT_VERIFICATION_ENABLED=false for local development
    # only. The grace period matches auth-service's JWT_GRACE_PERIOD_SECONDS.
    JWT_SECRET: str = ""
    JWT_VERIFICATION_ENABLED: bool = True
    JWT_GRACE_PERIOD_SECONDS: int = 300

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Platform API
    PLATFORM_BASE_URL: str = "https://platform.airqo.net/api/v2"
    PLATFORM_API_TOKEN: str = ""

    # Networks ("sensor manufacturers") beacon mirrors from the platform, as a
    # comma-separated allow-list (e.g. "airqo,airgradient,iqair"). Empty means
    # every network the platform returns.
    ENABLED_NETWORKS: str = ""

    # Redis
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # Scheduler
    SCHEDULER_ENABLED: bool = True
    SYNC_INTERVAL_MINUTES: int = 30
    DAILY_DIAGNOSTICS_ENABLED: bool = True  # Diagnose each completed device-day after the scheduled ThingSpeak sync
    # Backfill readings of devices from other manufacturers (airgradient, iqair,
    # metone ...) from the platform's analytics raw-data endpoint after the
    # nightly ThingSpeak sync.
    EXTERNAL_SYNC_ENABLED: bool = True
    # Poll the registry's live feed (which calls the manufacturer API through
    # the per-network adapter) for the latest reading of external devices.
    # Minutes between polls; 0 disables. Only networks listed in
    # EXTERNAL_FEED_NETWORKS have a working adapter today.
    EXTERNAL_FEED_POLL_MINUTES: int = 60
    EXTERNAL_FEED_NETWORKS: str = "airgradient,iqair"
    # Direct history from AirGradient's authenticated raw endpoint (devices
    # shared privately with this account, i.e. authRequired=true). Empty token
    # disables the direct source and those devices use analytics raw-data.
    AIRGRADIENT_API_TOKEN: str = ""
    AIRGRADIENT_BASE_URL: str = "https://api.airgradient.com/public/api/v1"

    # Tokens
    ORG_TOKEN: str = ""
    TOKEN: str = ""

    # Google Cloud Storage
    GCS_BUCKET_NAME: str = ""
    GOOGLE_APPLICATION_CREDENTIALS_JSON: Union[Dict[str, Any], str] = {}

    BEACON_API_SLACK_WEBHOOK_URL: str = ""
    SLACK_DEV_NOTIFS: bool = False

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
