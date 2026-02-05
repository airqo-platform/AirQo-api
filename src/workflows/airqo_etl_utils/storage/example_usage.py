"""Small typed usage example for storage adapters.

Usage pattern:
    - Prefer the config-driven factory `get_configured_storage()` for the
      runtime-default backend.
    - Type against `StorageAdapter` for testability and editor help.

Example:
    from typing import Optional
    from airqo_etl_utils.storage import get_configured_storage, StorageAdapter

    adapter: Optional[StorageAdapter] = get_configured_storage()
    if adapter is None:
        raise RuntimeError("No configured storage backend available")

    # placeholders: replace `table` and `df` with your values
    table = "project.dataset.table"
    df = None  # your pandas.DataFrame here

    # Validate and load
    ok, missing = adapter.validate_schema(table, df)
    if not ok:
        print("Missing columns:", missing)
    # adapter.load_dataframe(df, table)
"""
