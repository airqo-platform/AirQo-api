import datetime
from dataclasses import dataclass, asdict
from enum import Enum

import pandas as pd
from bson import ObjectId
from google.cloud import storage

from api.models.base.base_model import BaseMongoModel
from api.utils.dates import str_to_date, date_to_str
from config import Config


class DataExportStatus(Enum):
    SCHEDULED = 0
    PROCESSING = 1
    READY = 2
    FAILED = 3

    def __str__(self) -> str:
        if self == DataExportStatus.SCHEDULED:
            return "SCHEDULED"
        elif self == DataExportStatus.PROCESSING:
            return "PROCESSING"
        elif self == DataExportStatus.READY:
            return "READY"
        elif self == DataExportStatus.FAILED:
            return "FAILED"
        else:
            return ""


@dataclass
class DataExportRequest:
    status: DataExportStatus
    request_date: datetime

    download_link: str
    request_id: str
    user_id: str
    start_date: str
    end_date: str
    frequency: str
    download_type: str

    sites: list[str]
    devices: list[str]
    airqlouds: list[str]
    pollutants: list[str]

    def to_dict(self) -> dict:
        _dict = asdict(self)
        _dict["status"] = str(self.status)
        _dict["request_date"] = date_to_str(self.request_date)
        return _dict

    def destination_file(self) -> str:
        return f"{self.user_id}_{date_to_str(self.request_date) }.{self.download_type}"


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
            status=DataExportStatus[doc["status"]],
            airqlouds=doc["airqlouds"],
            sites=doc["sites"],
            download_link=doc["download_link"],
            request_date=str_to_date(doc["request_date"]),
            user_id=doc["user_id"],
            frequency=doc["frequency"],
            download_type=doc["download_type"],
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
                "$in": [str(DataExportStatus.SCHEDULED), str(DataExportStatus.FAILED)]
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

    def upload_dataframe_to_gcs(
        self, contents: pd.DataFrame, export_request: DataExportRequest
    ) -> str:
        storage_client = storage.Client()
        bucket = storage_client.bucket(self.bucket_name)
        blob = bucket.blob(export_request.destination_file())

        contents.reset_index(drop=True, inplace=True)
        blob.upload_from_string(contents.to_csv(index=False), "text/csv")

        return f"https://storage.cloud.google.com/{self.bucket_name}/{export_request.destination_file()}"
