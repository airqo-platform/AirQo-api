"""
Test configuration for the analytics2 FastAPI application.

Inherits from config.BaseConfig so all methods (data_sources,
SCHEMA_FILE_MAPPING, field_mappings, OPTIONAL_FIELDS, etc.) are available
without duplication.  Only the fields that need test-safe defaults are
overridden here.
"""

from pydantic_settings import SettingsConfigDict
from config import BaseConfig


class TestConfig(BaseConfig):
    """Test-safe settings — no real BigQuery, Redis, or GCP credentials needed."""

    # Override model_config to use a test-only env file (won't error if absent)
    model_config = SettingsConfigDict(
        env_file=".env.test",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    app_env: str = "test"
    secret_key: str = "test-secret-key-for-testing-only"  # type: ignore[assignment]

    # Use obviously-fake table names so no real queries can slip through
    bigquery_raw_data: str = "test_raw_data"
    bigquery_hourly_data: str = "test_hourly_data"
    bigquery_daily_data: str = "test_daily_data"
    bigquery_bam_hourly_data: str = "test_bam_hourly_data"
    bigquery_raw_bam_data_table: str = "test_raw_bam_data"
    bigquery_mobile_raw_data: str = "test_mobile_raw_data"
    bigquery_mobile_hourly_table: str = "test_mobile_hourly"
    bigquery_hourly_consolidated: str = "test_hourly_consolidated"
    bigquery_latest_events: str = "test_latest_events"
    bigquery_satellite_data_table: str = "test_satellite_data"

    data_export_bucket: str = "test-bucket"
    data_export_dataset: str = "test_dataset"
    data_export_gcp_project: str = "test-project"

    # MongoDB — never resolvable; MongoClient only connects on first operation,
    # and tests patch pymongo.MongoClient anyway.
    mongo_gce_uri: str = "mongodb://test-host:27017"  # type: ignore[assignment]
    mongo_local_uri: str = "mongodb://test-host:27017"  # type: ignore[assignment]
    mongo_db_name: str = "test_db"


# Singleton used by conftest.py and any test that imports this module
test_settings = TestConfig()


class TestGoogleCredentialsExport:
    """google.auth reads GOOGLE_APPLICATION_CREDENTIALS from os.environ only;
    the config module must export the env-file value there (the Flask app
    got this via load_dotenv, pydantic-settings does not export)."""

    def test_exports_absolute_path_to_os_environ(self, monkeypatch, tmp_path):
        import os
        from config import export_google_credentials

        key = tmp_path / "svc.json"
        key.write_text("{}")
        monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
        export_google_credentials(TestConfig(google_application_credentials=str(key)))
        assert os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == str(key)

    def test_relative_path_resolved_against_config_dir(self, monkeypatch):
        """The .env convention stores a relative filename; it must resolve
        against the app root (where config.py lives), not the cwd."""
        import os
        import config
        from pathlib import Path

        app_root = Path(config.__file__).resolve().parent
        monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
        cfg = TestConfig(
            google_application_credentials="google_application_credentials.json"
        )
        config.export_google_credentials(cfg)
        expected = app_root / "google_application_credentials.json"
        if expected.is_file():
            assert os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == str(expected)
        else:
            # Clean checkout (CI): file absent → must NOT export a bad path
            assert "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ

    def test_missing_file_is_not_exported(self, monkeypatch):
        """Exporting a nonexistent path would make google.auth raise instead
        of falling back to ADC / workload identity."""
        import os
        from config import export_google_credentials

        monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
        export_google_credentials(
            TestConfig(google_application_credentials="/nope/missing.json")
        )
        assert "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ

    def test_real_environment_wins_over_env_file(self, monkeypatch, tmp_path):
        import os
        from config import export_google_credentials

        key = tmp_path / "envfile.json"
        key.write_text("{}")
        monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/real/key.json")
        export_google_credentials(TestConfig(google_application_credentials=str(key)))
        assert os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == "/real/key.json"

    def test_noop_when_unset(self, monkeypatch):
        import os
        from config import export_google_credentials

        monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
        export_google_credentials(TestConfig(google_application_credentials=None))
        assert "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ


class TestSecretKeyGuard:
    """SECRET_KEY signs pagination cursors, whose contents reach a BigQuery
    WHERE clause. A predictable key means forgeable cursors, so deployed
    environments must not fall back to the shipped default."""

    def test_default_secret_rejected_in_production(self):
        import pytest
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="SECRET_KEY must be set"):
            BaseConfig(FLASK_ENV="production", SECRET_KEY=BaseConfig.DEFAULT_SECRET_KEY)

    def test_default_secret_rejected_in_staging(self):
        import pytest
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="SECRET_KEY must be set"):
            BaseConfig(FLASK_ENV="staging", SECRET_KEY=BaseConfig.DEFAULT_SECRET_KEY)

    def test_default_secret_allowed_in_development(self):
        config = BaseConfig(
            FLASK_ENV="development", SECRET_KEY=BaseConfig.DEFAULT_SECRET_KEY
        )
        assert config.secret_key.get_secret_value() == BaseConfig.DEFAULT_SECRET_KEY

    def test_real_secret_accepted_in_production(self):
        config = BaseConfig(FLASK_ENV="production", SECRET_KEY="a-real-rotated-key")
        assert config.secret_key.get_secret_value() == "a-real-rotated-key"


class TestApiDocsGating:
    """/docs, /redoc and /openapi.json publish the full schema of every
    endpoint — fine in dev and staging, needless disclosure in production."""

    def test_docs_hidden_in_production_by_default(self):
        assert (
            BaseConfig(FLASK_ENV="production", SECRET_KEY="real-key").expose_api_docs
            is False
        )

    def test_docs_visible_in_staging_by_default(self):
        assert (
            BaseConfig(FLASK_ENV="staging", SECRET_KEY="real-key").expose_api_docs
            is True
        )

    def test_docs_visible_in_development_by_default(self):
        assert BaseConfig(FLASK_ENV="development").expose_api_docs is True

    def test_explicit_override_wins_in_production(self):
        assert (
            BaseConfig(
                FLASK_ENV="production", SECRET_KEY="real-key", EXPOSE_API_DOCS=True
            ).expose_api_docs
            is True
        )

    def test_explicit_override_can_disable_outside_production(self):
        assert (
            BaseConfig(FLASK_ENV="development", EXPOSE_API_DOCS=False).expose_api_docs
            is False
        )
