"""Tests for cloud_storage.py — GCSFileStorage, AWSFileStorage, AzureBlobFileStorage.

All cloud clients are mocked. Tests cover:
  - download_file
  - upload_file
  - upload_dataframe (csv, json, parquet, unsupported)
  - save_file_object (round-trip serialization)
  - load_file_object (in-memory, cached, missing file)
  - list_files (GCS only)
  - stream_csv_files
"""
import io
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open, ANY

import joblib
import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# GCSFileStorage
# ---------------------------------------------------------------------------


class TestGCSFileStorage:
    """Tests for GCSFileStorage with mocked google.cloud.storage."""

    @pytest.fixture(autouse=True)
    def setup(self):
        with patch(
            "airqo_etl_utils.storage.cloud_storage.GCSFileStorage.__init__",
            lambda self_: None,
        ):
            from airqo_etl_utils.storage.cloud_storage import GCSFileStorage

            self.storage = GCSFileStorage()
            self.storage.client = MagicMock()

    # -- download_file -------------------------------------------------------

    def test_download_file_success(self):
        blob = MagicMock()
        blob.exists.return_value = True
        self.storage.client.bucket.return_value.blob.return_value = blob

        result = self.storage.download_file("bucket", "models/m.pkl", "/tmp/m.pkl")

        blob.download_to_filename.assert_called_once_with("/tmp/m.pkl")
        assert result == "/tmp/m.pkl"

    def test_download_file_default_destination(self):
        blob = MagicMock()
        blob.exists.return_value = True
        self.storage.client.bucket.return_value.blob.return_value = blob

        result = self.storage.download_file("bucket", "models/m.pkl")

        blob.download_to_filename.assert_called_once_with("m.pkl")
        assert result == "m.pkl"

    def test_download_file_not_found(self):
        blob = MagicMock()
        blob.exists.return_value = False
        self.storage.client.bucket.return_value.blob.return_value = blob

        with pytest.raises(FileNotFoundError):
            self.storage.download_file("bucket", "missing.pkl", "/tmp/missing.pkl")

    # -- upload_file ---------------------------------------------------------

    def test_upload_file_success(self):
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob

        result = self.storage.upload_file("bucket", "/tmp/m.pkl", "models/m.pkl")

        blob.upload_from_filename.assert_called_once_with("/tmp/m.pkl")
        assert result == "gs://bucket/models/m.pkl"

    def test_upload_file_default_destination(self):
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob

        result = self.storage.upload_file("bucket", "/tmp/m.pkl")

        self.storage.client.bucket.return_value.blob.assert_called_with("m.pkl")
        assert result == "gs://bucket/m.pkl"

    # -- upload_dataframe ----------------------------------------------------

    def test_upload_dataframe_csv(self):
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        result = self.storage.upload_dataframe("bucket", df, "data.csv", format="csv")

        blob.upload_from_string.assert_called_once()
        assert result == "gs://bucket/data.csv"

    def test_upload_dataframe_json(self):
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob
        df = pd.DataFrame({"a": [1]})

        result = self.storage.upload_dataframe("bucket", df, "d.json", format="json")

        blob.upload_from_string.assert_called_once()
        assert result == "gs://bucket/d.json"

    def test_upload_dataframe_parquet(self):
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob
        df = pd.DataFrame({"a": [1]})

        result = self.storage.upload_dataframe(
            "bucket", df, "d.parquet", format="parquet"
        )

        blob.upload_from_filename.assert_called_once()
        assert result == "gs://bucket/d.parquet"

    def test_upload_dataframe_unsupported_format(self):
        df = pd.DataFrame({"a": [1]})
        with pytest.raises(ValueError, match="Unsupported format"):
            self.storage.upload_dataframe("bucket", df, "d.xyz", format="xyz")

    def test_upload_dataframe_default_destination(self):
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob
        df = pd.DataFrame({"a": [1]})

        result = self.storage.upload_dataframe("bucket", df, format="csv")

        self.storage.client.bucket.return_value.blob.assert_called_with("dataframe.csv")
        assert result == "gs://bucket/dataframe.csv"

    # -- save_file_object ----------------------------------------------------

    def test_save_file_object_success(self):
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob

        obj = {"key": "value", "number": 42}
        result = self.storage.save_file_object("bucket", obj, "objects/config.pkl")

        blob.upload_from_file.assert_called_once()
        args, kwargs = blob.upload_from_file.call_args
        assert isinstance(args[0], io.BytesIO)
        assert kwargs["content_type"] == "application/octet-stream"
        assert result == "gs://bucket/objects/config.pkl"

    def test_save_file_object_roundtrip(self):
        """Verify the bytes produced by save can be loaded back."""
        blob = MagicMock()
        self.storage.client.bucket.return_value.blob.return_value = blob

        original = {"model": "lgbm", "params": [1, 2, 3]}
        self.storage.save_file_object("bucket", original, "obj.pkl")

        # Grab the BytesIO that was uploaded
        uploaded_buf = blob.upload_from_file.call_args[0][0]
        uploaded_buf.seek(0)
        loaded = joblib.load(uploaded_buf)
        assert loaded == original

    def test_save_file_object_upload_failure(self):
        blob = MagicMock()
        blob.upload_from_file.side_effect = RuntimeError("network error")
        self.storage.client.bucket.return_value.blob.return_value = blob

        with pytest.raises(RuntimeError, match="network error"):
            self.storage.save_file_object("bucket", {"a": 1}, "obj.pkl")

    # -- load_file_object ----------------------------------------------------

    def test_load_file_object_in_memory(self):
        original = {"key": "value"}
        buf = io.BytesIO()
        joblib.dump(original, buf)
        serialized_bytes = buf.getvalue()

        blob = MagicMock()
        blob.exists.return_value = True
        blob.download_as_bytes.return_value = serialized_bytes
        self.storage.client.bucket.return_value.blob.return_value = blob

        result = self.storage.load_file_object("bucket", "obj.pkl")

        assert result == original
        blob.download_as_bytes.assert_called_once()

    def test_load_file_object_with_cache(self, tmp_path):
        original = [1, 2, 3]
        cache_path = str(tmp_path / "cached.pkl")
        joblib.dump(original, cache_path)

        result = self.storage.load_file_object(
            "bucket", "obj.pkl", local_cache_path=cache_path
        )

        assert result == original
        # Should not have called the cloud client at all
        self.storage.client.bucket.assert_not_called()

    def test_load_file_object_cache_miss_downloads(self, tmp_path):
        original = {"cached": True}
        cache_path = str(tmp_path / "not_yet_cached.pkl")

        # Simulate download_to_filename by writing the file
        def fake_download(dest):
            joblib.dump(original, dest)

        blob = MagicMock()
        blob.exists.return_value = True
        blob.download_to_filename.side_effect = fake_download
        self.storage.client.bucket.return_value.blob.return_value = blob

        result = self.storage.load_file_object(
            "bucket", "obj.pkl", local_cache_path=cache_path
        )

        assert result == original
        blob.download_to_filename.assert_called_once_with(cache_path)
        assert Path(cache_path).exists()

    def test_load_file_object_not_found(self):
        blob = MagicMock()
        blob.exists.return_value = False
        self.storage.client.bucket.return_value.blob.return_value = blob

        with pytest.raises(FileNotFoundError):
            self.storage.load_file_object("bucket", "missing.pkl")

    # -- list_files ----------------------------------------------------------

    def test_list_files(self):
        blob1 = MagicMock()
        blob1.name = "file1.csv"
        blob2 = MagicMock()
        blob2.name = "file2.csv"
        self.storage.client.bucket.return_value.list_blobs.return_value = [
            blob1,
            blob2,
        ]

        result = self.storage.list_files("bucket", prefix="data/")

        assert result == ["file1.csv", "file2.csv"]

    # -- stream_csv_files ----------------------------------------------------

    def test_stream_csv_files_full_download(self):
        csv_content = b"a,b\n1,2\n3,4\n"
        blob = MagicMock()
        blob.name = "data.csv"
        blob.download_as_bytes.return_value = csv_content
        self.storage.client.bucket.return_value.list_blobs.return_value = [blob]

        dfs = list(self.storage.stream_csv_files("bucket"))

        assert len(dfs) == 1
        assert list(dfs[0].columns) == ["a", "b"]
        assert len(dfs[0]) == 2

    def test_stream_csv_files_skips_non_csv(self):
        blob = MagicMock()
        blob.name = "data.parquet"
        self.storage.client.bucket.return_value.list_blobs.return_value = [blob]

        dfs = list(self.storage.stream_csv_files("bucket"))

        assert len(dfs) == 0


