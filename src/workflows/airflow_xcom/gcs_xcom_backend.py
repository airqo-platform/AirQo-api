import os
import uuid
from typing import Any

import pandas as pd
from airflow.models.xcom import BaseXCom
from google.cloud import storage
from pandas.errors import EmptyDataError, ParserError


class GCSXComBackend(BaseXCom):
    """
    A custom Airflow XCom backend that stores XCom values as files in Google Cloud Storage (GCS).
    This class is particularly useful for handling large dataframes that would be inefficient to store
    in the Airflow metadata database. Instead of storing the data directly, it stores a reference to
    the file in GCS, and the file is downloaded and deserialized when accessed.

    Attributes:
        BUCKET_NAME(str): The name of the GCS bucket where XCom data is stored. Retrieved from the environment variable 'AIRFLOW_XCOM_BUCKET'.
    """

    BUCKET_NAME = os.getenv("AIRFLOW_XCOM_BUCKET")

    @staticmethod
    def download_file_from_gcs(
        bucket_name: str, source_file: str, destination_file: str
    ):
        """
        Downloads a file from a Google Cloud Storage (GCS) bucket.

        Args:
            bucket_name(str): The name of the GCS bucket.
            source_file(str): The name of the file to download from GCS.
            destination_file(str): The local path where the file will be saved.

        Returns:
            path(str): The path to the downloaded file.
        """
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(source_file)
        blob.download_to_filename(destination_file)
        print(
            f"file: {destination_file} downloaded from bucket: {bucket_name} successfully"
        )
        return destination_file

    @staticmethod
    def upload_dataframe_to_gcs(
        bucket_name: str, contents: pd.DataFrame, destination_file: str
    ):
        """
        Uploads a pandas DataFrame as a CSV file to a Google Cloud Storage (GCS) bucket.

        Args:
            bucket_name(str): The name of the GCS bucket.
            contents(pandas.DataFrame): The dataframe to be uploaded.
            destination_file(str): The destination file name in the GCS bucket.

        Returns:
            URI(str): The GCS URI of the uploaded file.
        """
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_file)
        contents.reset_index(drop=True, inplace=True)
        blob.upload_from_string(contents.to_csv(index=False), "text/csv")

        print(
            "{} with contents {} has been uploaded to {}.".format(
                destination_file, len(contents), bucket_name
            )
        )

        return f"gs://{bucket_name}/{blob.name}"

    @staticmethod
    def serialize_value(value: Any) -> Any:
        """
        Serializes a value to be stored in XCom. If the value is a pandas DataFrame, it is
        uploaded to GCS and the file name is stored in XCom instead.

        Args:
            value(Any): The value to be serialized.

        Returns:
            value(Any): The serialized value.
        """
        if isinstance(value, pd.DataFrame):
            filename = f"airflow_data_{str(uuid.uuid4())}.csv"

            uploaded_file_path = GCSXComBackend.upload_dataframe_to_gcs(
                bucket_name=GCSXComBackend.BUCKET_NAME,
                contents=value,
                destination_file=filename,
            )
            last_index = uploaded_file_path.rindex("/")
            value = uploaded_file_path[last_index + 1 :]

        return BaseXCom.serialize_value(value)

    @staticmethod
    def deserialize_value(result) -> Any:
        """
        Deserializes a value retrieved from XCom. If the value is a file reference in GCS,
        it downloads the file and loads it into a pandas DataFrame.

        Args:
            result(Any): The serialized value to be deserialized.

        Returns:
            result(Any): The deserialized value.
        """
        result = BaseXCom.deserialize_value(result)
        if isinstance(result, str):
            filename = f"/tmp/airflow_data_{str(uuid.uuid4())}.csv"
            GCSXComBackend.download_file_from_gcs(
                bucket_name=GCSXComBackend.BUCKET_NAME,
                source_file=result,
                destination_file=filename,
            )
            try:
                result = pd.read_csv(filename)
                result.reset_index(drop=True, inplace=True)
            except EmptyDataError:
                result = pd.DataFrame([])
            except ParserError:
                result = pd.read_csv(filename, lineterminator="\n")

            try:
                os.remove(filename)
            except Exception as ex:
                print(ex)
                pass

        return result

    def orm_deserialize_value(self) -> Any:
        """
        Deserializes the XCom value for ORM operations. If the value is a pandas DataFrame,
        it converts it to a list of dictionaries.

        Returns:
            Any: The deserialized value.
        """
        value = GCSXComBackend.deserialize_value(self)
        if isinstance(value, pd.DataFrame):
            return value.to_dict(orient="records")

        return super().orm_deserialize_value()
