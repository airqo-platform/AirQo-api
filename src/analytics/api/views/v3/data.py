import flask_excel as excel
from flasgger import swag_from
from flask import request
from flask_restx import Resource


from constants import Frequency, DataType, DeviceCategory, DeviceNetwork
from api.utils.datautils import DataUtils
from api.utils.utils import limiter, ratelimit_response
from api.models.datadownload.datadownload import data_download_model, raw_data_model
from schemas.datadownload import DataDownloadSchema, RawDataSchema
from marshmallow import ValidationError
from api.utils.data_formatters import (
    get_validated_filter,
    format_to_aqcsv,
)
from api.utils.exceptions import ExportRequestNotFound
from api.utils.http import AirQoRequests
from main import rest_api_v3

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
        try:
            json_data = DataDownloadSchema().load(request.json)
        except ValidationError as err:
            return {"errors": err.messages}, 400

        try:
            filter_type, filter_value, error_message = get_validated_filter(json_data)
            if error_message:
                return (
                    AirQoRequests.create_response(error_message, success=False),
                    AirQoRequests.Status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            logger.exception(f"An error has occured; {e}")

        startDateTime = json_data["startDateTime"]
        endDateTime = json_data["endDateTime"]
        download_type = (json_data.get("downloadType"),)
        output_format = (json_data.get("outputFormat"),)
        data_type = json_data.get("datatype")
        device_category = json_data.get("device_category")
        frequency = json_data.get("frequency")
        pollutants = json_data.get("pollutants")
        metadata_fields = json_data.get("metaDataFields", [])
        weather_fields = json_data.get("weatherFields", [])
        minimum_output = json_data.get("minimum", True)
        postfix = "-" if output_format == "airqo-standard" else "-aqcsv-"
        data_filter = {filter_type: filter_value}
        datatype = DataType[data_type.upper()]
        frequency = Frequency[frequency.upper()]
        extra_columns = [*metadata_fields, *weather_fields]
        try:
            device_category = (
                DeviceCategory[device_category.upper()]
                if device_category
                else DeviceCategory.LOWCOST
            )
            if data_filter:
                data_frame = DataUtils.extract_data_from_bigquery(
                    datatype=datatype,
                    start_date_time=startDateTime,
                    end_date_time=endDateTime,
                    frequency=frequency,
                    dynamic_query=True,
                    device_category=device_category,
                    main_columns=pollutants,
                    data_filter=data_filter,
                    extra_columns=extra_columns,
                    use_cache=True,
                )
            else:
                return (
                    AirQoRequests.create_response("No data filter provided.", data=[]),
                    AirQoRequests.Status.HTTP_400_BAD_REQUEST,
                )

            if data_frame.empty:
                return (
                    AirQoRequests.create_response("No data found", data=[]),
                    AirQoRequests.Status.HTTP_404_NOT_FOUND,
                )

            if minimum_output:
                # Drop unnecessary columns
                columns_to_drop = ["site_id"]
                columns_to_drop.append("timestamp") if frequency.value in [
                    "hourly",
                    "daily",
                ] else columns_to_drop
                data_frame.drop(columns=columns_to_drop, inplace=True, errors="ignore")

            records = data_frame.to_dict("records")

            if output_format == "aqcsv":
                records = format_to_aqcsv(
                    data=records, frequency=frequency, pollutants=pollutants
                )

            if download_type == "json":
                return (
                    AirQoRequests.create_response(
                        "air-quality data download successful", data=records
                    ),
                    AirQoRequests.Status.HTTP_200_OK,
                )

            return excel.make_response_from_records(
                records, "csv", file_name=f"{frequency}-air-quality{postfix}data"
            )
        except Exception as e:
            logger.exception(f"An error occurred: {e}")
            return (
                AirQoRequests.create_response(
                    f"An Error occurred while processing your request. Please contact support.",
                    success=False,
                ),
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
            return {"errors": err.messages}, 400

        network = json_data.get("network")
        device_names = json_data.get("device_names")
        device_category = json_data.get("device_category")
        startDateTime = json_data.get("startDateTime")
        endDateTime = json_data.get("endDateTime")
        frequency = json_data.get("frequency")
        frequency = Frequency[frequency.upper()]
        device_category = DeviceCategory[device_category.upper()]
        network = DeviceNetwork[network.upper()]
        data_filter = {"device_id": device_names}
        try:
            data_frame = DataUtils.extract_data_from_bigquery(
                datatype=DataType.RAW,
                start_date_time=startDateTime,
                end_date_time=endDateTime,
                frequency=frequency,
                device_category=device_category,
                device_network=network,
                data_filter=data_filter,
                use_cache=True,
            )

            if data_frame.empty:
                return (
                    AirQoRequests.create_response("No data found", data=[]),
                    AirQoRequests.Status.HTTP_404_NOT_FOUND,
                )

            records = data_frame.to_dict("records")

            return excel.make_response_from_records(
                records,
                "csv",
                file_name=f"{frequency.value}-air-quality-data-{startDateTime}",
            )
        except Exception as ex:
            logger.exception(f"An error occurred: {ex}")
            return (
                AirQoRequests.create_response(
                    f"An Error occurred while processing your request. Please contact support. {ex}",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
