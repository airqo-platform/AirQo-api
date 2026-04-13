import pandas as pd
import logging
import os
import io
import tempfile
import joblib
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Generator, Optional, Iterable

from .base import FileStorage

logger = logging.getLogger("airflow.task")


class BytesIteratorIO(io.RawIOBase):
    """Wrap an iterator of bytes into a binary file-like object.

    Works with `io.BufferedReader` and `io.TextIOWrapper` to provide a
    text-stream to consumers like `pandas.read_csv` without loading the whole
    object into memory.
    """

    def __init__(self, iterator: Iterable[bytes]):
        self._iter = iter(iterator)
        self._buf = b""

    def readable(self) -> bool:  # pragma: no cover - trivial
        return True

    def read(self, size: int = -1) -> bytes:
        if size == -1:
            parts = [self._buf]
            self._buf = b""
            for chunk in self._iter:
                parts.append(chunk)
            return b"".join(parts)

        while len(self._buf) < size:
            try:
                nxt = next(self._iter)
            except StopIteration:
                break
            if isinstance(nxt, memoryview):
                nxt = nxt.tobytes()
            self._buf += nxt

        out = self._buf[:size]
        self._buf = self._buf[size:]
        return out

    def readinto(self, b) -> int:
        """Read bytes into a pre-allocated, writable buffer `b`."""
        size = len(b)
        data = self.read(size)
        n = len(data)
        if n == 0:
            return 0
        b[:n] = data
        return n


