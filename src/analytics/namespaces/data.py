import traceback
import pandas as pd

import flask_excel as excel
from celery.result import AsyncResult
from flasgger import swag_from
from flask_restx import Resource, Namespace
from marshmallow import ValidationError

import tasks
from models import (
    EventsModel, )
from utils.data_formatters import filter_non_private_entities, Entity, compute_airqloud_summary
from utils.data_formatters import (
    format_to_aqcsv,
)
from utils.dates import str_to_date, date_to_str
from utils.http import create_response, Status
from utils.validators.data import DataExportSchema, DataSummarySchema, BulkDataExportSchema

data_export_api = Namespace("data", description="Data export APIs", path="/")


@data_export_api.route("/data-download")
class DataExportResource(Resource):
    @swag_from("/api/docs/dashboard/download_custom_data_post.yml")
    def post(self):
        try:
            json_data = DataExportSchema().load(data_export_api.payload)
        except ValidationError as err:
            return (
                create_response(f" {err.messages}", success=False),
                Status.HTTP_400_BAD_REQUEST
            )

        start_date = json_data["startDateTime"]
        end_date = json_data["endDateTime"]
        sites = filter_non_private_entities(
            entities=json_data.get("sites", []), entity_type=Entity.SITES
        )
        devices = filter_non_private_entities(
            entities=json_data.get("devices", []), entity_type=Entity.DEVICES
        )
        airqlouds = json_data.get("airqlouds", [])
        pollutants = json_data.get("pollutants", [])
        frequency = f"{json_data.get('frequency', [])}".lower()
        download_type = (
            f"{json_data.get('downloadType', [])}".lower()
        )
        output_format = (
            f"{json_data.get('outputFormat', [])}".lower()
        )

        postfix = "-" if output_format == "airqo-standard" else "-aqcsv-"

        try:
            data_frame = EventsModel.download_from_bigquery(
                sites=sites,
                devices=devices,
                airqlouds=airqlouds,
                start_date=start_date,
                end_date=end_date,
                frequency=frequency,
                pollutants=pollutants,
            )

            if data_frame.empty:
                return (
                    create_response("No data found", data=[]),
                    Status.HTTP_404_NOT_FOUND,
                )

            records = data_frame.to_dict("records")

            if output_format == "aqcsv":
                records = format_to_aqcsv(
                    data=records, frequency=frequency, pollutants=pollutants
                )

            if download_type == "json":
                return (
                    create_response(
                        "air-quality data download successful", data=records
                    ),
                    Status.HTTP_200_OK,
                )

            return excel.make_response_from_records(
                records, "csv", file_name=f"{frequency}-air-quality{postfix}data"
            )
        except Exception as ex:
            print(ex)
            traceback.print_exc()
            return (
                create_response(
                    f"An Error occurred while processing your request. Please contact support",
                    success=False,
                ),
                Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@data_export_api.route("/bulk-data-download")
class BulkDataExportResource(Resource):
    def post(self):
        try:
            json_data = BulkDataExportSchema().load(data_export_api.payload)
        except ValidationError as err:
            return (
                create_response(f" {err.messages}", success=False),
                Status.HTTP_400_BAD_REQUEST
            )
        user_id = json_data.get("userId")
        start_date = json_data["startDateTime"]
        end_date = json_data["endDateTime"]
        meta_data = json_data.get("meta_data", [])
        sites = filter_non_private_entities(
            entities=json_data.get("sites", []), entity_type=Entity.SITES
        )
        devices = filter_non_private_entities(
            entities=json_data.get("devices", []), entity_type=Entity.DEVICES
        )
        airqlouds = json_data.get("airqlouds", [])
        frequency = f"{json_data.get('frequency', [])}".lower()
        export_format = (
            f"{json_data.get('exportFormat','csv')}".lower()
        )
        pollutants = json_data.get("pollutants")
        output_format = (
            f"{json_data.get('outputFormat', 'airqo-standard')}".lower()
        )
        try:
            tasks.export_data.apply_async(
                args=[user_id, end_date, sites, devices, airqlouds, frequency, export_format, output_format, meta_data, pollutants],
                countdown=10,
                task_id=user_id
            )
            return (
            create_response(
                "request successfully received",
                data=None
            ),
            Status.HTTP_200_OK
            )
        except Exception as ex:
            print(ex)
            traceback.print_exc()
            return (
                create_response(
                    f"An Error occurred while processing your request. Please contact support",
                    success=False,
                ),
                Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @data_export_api.param("userId", "User ID", "string", required=True)
    def get(self, user_id):
        try:
            result = AsyncResult(task_id=user_id)
            if result.ready():
                return (
                create_response(
                    "request successfully received",
                    data=result.get(),
                ),
                Status.HTTP_200_OK,
                )
            else:
                return (
                create_response(
                    "Data export is still in progress",
                    data=None
                ),
                Status.HTTP_200_OK
                )

        except Exception as ex:
            print(ex)
            traceback.print_exc()
            return (
                create_response(
                    f"An Error occurred while processing your request. Please contact support",
                    success=False,
                ),
                Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

@data_export_api.route("/data/summary")
class DataSummaryResource(Resource):

    def post(self):
        try:
            json_data = DataSummarySchema().load(data_export_api.payload)
        except ValidationError as err:
            return (
                create_response(f" {err.messages}", success=False),
            )
            start_date_time = str_to_date(json_data["startDateTime"])
            end_date_time = str_to_date(json_data["endDateTime"])
            airqloud = str(json_data.get("airqloud", ""))
            cohort = str(json_data.get("cohort", ""))
            grid = str(json_data.get("grid", ""))

            start_date_time = date_to_str(start_date_time, format="%Y-%m-%dT%H:00:00Z")
            end_date_time = date_to_str(end_date_time, format="%Y-%m-%dT%H:00:00Z")
            data = EventsModel.get_devices_summary(
                airqloud=airqloud,
                start_date_time=start_date_time,
                end_date_time=end_date_time,
                grid=grid,
                cohort=cohort,
            )

            summary = compute_airqloud_summary(
                data=pd.DataFrame(data),
                start_date_time=start_date_time,
                end_date_time=end_date_time,
            )

            if len(summary) == 0:
                return (
                    create_response(
                        f"No data found for grid {grid} from {start_date_time} to {end_date_time}",
                        data={},
                        success=False,
                    ),
                    Status.HTTP_200_OK,
                )

            return (
                create_response("successful", data=summary),
                Status.HTTP_200_OK,
            )

        except Exception as ex:
            print(ex)
            traceback.print_exc()
            return (
                create_response(
                    "An Error occurred while processing your request. Please contact support",
                    data={},
                    success=False,
                ),
                Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
