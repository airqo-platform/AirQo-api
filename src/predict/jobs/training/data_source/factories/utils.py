import gcsfs
import pandas as pd


def get_csv_file_from_gcs(project_name, bucket_name, source_blob_name):
    """gets csv file from google cloud storage and returns as a pandas dataframe"""
    fs = gcsfs.GCSFileSystem(project=project_name)
    with fs.open(f'{bucket_name}/{source_blob_name}') as file_handle:
        df = pd.read_csv(file_handle)
    return df
