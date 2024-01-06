# Third-party libraries

import math

from flasgger import swag_from
from flask import request
from flask_restx import Resource

from api.models import (
    EventsModel,
    SiteModel,
    ExceedanceModel,
)

# Middlewares
from api.utils.http import create_response, Status
from api.utils.pollutants import (
    generate_pie_chart_data,
    d3_generate_pie_chart_data,
    PM_COLOR_CATEGORY,
    set_pm25_category_background,
)
from api.utils.request_validators import validate_request_json
from main import rest_api_v2


@rest_api_v2.route("/dashboard/chart/data")
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
        tenant = request.args.get("tenant", "airqo")

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


@rest_api_v2.route("/dashboard/chart/d3/data")
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
        tenant = request.args.get("tenant", "airqo")

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


@rest_api_v2.route("/dashboard/sites")
class MonitoringSiteResource(Resource):
    @swag_from("/api/docs/dashboard/monitoring_site_get.yml")
    def get(self):
        tenant = request.args.get("tenant", "airqo")

        ms_model = SiteModel(tenant)

        sites = ms_model.get_all_sites()

        return (
            create_response("monitoring site data successfully fetched", data=sites),
            Status.HTTP_200_OK,
        )


@rest_api_v2.route("/dashboard/historical/daily-averages")
class DailyAveragesResource(Resource):
    @swag_from("/api/docs/dashboard/device_daily_measurements_get.yml")
    @validate_request_json(
        "pollutant|required:str",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "sites|optional:list",
    )
    def post(self):
        tenant = request.args.get("tenant", "airqo")
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
            value = v.get("value", None)
            site_id = v.get("site_id", None)

            if not site_id or not value or math.isnan(value):
                continue

            site = list(filter(lambda s: s.get("site_id") == site_id, sites))

            if not site:
                continue

            site = site[0]
            values.append(value)
            labels.append(
                site.get("name")
                or site.get("description")
                or site.get("generated_name")
            )
            background_colors.append(set_pm25_category_background(value))

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


@rest_api_v2.route("/dashboard/historical/daily-averages-devices")
class DailyAveragesResource2(Resource):
    @swag_from("/api/docs/dashboard/device_daily_measurements_get.yml")
    @validate_request_json(
        "pollutant|required:str",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "devices|optional:list",
    )
    def post(self):
        tenant = request.args.get("tenant", "airqo")
        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        devices = json_data["devices"]

        events_model = EventsModel(tenant)
        data = events_model.get_device_averages_from_bigquery(
            start_date, end_date, pollutant, devices=devices
        )

        values = []
        labels = []
        background_colors = []

        for v in data:
            value = v.get("value", None)
            device_id = v.get("device_id", None)

            if not device_id or not value or math.isnan(value):
                continue

            values.append(value)
            labels.append(device_id)
            background_colors.append(set_pm25_category_background(value))
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


@rest_api_v2.route("/dashboard/exceedances")
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
        tenant = request.args.get("tenant", "airqo")

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


@rest_api_v2.route("/dashboard/exceedances-devices")
class ExceedancesResource2(Resource):
    @swag_from("/api/docs/dashboard/exceedances_post.yml")
    @validate_request_json(
        "pollutant|required:str",
        "standard|required:str",
        "startDate|required:datetime",
        "endDate|required:datetime",
        "devices|optional:list",
    )
    def post(self):
        tenant = request.args.get("tenant", "airqo")

        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        standard = json_data["standard"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        devices = json_data.get("devices", None)

        events_model = EventsModel(tenant)
        data = events_model.get_device_readings_from_bigquery(
            start_date, end_date, pollutant, devices=devices
        )
        exc_model = ExceedanceModel(tenant)
        standards_mapping = exc_model.standards_mapping
        device_exceedances = exc_model.count_standard_categories(
            data, standards_mapping, standard, pollutant
        )

        return create_response(
            message="exceedance data successfully fetched",
            data=[
                {
                    "device_id": device_id,
                    "total": sum(exceedances.values()),
                    "exceedances": exceedances,
                }
                for device_id, exceedances in device_exceedances.items()
            ],
            success=Status.HTTP_200_OK,
        )
