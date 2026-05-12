import pandas as pd

from airqo_etl_utils.storage import schema_registry


def test_validate_dataframe_missing_columns(monkeypatch):
    # validate_dataframe calls get_columns_by_type; mock that directly since
    # SCHEMA_FILE_MAPPING maps table names to JSON file paths, not column lists.
    monkeypatch.setattr(
        schema_registry,
        "get_columns_by_type",
        lambda table, column_types=None: (
            ["col1", "col2", "col3"] if table == "my.table" else []
        ),
    )

    df = pd.DataFrame({"col1": [1], "col3": [3]})
    ok, missing = schema_registry.validate_dataframe("my.table", df)
    assert ok is False
    assert "col2" in missing


def test_validate_dataframe_all_present(monkeypatch):
    monkeypatch.setattr(
        schema_registry,
        "get_columns_by_type",
        lambda table, column_types=None: ["a", "b"] if table == "my.table" else [],
    )
    df = pd.DataFrame({"a": [1], "b": [2]})
    ok, missing = schema_registry.validate_dataframe("my.table", df)
    assert ok is True
    assert missing == []