class GCSFileStorage(FileStorage):
    """
    Google Cloud Storage implementation.

    Authentication:
        Uses Google Cloud Application Default Credentials (ADC).
        Ensure `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set
        pointing to your JSON key file, or the environment is authorized
        (e.g., GKE Workload Identity, Compute Engine default service account).
    """

    def __init__(self):
        try:
            from google.cloud import storage

            self.client = storage.Client()
        except ImportError:
            logger.error("google-cloud-storage is needed for GCSFileStorage")
            raise

    def download_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            destination_file = destination_file or os.path.basename(source_file)

            bucket_obj = self.client.bucket(bucket)
            blob = bucket_obj.blob(source_file)

            if not blob.exists():
                raise FileNotFoundError(
                    f"The file '{source_file}' does not exist in the bucket '{bucket}'."
                )

            blob.download_to_filename(destination_file)
            logger.info(
                f"File: {destination_file} downloaded from bucket: {bucket} successfully"
            )
            return destination_file
        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to download file from GCS: {e}")
            raise

    def upload_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            destination_file = destination_file or os.path.basename(source_file)

            bucket_obj = self.client.bucket(bucket)
            blob = bucket_obj.blob(destination_file)
            blob.upload_from_filename(source_file)

            logger.info(
                f"File {source_file} uploaded to gs://{bucket}/{destination_file}"
            )
            return f"gs://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload file to GCS: {e}")
            raise

    def upload_dataframe(
        self,
        bucket: str,
        dataframe: pd.DataFrame,
        destination_file: str = None,
        format: str = "csv",
    ) -> str:
        try:
            destination_file = destination_file or f"dataframe.{format}"

            bucket_obj = self.client.bucket(bucket)
            blob = bucket_obj.blob(destination_file)
            dataframe.reset_index(drop=True, inplace=True)

            if format == "csv":
                blob.upload_from_string(dataframe.to_csv(index=False), "text/csv")
            elif format == "json":
                blob.upload_from_string(
                    dataframe.to_json(orient="records"), "application/json"
                )
            elif format == "parquet":
                with NamedTemporaryFile() as temp:
                    dataframe.to_parquet(temp.name)
                    blob.upload_from_filename(
                        temp.name, content_type="application/octet-stream"
                    )
            else:
                raise ValueError(f"Unsupported format: {format}")

            logger.info(
                f"Dataframe uploaded to gs://{bucket}/{destination_file} as {format}"
            )
            return f"gs://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload dataframe to GCS: {e}")
            raise

    def save_file_object(self, bucket: str, obj: Any, destination_file: str) -> str:
        """Serialize and upload a Python object directly to GCS (in-memory, no tempfile)."""
        try:
            buf = io.BytesIO()
            joblib.dump(obj, buf)
            buf.seek(0)

            bucket_obj = self.client.bucket(bucket)
            blob = bucket_obj.blob(destination_file)
            blob.upload_from_file(buf, content_type="application/octet-stream")

            uri = f"gs://{bucket}/{destination_file}"
            logger.info(f"Object serialized and uploaded to {uri}")
            return uri
        except Exception as e:
            logger.error(
                f"Failed to save object to gs://{bucket}/{destination_file}: {e}"
            )
            raise

    def load_file_object(
        self,
        bucket: str,
        source_file: str,
        local_cache_path: Optional[str] = None,
    ) -> Any:
        """Download and deserialize a Python object from GCS (in-memory when uncached)."""
        try:
            # Check local cache first, but guard against corrupt partial files
            if local_cache_path and Path(local_cache_path).exists():
                try:
                    logger.info(f"Using cached object at {local_cache_path}")
                    return joblib.load(local_cache_path)
                except Exception as cache_err:
                    logger.warning(
                        f"Cached file at {local_cache_path} is corrupt ({cache_err}). "
                        "Deleting and re-downloading."
                    )
                    Path(local_cache_path).unlink(missing_ok=True)

            bucket_obj = self.client.bucket(bucket)
            blob = bucket_obj.blob(source_file)

            if not blob.exists():
                raise FileNotFoundError(
                    f"The file '{source_file}' does not exist in the bucket '{bucket}'."
                )

            if local_cache_path:
                # Download atomically: write to a temp file then rename so the
                # cache path is never left in a partial/corrupt state on failure.
                cache_path = Path(local_cache_path)
                tmp_path = cache_path.with_suffix(".tmp")
                try:
                    blob.download_to_filename(str(tmp_path))
                    tmp_path.rename(cache_path)
                except Exception:
                    tmp_path.unlink(missing_ok=True)
                    raise
                logger.info(f"Downloaded and cached object at {local_cache_path}")
                return joblib.load(local_cache_path)

            # In-memory download — no disk I/O needed
            data = blob.download_as_bytes()
            buf = io.BytesIO(data)
            obj = joblib.load(buf)
            logger.info(f"Loaded object from gs://{bucket}/{source_file}")
            return obj

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to load object from gs://{bucket}/{source_file}: {e}")
            raise

    def list_files(self, bucket: str, prefix: str = "") -> list:
        """List all file paths in a GCS bucket, optionally filtered by prefix.

        Args:
            bucket: The GCS bucket name.
            prefix: Optional path prefix to filter results.

        Returns:
            List of blob names (strings).
        """
        try:
            bucket_obj = self.client.bucket(bucket)
            blobs = bucket_obj.list_blobs(prefix=prefix)
            file_list = [blob.name for blob in blobs]
            logger.info(f"Files in gs://{bucket}/{prefix}: {file_list}")
            return file_list
        except Exception as e:
            logger.error(f"Failed to list files in GCS: {e}")
            raise

    def stream_csv_files(
        self, bucket: str, prefix: str = "", chunksize: Optional[int] = None
    ) -> Generator[pd.DataFrame, None, None]:
        """Stream CSV files from a GCS bucket. Yields a pandas DataFrame per CSV file."""
        try:
            bucket_obj = self.client.bucket(bucket)
            blobs = bucket_obj.list_blobs(prefix=prefix)
            for blob in blobs:
                if not blob.name.lower().endswith(".csv"):
                    continue
                try:
                    if chunksize:
                        with blob.open("rb") as raw:
                            txt = io.TextIOWrapper(raw, encoding="utf-8")
                            for chunk in pd.read_csv(txt, chunksize=chunksize):
                                yield chunk
                    else:
                        data = blob.download_as_bytes()
                        bio = io.BytesIO(data)
                        df = pd.read_csv(bio)
                        yield df
                except Exception as e:
                    logger.error(f"Failed to stream CSV {blob.name} from GCS: {e}")
                    continue
        except Exception as e:
            logger.error(f"Failed to list/stream CSVs from GCS: {e}")
            raise


