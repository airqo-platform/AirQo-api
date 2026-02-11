import pandas as pd
import logging
import os
from tempfile import NamedTemporaryFile
from .base import FileStorage

logger = logging.getLogger("airflow.task")


class GCSFileStorage(FileStorage):
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


class AWSFileStorage(FileStorage):
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
                os.unlink(temp.name)

            logger.info(f"Dataframe uploaded to s3://{bucket}/{destination_file}")
            return f"s3://{bucket}/{destination_file}"
        except Exception as e:
            logger.error(f"Failed to upload dataframe to S3: {e}")
            raise


class AzureBlobFileStorage(FileStorage):
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


class GoogleDriveFileStorage(FileStorage):
    # Note: 'bucket' argument is treated as 'folder_id' for Google Drive
    def __init__(self):
        # Implementation assumes proper auth setup (e.g. service account)
        pass

    def download_file(
        self, bucket: str, source_file: str, destination_file: str
    ) -> str:
        raise NotImplementedError("Google Drive download not yet implemented")

    def upload_file(self, bucket: str, source_file: str, destination_file: str) -> str:
        raise NotImplementedError("Google Drive upload not yet implemented")

    def upload_dataframe(
        self,
        bucket: str,
        dataframe: pd.DataFrame,
        destination_file: str,
        format: str = "csv",
    ) -> str:
        raise NotImplementedError("Google Drive dataframe upload not yet implemented")
