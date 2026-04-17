from __future__ import annotations

import threading
import logging
from typing import List, Optional, Set, Tuple

from airqo_etl_utils.config import configuration
from airqo_etl_utils.constants import ColumnDataType
from airqo_etl_utils.utils import Utils
from airqo_etl_utils.cache import TTLCache

logger = logging.getLogger("airflow.task")

# The set of schema files merged when table="all", matching BigQueryApi.get_columns()
_ALL_SCHEMA_FILES = [
    "measurements",
    "raw_measurements",
    "weather_data",
    "latest_measurements",
    "data_warehouse",
    "sites",
    "sensor_positions",
    "devices",
    "mobile_measurements",
    "airqo_mobile_measurements",
    "bam_measurements",
    "bam_raw_measurements",
    "daily_24_hourly_forecasts",
    "device_computed_metadata",
    "measurements_baseline",
]

_schema_cache: Optional[TTLCache] = None
_schema_cache_lock = threading.Lock()


def _get_schema_cache() -> TTLCache:
    """Return the module-level TTLCache, initialising it lazily on first call.

    Uses double-checked locking to avoid redundant initialisation under
    concurrent Airflow tasks without holding the lock on every read.

    Returns:
        A shared TTLCache instance backed by configuration TTL/cleanup settings.
    """
    global _schema_cache
    if _schema_cache is None:
        with _schema_cache_lock:
            if _schema_cache is None:
                try:
                    _schema_cache = TTLCache(
                        default_ttl=configuration.CACHE_TTL_SECONDS,
                        cleanup_interval=configuration.CACHE_CLEANUP_INTERVAL_SECONDS,
                    )
                except Exception:
                    _schema_cache = TTLCache(default_ttl=0, cleanup_interval=60)
    return _schema_cache


def load_schema_for_table(table: str) -> List[dict]:
    """Load and return the raw BigQuery schema field list for a given table.

    Reads JSON schema files from the ``schema/`` directory via
    ``Utils.load_schema``. For the ``"all"`` pseudo-table, all known schema
    files are loaded and merged. Results are held in the module-level
    TTLCache so that repeated calls within the same Airflow task incur only a
    single round of disk I/O.

    Args:
        table: A BigQuery table identifier exactly as it appears in
            ``configuration.SCHEMA_FILE_MAPPING``, or the special string
            ``"all"`` to merge every known schema file.

    Returns:
        A list of BigQuery schema field dicts, each containing at minimum
        ``"name"``, ``"type"``, and ``"mode"`` keys. Returns an empty list
        when the table has no schema mapping or a schema file cannot be read.
    """
    cache_key = f"schema:{table}"
    cached = _get_schema_cache().get(cache_key)
    if cached is not None:
        return cached

    if table == "all":
        schema: List[dict] = []
        for file_stem in _ALL_SCHEMA_FILES:
            try:
                schema.extend(Utils.load_schema(file_name=f"{file_stem}.json"))
            except Exception as e:
                logger.warning(f"Failed to load schema file {file_stem}.json: {e}")
    else:
        schema_file = configuration.SCHEMA_FILE_MAPPING.get(table)
        if schema_file is None:
            logger.warning(f"No schema file mapped for table '{table}'")
            return []
        try:
            schema = Utils.load_schema(file_name=schema_file)
        except Exception as e:
            logger.warning(f"Failed to load schema file {schema_file}: {e}")
            return []

    _get_schema_cache().set(cache_key, schema)
    return schema


def get_columns_by_type(
    table: str,
    column_types: Optional[List[ColumnDataType]] = None,
) -> List[str]:
    """Return column names from a table's schema filtered by one or more ColumnDataTypes.

    Type-filtering rules (matching ``BigQueryApi.get_columns`` behaviour):

    - ``ColumnDataType.RECORD`` — returns only ``RECORD`` fields with mode
      ``NULLABLE``. When this type is present, all other type checks are skipped
      for every field.
    - ``ColumnDataType.REPEATED`` — returns only ``RECORD`` fields with mode
      ``REPEATED``. When this type is present, all other type checks are skipped
      for every field.
    - ``ColumnDataType.NONE`` (default) — returns the names of all fields
      regardless of type.
    - Any other ``ColumnDataType`` — returns columns whose BigQuery type
      (uppercased) matches the enum's string representation (e.g. ``FLOAT``,
      ``INTEGER``, ``TIMESTAMP``).

    Args:
        table: A BigQuery table identifier or ``"all"``. Passed directly to
            ``load_schema_for_table``.
        column_types: List of ``ColumnDataType`` filters to apply. Defaults to
            ``[ColumnDataType.NONE]`` (all columns).

    Returns:
        Deduplicated list of column names that satisfy the requested type
        criteria. Order is not guaranteed.
    """
    if not column_types:
        column_types = [ColumnDataType.NONE]

    type_key = ",".join(sorted(ct.value for ct in column_types))
    cache_key = f"cols:{table}:{type_key}"
    cached = _get_schema_cache().get(cache_key)
    if cached is not None:
        return cached

    schema = load_schema_for_table(table)
    column_type_strings: Set[str] = {ct.str.upper() for ct in column_types}
    columns: Set[str] = set()

    for field in schema:
        col_type = field.get("type", "").upper()
        col_mode = field.get("mode", "NULLABLE").upper()
        col_name = field.get("name")
        if not col_name:
            continue

        # RECORD (NULLABLE) — exclusive branch, skips all other checks per field.
        if ColumnDataType.RECORD in column_types:
            if col_type == "RECORD" and col_mode == "NULLABLE":
                columns.add(col_name)
            continue

        # RECORD (REPEATED) — exclusive branch, skips all other checks per field.
        if ColumnDataType.REPEATED in column_types:
            if col_type == "RECORD" and col_mode == "REPEATED":
                columns.add(col_name)
            continue

        # NONE = all columns; otherwise match the requested type strings.
        if ColumnDataType.NONE in column_types or col_type in column_type_strings:
            columns.add(col_name)

    result = list(columns)
    _get_schema_cache().set(cache_key, result)
    return result


def validate_dataframe(table: str, df) -> Tuple[bool, List[str]]:
    """Validate that ``df`` contains all columns required by ``table``'s schema.

    Uses the full JSON schema (loaded via :func:`load_schema_for_table`) to
    determine the required column set rather than a simplified in-memory
    mapping, providing accurate validation against the actual BigQuery schema.

    Args:
        table: BigQuery table identifier as it appears in
            ``configuration.SCHEMA_FILE_MAPPING``.
        df: pandas ``DataFrame`` to validate.

    Returns:
        A ``(ok, missing_columns)`` tuple where ``ok`` is ``True`` if all
        schema columns are present in ``df``, and ``missing_columns`` is
        the list of absent column names (empty when ``ok`` is ``True``).
        Returns ``(True, [])`` when no schema is registered for ``table``.
    """
    required = get_columns_by_type(table, [ColumnDataType.NONE])
    if not required:
        return True, []
    missing = [c for c in required if c not in df.columns]
    return (len(missing) == 0), missing
