from typing import Optional, Any, Dict
from pydantic_settings import BaseSettings
from pydantic import PostgresDsn, field_validator, ValidationInfo
import os


class Settings(BaseSettings):
    API_V1_STR: str = ""
    ROOT_PATH: str = ""
    PROJECT_NAME: str = "AirQo Beacon Service"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = "API for comprehensive AirQo device performance and data monitoring"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "airqo")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "airqo")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "beacon_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    DATABASE_URL: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info: ValidationInfo) -> str:
        if isinstance(v, str):
            return v
        values = info.data
        return f"postgresql://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_SERVER')}:{values.get('POSTGRES_PORT')}/{values.get('POSTGRES_DB')}"
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_URL: Optional[str] = None
    
    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def assemble_redis_connection(cls, v: Optional[str], info: ValidationInfo) -> str:
        if isinstance(v, str):
            return v
        values = info.data
        return f"redis://{values.get('REDIS_HOST')}:{values.get('REDIS_PORT')}/{values.get('REDIS_DB')}"
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    TIMEZONE: str = "Africa/Kampala"
    UPTIME_THRESHOLD_GOOD: float = 90.0
    UPTIME_THRESHOLD_MODERATE: float = 70.0
    DATA_COMPLETENESS_THRESHOLD_GOOD: float = 85.0
    DATA_COMPLETENESS_THRESHOLD_MODERATE: float = 60.0
    SCHEDULER_ENABLED: bool = os.getenv("SCHEDULER_ENABLED", "True").lower() == "true"
    SYNC_INTERVAL_MINUTES: int = int(os.getenv("SYNC_INTERVAL_MINUTES", "30"))
    AIRQO_API_TOKEN: Optional[str] = None
    AIRQO_API_URL: Optional[str] = None
    AIRQO_API_BASE_URL: Optional[str] = None
    AIRQO_RECENT_API_URL: Optional[str] = None
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


settings = Settings()