class AWSFileStorage(FileStorage):
    """
    AWS S3 Storage implementation.

    Authentication:
        Uses boto3 standard credential resolution chain.
    """

    def __init__(self):
        try:
            import boto3

            self.s3 = boto3.client("s3")
        except ImportError:
            logger.error("boto3 is needed for AWSFileStorage")
            raise

    def download_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            destination_file = destination_file or os.path.basename(source_file)
            self.s3.download_file(bucket, source_file, destination_file)
            logger.info(f"File downloaded from S3://{bucket}/{source_file}")
            return destination_file
        except Exception as e:
            logger.error(f"Failed to download from S3: {e}")
            raise

    def upload_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            destination_file = destination_file or os.path.basename(source_file)
            self.s3.upload_file(source_file, bucket, destination_file)
            logger.info(f"File uploaded to s3://{bucket}/{destination_file}")
            return f"s3://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload to S3: {e}")
            raise

    def upload_dataframe(
        self,
        bucket: str,
        dataframe: pd.DataFrame,
        destination_file: str = None,
        format: str = "csv",
    ) -> str:
        temp_path = None
        try:
            destination_file = destination_file or f"dataframe.{format}"

            with NamedTemporaryFile(delete=False) as temp:
                temp_path = temp.name
                if format == "csv":
                    dataframe.to_csv(temp_path, index=False)
                elif format == "json":
                    dataframe.to_json(temp_path, orient="records")
                elif format == "parquet":
                    dataframe.to_parquet(temp_path)
                else:
                    raise ValueError(f"Unsupported format: {format}")

            self.s3.upload_file(temp_path, bucket, destination_file)
            logger.info(f"Dataframe uploaded to s3://{bucket}/{destination_file}")
            return f"s3://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload dataframe to S3: {e}")
            raise
        finally:
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

    def save_file_object(self, bucket: str, obj: Any, destination_file: str) -> str:
        """Serialize and upload a Python object to S3 (in-memory)."""
        try:
            buf = io.BytesIO()
            joblib.dump(obj, buf)
            buf.seek(0)

            self.s3.upload_fileobj(buf, bucket, destination_file)

            uri = f"s3://{bucket}/{destination_file}"
            logger.info(f"Object serialized and uploaded to {uri}")
            return uri
        except Exception as e:
            logger.error(
                f"Failed to save object to s3://{bucket}/{destination_file}: {e}"
            )
            raise

    def load_file_object(
        self,
        bucket: str,
        source_file: str,
        local_cache_path: Optional[str] = None,
    ) -> Any:
        """Download and deserialize a Python object from S3."""
        try:
            if local_cache_path and Path(local_cache_path).exists():
                logger.info(f"Using cached object at {local_cache_path}")
                return joblib.load(local_cache_path)

            if local_cache_path:
                self.s3.download_file(bucket, source_file, local_cache_path)
                logger.info(f"Downloaded and cached object at {local_cache_path}")
                return joblib.load(local_cache_path)

            # In-memory download
            buf = io.BytesIO()
            self.s3.download_fileobj(bucket, source_file, buf)
            buf.seek(0)
            obj = joblib.load(buf)
            logger.info(f"Loaded object from s3://{bucket}/{source_file}")
            return obj

        except self.s3.exceptions.ClientError as e:
            if e.response["Error"]["Code"] == "404":
                raise FileNotFoundError(
                    f"The file '{source_file}' does not exist in the bucket '{bucket}'."
                ) from e
            raise
        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to load object from s3://{bucket}/{source_file}: {e}")
            raise

    def stream_csv_files(
        self, bucket: str, prefix: str = "", chunksize: Optional[int] = None
    ) -> Generator[pd.DataFrame, None, None]:
        """Stream CSV files from an S3 bucket. Yields a pandas DataFrame per CSV file."""
        try:
            paginator = self.s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                for obj in page.get("Contents", []) or []:
                    key = obj.get("Key")
                    if not key or not key.lower().endswith(".csv"):
                        continue
                    try:
                        resp = self.s3.get_object(Bucket=bucket, Key=key)
                        body = resp["Body"]
                        if chunksize:
                            txt = io.TextIOWrapper(body, encoding="utf-8")
                            for chunk in pd.read_csv(txt, chunksize=chunksize):
                                yield chunk
                        else:
                            data = body.read()
                            bio = io.BytesIO(data)
                            df = pd.read_csv(bio)
                            yield df
                    except Exception as e:
                        logger.error(f"Failed to stream CSV {key} from S3: {e}")
                        continue
        except Exception as e:
            logger.error(f"Failed to list/stream CSVs from S3: {e}")
            raise


