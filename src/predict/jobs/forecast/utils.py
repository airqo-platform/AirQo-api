import gcsfs
import joblib
import pandas as pd
from datetime import date, datetime
from dateutil.relativedelta import relativedelta


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


def str_to_date_2(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%d %H:%M:%S')


def date_to_str_2(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%d %H:00:00')


def get_csv_file_from_gcs(project_name, bucket_name, source_blob_name):
    """gets csv file from google cloud storage and returns as a pandas dataframe"""
    fs = gcsfs.GCSFileSystem(project=project_name)
    with fs.open(f'{bucket_name}/{source_blob_name}') as file_handle:
        df = pd.read_csv(file_handle)
    return df


def get_trained_model_from_gcs(project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)
    fs.ls(bucket_name)
    with fs.open(bucket_name + '/' + source_blob_name, 'rb') as handle:
        job = joblib.load(handle)
    return job