# ---------------------------------------------------------------------------
# AWSFileStorage
# ---------------------------------------------------------------------------


class TestAWSFileStorage:
    """Tests for AWSFileStorage with mocked boto3."""

    @pytest.fixture(autouse=True)
    def setup(self):
        with patch(
            "airqo_etl_utils.storage.cloud_storage.AWSFileStorage.__init__",
            lambda self_: None,
        ):
            from airqo_etl_utils.storage.cloud_storage import AWSFileStorage

            self.storage = AWSFileStorage()
            self.storage.s3 = MagicMock()

    def test_download_file(self):
        result = self.storage.download_file("bucket", "key.pkl", "/tmp/key.pkl")
        self.storage.s3.download_file.assert_called_once_with(
            "bucket", "key.pkl", "/tmp/key.pkl"
        )
        assert result == "/tmp/key.pkl"

    def test_upload_file(self):
        result = self.storage.upload_file("bucket", "/tmp/file.pkl", "dest.pkl")
        self.storage.s3.upload_file.assert_called_once_with(
            "/tmp/file.pkl", "bucket", "dest.pkl"
        )
        assert result == "s3://bucket/dest.pkl"

    def test_save_file_object(self):
        obj = {"model": "test"}
        result = self.storage.save_file_object("bucket", obj, "model.pkl")

        self.storage.s3.upload_fileobj.assert_called_once()
        args = self.storage.s3.upload_fileobj.call_args[0]
        assert isinstance(args[0], io.BytesIO)
        assert args[1] == "bucket"
        assert args[2] == "model.pkl"
        assert result == "s3://bucket/model.pkl"

    def test_save_file_object_roundtrip(self):
        original = {"weights": [0.1, 0.2]}
        captured_buf = None

        def capture_upload(buf, bucket, key):
            nonlocal captured_buf
            captured_buf = io.BytesIO(buf.read())

        self.storage.s3.upload_fileobj.side_effect = capture_upload
        self.storage.save_file_object("bucket", original, "model.pkl")

        captured_buf.seek(0)
        loaded = joblib.load(captured_buf)
        assert loaded == original

    def test_load_file_object_in_memory(self):
        original = {"key": "s3value"}
        buf = io.BytesIO()
        joblib.dump(original, buf)
        serialized = buf.getvalue()

        def fake_download(bucket, key, fileobj):
            fileobj.write(serialized)

        self.storage.s3.download_fileobj.side_effect = fake_download

        result = self.storage.load_file_object("bucket", "obj.pkl")
        assert result == original

    def test_load_file_object_with_cache(self, tmp_path):
        original = "cached_data"
        cache_path = str(tmp_path / "cached.pkl")
        joblib.dump(original, cache_path)

        result = self.storage.load_file_object(
            "bucket", "obj.pkl", local_cache_path=cache_path
        )
        assert result == original
        self.storage.s3.download_file.assert_not_called()

    def test_upload_dataframe_csv(self, tmp_path):
        df = pd.DataFrame({"x": [1, 2]})
        result = self.storage.upload_dataframe("bucket", df, "data.csv", format="csv")
        assert result == "s3://bucket/data.csv"
        self.storage.s3.upload_file.assert_called_once()


