from datetime import datetime

import gcsfs
import joblib


def date_to_str(date, format='%Y-%m-%dT%H:%M:%S.%fZ'):
    """Converts datetime to a string"""
    return datetime.strftime(date, format)


def get_trained_model_from_gcs(project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)
    fs.ls(bucket_name)
    with fs.open(bucket_name + '/' + source_blob_name, 'rb') as handle:
        job = joblib.load(handle)
    return job
