import io
import types

import pandas as pd

from airqo_etl_utils.storage.cloud_storage import (
    GCSFileStorage,
    AWSFileStorage,
    AzureBlobFileStorage,
)


CSV_BYTES = b"a,b\n1,2\n3,4\n"


class FakeBlob:
    def __init__(self, name: str, data: bytes):
        self.name = name
        self._data = data

    def open(self, mode="rb"):
        class CM:
            def __init__(self, data):
                self._buf = io.BytesIO(data)

            def __enter__(self):
                return self._buf

            def __exit__(self, exc_type, exc, tb):
                return False

        return CM(self._data)

    def download_as_bytes(self):
        return self._data


class FakeBucket:
    def __init__(self, blobs):
        self._blobs = blobs

    def list_blobs(self, prefix=None):
        return self._blobs


class FakeGCSClient:
    def __init__(self, bucket):
        self._bucket = bucket

    def bucket(self, name):
        return self._bucket


def test_gcs_streaming_chunks():
    blob = FakeBlob("file.csv", CSV_BYTES)
    client = FakeGCSClient(FakeBucket([blob]))
    gcs = object.__new__(GCSFileStorage)
    gcs.client = client

    parts = list(gcs.stream_csv_files("any", chunksize=1))
    assert len(parts) == 2
    assert sum(len(df) for df in parts) == 2
    assert list(parts[0].columns) == ["a", "b"]


def test_gcs_streaming_full():
    blob = FakeBlob("file.csv", CSV_BYTES)
    client = FakeGCSClient(FakeBucket([blob]))
    gcs = object.__new__(GCSFileStorage)
    gcs.client = client

    parts = list(gcs.stream_csv_files("any"))
    assert len(parts) == 1
    assert parts[0].shape == (2, 2)


# ---- S3 ----
class FakePaginator:
    def __init__(self, pages):
        self._pages = pages

    def paginate(self, Bucket, Prefix):
        for p in self._pages:
            yield p


class FakeS3Body(io.BytesIO):
    # behaves like boto3 StreamingBody for our tests
    pass


class FakeS3Client:
    def __init__(self, csv_bytes: bytes):
        self.csv_bytes = csv_bytes

    def get_paginator(self, name):
        return FakePaginator([{"Contents": [{"Key": "file.csv"}]}])

    def get_object(self, Bucket, Key):
        return {"Body": FakeS3Body(self.csv_bytes)}


def test_s3_streaming_chunks():
    s3 = FakeS3Client(CSV_BYTES)
    aws = object.__new__(AWSFileStorage)
    aws.s3 = s3

    parts = list(aws.stream_csv_files("bucket", chunksize=1))
    assert len(parts) == 2
    assert sum(len(df) for df in parts) == 2


def test_s3_streaming_full():
    s3 = FakeS3Client(CSV_BYTES)
    aws = object.__new__(AWSFileStorage)
    aws.s3 = s3

    parts = list(aws.stream_csv_files("bucket"))
    assert len(parts) == 1
    assert parts[0].shape == (2, 2)


# ---- Azure ----
class FakeAzureStream:
    def __init__(self, data: bytes):
        self._data = data

    def chunks(self):
        # split into two chunks for streaming
        mid = len(self._data) // 2
        yield self._data[:mid]
        yield self._data[mid:]

    def readall(self):
        return self._data


class FakeBlobClient:
    def __init__(self, data: bytes):
        self._data = data

    def download_blob(self):
        return FakeAzureStream(self._data)


class FakeContainerClient:
    def __init__(self, data: bytes):
        self._data = data

    def list_blobs(self, name_starts_with=None):
        return [types.SimpleNamespace(name="file.csv")]

    def get_blob_client(self, name):
        return FakeBlobClient(self._data)


class FakeAzureClient:
    def __init__(self, data: bytes):
        self._data = data

    def get_container_client(self, container):
        return FakeContainerClient(self._data)


def test_azure_streaming_chunks():
    client = FakeAzureClient(CSV_BYTES)
    az = object.__new__(AzureBlobFileStorage)
    az.client = client

    parts = list(az.stream_csv_files("container", chunksize=1))
    assert len(parts) == 2
    assert sum(len(df) for df in parts) == 2


def test_azure_streaming_full():
    client = FakeAzureClient(CSV_BYTES)
    az = object.__new__(AzureBlobFileStorage)
    az.client = client

    parts = list(az.stream_csv_files("container"))
    assert len(parts) == 1
    assert parts[0].shape == (2, 2)
