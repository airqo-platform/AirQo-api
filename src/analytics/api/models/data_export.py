import json
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

import pandas as pd
from bson import ObjectId
from google.cloud import storage

from api.models.base.base_model import BaseMongoModel
from api.utils.dates import date_to_str
from config import Config


class DataExportStatus(Enum):
    SCHEDULED = "scheduled"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


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

    download_link: str
    request_id: str
    user_id: str

    sites: list[str]
    devices: list[str]
    airqlouds: list[str]
    pollutants: list[str]

    def to_dict(self, format_datetime=False) -> dict:
        _dict = asdict(self)
        _dict["status"] = self.status.value
        _dict["frequency"] = self.frequency.value
        _dict["export_format"] = self.export_format.value

        if format_datetime:
            _dict["request_date"] = date_to_str(self.request_date)
            _dict["start_date"] = date_to_str(self.start_date)
            _dict["end_date"] = date_to_str(self.end_date)

        return _dict

    def destination_file(self) -> str:
        return f"{self.user_id}_{date_to_str(self.request_date) }.{self.export_format.value}"


class DataExportModel(BaseMongoModel):
    bucket_name = Config.DATA_EXPORT_BUCKET
    collection_name = Config.DATA_EXPORT_COLLECTION

    @staticmethod
    def doc_to_data_export_request(doc) -> DataExportRequest:
        return DataExportRequest(
            request_id=str(doc["_id"]),
            devices=doc["devices"],
            start_date=doc["start_date"],
            end_date=doc["end_date"],
            airqlouds=doc["airqlouds"],
            sites=doc["sites"],
            download_link=doc["download_link"],
            request_date=doc["request_date"],
            user_id=doc["user_id"],
            status=DataExportStatus[str(doc["status"]).upper()],
            frequency=Frequency[str(doc["frequency"]).upper()],
            export_format=DataExportFormat[str(doc["export_format"]).upper()],
            pollutants=doc["pollutants"],
        )

    def docs_to_data_export_requests(self, docs: list) -> list[DataExportRequest]:
        data: list[DataExportRequest] = []
        for doc in docs:
            doc_data = self.doc_to_data_export_request(doc)
            data.append(doc_data)
        return data

    def __init__(self):
        super().__init__(collection_name=self.collection_name)

    def create_request(self, request: DataExportRequest):
        self.db.data_eport.insert_one(request.to_dict())

    def get_scheduled_and_failed_requests(self) -> list[DataExportRequest]:
        filter_set = {
            "status": {
                "$in": [DataExportStatus.SCHEDULED.value, DataExportStatus.FAILED.value]
            }
        }
        docs = self.db.data_eport.find(filter_set)
        return self.docs_to_data_export_requests(docs)

    def update_request_status(self, request: DataExportRequest) -> bool:
        try:
            data = request.to_dict()
            filter_set = {"_id": ObjectId(f"{request.request_id}")}
            update_set = {"$set": {"status": data["status"]}}
            result = self.db.data_eport.update_one(filter_set, update_set)
            return result.modified_count == 1
        except Exception as ex:
            print(ex)
        return False

    def update_request_status_and_download_link(
        self, request: DataExportRequest
    ) -> bool:
        try:
            filter_set = {"_id": ObjectId(f"{request.request_id}")}
            data = request.to_dict()
            update_set = {
                "$set": {
                    "status": data["status"],
                    "download_link": data["download_link"],
                }
            }
            result = self.db.data_eport.update_one(filter_set, update_set)
            return result.modified_count == 1
        except Exception as ex:
            print(ex)
        return False

    def get_user_requests(self, user_id: str) -> list[DataExportRequest]:
        docs = self.db.data_eport.find({"user_id": user_id})
        return self.docs_to_data_export_requests(docs)

    def get_request_by_id(self, request_id: str) -> DataExportRequest:
        filter_set = {"_id": ObjectId(f"{request_id}")}
        doc = self.db.data_eport.find_one(filter_set)
        return self.doc_to_data_export_request(doc)

    def upload_file_to_gcs(
        self, contents: pd.DataFrame, export_request: DataExportRequest
    ) -> str:
        storage_client = storage.Client()
        bucket = storage_client.bucket(self.bucket_name)
        blob = bucket.blob(export_request.destination_file())

        contents.reset_index(drop=True, inplace=True)
        if export_request.export_format == DataExportFormat.CSV:
            blob.upload_from_string(data=contents.to_csv(index=False), content_type="text/csv", timeout=300, num_retries=2)
        elif export_request.export_format == DataExportFormat.JSON:
            data = contents.to_dict("records")
            blob.upload_from_string(data=json.dumps(data), content_type="application/json", timeout=300, num_retries=2)

        return f"https://storage.cloud.google.com/{self.bucket_name}/{export_request.destination_file()}"
