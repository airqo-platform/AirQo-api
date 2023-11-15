import datetime
import traceback

import flask_excel as excel
import pandas as pd
from flasgger import swag_from
from flask import request, jsonify
from flask_restx import Resource

from api.models import (
    EventsModel,
)
from api.models.data_export import (
    DataExportRequest,
    DataExportModel,
    DataExportStatus,
    DataExportFormat,
    Frequency,
)

# Middlewares
from api.utils.data_formatters import (
    format_to_aqcsv,
    compute_airqloud_summary,
)
from api.utils.dates import str_to_date, date_to_str
from api.utils.exceptions import ExportRequestNotFound
from api.utils.http import create_response, Status
from api.utils.request_validators import validate_request_json, validate_request_params
from main import rest_api_v2


@rest_api_v2.errorhandler(ExportRequestNotFound)
def batch_not_found_exception(error):
    return (
        create_response(error.message, data={}, success=False),
        Status.HTTP_400_BAD_REQUEST,
    )


@rest_api_v2.route("/data-download")
class DataExportResource(Resource):
    @swag_from("/api/docs/dashboard/download_custom_data_post.yml")
    @validate_request_json(
        "startDateTime|required:datetime",
        "endDateTime|required:datetime",
        "frequency|optional:str",
        "downloadType|optional:str",
        "outputFormat|optional:str",
        "pollutants|optional:list",
        "sites|optional:list",
        "devices|optional:list",
        "airqlouds|optional:list",
    )
    def post(self):
        valid_pollutants = ["pm2_5", "pm10", "no2"]
        valid_download_types = ["csv", "json"]
        valid_output_formats = ["airqo-standard", "aqcsv"]
        valid_frequencies = ["hourly", "daily", "raw"]

        json_data = request.get_json()

        start_date = json_data["startDateTime"]
        end_date = json_data["endDateTime"]
        sites = json_data.get("sites", [])
        devices = json_data.get("devices", [])
        airqlouds = json_data.get("airqlouds", [])
        pollutants = json_data.get("pollutants", valid_pollutants)
        frequency = f"{json_data.get('frequency', valid_frequencies[0])}".lower()
        download_type = (
            f"{json_data.get('downloadType', valid_download_types[0])}".lower()
        )
        output_format = (
            f"{json_data.get('outputFormat', valid_output_formats[0])}".lower()
        )

        if sum([len(sites) == 0, len(devices) == 0, len(airqlouds) == 0]) == 3:
            return (
                create_response(
                    f"Specify either a list of airqlouds, sites or devices in the request body",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        if sum([len(sites) != 0, len(devices) != 0, len(airqlouds) != 0]) != 1:
            return (
                create_response(
                    f"You cannot specify airqlouds, sites and devices in one go",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        if frequency not in valid_frequencies:
            return (
                create_response(
                    f"Invalid frequency {frequency}. Valid string values are any of {', '.join(valid_frequencies)}",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        if download_type not in valid_download_types:
            return (
                create_response(
                    f"Invalid download type {download_type}. Valid string values are any of {', '.join(valid_download_types)}",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        if output_format not in valid_output_formats:
            return (
                create_response(
                    f"Invalid output format {output_format}. Valid string values are any of {', '.join(valid_output_formats)}",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        for pollutant in pollutants:
            if pollutant not in valid_pollutants:
                return (
                    create_response(
                        f"Invalid pollutant {pollutant}. Valid values are {', '.join(valid_pollutants)}",
                        success=False,
                    ),
                    Status.HTTP_400_BAD_REQUEST,
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


@rest_api_v2.route("/data-export")
class DataExportV2Resource(Resource):
    @validate_request_json(
        "startDateTime|required:datetime",
        "endDateTime|required:datetime",
        "userId|required:str",
        "frequency|optional:str",
        "exportFormat|optional:str",
        "outputFormat|optional:str",
        "pollutants|optional:list",
        "sites|optional:list",
        "devices|optional:list",
        "airqlouds|optional:list",
        "meta_data|optional:dict",
    )
    def post(self):
        valid_pollutants = ["pm2_5", "pm10", "no2"]
        valid_export_formats = ["csv", "json"]
        valid_output_formats = ["airqo-standard", "aqcsv"]
        valid_frequencies = ["hourly", "daily", "raw"]

        json_data = request.get_json()

        start_date = json_data["startDateTime"]
        end_date = json_data["endDateTime"]
        meta_data = json_data.get("meta_data", [])
        sites = json_data.get("sites", [])
        devices = json_data.get("devices", [])
        airqlouds = json_data.get("airqlouds", [])
        pollutants = json_data.get("pollutants", valid_pollutants)
        user_id = json_data.get("userId")
        frequency = f"{json_data.get('frequency', valid_frequencies[0])}".lower()
        export_format = (
            f"{json_data.get('exportFormat', valid_export_formats[0])}".lower()
        )
        output_format = (
            f"{json_data.get('outputFormat', valid_output_formats[0])}".lower()
        )

        if len(airqlouds) != 0:
            devices = []
            sites = []
        elif len(sites) != 0:
            devices = []
            airqlouds = []
        elif len(devices) != 0:
            airqlouds = []
            sites = []
        else:
            return (
                create_response(
                    f"Specify either a list of airqlouds, sites or devices in the request body",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        if frequency not in valid_frequencies:
            return (
                create_response(
                    f"Invalid frequency {frequency}. Valid string values are any of {', '.join(valid_frequencies)}",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        if export_format not in valid_export_formats:
            return (
                create_response(
                    f"Invalid download type {export_format}. Valid string values are any of {', '.join(valid_export_formats)}",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        if output_format not in valid_output_formats:
            return (
                create_response(
                    f"Invalid output format {output_format}. Valid string values are any of {', '.join(valid_output_formats)}",
                    success=False,
                ),
                Status.HTTP_400_BAD_REQUEST,
            )

        for pollutant in pollutants:
            if pollutant not in valid_pollutants:
                return (
                    create_response(
                        f"Invalid pollutant {pollutant}. Valid values are {', '.join(valid_pollutants)}",
                        success=False,
                    ),
                    Status.HTTP_400_BAD_REQUEST,
                )

        try:
            data_export_model = DataExportModel()
            data_export_request = DataExportRequest(
                airqlouds=airqlouds,
                start_date=str_to_date(start_date),
                end_date=str_to_date(end_date),
                sites=sites,
                status=DataExportStatus.SCHEDULED,
                data_links=[],
                request_date=datetime.datetime.utcnow(),
                user_id=user_id,
                frequency=Frequency[frequency.upper()],
                export_format=DataExportFormat[export_format.upper()],
                devices=devices,
                request_id="",
                pollutants=pollutants,
                retries=3,
                meta_data=meta_data,
            )

            data_export_request.status = DataExportStatus.SCHEDULED
            data_export_model.create_request(data_export_request)

            return (
                create_response(
                    "request successfully received",
                    data=data_export_request.to_api_format(),
                ),
                Status.HTTP_200_OK,
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

    @validate_request_params(
        "userId|required:str",
    )
    def get(self):
        user_id = request.args.get("userId")
        try:
            data_export_model = DataExportModel()
            requests = data_export_model.get_user_requests(user_id)

            data = [x.to_api_format() for x in requests]

            return (
                create_response(
                    "request successfully received",
                    data=data,
                ),
                Status.HTTP_200_OK,
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

    @validate_request_params(
        "requestId|required:str",
    )
    def patch(self):
        request_id = request.args.get("requestId")
        data_export_model = DataExportModel()
        export_request = data_export_model.get_request_by_id(request_id)
        export_request.status = DataExportStatus.SCHEDULED
        export_request.retries = 3
        success = data_export_model.update_request_status_and_retries(export_request)
        if success:
            return (
                create_response(
                    "request successfully updated",
                    data=export_request.to_api_format(),
                ),
                Status.HTTP_200_OK,
            )
        else:
            return (
                create_response(
                    f"An Error occurred while processing your request. Please contact support",
                    success=False,
                ),
                Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@rest_api_v2.route("/data/summary")
class DataSummaryResource(Resource):
    @validate_request_json(
        "startDateTime|required:datetime",
        "endDateTime|required:datetime",
        "airqloud|optional:str",
        "cohort|optional:str",
        "grid|optional:str",
    )
    def post(self):
        try:
            json_data = request.get_json()

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
                        f"No data found for airqloud {airqloud} from {start_date_time} to {end_date_time}",
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