class AzureBlobFileStorage(FileStorage):
    """
    Azure Blob Storage implementation.

    Authentication:
        Requires a connection string.
    """

    def __init__(self, connection_string: str = None):
        try:
            from azure.storage.blob import BlobServiceClient

            conn_str = connection_string or os.getenv("AZURE_STORAGE_CONNECTION_STRING")
            if not conn_str:
                raise ValueError("Azure connection string is required")
            self.client = BlobServiceClient.from_connection_string(conn_str)
        except ImportError:
            logger.error("azure-storage-blob is needed for AzureBlobFileStorage")
            raise

    def download_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            destination_file = destination_file or os.path.basename(source_file)
            container_client = self.client.get_container_client(bucket)
            blob_client = container_client.get_blob_client(source_file)

            with open(destination_file, "wb") as file:
                download_stream = blob_client.download_blob()
                file.write(download_stream.readall())

            logger.info(f"File downloaded from Azure container {bucket}/{source_file}")
            return destination_file
        except Exception as e:
            logger.error(f"Failed to download from Azure: {e}")
            raise

    def upload_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            destination_file = destination_file or os.path.basename(source_file)
            container_client = self.client.get_container_client(bucket)
            blob_client = container_client.get_blob_client(destination_file)

            with open(source_file, "rb") as data:
                blob_client.upload_blob(data, overwrite=True)

            logger.info(f"File uploaded to Azure container {bucket}/{destination_file}")
            return f"azure://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload to Azure: {e}")
            raise

    def upload_dataframe(
        self,
        bucket: str,
        dataframe: pd.DataFrame,
        destination_file: str = None,
        format: str = "csv",
    ) -> str:
        try:
            destination_file = destination_file or f"dataframe.{format}"
            container_client = self.client.get_container_client(bucket)
            blob_client = container_client.get_blob_client(destination_file)

            if format == "csv":
                data = dataframe.to_csv(index=False)
            elif format == "json":
                data = dataframe.to_json(orient="records")
            elif format == "parquet":
                buf = io.BytesIO()
                dataframe.to_parquet(buf)
                data = buf.getvalue()
            else:
                raise ValueError(f"Unsupported format: {format}")

            blob_client.upload_blob(data, overwrite=True)
            logger.info(
                f"Dataframe uploaded to Azure container {bucket}/{destination_file}"
            )
            return f"azure://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload dataframe to Azure: {e}")
            raise

    def save_file_object(self, bucket: str, obj: Any, destination_file: str) -> str:
        """Serialize and upload a Python object to Azure Blob (in-memory)."""
        try:
            buf = io.BytesIO()
            joblib.dump(obj, buf)
            buf.seek(0)

            container_client = self.client.get_container_client(bucket)
            blob_client = container_client.get_blob_client(destination_file)
            blob_client.upload_blob(buf, overwrite=True)

            uri = f"azure://{bucket}/{destination_file}"
            logger.info(f"Object serialized and uploaded to {uri}")
            return uri
        except Exception as e:
            logger.error(
                f"Failed to save object to azure://{bucket}/{destination_file}: {e}"
            )
            raise

    def load_file_object(
        self,
        bucket: str,
        source_file: str,
        local_cache_path: Optional[str] = None,
    ) -> Any:
        """Download and deserialize a Python object from Azure Blob."""
        try:
            if local_cache_path and Path(local_cache_path).exists():
                logger.info(f"Using cached object at {local_cache_path}")
                return joblib.load(local_cache_path)

            container_client = self.client.get_container_client(bucket)
            blob_client = container_client.get_blob_client(source_file)

            if local_cache_path:
                with open(local_cache_path, "wb") as f:
                    download_stream = blob_client.download_blob()
                    f.write(download_stream.readall())
                logger.info(f"Downloaded and cached object at {local_cache_path}")
                return joblib.load(local_cache_path)

            # In-memory download
            download_stream = blob_client.download_blob()
            data = download_stream.readall()
            buf = io.BytesIO(data)
            obj = joblib.load(buf)
            logger.info(f"Loaded object from azure://{bucket}/{source_file}")
            return obj

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(
                f"Failed to load object from azure://{bucket}/{source_file}: {e}"
            )
            raise

    def stream_csv_files(
        self, bucket: str, prefix: str = "", chunksize: Optional[int] = None
    ) -> Generator[pd.DataFrame, None, None]:
        """Stream CSV files from an Azure Blob container."""
        try:
            container_client = self.client.get_container_client(bucket)
            blobs = container_client.list_blobs(name_starts_with=prefix)
            for b in blobs:
                if not b.name.lower().endswith(".csv"):
                    continue
                try:
                    blob_client = container_client.get_blob_client(b.name)
                    stream = blob_client.download_blob()
                    if chunksize:
                        iterator = stream.chunks()
                        raw = BytesIteratorIO(iterator)
                        buffered = io.BufferedReader(raw)
                        txt = io.TextIOWrapper(buffered, encoding="utf-8")
                        for chunk in pd.read_csv(txt, chunksize=chunksize):
                            yield chunk
                    else:
                        data = stream.readall()
                        bio = io.BytesIO(data)
                        df = pd.read_csv(bio)
                        yield df
                except Exception as e:
                    logger.error(f"Failed to stream CSV {b.name} from Azure: {e}")
                    continue
        except Exception as e:
            logger.error(f"Failed to list/stream CSVs from Azure: {e}")
            raise


