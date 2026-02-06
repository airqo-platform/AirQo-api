"""Storage package for data warehouse adapters.

This module provides:
- a `StorageAdapter` ABC for implementations
- a registry (`register_storage`, `get_storage`) for pluggable backends
- a small convenience factory that will register a default backend based on
  an environment variable or configuration (falls back to BigQuery).

Callers can either import and instantiate an adapter directly:

    from airqo_etl_utils.storage.bigquery_adapter import BigQueryAdapter
    adapter = BigQueryAdapter()

Or use the registry / config-driven default via `get_storage`.
"""

import os
from typing import Optional

from .registry import register_storage, get_storage, get_default_storage  # re-export
from .bigquery_adapter import BigQueryAdapter
from .base import StorageAdapter

__all__ = [
    "register_storage",
    "get_storage",
    "get_default_storage",
    "BigQueryAdapter",
    "StorageAdapter",
    "get_configured_storage",
]


# Helper: decide configured backend from env or configuration
def _configured_backend_name() -> Optional[str]:
    # Priority: explicit env var, then configuration (if present), then None
    name = os.getenv("STORAGE_BACKEND")
    if name:
        return name.lower()
    try:
        # Lazy import to avoid circular imports during package init
        from airqo_etl_utils.config import configuration

        name = getattr(configuration, "STORAGE_BACKEND", None)
        if name:
            return str(name).lower()
    except Exception:
        pass
    return None


def get_configured_storage() -> Optional[StorageAdapter]:
    """Return a configured storage adapter instance.

    Behavior:
    - If a backend was registered programmatically under the configured name,
      return that instance.
    - Otherwise, if the configured name is 'bigquery' (or missing), instantiate
      and register a `BigQueryAdapter` and return it.
    - Returns None only if instantiation fails.
    """
    backend = _configured_backend_name() or "bigquery"

    existing = get_storage(backend)
    if existing:
        return existing

    # Only BigQuery is implemented by default here; other backends should
    # register themselves via `register_storage("name", adapter_instance)`.
    if backend == "bigquery":
        try:
            # Prefer an explicit service-account JSON path if provided
            sa_path = os.getenv("BIGQUERY_SERVICE_ACCOUNT_JSON")
            if not sa_path:
                try:
                    from airqo_etl_utils.config import configuration

                    sa_path = getattr(
                        configuration, "BIGQUERY_SERVICE_ACCOUNT_JSON", None
                    )
                except Exception:
                    sa_path = None

            if sa_path:
                try:
                    from google.oauth2 import service_account
                    from google.cloud import bigquery

                    creds = service_account.Credentials.from_service_account_file(
                        sa_path
                    )
                    client = bigquery.Client(credentials=creds)
                except Exception:
                    # fallback to default client if explicit creds fail
                    from google.cloud import bigquery

                    client = bigquery.Client()
            else:
                from google.cloud import bigquery

                client = bigquery.Client()

            # Try to load schema mapping from configuration if available
            try:
                from airqo_etl_utils.config import configuration

                schema_mapping = getattr(configuration, "SCHEMA_FILE_MAPPING", None)
            except Exception:
                schema_mapping = None

            adapter = BigQueryAdapter(client=client, schema_mapping=schema_mapping)
            register_storage("bigquery", adapter)
            return adapter
        except Exception:
            return None

    return None


# During import, ensure a default backend is available (if possible)
try:
    get_configured_storage()
except Exception:
    # Keep import-time failures non-fatal
    pass
