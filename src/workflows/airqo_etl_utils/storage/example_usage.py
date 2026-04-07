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

"""
File Storage Usage Example:
    from airqo_etl_utils.storage import GCSFileStorage, FileStorage

    file_storage: FileStorage = GCSFileStorage()

    # Upload file
    file_storage.upload_file("my-bucket", "local_file.csv", "remote_file.csv")

    # Upload dataframe
    import pandas as pd
    df = pd.DataFrame({"a": [1, 2, 3]})
    file_storage.upload_dataframe("my-bucket", df, "data.csv", format="csv")

    #download file
    file_storage.download_file("my-bucket", "remote_file.csv", "downloaded_file.csv")
"""

"""Shows full-file yields and chunked yields using `stream_csv_files(..., chunksize=...)`.

Behavior summary (final implementation):
 - GCS: streams via `blob.open('rb')` wrapped in `TextIOWrapper` when `chunksize`
   is provided; falls back to `download_as_bytes()` for full-file reads.
 - S3: streams via `StreamingBody` wrapped in `TextIOWrapper` when `chunksize` is
   provided; falls back to `Body.read()` for full-file reads.
 - Azure: streams via `download_blob().chunks()` piped through a small adapter
   into `TextIOWrapper` when `chunksize` is provided; falls back to
   `readall()` for full-file reads.
 - Google Drive: downloads to a temporary file and calls `pd.read_csv(temp_path,
   chunksize=...)` to avoid memory buffering (disk-backed streaming).

Examples below are minimal and require valid credentials/buckets to run.

from typing import Optional

import pandas as pd

from airqo_etl_utils.storage.cloud_storage import (
    GCSFileStorage,
    AWSFileStorage,
    AzureBlobFileStorage,
    GoogleDriveFileStorage,
)


def process(df: pd.DataFrame) -> None:
    # Placeholder processing function for each yielded DataFrame.
    print("Got DataFrame with shape:", df.shape)


def demo_gcs(bucket: str, prefix: str = "") -> None:
    fs = GCSFileStorage()
    for df in fs.stream_csv_files(bucket, prefix=prefix):
        process(df)
    for chunk in fs.stream_csv_files(bucket, prefix=prefix, chunksize=10000):
        process(chunk)


def demo_s3(bucket: str, prefix: str = "") -> None:
    fs = AWSFileStorage()
    for df in fs.stream_csv_files(bucket, prefix=prefix):
        process(df)
    for chunk in fs.stream_csv_files(bucket, prefix=prefix, chunksize=5000):
        process(chunk)


def demo_azure(container: str, prefix: str = "") -> None:
    fs = AzureBlobFileStorage()
    for df in fs.stream_csv_files(container, prefix=prefix):
        process(df)
    for chunk in fs.stream_csv_files(container, prefix=prefix, chunksize=2000):
        process(chunk)


def demo_drive(folder_id: str, prefix: str = "") -> None:
    fs = GoogleDriveFileStorage()
    for df in fs.stream_csv_files(folder_id, prefix=prefix):
        process(df)
    for chunk in fs.stream_csv_files(folder_id, prefix=prefix, chunksize=1000):
        process(chunk)


if __name__ == "__main__":
    # Replace these placeholders with real values before running
    GCS_BUCKET = "your-gcs-bucket"
    S3_BUCKET = "your-s3-bucket"
    AZURE_CONTAINER = "your-container"
    DRIVE_FOLDER_ID = "your-drive-folder-id"

    # Uncomment whichever demo you want to run (and provide valid names/credentials)
    # demo_gcs(GCS_BUCKET, prefix="path/")
    # demo_s3(S3_BUCKET, prefix="path/")
    # demo_azure(AZURE_CONTAINER, prefix="path/")
    # demo_drive(DRIVE_FOLDER_ID, prefix="")
"""
