from typing import Dict, List, Tuple
from airqo_etl_utils.config import configuration


def get_schema(table: str):
    """Return schema mapping for a table from configuration.

    The configuration value `SCHEMA_FILE_MAPPING` may contain per-table
    entries. If none found, returns None.
    """
    try:
        mapping = configuration.SCHEMA_FILE_MAPPING
        return mapping.get(table)
    except Exception:
        return None


def extract_required_columns(schema_entry) -> List[str]:
    """Normalize schema entry to a list of required columns.

    Accepts either a list of column names or a dict with key 'columns'.
    """
    if schema_entry is None:
        return []
    if isinstance(schema_entry, list):
        return schema_entry
    if isinstance(schema_entry, dict):
        cols = schema_entry.get("columns") or schema_entry.get("fields")
        if isinstance(cols, list):
            return cols
    return []


def validate_dataframe(table: str, df) -> Tuple[bool, List[str]]:
    """Validate that `df` contains required columns for `table`.

    Returns (ok, missing_columns).
    """
    schema = get_schema(table)
    required = extract_required_columns(schema)
    if not required:
        return True, []

    missing = [c for c in required if c not in df.columns]
    return (len(missing) == 0), missing
