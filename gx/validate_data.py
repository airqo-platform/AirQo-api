from google.cloud import storage
from great_expectations.data_context import DataContext
from great_expectations.core.batch import BatchRequest
import os

def download_data(bucket_name, source_blob_name, destination_file_name):
    """Downloads a blob from the bucket."""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(source_blob_name)
    blob.download_to_filename(destination_file_name)
    print(f"Blob {source_blob_name} downloaded to {destination_file_name}.")

def validate_data():
    context = DataContext("gx/expectations")

    # Specify GCP bucket and file details
    bucket_name = 'bucket-name'
    source_blob_name = 'path/to/datafile.csv'
    destination_file_name = '/path/to/local/datafile.csv'
    download_data(bucket_name, source_blob_name, destination_file_name)

    batch_request = BatchRequest(
        datasource_name="datasource_name",
        data_connector_name="data_connector_name",
        data_asset_name="data_asset_name",
        batch_identifiers={
            "default_identifier_name": "default_identifier"
        }
    )

    results = context.run_validation_operator(
        "action_list_operator",
        assets_to_validate=[batch_request],
        run_id="your_run_id"
    )

    validation_result_identifier = results.list_validation_result_identifiers()[0]
    validation_result = context.get_validation_result(validation_result_identifier)

    if not validation_result.success:
        raise ValueError("Validation failed!")
    else:
        print("Validation succeeded!")
