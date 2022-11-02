"""Loading functions from GCS"""
import logging
from typing import Any

import ruamel.yaml as yaml
from google.cloud import storage

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
ch.setFormatter(formatter)
logger.addHandler(ch)


def read_yml_from_gcs(
    bucket_name: str,
    blob_name: str,
    template: dict[str, Any],
    client: storage.Client = storage.Client(),
) -> dict[str, Any]:
    bucket: storage.Bucket = client.bucket(bucket_name)
    content: bytes = bucket.blob(blob_name).download_as_string()
    decoded: str = content.decode("utf-8")

    for k, v in template.items():
        decoded = decoded.replace(k, v)

    return yaml.safe_load(decoded)


def move_blob(
    bucket_name: str,
    blob_name: str,
    prefix: str,
    client: storage.Client = storage.Client(),
) -> None:

    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    new_name = "/".join([prefix] + blob_name.split("/")[1:])
    new_blob = bucket.rename_blob(blob, new_name)

    logger.info(f"Blob {blob.name} has been renamed to {new_blob.name}")


def check_trigger_file_path(blob_name: str, trigger_prefix: str) -> bool:
    return blob_name.startswith(trigger_prefix)


def extract_dataset_name(blob_name) -> str:
    return blob_name.split("/")[1]