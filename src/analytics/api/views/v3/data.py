from flasgger import swag_from
from flask import request, jsonify
from flask_restx import Resource

from api.utils.utils import limiter, ratelimit_response
from api.models.datadownload.datadownload import data_download_model, raw_data_model
from schemas.datadownload import DataDownloadSchema, RawDataSchema
from marshmallow import ValidationError
from api.utils.data_formatters import (
    get_validated_filter,
)
from api.utils.datautils import DataUtils
from api.views.common.responses import ResponseBuilder
from api.views.common.data_ops import DownloadService
from api.utils.exceptions import ExportRequestNotFound
from api.utils.http import AirQoRequests
from main import rest_api_v3
from api.utils.cursor_utils import CursorUtils

from constants import DataType, DeviceCategory
import logging

logger = logging.getLogger(__name__)


@rest_api_v3.errorhandler(ExportRequestNotFound)
def batch_not_found_exception(error):
    return (
        AirQoRequests.create_response(error.message, data={}, success=False),
        AirQoRequests.Status.HTTP_400_BAD_REQUEST,
    )


@rest_api_v3.route("/data-download")
class DataExportResource(Resource):
    """
    Resource class for handling air quality data download requests.
    Provides functionality to filter, validate, and format air quality data
    for specified time ranges, sites, devices, or airqlouds.
    """

    @swag_from("/api/docs/dashboard/download_custom_data_post.yml")
    @rest_api_v3.expect(data_download_model)
    @limiter.limit("10 per minute", error_message=ratelimit_response)
    def post(self):
        """
        Handles POST requests for downloading air quality data. Validates inputs, retrieves data from BigQuery,
        formats it as per specified download type and format, and returns the data.

        Returns:
            - JSON response with air quality data if downloadType is 'json'.
            - CSV file download response if downloadType is 'csv'.
        """
        """
        Handles the POST request to download custom air quality data.

        Returns:
            Tuple containing the response dictionary and HTTP status code.
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


@rest_api_v3.route("/raw-data")
class RawDataExportResource(Resource):
    @rest_api_v3.expect(raw_data_model)
    @limiter.limit("10 per minute", error_message=ratelimit_response)
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
            logger.exception(
                f"Unexpected error occurred during custom data download: {e}"
            )
            return ResponseBuilder.error(
                "An error occurred while processing your request. Please contact support.",
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
