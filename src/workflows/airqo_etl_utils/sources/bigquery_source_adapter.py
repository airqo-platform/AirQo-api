"""BigQuery as a DataSourceAdapter — reads data *from* BigQuery tables.

This thin adapter bridges the gap between BigQuery (which is fundamentally a
**storage** backend) and the unified ``DataSourceAdapter.fetch()`` interface
used by all other data-source adapters.

Write operations (``load_dataframe``, ``validate_schema``, etc.) remain on
:class:`~airqo_etl_utils.storage.BigQueryAdapter`.  This class only handles
the *read* path so BigQuery can participate in the same
``get_adapter()`` / ``fetch_from_adapter()`` pattern as ThingSpeak, IQAir,
and the rest.

Architecture::

    ┌────────────────────────────┐
    │  storage.BigQueryAdapter   │  ← StorageAdapter (load, schema, query)
    └────────────┬───────────────┘
                 │  delegates query execution
    ┌────────────▼───────────────┐
    │ sources.BigQuerySourceAdapter │  ← DataSourceAdapter (fetch)
    └────────────────────────────┘

Usage::

    from airqo_etl_utils.sources import get_adapter

    adapter = get_adapter("bigquery")
    result = adapter.fetch(
        device={"query": "SELECT * FROM `project.dataset.table` WHERE ..."},
        dates=None,
    )
    df = result.data["records"]  # pandas DataFrame
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from .adapter import DataSourceAdapter
from ..utils import Result

logger = logging.getLogger("airflow.task")


class BigQuerySourceAdapter(DataSourceAdapter):
    """Read data from BigQuery via the ``DataSourceAdapter`` interface.

    The ``device`` dict passed to :meth:`fetch` should contain:

    * ``query`` (str) — a SQL query whose result set becomes the records.
    * ``table`` (str, optional) — alternative to ``query``; the adapter will
      build a simple ``SELECT * FROM `table` WHERE ...`` query using the
      supplied ``dates``.
    * ``date_column`` (str, optional) — column name used for the time filter
      when ``table`` is provided.  Defaults to ``"timestamp"``.

    Only one of ``query`` or ``table`` is required.  When ``query`` is
    provided it takes precedence and ``dates`` is ignored (the caller is
    responsible for embedding date filters in the SQL).
    """

    def __init__(self) -> None:
        # Lazy-init to avoid import-time BigQuery client creation.
        self._storage_adapter = None

    @property
    def storage(self):
        """Lazy accessor for the canonical storage BigQueryAdapter."""
        if self._storage_adapter is None:
            from ..storage import get_configured_storage, BigQueryAdapter

            configured = get_configured_storage()
            if isinstance(configured, BigQueryAdapter):
                self._storage_adapter = configured
            else:
                self._storage_adapter = BigQueryAdapter()
        return self._storage_adapter

    def fetch(
        self,
        device: Dict[str, Any],
        dates: Optional[List[Tuple[str, str]]] = None,
        resolution: Any = None,
    ) -> Result:
        """Execute a BigQuery read and return the result as a ``Result``.

        Args:
            device: Dict with ``query`` (raw SQL) or ``table`` + optional
                ``date_column`` for auto-generated SQL.
            dates: Optional ``(start, end)`` tuples.  Used only when ``table``
                is provided (ignored when ``query`` is given directly).
            resolution: Unused; accepted for interface parity.

        Returns:
            Result whose ``data`` is ``{"records": <DataFrame>, "meta": {}}``.
        """
        query = device.get("query")

        if not query:
            table = device.get("table")
            if not table:
                return Result(
                    data={"records": [], "meta": {}},
                    error="Provide either 'query' or 'table' in the device dict",
                )
            query = self._build_query(table, dates, device.get("date_column"))

        try:
            result = self.storage.execute_query(query)
            if result.error:
                return Result(data={"records": [], "meta": {}}, error=result.error)
            return Result(
                data={"records": result.data, "meta": {}},
                error=None,
            )
        except Exception as exc:
            logger.exception(f"BigQuery source fetch failed: {exc}")
            return Result(data={"records": [], "meta": {}}, error=str(exc))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_query(
        table: str,
        dates: Optional[List[Tuple[str, str]]],
        date_column: Optional[str] = None,
    ) -> str:
        """Build a simple SELECT with optional date range WHERE clause."""
        col = date_column or "timestamp"
        if not dates:
            return f"SELECT * FROM `{table}`"

        # Combine all date ranges into OR clauses
        clauses = [f"(`{col}` BETWEEN '{start}' AND '{end}')" for start, end in dates]
        where = " OR ".join(clauses)
        return f"SELECT * FROM `{table}` WHERE {where}"


# Self-register with the adapter registry
from .registry import register_adapter  # noqa: E402

register_adapter("bigquery", BigQuerySourceAdapter)