# ---------------------------------------------------------------------------
# AzureBlobFileStorage
# ---------------------------------------------------------------------------


class TestAzureBlobFileStorage:
    """Tests for AzureBlobFileStorage with mocked azure client."""

    @pytest.fixture(autouse=True)
    def setup(self):
        with patch(
            "airqo_etl_utils.storage.cloud_storage.AzureBlobFileStorage.__init__",
            lambda self_: None,
        ):
            from airqo_etl_utils.storage.cloud_storage import AzureBlobFileStorage

            self.storage = AzureBlobFileStorage()
            self.storage.client = MagicMock()

    def test_upload_file(self):
        with patch("builtins.open", mock_open(read_data=b"data")):
            result = self.storage.upload_file("container", "/tmp/f.pkl", "dest.pkl")
        assert result == "azure://container/dest.pkl"

    def test_save_file_object(self):
        blob_client = MagicMock()
        self.storage.client.get_container_client.return_value.get_blob_client.return_value = (
            blob_client
        )

        obj = [1, 2, 3]
        result = self.storage.save_file_object("container", obj, "model.pkl")

        blob_client.upload_blob.assert_called_once()
        args = blob_client.upload_blob.call_args[0]
        assert isinstance(args[0], io.BytesIO)
        assert result == "azure://container/model.pkl"

    def test_save_file_object_roundtrip(self):
        blob_client = MagicMock()
        self.storage.client.get_container_client.return_value.get_blob_client.return_value = (
            blob_client
        )
        captured_buf = None

        def capture_upload(buf, **kwargs):
            nonlocal captured_buf
            captured_buf = io.BytesIO(buf.read())

        blob_client.upload_blob.side_effect = capture_upload

        original = {"azure": "model"}
        self.storage.save_file_object("container", original, "model.pkl")

        captured_buf.seek(0)
        loaded = joblib.load(captured_buf)
        assert loaded == original

    def test_load_file_object_in_memory(self):
        original = {"azure": "data"}
        buf = io.BytesIO()
        joblib.dump(original, buf)
        serialized = buf.getvalue()

        blob_client = MagicMock()
        blob_client.download_blob.return_value.readall.return_value = serialized
        self.storage.client.get_container_client.return_value.get_blob_client.return_value = (
            blob_client
        )

        result = self.storage.load_file_object("container", "obj.pkl")
        assert result == original

    def test_load_file_object_with_cache(self, tmp_path):
        original = "azure_cached"
        cache_path = str(tmp_path / "cached.pkl")
        joblib.dump(original, cache_path)

        result = self.storage.load_file_object(
            "container", "obj.pkl", local_cache_path=cache_path
        )
        assert result == original
        self.storage.client.get_container_client.assert_not_called()

    def test_upload_dataframe_csv(self):
        blob_client = MagicMock()
        self.storage.client.get_container_client.return_value.get_blob_client.return_value = (
            blob_client
        )
        df = pd.DataFrame({"a": [1]})

        result = self.storage.upload_dataframe("c", df, "d.csv", format="csv")

        blob_client.upload_blob.assert_called_once()
        assert result == "azure://c/d.csv"

    def test_upload_dataframe_unsupported(self):
        df = pd.DataFrame({"a": [1]})
        with pytest.raises(ValueError, match="Unsupported format"):
            self.storage.upload_dataframe("c", df, "d.xyz", format="xyz")


# ---------------------------------------------------------------------------
# FileStorage abstract contract
# ---------------------------------------------------------------------------


class TestFileStorageAbstract:
    """Verify that FileStorage cannot be instantiated without all abstract methods."""

    def test_cannot_instantiate_without_all_methods(self):
        from airqo_etl_utils.storage.base import FileStorage

        with pytest.raises(TypeError):
            FileStorage()

    def test_subclass_must_implement_save_load_file_object(self):
        from airqo_etl_utils.storage.base import FileStorage

        class IncompleteStorage(FileStorage):
            def download_file(self, bucket, source_file, destination_file=None):
                pass

            def upload_file(self, bucket, source_file, destination_file=None):
                pass

            def upload_dataframe(
                self, bucket, dataframe, destination_file=None, format="csv"
            ):
                pass

            # Missing: save_file_object, load_file_object

        with pytest.raises(TypeError, match="save_file_object|load_file_object"):
            IncompleteStorage()
