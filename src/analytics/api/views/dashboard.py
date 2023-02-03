# Third-party libraries
from flasgger import swag_from
import flask_excel as excel
from flask_restx import Resource
from flask import request

# Middlewares
from api.utils.data_formatters import format_to_aqcsv, format_to_aqcsv_v2
from main import rest_api

from api.models import (
    EventsModel,
    SiteModel,
    ExceedanceModel,
)

from api.utils.http import create_response, Status
from api.utils.request_validators import validate_request_params, validate_request_json
from api.utils.pollutants import (
    generate_pie_chart_data,
    d3_generate_pie_chart_data,
    PM_COLOR_CATEGORY,
    set_pm25_category_background,
)


@rest_api.route("/data-download")
class DownloadDataResource(Resource):
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


@rest_api.route("/data/download")
class DownloadCustomisedDataResource(Resource):
    @swag_from("/api/docs/dashboard/download_custom_data_post.yml")
    @validate_request_params("downloadType|optional:data")
    @validate_request_json(
        "sites|optional:list",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "frequency|optional:str",
        "pollutants|optional:list",
        "device_numbers|optional:list",
    )
    def post(self):
        json_data = request.get_json()

        start_date = json_data["startDate"]
        end_date = json_data["endDate"]

        tenant = request.args.get("tenant", "").lower()
        output_format = request.args.get("outputFormat", "").lower()
        download_type = request.args.get("downloadType", "csv")

        sites = json_data.get("sites", [])
        device_numbers = json_data.get("device_numbers", [])
        frequency = json_data.get("frequency", "hourly")
        pollutants = json_data.get("pollutants", [])
        postfix = "-"

        if tenant.lower() == "urbanbetter":
            frequency = "raw"
            data = EventsModel.bigquery_mobile_device_measurements(
                tenant=tenant,
                device_numbers=device_numbers,
                start_date_time=start_date,
                end_date_time=end_date,
            )
        else:
            data = EventsModel.from_bigquery(
                tenant=tenant,
                sites=sites,
                start_date=start_date,
                end_date=end_date,
                frequency=frequency,
                pollutants=pollutants,
                output_format=output_format,
            )

            if output_format == "aqcsv":
                data = format_to_aqcsv(
                    data=data, frequency="hourly", pollutants=pollutants
                )
                postfix = "-aqcsv-"

        if download_type == "csv":
            return excel.make_response_from_records(
                data, "csv", file_name=f"{tenant}-air-quality-{frequency}{postfix}data"
            )
        elif download_type == "json":
            return (
                create_response("air-quality data download successful", data=data),
                Status.HTTP_200_OK,
            )
        else:
            return (
                create_response(f"unknown data format {download_type}", success=False),
                Status.HTTP_400_BAD_REQUEST,
            )


@rest_api.route("/dashboard/chart/data")
class ChartDataResource(Resource):
    @swag_from("/api/docs/dashboard/customised_chart_post.yml")
    @validate_request_json(
        "sites|required:list",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "frequency|required:str",
        "pollutant|required:str",
        "chartType|required:str",
    )
    def post(self):
        tenant = request.args.get("tenant")

        json_data = request.get_json()
        sites = json_data["sites"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]

        colors = ["#7F7F7F", "#E377C2", "#17BECF", "#BCBD22", "#3f51b5"]

        events_model = EventsModel(tenant)
        data = events_model.get_chart_events(
            sites, start_date, end_date, pollutant, frequency
        )

        chart_datasets = []
        chart_labels = []

        for record in data:

            site = record.get("site", {})

            site_name = f"{site.get('name') or site.get('description') or site.get('generated_name')}"

            dataset = {}

            sorted_values = sorted(
                record.get("values", []), key=lambda item: item.get("time")
            )
            if chart_type.lower() == "pie":
                category_count = generate_pie_chart_data(
                    records=sorted_values, key="value", pollutant=pollutant
                )

                try:
                    labels, values = zip(*category_count.items())
                except ValueError:
                    values = []
                    labels = []
                background_colors = [
                    PM_COLOR_CATEGORY.get(label, "#808080") for label in labels
                ]
                color = background_colors

                dataset.update(
                    {
                        "data": values,
                        "label": f"{site_name} {pollutant}",
                        "backgroundColor": color,
                        "fill": False,
                    }
                )

            else:
                try:
                    values, labels = zip(
                        *[
                            (data.get("value"), data.get("time"))
                            for data in sorted_values
                        ]
                    )
                except ValueError:
                    values = []
                    labels = []

                color = colors.pop()

                dataset.update(
                    {
                        "data": values,
                        "label": f"{site_name} {pollutant}",
                        "borderColor": color,
                        "backgroundColor": color,
                        "fill": False,
                    }
                )

            if not chart_labels:
                chart_labels = labels

            chart_datasets.append(dataset)

        return (
            create_response(
                "successfully retrieved chart data",
                data={"labels": chart_labels, "datasets": chart_datasets},
            ),
            Status.HTTP_200_OK,
        )


