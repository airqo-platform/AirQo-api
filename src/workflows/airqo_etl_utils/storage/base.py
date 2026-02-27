from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, Tuple, Optional
import pandas as pd

import logging

logger = logging.getLogger("airflow.task")


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
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        """Download a file from storage to local path.

        If destination_file is not provided, uses the source filename.
        """
        raise NotImplementedError()

    @abstractmethod
    def upload_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        """Upload a local file to storage.

        If destination_file is not provided, uses the source filename.
        """
        raise NotImplementedError()

    @abstractmethod
    def upload_dataframe(
        self,
        bucket: str,
        dataframe: pd.DataFrame,
        destination_file: str = None,
        format: str = "csv",
    ) -> str:
        """Upload a dataframe to storage.

        If destination_file is not provided, uses a default name like 'dataframe.{format}'.
        """
        raise NotImplementedError()

    @abstractmethod
    def save_file_object(
        self,
        bucket: str,
        obj: Any,
        destination_file: str,
    ) -> str:
        """Serialize and upload a Python object to cloud storage.

        Serializes the object using joblib and uploads to the specified
        bucket/destination. Implementations should avoid unnecessary disk I/O
        where possible (e.g., serialize to bytes in memory).

        Args:
            bucket: The bucket/container name.
            obj: The Python object to serialize (model, config, etc.).
            destination_file: Path/key in cloud storage (e.g., "models/rf_model.pkl").

        Returns:
            The storage URI of the uploaded object.

        Raises:
            Exception: If serialization or upload fails.
        """
        raise NotImplementedError()

    @abstractmethod
    def load_file_object(
        self,
        bucket: str,
        source_file: str,
        local_cache_path: Optional[str] = None,
    ) -> Any:
        """Download and deserialize a Python object from cloud storage.

        Downloads the serialized file and deserializes it using joblib.
        Supports optional local caching to avoid re-downloading.

        Args:
            bucket: The bucket/container name.
            source_file: Path/key in cloud storage (e.g., "models/rf_model.pkl").
            local_cache_path: Optional local path to cache the downloaded file.
                If the file already exists at this path, it is loaded directly
                without downloading again.

        Returns:
            The deserialized Python object.

        Raises:
            FileNotFoundError: If the file does not exist in storage.
            Exception: If download or deserialization fails.
        """
        raise NotImplementedError()
