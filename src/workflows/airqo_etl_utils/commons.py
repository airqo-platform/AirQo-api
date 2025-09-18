import pandas as pd
from google.cloud import storage
from typing import List, Optional
import os
import ast

import logging

logger = logging.getLogger("airflow.task")


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


def delete_old_files(files: List[str]) -> None:
    """
    Deletes the specified list of files if they exist.

    Args:
        files(List[str]): A list of file paths to delete.
    Logs:
        - Info message for each successfully deleted file.
        - Warning message if deletion fails for a file.
    """
    for file_path in files:
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"Deleted file: {file_path}")
            else:
                logger.debug(f"File not found, skipping: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to delete file '{file_path}': {e}")


def upload_dataframe_to_gcs(
    bucket_name: str, contents: pd.DataFrame, destination_file: str
) -> str:
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


def drop_rows_with_bad_data(
    data_type: str, data: pd.DataFrame, exclude: Optional[List[str]] = []
) -> pd.DataFrame:
    """
    Removes rows from a DataFrame where most numeric values are missing.

    Args:
        data_type(str): The data type to filter columns by (e.g., "number" for numeric columns).
        data(pd.DataFrame): The input DataFrame to process.
        exclude(Optional[List[str]]): A list of column names to exclude from the check.

    Returns:
        pd.DataFrame: A filtered DataFrame where rows with at least two non-null values in the selected numeric columns are retained.
    """
    # TODO Update to be more dynamic
    numeric_columns = data.select_dtypes(include=[data_type]).columns.difference(
        exclude
    )
    return data[data[numeric_columns].count(axis=1) > 1]


def has_valid_dict(value: str) -> bool:
    """
    Checks whether the input string represents a valid, non-empty dictionary.

    This function attempts to safely evaluate the string using `ast.literal_eval`.
    It returns True only if the input is a string that evaluates to a non-empty dictionary.

    Args:
        v(str): A string potentially representing a dictionary.

    Returns:
        bool: True if `v` is a string representation of a non-empty dictionary, False otherwise.
    """
    try:
        if not isinstance(value, str):
            return False
        parsed = ast.literal_eval(value)
        return isinstance(parsed, dict) and len(parsed) > 0
    except (ValueError, SyntaxError):
        return False