@rest_api.route("/dashboard/chart/d3/data")
class D3ChartDataResource(Resource):
    @swag_from("/api/docs/dashboard/d3_chart_data_post.yml")
    @validate_request_json(
        "sites|required:list",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "frequency|required:str",
        "pollutant|required:str",
        "chartType|required:str",
    )
    def post(self):
        tenant = request.args.get("tenant")

        json_data = request.get_json()
        sites = json_data["sites"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]

        events_model = EventsModel(tenant)
        # data = events_model.get_d3_chart_events(sites, start_date, end_date, pollutant, frequency)
        data = events_model.get_d3_chart_events_v2(
            sites, start_date, end_date, pollutant, frequency, tenant
        )

        if chart_type.lower() == "pie":
            data = d3_generate_pie_chart_data(data, pollutant)

        return (
            create_response("successfully retrieved d3 chart data", data=data),
            Status.HTTP_200_OK,
        )


@rest_api.route("/dashboard/sites")
class MonitoringSiteResource(Resource):
    @swag_from("/api/docs/dashboard/monitoring_site_get.yml")
    def get(self):
        tenant = request.args.get("tenant")

        ms_model = SiteModel(tenant)

        sites = ms_model.get_all_sites()

        return (
            create_response("monitoring site data successfully fetched", data=sites),
            Status.HTTP_200_OK,
        )


@rest_api.route("/dashboard/historical/daily-averages")
class DailyAveragesResource(Resource):
    @swag_from("/api/docs/dashboard/device_daily_measurements_get.yml")
    @validate_request_json(
        "pollutant|required:str",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "sites|optional:list",
    )
    def post(self):
        tenant = request.args.get("tenant")
        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        sites = json_data.get("sites", None)

        events_model = EventsModel(tenant)
        site_model = SiteModel(tenant)
        sites = site_model.get_sites(sites)
        data = events_model.get_averages_by_pollutant_from_bigquery(
            start_date, end_date, pollutant
        )

        values = []
        labels = []
        background_colors = []

        for v in data:

            if not v.get("site_id"):
                continue

            site = list(filter(lambda s: s.get("site_id") == v.get("site_id"), sites))

            if not site:
                continue

            site = site[0]
            values.append(v.get("value"))
            labels.append(
                site.get("name")
                or site.get("description")
                or site.get("generated_name")
            )
            background_colors.append(set_pm25_category_background(v.get("value")))

        return (
            create_response(
                "daily averages successfully fetched",
                data={
                    "average_values": values,
                    "labels": labels,
                    "background_colors": background_colors,
                },
            ),
            Status.HTTP_200_OK,
        )


@rest_api.route("/dashboard/exceedances")
class ExceedancesResource(Resource):
    @swag_from("/api/docs/dashboard/exceedances_post.yml")
    @validate_request_json(
        "pollutant|required:str",
        "standard|required:str",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "sites|optional:list",
    )
    def post(self):
        tenant = request.args.get("tenant")

        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        standard = json_data["standard"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        sites = json_data.get("sites", None)

        exc_model = ExceedanceModel(tenant)
        data = exc_model.get_exceedances(
            start_date, end_date, pollutant, standard, sites=sites
        )

        return (
            create_response(
                "exceedance data successfully fetched",
                data=data,
            ),
            Status.HTTP_200_OK,
        )
