from google.cloud import storage
import os
from typing import Union
import pandas as pd

import logging

logger = logging.getLogger()


def download_file_from_gcs(
    bucket_name: str, source_file: str, destination_file: str
) -> str:
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
    logger.info(
        f"file: {destination_file} downloaded from bucket: {bucket_name} successfully"
    )
    return destination_file


def upload_to_gcs(
    bucket_name: str, contents: Union[pd.DataFrame, str, bytes], destination_file: str
) -> str:
    """
    Uploads a pandas DataFrame as a CSV file OR a file/bytes object to a Google Cloud Storage (GCS) bucket.

    Args:
        bucket_name(str): The name of the GCS bucket.
        contents(pandas.DataFrame | str | bytes):
            - If DataFrame: will be converted to CSV and uploaded.
            - If str: treated as a file path and the file will be uploaded.
            - If bytes: uploaded directly as a binary object.
        destination_file(str): The destination file path in the GCS bucket.

    Returns:
        str: The GCS URI of the uploaded file.
    """
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_file)

    if isinstance(contents, pd.DataFrame):
        contents.reset_index(drop=True, inplace=True)
        blob.upload_from_string(contents.to_csv(index=False), content_type="text/csv")
        logger.info(
            f"DataFrame with {len(contents)} rows uploaded to {bucket_name}/{destination_file}."
        )
    elif isinstance(contents, str) and os.path.isfile(contents):
        blob.upload_from_filename(contents)
        logger.info(f"File '{contents}' uploaded to {bucket_name}/{destination_file}.")
    elif isinstance(contents, bytes):
        blob.upload_from_string(contents)
        logger.info(f"Bytes object uploaded to {bucket_name}/{destination_file}.")
    else:
        raise ValueError(
            "Unsupported contents type. Must be DataFrame, file path, or bytes."
        )

    return f"gs://{bucket_name}/{blob.name}"
