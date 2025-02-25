import pandas as pd
from google.cloud import storage
import logging

logger = logging.getLogger(__name__)


def download_file_from_gcs(bucket_name: str, source_file: str, destination_file: str):
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

    logger.info(
        "{} with contents {} has been uploaded to {}.".format(
            destination_file, len(contents), bucket_name
        )
    )

    return f"gs://{bucket_name}/{blob.name}"
