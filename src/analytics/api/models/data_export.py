import datetime
from dataclasses import dataclass, asdict
from enum import Enum

import pandas as pd
from google.cloud import storage

from api.models.base.base_model import BaseMongoModel
from api.utils.dates import str_to_date, date_to_str


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
    collection_name = "data_export"
    bucket_name = "data_export_requests"

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
            print(doc)
            doc_data = self.doc_to_data_export_request(doc)
            data.append(doc_data)
        return data

    def __init__(self):
        super().__init__(collection_name=self.collection_name)

    def create_request(self, request: DataExportRequest):
        self.insert(request.to_dict())

    def get_scheduled_requests(self) -> list[DataExportRequest]:
        docs = self.find({"status": str(DataExportStatus.SCHEDULED)})

        return self.docs_to_data_export_requests(docs)

    def update_request_status(self, request: DataExportRequest) -> bool:
        try:
            self.update_one({"_id": request.request_id}, {"status": str(request.status)})
            return True
        except Exception as ex:
            print(ex)
        return False

    def update_request_status_and_download_link(
        self, request: DataExportRequest
    ) -> bool:
        try:
            self.update_one(
                {"_id": request.request_id},
                {"status": request.status, "download_link": request.download_link},
            )
            return True
        except Exception as ex:
            print(ex)
        return False

    def get_user_requests(self, user_id: str) -> list[DataExportRequest]:
        docs = self.find({"user_id": user_id})
        return self.docs_to_data_export_requests(docs)

    def upload_dataframe_to_gcs(
        self, contents: pd.DataFrame, export_request: DataExportRequest
    ) -> str:
        storage_client = storage.Client()
        bucket = storage_client.bucket(self.bucket_name)
        blob = bucket.blob(export_request.destination_file())

        contents.reset_index(drop=True, inplace=True)
        blob.upload_from_string(contents.to_csv(index=False), "text/csv")

        print(
            "{} with contents {} has been uploaded to {}.".format(
                export_request.destination_file(), len(contents), self.bucket_name
            )
        )

        return f"https://storage.cloud.google.com/{self.bucket_name}/{export_request.destination_file()}"
