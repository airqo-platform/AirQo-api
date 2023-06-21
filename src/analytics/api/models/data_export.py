import json
import traceback
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

import pandas as pd
import pymongo
from bson import ObjectId
from google.cloud import bigquery, storage

from api.models.base.base_model import BasePyMongoModel
from api.utils.dates import date_to_str
from config import Config


class DataExportStatus(Enum):
    SCHEDULED = "scheduled"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    NO_DATA = "no_data"


class Frequency(Enum):
    RAW = "raw"
    HOURLY = "hourly"
    DAILY = "daily"


class DataExportFormat(Enum):
    JSON = "json"
    CSV = "csv"


@dataclass
class DataExportRequest:
    status: DataExportStatus
    frequency: Frequency
    export_format: DataExportFormat

    request_date: datetime
    start_date: datetime
    end_date: datetime

    data_links: list[str]
    request_id: str
    user_id: str

    sites: list[str]
    devices: list[str]
    airqlouds: list[str]
    pollutants: list[str]
    retries: int
    meta_data: dict

    def to_dict(self) -> dict:
        _dict = asdict(self)
        _dict["status"] = self.status.value
        _dict["frequency"] = self.frequency.value
        _dict["export_format"] = self.export_format.value
        return _dict

    def to_api_format(self) -> dict:
        _dict = asdict(self)
        _dict["status"] = str(self.status.value).replace("_", " ").capitalize()
        _dict["frequency"] = self.frequency.value
        _dict["export_format"] = self.export_format.value
        _dict["request_date"] = date_to_str(self.request_date)
        _dict["start_date"] = date_to_str(self.start_date)
        _dict["end_date"] = date_to_str(self.end_date)
        return _dict

    def destination_file(self) -> str:
        return f"{self.user_id}_{date_to_str(self.request_date) }-*.{self.export_format.value}"

    def destination_bucket(self) -> str:
        return f"{self.user_id}/{self.request_id}/{date_to_str(self.request_date)}-*.{self.export_format.value}"

    def gcs_folder(self) -> str:
        return f"{self.user_id}/{self.request_id}/"

    def gcs_file(self) -> str:
        return f"download_*.{self.export_format.value}"

    def bigquery_table(self) -> str:
        return f"{self.user_id}_{self.request_id.replace('-', '_')}"

    def export_table_name(self) -> str:
        return f"{self.user_id}_{date_to_str(self.request_date)}"


