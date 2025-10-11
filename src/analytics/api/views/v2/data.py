from datetime import datetime, timezone
import pandas as pd
from flasgger import swag_from
from flask import request
from flask_restx import Resource

from api.models import (
    EventsModel,
)
from api.models.data_export import (
    DataExportRequest,
    DataExportModel,
)
from constants import (
    DataExportStatus,
    DataExportFormat,
    Frequency,
)
from api.models.datadownload.datadownload import (
    raw_data_model,
    data_download_model,
    data_export_model,
)
from schemas.datadownload import RawDataSchema, DataDownloadSchema, DataExportSchema
from marshmallow import ValidationError
from api.utils.data_formatters import (
    get_validated_filter,
    compute_airqloud_summary,
)
from api.utils.dates import str_to_date, date_to_str
from api.utils.exceptions import ExportRequestNotFound
from api.utils.http import AirQoRequests
from api.views.common.responses import ResponseBuilder
from api.views.common.data_ops import DownloadService
from api.utils.request_validators import validate_request_json, validate_request_params
from main import rest_api_v2

import logging

logger = logging.getLogger(__name__)


@rest_api_v2.errorhandler(ExportRequestNotFound)
def batch_not_found_exception(error):
    return (
        AirQoRequests.create_response(error.message, data={}, success=False),
        AirQoRequests.Status.HTTP_400_BAD_REQUEST,
    )


@rest_api_v2.route("/data-download")
class DataExportResource(Resource):
    """
    Resource class for handling air quality data download requests.
    Provides functionality to filter, validate, and format air quality data
    for specified time ranges, sites, devices, or airqlouds.
    """

    @swag_from("/api/docs/dashboard/download_custom_data_post.yml")
    @rest_api_v2.expect(data_download_model)
    def post(self):
        """
        Handles POST requests for downloading air quality data. Validates inputs, retrieves data from BigQuery,
        formats it as per specified download type and format, and returns the data.

        Returns:
            - JSON response with air quality data if downloadType is 'json'.
            - CSV file download response if downloadType is 'csv'.
        """
        try:
            json_data = DataDownloadSchema().load(request.json)
        except ValidationError as err:
            return ResponseBuilder.error(err.messages, 400)

        try:
            filter_type, filter_value, error_message = get_validated_filter(json_data)
            if error_message:
                return ResponseBuilder.error(error_message, 400)

            json_data.update({"dynamic": True})
            data_frame, _ = DownloadService.fetch_data(
                json_data, filter_type, filter_value
            )

            if data_frame.empty:
                return ResponseBuilder.error("No data found", 400)

            return DownloadService.format_and_respond(json_data, data_frame)

        except Exception as e:
            logger.exception("Unexpected error occurred during custom data download.")
            return ResponseBuilder.error(
                "An error occurred while processing your request. Please contact support.",
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@rest_api_v2.route("/raw-data")
class RawDataExportResource(Resource):
    @rest_api_v2.expect(raw_data_model)
    def post(self):
        try:
            json_data = RawDataSchema().load(request.json)
        except ValidationError as err:
            return ResponseBuilder.error(err.messages, 400)

        try:
            filter_type, filter_value, error_message = get_validated_filter(json_data)
            if error_message:
                return ResponseBuilder.error(error_message, 400)

            json_data.update({"datatype": "raw"})
            data_frame, metadata = DownloadService.fetch_data(
                json_data, filter_type, filter_value
            )
            if data_frame.empty:
                return ResponseBuilder.error("No data found", 400)

            return DownloadService.format_and_respond(json_data, data_frame, metadata)

        except Exception as e:
            logger.exception("Unexpected error occurred during custom data download.")
            return ResponseBuilder.error(
                "An error occurred while processing your request. Please contact support.",
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@rest_api_v2.route("/data-export")
class DataExportV2Resource(Resource):
    @rest_api_v2.expect(data_export_model)
    def post(self):
        try:
            json_data = DataExportSchema().load(request.json)
        except ValidationError as err:
            return {"errors": err.messages}, 400

        start_date = json_data["startDateTime"]
        end_date = json_data["endDateTime"]
        try:
            filter_type, filter_value, error_message = get_validated_filter(json_data)
            if error_message:
                return (
                    AirQoRequests.create_response(error_message, success=False),
                    AirQoRequests.Status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            logger.exception(f"An error has occured; {e}")

        meta_data = json_data.get("meta_data", [])
        pollutants = json_data.get("pollutants")
        user_id = json_data.get("userId")
        frequency = json_data.get("frequency")
        export_format = json_data.get("exportFormat")

        try:
            data_export_model = DataExportModel()
            data_export_request = DataExportRequest(
                start_date=str_to_date(start_date),
                end_date=str_to_date(end_date),
                filter_type=filter_type,
                filter_value=filter_value,
                status=DataExportStatus.SCHEDULED,
                data_links=[],
                request_date=datetime.now(timezone.utc),
                user_id=user_id,
                frequency=Frequency[frequency.upper()],
                export_format=DataExportFormat[export_format.upper()],
                request_id="",
                pollutants=pollutants,
                retries=3,
                meta_data=meta_data,
            )

            data_export_request.status = DataExportStatus.SCHEDULED
            data_export_model.create_request(data_export_request)

            return (
                AirQoRequests.create_response(
                    "request successfully received",
                    data=data_export_request.to_api_format(),
                ),
                AirQoRequests.Status.HTTP_200_OK,
            )

        except Exception as ex:
            logger.exception(f"An exception occured: {ex}")
            return (
                AirQoRequests.create_response(
                    f"An Error occurred while processing your request. Please contact support",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
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
                AirQoRequests.create_response(
                    "request successfully received",
                    data=data,
                ),
                AirQoRequests.Status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception(f"An exception has occurred: {e}")
            return (
                AirQoRequests.create_response(
                    f"An Error occurred while processing your request. Please contact support",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
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
                AirQoRequests.create_response(
                    "request successfully updated",
                    data=export_request.to_api_format(),
                ),
                AirQoRequests.Status.HTTP_200_OK,
            )
        else:
            return (
                AirQoRequests.create_response(
                    f"An Error occurred while processing your request. Please contact support",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
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
        events_model = EventsModel()
        try:
            json_data = request.get_json()

            start_date_time = str_to_date(json_data["startDateTime"])
            end_date_time = str_to_date(json_data["endDateTime"])
            airqloud = str(json_data.get("airqloud", ""))
            cohort = str(json_data.get("cohort", ""))
            grid = str(json_data.get("grid", ""))

            start_date_time = date_to_str(start_date_time, format="%Y-%m-%dT%H:00:00Z")
            end_date_time = date_to_str(end_date_time, format="%Y-%m-%dT%H:00:00Z")
            data = events_model.get_devices_summary(
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
                    AirQoRequests.create_response(
                        f"No data found for grid {grid} from {start_date_time} to {end_date_time}",
                        data={},
                        success=False,
                    ),
                    AirQoRequests.Status.HTTP_200_OK,
                )

            return (
                AirQoRequests.create_response("successful", data=summary),
                AirQoRequests.Status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception(f"An exception has occurred: {e}")
            return (
                AirQoRequests.create_response(
                    "An Error occurred while processing your request. Please contact support",
                    data={},
                    success=False,
                ),
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