class GoogleDriveFileStorage(FileStorage):
    """
    Google Drive implementation.

    Authentication:
        Uses Google Service Account credentials.
    """

    def __init__(self):
        try:
            from googleapiclient.discovery import build
            from google.oauth2 import service_account

            SCOPES = ["https://www.googleapis.com/auth/drive"]

            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if not creds_path:
                raise ValueError(
                    "GOOGLE_APPLICATION_CREDENTIALS environment variable not set"
                )

            creds = service_account.Credentials.from_service_account_file(
                creds_path, scopes=SCOPES
            )
            self.service = build("drive", "v3", credentials=creds)

        except ImportError:
            logger.error(
                "google-api-python-client is needed for GoogleDriveFileStorage"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Google Drive client: {e}")
            raise

    def download_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            from googleapiclient.http import MediaIoBaseDownload

            destination_file = destination_file or os.path.basename(source_file)

            file_id = self._get_file_id(source_file, folder_id=bucket)
            if not file_id:
                raise FileNotFoundError(
                    f"File '{source_file}' not found in folder '{bucket}'"
                )

            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)

            done = False
            while done is False:
                status, done = downloader.next_chunk()

            with open(destination_file, "wb") as f:
                f.write(fh.getbuffer())

            logger.info(f"File downloaded from Drive folder {bucket}: {source_file}")
            return destination_file
        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to download from Drive: {e}")
            raise

    def upload_file(
        self, bucket: str, source_file: str, destination_file: str = None
    ) -> str:
        try:
            from googleapiclient.http import MediaFileUpload

            destination_file = destination_file or os.path.basename(source_file)

            file_metadata = {"name": destination_file, "parents": [bucket]}
            media = MediaFileUpload(source_file, resumable=True)

            file = (
                self.service.files()
                .create(body=file_metadata, media_body=media, fields="id")
                .execute()
            )

            logger.info(
                f"File uploaded to Drive folder {bucket} with ID: {file.get('id')}"
            )
            return file.get("id")
        except Exception as e:
            logger.error(f"Failed to upload to Drive: {e}")
            raise

    def upload_dataframe(
        self,
        bucket: str,
        dataframe: pd.DataFrame,
        destination_file: str = None,
        format: str = "csv",
    ) -> str:
        temp_path = None
        try:
            destination_file = destination_file or f"dataframe.{format}"

            with NamedTemporaryFile(delete=False, suffix=f".{format}") as temp:
                temp_path = temp.name
                if format == "csv":
                    dataframe.to_csv(temp_path, index=False)
                    mimetype = "text/csv"
                elif format == "json":
                    dataframe.to_json(temp_path, orient="records")
                    mimetype = "application/json"
                elif format == "parquet":
                    dataframe.to_parquet(temp_path)
                    mimetype = "application/octet-stream"
                else:
                    raise ValueError(f"Unsupported format: {format}")

            from googleapiclient.http import MediaFileUpload

            file_metadata = {"name": destination_file, "parents": [bucket]}
            media = MediaFileUpload(temp_path, mimetype=mimetype, resumable=True)

            file = (
                self.service.files()
                .create(body=file_metadata, media_body=media, fields="id")
                .execute()
            )

            logger.info(
                f"Dataframe uploaded to Drive folder {bucket} as {destination_file}"
            )
            return file.get("id")
        except Exception as e:
            logger.error(f"Failed to upload dataframe to Drive: {e}")
            raise
        finally:
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

    def save_file_object(self, bucket: str, obj: Any, destination_file: str) -> str:
        """Serialize and upload a Python object to Google Drive."""
        temp_path = None
        try:
            from googleapiclient.http import MediaFileUpload

            # Drive API requires a file on disk for MediaFileUpload
            with NamedTemporaryFile(delete=False, suffix=".pkl") as temp:
                temp_path = temp.name
                joblib.dump(obj, temp_path)

            file_metadata = {"name": destination_file, "parents": [bucket]}
            media = MediaFileUpload(
                temp_path,
                mimetype="application/octet-stream",
                resumable=True,
            )

            file = (
                self.service.files()
                .create(body=file_metadata, media_body=media, fields="id")
                .execute()
            )

            file_id = file.get("id")
            logger.info(
                f"Object serialized and uploaded to Drive folder {bucket} "
                f"with ID: {file_id}"
            )
            return file_id
        except Exception as e:
            logger.error(f"Failed to save object to Drive folder {bucket}: {e}")
            raise
        finally:
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

    def load_file_object(
        self,
        bucket: str,
        source_file: str,
        local_cache_path: Optional[str] = None,
    ) -> Any:
        """Download and deserialize a Python object from Google Drive."""
        try:
            from googleapiclient.http import MediaIoBaseDownload

            if local_cache_path and Path(local_cache_path).exists():
                logger.info(f"Using cached object at {local_cache_path}")
                return joblib.load(local_cache_path)

            file_id = self._get_file_id(source_file, folder_id=bucket)
            if not file_id:
                raise FileNotFoundError(
                    f"File '{source_file}' not found in folder '{bucket}'"
                )

            request = self.service.files().get_media(fileId=file_id)
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, request)
            done = False
            while done is False:
                _, done = downloader.next_chunk()

            if local_cache_path:
                with open(local_cache_path, "wb") as f:
                    f.write(buf.getbuffer())
                logger.info(f"Downloaded and cached object at {local_cache_path}")
                return joblib.load(local_cache_path)

            buf.seek(0)
            obj = joblib.load(buf)
            logger.info(f"Loaded object from Drive folder {bucket}: {source_file}")
            return obj

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to load object from Drive folder {bucket}: {e}")
            raise

    def stream_csv_files(
        self, bucket: str, prefix: str = "", chunksize: Optional[int] = None
    ) -> Generator[pd.DataFrame, None, None]:
        """Stream CSV files from a Google Drive folder."""
        try:
            from googleapiclient.http import MediaIoBaseDownload

            page_token = None
            q = f"'{bucket}' in parents and trashed = false"
            if prefix:
                q = q + f" and name contains '{prefix}'"

            while True:
                res = (
                    self.service.files()
                    .list(
                        q=q,
                        spaces="drive",
                        pageToken=page_token,
                        fields="nextPageToken, files(id, name)",
                    )
                    .execute()
                )
                items = res.get("files", [])
                for item in items:
                    name = item.get("name", "")
                    if not name.lower().endswith(".csv"):
                        continue
                    file_id = item.get("id")
                    temp_path = None
                    try:
                        with NamedTemporaryFile(delete=False) as temp:
                            temp_path = temp.name
                            request = self.service.files().get_media(fileId=file_id)
                            downloader = MediaIoBaseDownload(temp, request)
                            done = False
                            while done is False:
                                _, done = downloader.next_chunk()

                        if chunksize:
                            for chunk in pd.read_csv(temp_path, chunksize=chunksize):
                                yield chunk
                        else:
                            df = pd.read_csv(temp_path)
                            yield df
                    except Exception as e:
                        logger.error(f"Failed to stream CSV {name} from Drive: {e}")
                        continue
                    finally:
                        if temp_path:
                            try:
                                os.unlink(temp_path)
                            except OSError:
                                pass

                page_token = res.get("nextPageToken")
                if not page_token:
                    break
        except Exception as e:
            logger.error(f"Failed to list/stream CSVs from Drive: {e}")
            raise

    def _get_file_id(self, filename: str, folder_id: str) -> str:
        """Helper to find file ID by name within a folder."""
        safe_name = filename.replace("\\", "\\\\").replace("'", "\\'")
        query = f"name = '{safe_name}' and '{folder_id}' in parents and trashed = false"
        results = (
            self.service.files()
            .list(q=query, pageSize=1, fields="files(id, name)")
            .execute()
        )
        items = results.get("files", [])
        if not items:
            return None
        return items[0]["id"]