class DataExportModel(BasePyMongoModel):
    def __init__(self):
        super().__init__(collection_name=Config.DATA_EXPORT_COLLECTION, tenant="airqo")
        self.bigquery_client = bigquery.Client()
        self.cloud_storage_client = storage.Client()
        self.dataset = Config.DATA_EXPORT_DATASET
        self.project = Config.DATA_EXPORT_GCP_PROJECT
        self.bucket = self.cloud_storage_client.get_bucket(Config.DATA_EXPORT_BUCKET)

    @staticmethod
    def doc_to_data_export_request(doc) -> DataExportRequest:
        return DataExportRequest(
            request_id=str(doc["_id"]),
            devices=doc["devices"],
            start_date=doc["start_date"],
            end_date=doc["end_date"],
            airqlouds=doc["airqlouds"],
            sites=doc["sites"],
            data_links=doc["data_links"],
            request_date=doc["request_date"],
            user_id=doc["user_id"],
            status=DataExportStatus[str(doc["status"]).upper()],
            frequency=Frequency[str(doc["frequency"]).upper()],
            export_format=DataExportFormat[str(doc["export_format"]).upper()],
            pollutants=doc["pollutants"],
            retries=doc.get("retries", 3),
            meta_data=doc.get("meta_data", {}),
        )

    def docs_to_data_export_requests(self, docs: list) -> list[DataExportRequest]:
        data: list[DataExportRequest] = []
        for doc in docs:
            try:
                doc_data = self.doc_to_data_export_request(doc)
                data.append(doc_data)
            except Exception as ex:
                print(ex)
                traceback.print_exc()

        return data

    def create_request(self, request: DataExportRequest):
        self.collection.insert_one(request.to_dict())

    def get_scheduled_and_failed_requests(self) -> list[DataExportRequest]:
        filter_set = {
            "$or": [
                {
                    "status": {"$in": [DataExportStatus.SCHEDULED.value]},
                },
                {
                    "$and": [
                        {
                            "status": {"$in": [DataExportStatus.FAILED.value]},
                            "retires": {"$gt": 0},
                        }
                    ],
                },
            ]
        }

        docs = self.collection.find(filter_set)
        return self.docs_to_data_export_requests(docs)

    def update_request_status_and_retries(self, request: DataExportRequest) -> bool:
        try:
            data = request.to_dict()
            filter_set = {"_id": ObjectId(f"{request.request_id}")}
            update_set = {
                "$set": {"status": data["status"], "retries": data["retries"]}
            }
            result = self.collection.update_one(filter_set, update_set)
            return result.modified_count == 1
        except Exception as ex:
            print(ex)
        return False

    def update_request_status_and_data_links(self, request: DataExportRequest) -> bool:
        try:
            filter_set = {"_id": ObjectId(f"{request.request_id}")}
            data = request.to_dict()
            update_set = {
                "$set": {
                    "status": data["status"],
                    "data_links": data["data_links"],
                }
            }
            result = self.collection.update_one(filter_set, update_set)
            return result.modified_count == 1
        except Exception as ex:
            print(ex)
        return False

    def get_user_requests(self, user_id: str) -> list[DataExportRequest]:
        docs = self.collection.find({"user_id": user_id}).sort(
            "request_date", pymongo.DESCENDING
        )
        return self.docs_to_data_export_requests(docs)

    def get_request_by_id(self, request_id: str) -> DataExportRequest:
        filter_set = {"_id": ObjectId(f"{request_id}")}
        doc = self.collection.find_one(filter_set)
        return self.doc_to_data_export_request(doc)

    def export_table_to_gcs(self, export_request: DataExportRequest):
        blobs = self.bucket.list_blobs(prefix=export_request.gcs_folder())
        for blob in blobs:
            blob.delete()

        destination_uri = f"https://storage.cloud.google.com/{self.bucket.name}/{export_request.gcs_folder()}{export_request.gcs_file()}"
        extract_job_config = bigquery.job.ExtractJobConfig()
        if export_request.export_format == DataExportFormat.CSV:
            extract_job_config.destination_format = bigquery.DestinationFormat.CSV
        elif export_request.export_format == DataExportFormat.JSON:
            extract_job_config.destination_format = (
                bigquery.DestinationFormat.NEWLINE_DELIMITED_JSON
            )

        extract_job_config.print_header = True
        extract_job = self.bigquery_client.extract_table(
            f"{self.dataset}.{export_request.bigquery_table()}",
            destination_uri,
            job_config=extract_job_config,
            location="EU",
        )

        extract_job.result()

    def get_data_links(self, export_request: DataExportRequest) -> [str]:
        blobs = self.bucket.list_blobs(prefix=export_request.gcs_folder())
        return [
            f"https://storage.cloud.google.com/{self.bucket.name}/{blob.name}"
            for blob in blobs
            if not blob.name.endswith("/")
        ]

    def has_data(self, query) -> bool:
        job_config = bigquery.QueryJobConfig()
        job_config.use_query_cache = True
        total_rows = (
            bigquery.Client()
            .query(f"select * from ({query}) limit 1", job_config)
            .result()
            .total_rows
        )
        return total_rows > 0

    def export_query_results_to_table(self, query, export_request: DataExportRequest):
        job_config = bigquery.QueryJobConfig(
            destination=f"{self.project}.{self.dataset}.{export_request.bigquery_table()}"
        )
        job_config.write_disposition = bigquery.WriteDisposition.WRITE_TRUNCATE
        job = self.bigquery_client.query(query, job_config=job_config)
        job.result()

    def upload_file_to_gcs(
        self, contents: pd.DataFrame, export_request: DataExportRequest
    ) -> str:
        blob = self.bucket.blob(export_request.destination_file())

        contents.reset_index(drop=True, inplace=True)
        if export_request.export_format == DataExportFormat.CSV:
            blob.upload_from_string(
                data=contents.to_csv(index=False),
                content_type="text/csv",
                timeout=300,
                num_retries=2,
            )
        elif export_request.export_format == DataExportFormat.JSON:
            data = contents.to_dict("records")
            blob.upload_from_string(
                data=json.dumps(data),
                content_type="application/json",
                timeout=300,
                num_retries=2,
            )

        return f"https://storage.cloud.google.com/{self.bucket.name}/{export_request.destination_file()}"

    def export_query_results_to_gcs(self, query, export_request: DataExportRequest):
        destination_uri = f"https://storage.cloud.google.com/{self.bucket.name}/{export_request.destination_file()}.gz"

        job_config = bigquery.QueryJobConfig()
        extract_job_config = bigquery.job.ExtractJobConfig()
        extract_job_config.destination_format = bigquery.DestinationFormat.CSV
        extract_job_config.compression = bigquery.Compression.GZIP
        extract_job_config.print_header = True

        job = self.bigquery_client.query(query, job_config=job_config)
        job.result()

        destination_table = job.destination

        extract_job = self.bigquery_client.extract_table(
            destination_table,
            destination_uri,
            job_config=extract_job_config,
            location="US",
        )

        extract_job.result()

        print(f"Query results exported to {destination_uri}")
        return destination_uri
