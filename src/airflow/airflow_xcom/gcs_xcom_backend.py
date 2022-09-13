import os
import uuid
from typing import Any

import pandas as pd
from airflow.models.xcom import BaseXCom
from google.cloud import storage
from pandas.errors import EmptyDataError, ParserError


class GCSXComBackend(BaseXCom):
    BUCKET_NAME = os.getenv("AIRFLOW_XCOM_BUCKET")

    @staticmethod
    def download_file_from_gcs(
        bucket_name: str, source_file: str, destination_file: str
    ):
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
    def serialize_value(value: Any):
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
        value = GCSXComBackend.deserialize_value(self)
        if isinstance(value, pd.DataFrame):
            return value.to_dict(orient="records")

        return super().orm_deserialize_value()
