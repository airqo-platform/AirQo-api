from pathlib import Path
import re
from typing import Dict, Optional, Set

NAMED_QUERY_PATTERN = re.compile(
    r"--\s*name:\s*(?P<name>[A-Za-z0-9_]+)\s*\n(?P<body>.*?)(?=(?:\n--\s*name:)|\Z)",
    re.S,
)
PLACEHOLDER_PATTERN = re.compile(r"\{([A-Za-z0-9_]+)\}")


class Query:
    """Represents a named SQL query template.

    Attributes:
        name: query name
        sql: the SQL template text
        placeholders: set of placeholder names required for .format()
        source: source file Path
    """

    def __init__(self, name: str, sql: str, source: Path):
        self.name = name
        self.sql = sql.strip()
        self.source = source
        self.placeholders = set(PLACEHOLDER_PATTERN.findall(self.sql))

    def format(self, **kwargs) -> str:
        missing = self.placeholders - set(kwargs.keys())
        if missing:
            raise KeyError(
                f"Missing placeholders for query '{self.name}': {sorted(missing)}"
            )
        return self.sql.format(**kwargs)


class QueryManager:
    """Loads named queries from SQL files under a directory and exposes them.

    Usage:
        qm = QueryManager(base_dir=Path(__file__).parent / 'sql')
        q = qm.get_query('merged_hourly')
        sql_text = q.format(geo_table='project.ds.geo', sat_table='project.ds.sat', start_date='2025-01-01', end_date='2025-01-02', distance_meters=100)

    Validation:
        qm.validate('merged_hourly') attempts a basic static check. If a BigQuery client is provided,
        a dry-run can be performed.
    """

    def __init__(self, base_dir: Optional[Path] = None, suffix: str = ".sql"):
        self.base_dir = Path(base_dir) if base_dir else Path(__file__).parent
        self.suffix = suffix
        self.queries: Dict[str, Query] = {}
        self._load_queries()

    def _load_queries(self) -> None:
        for path in self.base_dir.rglob(f"*{self.suffix}"):
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            for m in NAMED_QUERY_PATTERN.finditer(text):
                name = m.group("name").strip()
                body = m.group("body").strip()
                # If file contains only one unnamed query, allow using filename as name
                if not name:
                    name = path.stem
                if name in self.queries:
                    # prefer first occurrence; skip duplicates
                    continue
                self.queries[name] = Query(name=name, sql=body, source=path)
            # If no named queries found, register whole file under its stem
            if not any(NAMED_QUERY_PATTERN.finditer(text)):
                self.queries[path.stem] = Query(name=path.stem, sql=text, source=path)

    def get_query(self, name: str) -> Query:
        if name not in self.queries:
            raise KeyError(f"Query not found: {name}")
        return self.queries[name]

    def list_queries(self) -> Set[str]:
        return set(self.queries.keys())

    def detect_placeholders(self, name: str) -> Set[str]:
        return self.get_query(name).placeholders

    # WORK IN PROGRESS: basic validation method; can be extended with actual BigQuery dry-run if client provided
    def validate(
        self, name: str, client: Optional[object] = None, project: Optional[str] = None
    ) -> Dict[str, object]:
        """Performs basic validation. If a client is provided, performs a dry-run.

        Returns dict: { 'ok': bool, 'message': str }
        Ref: https://pypi.org/project/sqlfluff/
        """
        q = self.get_query(name)

        # Basic checks
        sql = q.sql
        # simple balanced parentheses check
        if sql.count("(") != sql.count(")"):
            return {"ok": False, "message": "Unbalanced parentheses"}
        # Use sqlfluff for offline SQL linting (client dialect)
        try:
            from sqlfluff.core import Linter

            linter = Linter(dialect="bigquery")
            result = linter.lint_string(sql)
            violations = result.get_violations() or []
            if violations:
                msgs = []
                for v in violations:
                    code = (
                        getattr(v, "rule_code", None) or getattr(v, "rule", None) or ""
                    )
                    line = (
                        getattr(v, "line_no", None) or getattr(v, "line", None) or "?"
                    )
                    pos = getattr(v, "line_pos", None) or getattr(v, "pos", None) or "?"
                    desc = (
                        getattr(v, "description", None)
                        or getattr(v, "desc", None)
                        or str(v)
                    )
                    msgs.append(f"{code}:{line}:{pos} {desc}")
                return {
                    "ok": False,
                    "message": f"sqlfluff violations: {'; '.join(msgs)}",
                }
            return {"ok": True, "message": "sqlfluff: no issues found"}
        except Exception as e:
            return {"ok": False, "message": f"Offline linting failed: {e}"}


def _default_manager() -> QueryManager:
    base = Path(__file__).parent
    return QueryManager(base_dir=base)


# default singleton for easy import
default = _default_manager()


def get_query(name: str) -> Query:
    return default.get_query(name)


def list_queries() -> Set[str]:
    return default.list_queries()


def query_exists(name: str) -> bool:
    return name in default.list_queries()
