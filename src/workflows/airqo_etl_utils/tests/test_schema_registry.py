import pandas as pd

from airqo_etl_utils.storage import schema_registry
from airqo_etl_utils.config import configuration


def test_validate_dataframe_missing_columns(monkeypatch):
    # Inject a simple schema mapping into configuration
    mapping = {"my.table": ["col1", "col2", "col3"]}
    monkeypatch.setattr(configuration, "SCHEMA_FILE_MAPPING", mapping, raising=False)

    df = pd.DataFrame({"col1": [1], "col3": [3]})
    ok, missing = schema_registry.validate_dataframe("my.table", df)
    assert ok is False
    assert "col2" in missing


def test_validate_dataframe_all_present(monkeypatch):
    mapping = {"my.table": ["a", "b"]}
    monkeypatch.setattr(configuration, "SCHEMA_FILE_MAPPING", mapping, raising=False)
    df = pd.DataFrame({"a": [1], "b": [2]})
    ok, missing = schema_registry.validate_dataframe("my.table", df)
    assert ok is True
    assert missing == []
