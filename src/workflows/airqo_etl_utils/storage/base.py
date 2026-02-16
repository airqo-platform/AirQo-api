from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, Tuple, Optional
import pandas as pd


class StorageAdapter(ABC):
    """Abstract interface for storage backends (BigQuery, GCS staging, etc.).

    Implementations should be registered via `register_storage(name, backend)`
    and retrieved with `get_storage(name)`.
    """

    @abstractmethod
    def load_dataframe(
        self, dataframe: pd.DataFrame, table: str, job_action: Any = None, **opts
    ) -> Dict[str, Any]:
        raise NotImplementedError()

    @abstractmethod
    def validate_schema(self, table: str, df: pd.DataFrame) -> Tuple[bool, list]:
        raise NotImplementedError()

    @abstractmethod
    def download_query(self, query: str) -> pd.DataFrame:
        raise NotImplementedError()

    def staged_load(
        self, dataframe: pd.DataFrame, table: str, **opts
    ) -> Dict[str, Any]:
        """Optional: staged load implementation (e.g., upload to GCS + load job).

        Backends that support staged loads can override this for large datasets.
        """
        raise NotImplementedError()


class FileStorage(ABC):
    """Abstract interface for file object storage (GCS, S3, Azure Blob, Drive)."""

    @abstractmethod
    def download_file(
        self, bucket: str, source_file: str, destination_file: str
    ) -> str:
        """Download a file from storage to local path."""
        raise NotImplementedError()

    @abstractmethod
    def upload_file(self, bucket: str, source_file: str, destination_file: str) -> str:
        """Upload a local file to storage."""
        raise NotImplementedError()

    @abstractmethod
    def upload_dataframe(
        self,
        bucket: str,
        dataframe: pd.DataFrame,
        destination_file: str,
        format: str = "csv",
    ) -> str:
        """Upload a dataframe to storage."""
        raise NotImplementedError()
