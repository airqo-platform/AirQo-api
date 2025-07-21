from datetime import datetime, timezone
import flask_excel as excel
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
    DataType,
    DeviceCategory,
    DeviceNetwork,
)
from api.utils.datautils import DataUtils
from api.models.datadownload.datadownload import (
    raw_data_model,
    data_download_model,
    data_export_model,
)
from schemas.datadownload import RawDataSchema, DataDownloadSchema, DataExportSchema
from marshmallow import ValidationError
from api.utils.data_formatters import (
    get_validated_filter,
    format_to_aqcsv,
    compute_airqloud_summary,
)
from api.utils.dates import str_to_date, date_to_str
from api.utils.exceptions import ExportRequestNotFound
from api.utils.http import AirQoRequests
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
        minimum_output = json_data.get("minimum", True)
        postfix = "-" if output_format == "airqo-standard" else "-aqcsv-"
        data_filter = {filter_type: filter_value}
        datatype = DataType[data_type.upper()]
        frequency = Frequency[frequency.upper()]

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
                    columns=pollutants,
                    data_filter=data_filter,
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


@rest_api_v2.route("/raw-data")
class RawDataExportResource(Resource):
    @rest_api_v2.expect(raw_data_model)
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
