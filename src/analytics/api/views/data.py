import json
import traceback

import flask_excel as excel
import pandas as pd
from flasgger import swag_from
from flask import request
from flask_restx import Resource

from api.models import (
    EventsModel,
)

# Middlewares
from api.utils.data_formatters import (
    format_to_aqcsv_v2,
    compute_airqloud_data_statistics,
)
from api.utils.http import create_response, Status
from api.utils.request_validators import validate_request_json
from main import rest_api


@rest_api.route("/data-download")
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
            records = format_to_aqcsv_v2(
                data=records, frequency=frequency, pollutants=pollutants
            )

        if download_type == "json":
            return (
                create_response("air-quality data download successful", data=records),
                Status.HTTP_200_OK,
            )

        return excel.make_response_from_records(
            records, "csv", file_name=f"{frequency}-air-quality{postfix}data"
        )


@rest_api.route("/data/summary")
class DataSummaryResource(Resource):
    @validate_request_json(
        "startDateTime|required:datetime",
        "endDateTime|required:datetime",
        "airqloud|optional:str",
    )
    def post(self):
        try:
            json_data = request.get_json()

            start_date_time = json_data["startDateTime"]
            end_date_time = json_data["endDateTime"]
            airqloud = str(json_data.get("airqloud", ""))

            if airqloud.strip() == "":
                return (
                    create_response(
                        f"Specify the airqloud id in the request body",
                        success=False,
                    ),
                    Status.HTTP_400_BAD_REQUEST,
                )

            data = EventsModel.get_data_for_summary(
                airqloud=airqloud,
                start_date_time=start_date_time,
                end_date_time=end_date_time,
            )

            summary = compute_airqloud_data_statistics(
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
                    Status.HTTP_404_NOT_FOUND,
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
