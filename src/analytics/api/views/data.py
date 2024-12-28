import datetime
import traceback
from typing import List

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
    DataExportStatus,
    DataExportFormat,
    Frequency,
)
from api.utils.data_formatters import (
    filter_non_private_sites,
    filter_non_private_devices,
)

# Middlewares
from api.utils.data_formatters import (
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
    @validate_request_json(
        "startDateTime|required:datetime",
        "endDateTime|required:datetime",
        "frequency|optional:str",
        "weatherFields|optional:list",
        "downloadType|optional:str",
        "outputFormat|optional:str",
        "pollutants|optional:list",
        "sites|optional:list",
        "site_ids|optional:list",
        "site_names|optional:list",
        "device_ids|optional:list",
        "devices|optional:list",
        "device_names|optional:list",
        "airqlouds|optional:list",
        "datatype|optional:str",
        "minimum|optional:bool",
    )
    def post(self):
        """
        Handles POST requests for downloading air quality data. Validates inputs, retrieves data from BigQuery,
        formats it as per specified download type and format, and returns the data.

        Returns:
            - JSON response with air quality data if downloadType is 'json'.
            - CSV file download response if downloadType is 'csv'.
        """
        valid_options = {
            "pollutants": ["pm2_5", "pm10", "no2"],
            "download_types": ["csv", "json"],
            "data_types": ["calibrated", "raw"],
            "output_formats": ["airqo-standard", "aqcsv"],
            "frequencies": ["hourly", "daily", "raw", "weekly", "monthly", "yearly"],
        }

        json_data = request.get_json()

        start_date = json_data["startDateTime"]
        end_date = json_data["endDateTime"]
        try:
            filter_type, filter_value, error_message = self._get_validated_filter(
                json_data
            )
            if error_message:
                return (
                    AirQoRequests.create_response(error_message, success=False),
                    AirQoRequests.Status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            logger.exception(f"An error has occured; {e}")

        try:
            frequency = self._get_valid_option(
                json_data.get("frequency"), valid_options["frequencies"], "frequency"
            )
            download_type = self._get_valid_option(
                json_data.get("downloadType"),
                valid_options["download_types"],
                "downloadType",
            )
            output_format = self._get_valid_option(
                json_data.get("outputFormat"),
                valid_options["output_formats"],
                "outputFormat",
            )
            data_type = self._get_valid_option(
                json_data.get("datatype"), valid_options["data_types"], "datatype"
            )
        except ValueError as e:
            return (
                AirQoRequests.create_response(f"An error occured: {e}", success=False),
                AirQoRequests.Status.HTTP_400_BAD_REQUEST,
            )

        pollutants = json_data.get("pollutants", valid_options["pollutants"])
        weather_fields = json_data.get("weatherFields", None)
        minimum_output = json_data.get("minimum", True)

        if not all(p in valid_options["pollutants"] for p in pollutants):
            return (
                AirQoRequests.create_response(
                    f"Invalid pollutant. Valid values are {', '.join(valid_options['pollutants'])}",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_400_BAD_REQUEST,
            )

        postfix = "-" if output_format == "airqo-standard" else "-aqcsv-"

        try:
            data_frame = EventsModel.download_from_bigquery(
                filter_type=filter_type,  # Pass one filter[sites, airqlouds, devices] that has been passed in the api query
                filter_value=filter_value,
                start_date=start_date,
                end_date=end_date,
                frequency=frequency,
                pollutants=pollutants,
                data_type=data_type,
                weather_fields=weather_fields,
            )

            if data_frame.empty:
                return (
                    AirQoRequests.create_response("No data found", data=[]),
                    AirQoRequests.Status.HTTP_404_NOT_FOUND,
                )
            if minimum_output:
                # Drop unnecessary columns
                columns_to_drop = ["site_id"]
                columns_to_drop.append("timestamp") if frequency in [
                    "hourly",
                    "daily",
                ] else columns_to_drop
                print(data_frame.columns.to_list())
                data_frame.drop(
                    columns=columns_to_drop,
                    inplace=True,
                )

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
        except Exception as ex:
            logger.exception(f"An error occurred: {ex}")
            return (
                AirQoRequests.create_response(
                    f"An Error occurred while processing your request. Please contact support.",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _get_validated_filter(self, json_data):
        """
        Validates that exactly one of 'airqlouds', 'sites', or 'devices' is provided in the request,
        and applies filtering if necessary.

        Args:
            json_data (dict): JSON payload from the request.

        Returns:
            tuple: The name of the filter ("sites", "devices", or "airqlouds") and its validated value if valid.

        Raises:
            ValueError: If more than one or none of the filters are provided.
        """
        filter_type: str = None
        validated_data: List[str] = None
        error_message: str = ""

        # TODO Lias with device registry to cleanup this makeshift implementation
        devices = ["devices", "device_ids", "device_names"]
        sites = ["sites", "site_names", "site_ids"]

        valid_filters = [
            "sites",
            "site_names",
            "site_ids",
            "devices",
            "device_ids",
            "airqlouds",
            "device_names",
        ]
        provided_filters = [key for key in valid_filters if json_data.get(key)]
        if len(provided_filters) != 1:
            error_message = "Specify exactly one of 'airqlouds', 'sites', 'device_names', or 'devices' in the request body."
            return filter_type, validated_data, error_message

        filter_type = provided_filters[0]
        filter_value = json_data.get(filter_type)

        if filter_type in sites:
            validated_value = filter_non_private_sites(filter_type, filter_value)
        elif filter_type in devices:
            validated_value = filter_non_private_devices(filter_type, filter_value)
        else:
            return filter_type, filter_value, None

        if validated_value and validated_value.get("status") == "success":
            # TODO This should be cleaned up.
            validated_data = validated_value.get("data", {}).get(
                "sites" if filter_type in sites else "devices", []
            )
        else:
            error_message = validated_value.get(
                "message", "Data filter validation failed"
            )

        return filter_type, validated_data, error_message

    def _get_valid_option(self, option, valid_options, option_name):
        """
        Returns a validated option, raising an error with valid options if invalid.

        Args:
            option (str): Option provided in the request.
            valid_options (list): List of valid options.
            option_name (str): The name of the option being validated.

        Returns:
            str: A validated option from the list.

        Raises:
            ValueError: If the provided option is invalid.
        """
        if option and option.lower() in valid_options:
            return option.lower()
        if option:
            raise ValueError(
                f"Invalid {option_name}. Valid values are: {', '.join(valid_options)}."
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
        sites = filter_non_private_sites(sites=json_data.get("sites", {})).get(
            "sites", None
        )
        devices = filter_non_private_devices(devices=json_data.get("devices", {})).get(
            "devices", None
        )
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
                AirQoRequests.create_response(
                    f"Specify either a list of airqlouds, sites or devices in the request body",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_400_BAD_REQUEST,
            )

        if frequency not in valid_frequencies:
            return (
                AirQoRequests.create_response(
                    f"Invalid frequency {frequency}. Valid string values are any of {', '.join(valid_frequencies)}",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_400_BAD_REQUEST,
            )

        if export_format not in valid_export_formats:
            return (
                AirQoRequests.create_response(
                    f"Invalid download type {export_format}. Valid string values are any of {', '.join(valid_export_formats)}",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_400_BAD_REQUEST,
            )

        if output_format not in valid_output_formats:
            return (
                AirQoRequests.create_response(
                    f"Invalid output format {output_format}. Valid string values are any of {', '.join(valid_output_formats)}",
                    success=False,
                ),
                AirQoRequests.Status.HTTP_400_BAD_REQUEST,
            )

        for pollutant in pollutants:
            if pollutant not in valid_pollutants:
                return (
                    AirQoRequests.create_response(
                        f"Invalid pollutant {pollutant}. Valid values are {', '.join(valid_pollutants)}",
                        success=False,
                    ),
                    AirQoRequests.Status.HTTP_400_BAD_REQUEST,
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
                AirQoRequests.create_response(
                    "request successfully received",
                    data=data_export_request.to_api_format(),
                ),
                AirQoRequests.Status.HTTP_200_OK,
            )

        except Exception as ex:
            print(ex)
            traceback.print_exc()
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

        except Exception as ex:
            print(ex)
            traceback.print_exc()
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

        except Exception as ex:
            print(ex)
            traceback.print_exc()
            return (
                AirQoRequests.create_response(
                    "An Error occurred while processing your request. Please contact support",
                    data={},
                    success=False,
                ),
                AirQoRequests.Status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
