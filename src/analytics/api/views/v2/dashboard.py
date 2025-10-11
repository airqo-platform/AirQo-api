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
from constants import (
    Frequency,
    DataType,
    DeviceCategory,
)
from api.utils.datautils import DataUtils
from api.utils.data_formatters import (
    filter_non_private_sites_devices,
    get_validated_filter,
)

# Middlewares
from api.utils.http import AirQoRequests
from api.utils.pollutants import (
    generate_pie_chart_data,
    PM_COLOR_CATEGORY,
    set_pm25_category_background,
)
from api.models.dashboard.dashboard import dashboard_chart_data_model
from api.models.dashboard.dashboarddatautils import DashboardDataUtils
from schemas.dashboardchartdata import DashboardChartDataSchema
from marshmallow import ValidationError
from api.utils.request_validators import validate_request_json
from main import rest_api_v2

import logging

logger = logging.getLogger(__name__)


@rest_api_v2.route("/dashboard/chart/data")
class ChartDataResource(Resource):
    @swag_from("/api/docs/dashboard/customised_chart_post.yml")
    @rest_api_v2.expect(dashboard_chart_data_model)
    def post(self):
        try:
            json_data = DashboardChartDataSchema().load(request.json)
        except ValidationError as err:
            return {"errors": err.messages}, 400

        json_data = request.get_json()
        sites = filter_non_private_sites_devices(
            filter_type="sites", filter_value=json_data.get("sites", {})
        ).get("data", [])
        network = json_data.get("network", "airqo")
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]

        colors = ["#7F7F7F", "#E377C2", "#17BECF", "#BCBD22", "#3f51b5"]

        events_model = EventsModel(network)
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
            AirQoRequests.create_response(
                "successfully retrieved chart data",
                data={"labels": chart_labels, "datasets": chart_datasets},
            ),
            AirQoRequests.Status.HTTP_200_OK,
        )


@rest_api_v2.route("/dashboard/chart/d3/data")
class D3ChartDataResource(Resource):
    @swag_from("/api/docs/dashboard/d3_chart_data_post.yml")
    @rest_api_v2.expect(dashboard_chart_data_model)
    def post(self):
        try:
            json_data = DashboardChartDataSchema().load(request.json)
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

        network = json_data.get("network", "airqo")
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]
        device_category = json_data.get("device_category", None)
        data_filter = {filter_type: filter_value}
        frequency = Frequency[frequency.upper()]
        metadata_fields = json_data.get("metaDataFields", ["site_id"])
        extra_columns = metadata_fields
        try:
            device_category = (
                (DeviceCategory[device_category.upper()])
                if device_category
                else DeviceCategory.LOWCOST
            )
            datatype = DataType.CALIBRATED
            data, _ = DataUtils.extract_data_from_bigquery(
                datatype,
                start_date,
                end_date,
                frequency=frequency,
                dynamic_query=True,
                device_category=device_category,
                main_columns=[
                    pollutant,
                ],
                data_filter=data_filter,
                extra_columns=extra_columns,
                use_cache=True,
            )

            if not data.empty:
                dashboardata = DashboardDataUtils()
                data = dashboardata.processd3data(data, frequency)
            else:
                data: list = []

            if chart_type.lower() == "pie":
                data = dashboardata.d3_generate_pie_chart_data(data, pollutant)

            return (
                AirQoRequests.create_response(
                    "successfully retrieved d3 chart data", data=data
                ),
                AirQoRequests.Status.HTTP_200_OK,
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


@rest_api_v2.route("/dashboard/sites")
class MonitoringSiteResource(Resource):
    @swag_from("/api/docs/dashboard/monitoring_site_get.yml")
    def get(self):
        tenant = request.args.get("tenant", "airqo")

        ms_model = SiteModel(tenant)

        sites = ms_model.get_all_sites()

        return (
            AirQoRequests.create_response(
                "monitoring site data successfully fetched", data=sites
            ),
            AirQoRequests.Status.HTTP_200_OK,
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
        sites = filter_non_private_sites_devices(
            filter_type="sites", filter_value=json_data.get("sites", {})
        ).get("data", [])

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
            AirQoRequests.create_response(
                "daily averages successfully fetched",
                data={
                    "average_values": values,
                    "labels": labels,
                    "background_colors": background_colors,
                },
            ),
            AirQoRequests.Status.HTTP_200_OK,
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
        network = request.args.get("network", "airqo")
        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        devices = filter_non_private_sites_devices(
            filter_type="devices", filter_value=json_data.get("devices", {})
        ).get("data", [])

        events_model = EventsModel(network)
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
            AirQoRequests.create_response(
                "daily averages successfully fetched",
                data={
                    "average_values": values,
                    "labels": labels,
                    "background_colors": background_colors,
                },
            ),
            AirQoRequests.Status.HTTP_200_OK,
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
        sites = filter_non_private_sites_devices(
            filter_type="sites", filter_value=json_data.get("sites", {})
        ).get("data", [])

        exc_model = ExceedanceModel(tenant)
        data = exc_model.get_exceedances(
            start_date, end_date, pollutant, standard, sites=sites
        )

        return (
            AirQoRequests.create_response(
                "exceedance data successfully fetched",
                data=data,
            ),
            AirQoRequests.Status.HTTP_200_OK,
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
        devices = filter_non_private_sites_devices(
            filter_type="devices", filter_value=json_data.get("devices", {})
        ).get("data", [])

        events_model = EventsModel(tenant)
        data = events_model.get_device_readings_from_bigquery(
            start_date, end_date, pollutant, devices=devices
        )
        exc_model = ExceedanceModel(tenant)
        standards_mapping = exc_model.standards_mapping
        device_exceedances = exc_model.count_standard_categories(
            data, standards_mapping, standard, pollutant
        )

        return AirQoRequests.create_response(
            message="exceedance data successfully fetched",
            data=[
                {
                    "device_id": device_id,
                    "total": sum(exceedances.values()),
                    "exceedances": exceedances,
                }
                for device_id, exceedances in device_exceedances.items()
            ],
            success=AirQoRequests.Status.HTTP_200_OK,
        )
