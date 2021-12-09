# Third-party libraries
from flasgger import swag_from
import flask_excel as excel
from flask_restx import Resource
from flask import request

# Middlewares
from main import rest_api

from api.models import (
    EventsModel,
    SiteModel,
    ExceedanceModel,
)

from api.utils.http import create_response, Status
from api.utils.coordinates import approximate_coordinates
from api.utils.request_validators import validate_request_params, validate_request_json
from api.utils.pollutants import (
    generate_pie_chart_data,
    PM_COLOR_CATEGORY,
    set_pm25_category_background,
)


@rest_api.route("/data/download")
class DownloadCustomisedDataResource(Resource):

    @swag_from('/api/docs/dashboard/download_custom_data_post.yml')
    @validate_request_params('downloadType|required:data')
    @validate_request_json(
        'sites|required:list', 'startDate|required:datetime', 'endDate|required:datetime',
        'frequency|required:str', 'pollutants|required:list'
    )
    def post(self):
        tenant = request.args.get("tenant")
        download_type = request.args.get('downloadType')
        json_data = request.get_json()
        sites = json_data["sites"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutants = json_data["pollutants"]

        events_model = EventsModel(tenant)
        data = approximate_coordinates(events_model.get_downloadable_events(sites, start_date, end_date, frequency, pollutants))

        if download_type == 'json':
            return create_response("air-quality data download successful", data=data), Status.HTTP_200_OK

        if download_type == 'csv':
            return excel.make_response_from_records(data, 'csv', file_name=f'airquality-{frequency}-data')

        return create_response(f'unknown data format {download_type}', success=False), Status.HTTP_400_BAD_REQUEST


@rest_api.route('/dashboard/chart/data')
class ChartDataResource(Resource):
    @swag_from('/api/docs/dashboard/customised_chart_post.yml')
    @validate_request_json(
        'sites|required:list', 'startDate|required:datetime',
        'endDate|required:datetime', 'frequency|required:str',
        'pollutant|required:str', 'chartType|required:str'
    )
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        sites = json_data["sites"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]

        colors = ['#7F7F7F', '#E377C2', '#17BECF', '#BCBD22', '#3f51b5']

        events_model = EventsModel(tenant)
        data = events_model.get_chart_events(sites, start_date, end_date, pollutant, frequency)

        chart_datasets = []
        chart_labels = []

        for record in data:

            site = record.get("site", {})

            site_name = f"{site.get('name') or site.get('description') or site.get('generated_name')}"

            dataset = {}

            sorted_values = sorted(record.get('values', []), key=lambda item: item.get('time'))
            if chart_type.lower() == 'pie':
                category_count = generate_pie_chart_data(
                    records=sorted_values,
                    key='value',
                    pollutant=pollutant
                )

                try:
                    labels, values = zip(*category_count.items())
                except ValueError:
                    values = []
                    labels = []
                background_colors = [PM_COLOR_CATEGORY.get(label, '#808080') for label in labels]
                color = background_colors

                dataset.update({
                    'data': values,
                    'label': f'{site_name} {pollutant}',
                    'backgroundColor': color,
                    'fill': False
                })

            else:
                try:
                    values, labels = zip(*[(data.get('value'), data.get('time')) for data in sorted_values])
                except ValueError:
                    values = []
                    labels = []

                color = colors.pop()

                dataset.update({
                    'data': values,
                    'label': f'{site_name} {pollutant}',
                    'borderColor': color,
                    'backgroundColor': color,
                    'fill': False
                })

            if not chart_labels:
                chart_labels = labels

            chart_datasets.append(dataset)

        return create_response(
            "successfully retrieved chart data",
            data={
                "labels": chart_labels,
                "datasets": chart_datasets
            }
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/chart/d3/data')
class D3ChartDataResource(Resource):
    @swag_from('/api/docs/dashboard/customised_chart_post.yml')
    @validate_request_json(
        'sites|required:list', 'startDate|required:datetime',
        'endDate|required:datetime', 'frequency|required:str',
        'pollutant|required:str', 'chartType|required:str'
    )
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        sites = json_data["sites"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]

        events_model = EventsModel(tenant)
        data = events_model.get_d3_chart_events(sites, start_date, end_date, pollutant, frequency)

        return create_response(
            "successfully retrieved d3 chart data",
            data=data
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/sites')
class MonitoringSiteResource(Resource):

    @swag_from('/api/docs/dashboard/monitoring_site_get.yml')
    def get(self):
        tenant = request.args.get('tenant')

        ms_model = SiteModel(tenant)

        sites = ms_model.get_all_sites()

        return create_response(
            "monitoring site data successfully fetched",
            data=sites
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/historical/daily-averages')
class DailyAveragesResource(Resource):

    @swag_from('/api/docs/dashboard/device_daily_measurements_get.yml')
    @validate_request_json(
        'pollutant|required:str', 'startDate|required:datetime',
        'endDate|required:datetime', 'sites|optional:list')
    def post(self):
        tenant = request.args.get('tenant')
        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        sites = json_data.get("sites", None)

        events_model = EventsModel(tenant)
        site_model = SiteModel(tenant)
        sites = site_model.get_sites(sites)
        data = events_model.get_averages_by_pollutant(start_date, end_date, pollutant)

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
            values.append(v.get('value'))
            labels.append(
                site.get('name') or
                site.get('description') or
                site.get('generated_name')
            )
            background_colors.append(set_pm25_category_background(v.get('value')))

        return create_response(
            "daily averages successfully fetched",
            data={
                "average_values": values,
                "labels": labels,
                "background_colors": background_colors
            }
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/exceedances')
class ExceedancesResource(Resource):

    @swag_from('/api/docs/dashboard/exceedances_post.yml')
    @validate_request_json(
        'pollutant|required:str', 'standard|required:str',
        'startDate|required:datetime', 'endDate|required:datetime',
        'sites|optional:list'
    )
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        standard = json_data["standard"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        sites = json_data.get("sites", None)

        exc_model = ExceedanceModel(tenant)
        data = exc_model.get_exceedances(start_date, end_date, pollutant, standard, sites=sites)

        return create_response(
            "exceedance data successfully fetched",
            data=data,
        ), Status.HTTP_200_OK
