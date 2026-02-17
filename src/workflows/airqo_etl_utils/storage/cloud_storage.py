import pandas as pd
import logging
import os
import io
from tempfile import NamedTemporaryFile
from typing import Generator, Optional, Iterable


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
        """Read bytes into a pre-allocated, writable buffer `b`.

        This implements the raw IO `readinto` interface which some C
        extensions (including pandas' C CSV parser) use for efficient
        reads. Return number of bytes written, or 0 on EOF.
        """
        # Determine how many bytes to read
        size = len(b)
        data = self.read(size)
        n = len(data)
        if n == 0:
            return 0
        # memoryview supports assignment to the buffer
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
        self, bucket: str, source_file: str, destination_file: str
    ) -> str:
        try:
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
        except Exception as e:
            logger.error(f"Failed to download file from GCS: {e}")
            raise

    def upload_file(self, bucket: str, source_file: str, destination_file: str) -> str:
        try:
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
        destination_file: str,
        format: str = "csv",
    ) -> str:
        """
        Upload a dataframe to Google Cloud Storage.

        :param self: The instance of the class.
        :param bucket: The name of the GCS bucket.
        :type bucket: str
        :param dataframe: The dataframe to upload.
        :type dataframe: pd.DataFrame
        :param destination_file: The destination file path in the bucket.
        :type destination_file: str
        :param format: The format to upload the dataframe in (csv, json, parquet).
        :type format: str
        :return: Description
        :rtype: str

        Notes:
        - Always pass a copy of the dataframe to avoid side effects.
        """
        try:
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
                # For parquet, we need a file-like object or bytes
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

    def list_files(self, bucket: str, prefix: str = "") -> list:
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
        """
        Stream CSV files from a GCS bucket. Yields a pandas DataFrame per CSV file found.

        - Only files with a .csv suffix are processed.
        - Each file is read into a pandas.DataFrame in memory and yielded.
        """
        try:
            bucket_obj = self.client.bucket(bucket)
            blobs = bucket_obj.list_blobs(prefix=prefix)
            for blob in blobs:
                if not blob.name.lower().endswith(".csv"):
                    continue
                try:
                    if chunksize:
                        # Use blob.open to stream bytes and wrap to text for pandas.
                        with blob.open("rb") as raw:
                            txt = io.TextIOWrapper(raw, encoding="utf-8")
                            for chunk in pd.read_csv(txt, chunksize=chunksize):
                                yield chunk
                    else:
                        # Default behaviour: download full file and parse
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

        You can configure authentication via:
        1. Environment Variables:
           - AWS_ACCESS_KEY_ID
           - AWS_SECRET_ACCESS_KEY
           - AWS_DEFAULT_REGION
        2. Shared Credential File (~/.aws/credentials)
        3. Config File (~/.aws/config)
        4. IAM Role (if running on EC2/ECS/EKS/Lambda)
    """

    def __init__(self):
        try:
            import boto3

            self.s3 = boto3.client("s3")
        except ImportError:
            logger.error("boto3 is needed for AWSFileStorage")
            raise

    def download_file(
        self, bucket: str, source_file: str, destination_file: str
    ) -> str:
        try:
            self.s3.download_file(bucket, source_file, destination_file)
            logger.info(f"File downloaded from S3://{bucket}/{source_file}")
            return destination_file
        except Exception as e:
            logger.error(f"Failed to download from S3: {e}")
            raise

    def upload_file(self, bucket: str, source_file: str, destination_file: str) -> str:
        try:
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
        destination_file: str,
        format: str = "csv",
    ) -> str:
        try:
            with NamedTemporaryFile(delete=False) as temp:
                if format == "csv":
                    dataframe.to_csv(temp.name, index=False)
                elif format == "json":
                    dataframe.to_json(temp.name, orient="records")
                elif format == "parquet":
                    dataframe.to_parquet(temp.name)
                else:
                    raise ValueError(f"Unsupported format: {format}")

                self.s3.upload_file(temp.name, bucket, destination_file)

            logger.info(f"Dataframe uploaded to s3://{bucket}/{destination_file}")
            return f"s3://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload dataframe to S3: {e}")
            raise
        finally:
            os.unlink(temp.name)

    def stream_csv_files(
        self, bucket: str, prefix: str = "", chunksize: Optional[int] = None
    ) -> Generator[pd.DataFrame, None, None]:
        """
        Stream CSV files from an S3 bucket. Yields a pandas DataFrame per CSV file.

        Uses `get_object` and reads the object body into memory before passing to pandas.
        """
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
                            # `body` is a StreamingBody; wrap as text and stream into pandas
                            txt = io.TextIOWrapper(body, encoding="utf-8")
                            for chunk in pd.read_csv(txt, chunksize=chunksize):
                                yield chunk
                        else:
                            # Full download path
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

        Configuration:
        1. Pass `connection_string` explicitly to the constructor.
        2. Set `AZURE_STORAGE_CONNECTION_STRING` environment variable.
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
        self, bucket: str, source_file: str, destination_file: str
    ) -> str:
        try:
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

    def upload_file(self, bucket: str, source_file: str, destination_file: str) -> str:
        try:
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
        destination_file: str,
        format: str = "csv",
    ) -> str:
        try:
            container_client = self.client.get_container_client(bucket)
            blob_client = container_client.get_blob_client(destination_file)

            data = None
            if format == "csv":
                data = dataframe.to_csv(index=False)
            elif format == "json":
                data = dataframe.to_json(orient="records")
            elif format == "parquet":
                with NamedTemporaryFile() as temp:
                    dataframe.to_parquet(temp.name)
                    with open(temp.name, "rb") as f:
                        data = f.read()
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

    def stream_csv_files(
        self, bucket: str, prefix: str = "", chunksize: Optional[int] = None
    ) -> Generator[pd.DataFrame, None, None]:
        """
        Stream CSV files from an Azure Blob container. Yields a pandas DataFrame per CSV file.

        - Only files with .csv extension are read.
        - Uses `download_blob().readall()` to get bytes and then pandas to parse.
        """
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
                        # stream.chunks() yields bytes; wrap into a file-like object
                        iterator = stream.chunks()
                        raw = BytesIteratorIO(iterator)
                        buffered = io.BufferedReader(raw)
                        txt = io.TextIOWrapper(buffered, encoding="utf-8")
                        for chunk in pd.read_csv(txt, chunksize=chunksize):
                            yield chunk
                    else:
                        # Full download path
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

        Configuration:
        1. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable to path of JSON key file.
        2. Ensure the Service Account has valid scopes for Drive API:
           - 'https://www.googleapis.com/auth/drive'
    """

    def __init__(self):
        try:
            from googleapiclient.discovery import build
            from google.oauth2 import service_account

            # Scopes required for Drive API
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
        self, bucket: str, source_file: str, destination_file: str
    ) -> str:
        """
        Download file from Google Drive.

        Args:
            bucket: Treated as the Folder ID where the file resides (optional search context).
                    If source_file is a File ID, bucket is ignored.
                    If source_file is a name, we search within this folder.
            source_file: The File ID or File Name of the file to download.
            destination_file: Local path to save the file.
        """
        try:
            from googleapiclient.http import MediaIoBaseDownload
            import io

            # Check if source_file looks like an ID (basic heuristic or assume name)
            # For simplicity, let's assume source_file is a file name and bucket is folder_id
            # We first search for the file ID
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
        except Exception as e:
            logger.error(f"Failed to download from Drive: {e}")
            raise

    def upload_file(self, bucket: str, source_file: str, destination_file: str) -> str:
        """
        Upload file to Google Drive.

        Args:
            bucket: The Folder ID where the file will be uploaded.
            source_file: Local path to the file.
            destination_file: Name of the file in Google Drive.
        """
        try:
            from googleapiclient.http import MediaFileUpload

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
        destination_file: str,
        format: str = "csv",
    ) -> str:
        try:
            with NamedTemporaryFile(delete=False, suffix=f".{format}") as temp:
                if format == "csv":
                    dataframe.to_csv(temp.name, index=False)
                    mimetype = "text/csv"
                elif format == "json":
                    dataframe.to_json(temp.name, orient="records")
                    mimetype = "application/json"
                elif format == "parquet":
                    dataframe.to_parquet(temp.name)
                    mimetype = "application/octet-stream"
                else:
                    raise ValueError(f"Unsupported format: {format}")

                # Close temp file ensuring data is flushed
                temp_path = temp.name

            # For simplicity, reusing upload_file which handles generic upload
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
            os.unlink(temp_path)

    def stream_csv_files(
        self, bucket: str, prefix: str = "", chunksize: Optional[int] = None
    ) -> Generator[pd.DataFrame, None, None]:
        """
        Stream CSV files from a Google Drive folder. Yields a pandas DataFrame per CSV file.

        Args:
            bucket: Folder ID to search in.
            prefix: optional filename prefix filter (applied to name contains).
        """
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
                    try:
                        # Download to a temporary file on disk and stream from there
                        with NamedTemporaryFile(delete=False) as temp:
                            temp_path = temp.name
                            request = self.service.files().get_media(fileId=file_id)
                            downloader = MediaIoBaseDownload(temp, request)
                            done = False
                            while done is False:
                                status, done = downloader.next_chunk()

                        try:
                            if chunksize:
                                for chunk in pd.read_csv(
                                    temp_path, chunksize=chunksize
                                ):
                                    yield chunk
                            else:
                                df = pd.read_csv(temp_path)
                                yield df
                        finally:
                            try:
                                os.unlink(temp_path)
                            except Exception:
                                pass
                    except Exception as e:
                        logger.error(f"Failed to stream CSV {name} from Drive: {e}")
                        continue

                page_token = res.get("nextPageToken")
                if not page_token:
                    break
        except Exception as e:
            logger.error(f"Failed to list/stream CSVs from Drive: {e}")
            raise

    def _get_file_id(self, filename: str, folder_id: str) -> str:
        """Helper to find file ID by name within a folder."""
        # query = f"name = '{filename}' and '{folder_id}' in parents and trashed = false"
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
