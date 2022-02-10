import gcsfs
import joblib
import pandas as pd
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from google.cloud import storage


def previous_months_range(n):
    """
    Function that calculates the previous months date ranges
    Args:
        n (int): represents the number of previous months range e.g 3 for three months ago
    """
    # end_date = date.today()
    end_date = datetime.now()
    start_date = end_date + relativedelta(months=-n)

    return start_date, end_date


def str_to_date(st):
    """converts a string to datetime"""
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')


def date_to_str(date):
    """converts datetime to a string"""
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%S.%fZ')


def is_key_exist(dict, key):
        """checks wether specified key is available in the specified dictionary."""
        if key in dict.keys(): 
            return True 
        else: 
            return False

def get_csv_file_from_gcs(project_name, bucket_name, source_blob_name):
    """gets csv file from google cloud storage and returns as a pandas dataframe"""
    fs = gcsfs.GCSFileSystem(project=project_name)
    with fs.open(f'{bucket_name}/{source_blob_name}') as file_handle:
        df = pd.read_csv(file_handle)
    return df

def upload_trained_model_to_gcs(trained_model,project_name,bucket_name,source_blob_name):
  fs = gcsfs.GCSFileSystem(project=project_name)    
  with fs.open(bucket_name + '/' + source_blob_name, 'wb') as handle:
        joblib.dump(trained_model,handle)


def rename_blob(project_name, credential, bucket_name, blob_name, new_name):

    storage_client = storage.Client(
        project=project_name,
        credentials=credential
    )

    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    new_blob = bucket.rename_blob(blob, new_name)

    print("Blob {} has been renamed to {}".format(blob.name, new_blob.name))

