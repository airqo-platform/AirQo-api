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
from api.utils.request_validators import validate_request_params, validate_request_json
from api.utils.pollutants import (
    generate_pie_chart_data,
    PM_COLOR_CATEGORY,
    POLLUTANT_MEASUREMENT_UNITS,
    set_pm25_category_background,
    str_date_to_format_str
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

        formatted_pollutants = {}

        for pollutant in pollutants:
            if pollutant == 'pm2_5':
                formatted_pollutants['pm2_5.value'] = 1
            elif pollutant == 'pm10':
                formatted_pollutants['pm10.value'] = 1
            elif pollutant == 'no2':
                formatted_pollutants['no2.value'] = 1

        events_model = EventsModel(tenant)
        data = events_model.get_downloadable_events(sites, start_date, end_date, frequency, formatted_pollutants)

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
        'endDate|required:datetime', 'frequency|required:str'
    )
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        sites = json_data["sites"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]

        events_model = EventsModel(tenant)

        data = events_model.get_events(sites, start_date, end_date, frequency)

        return create_response("chart data successfully retrieved", data=data), Status.HTTP_200_OK


# @rest_api.route('/dashboard/customised_chart')
# class CustomisedChartResource(Resource):
#
#     @swag_from('/api/docs/dashboard/customised_chart_post.yml')
#     @validate_request_json(
#         'locations|required:list', 'startDate|required:datetime', 'endDate|required:datetime',
#         'frequency|required:str', 'pollutant|required:str', 'chartType|required:str', 'orgName|str'
#     )
#     def post(self):
#         tenant = request.args.get('tenant')
#
#         json_data = request.get_json()
#         locations = json_data["locations"]
#         start_date = json_data["startDate"]
#         end_date = json_data["endDate"]
#         frequency = json_data["frequency"]
#         pollutant = json_data["pollutant"]
#         chart_type = json_data["chartType"]
#         org_name = json_data.get("orgName") or tenant
#
#         custom_chart_title = f'Mean {frequency.capitalize()} {pollutant} for {", ".join(locations)}'
#         custom_chart_title_second_section = f'Between {str_date_to_format_str(start_date, frequency)} and ' \
#                                             f'{str_date_to_format_str(start_date, frequency)}'
#
#         colors = ['#7F7F7F', '#E377C2', '#17BECF', '#BCBD22', '#3f51b5']
#
#         if pollutant.lower() == 'pm 2.5':
#             category_key = 'pm25'
#             label_key = 'pm'
#
#         elif pollutant.lower() == 'pm 10':
#             category_key = 'pm10'
#             label_key = 'pm'
#
#         else:
#             category_key = 'no2'
#             label_key = 'no2'
#
#         ms_model = MonitoringSiteModel(tenant)
#         dhm_model = DeviceHourlyMeasurementModel(tenant)
#
#         results = {
#             "chart_type": chart_type,
#             "custom_chart_title": custom_chart_title,
#             "custom_chart_title_second_section": custom_chart_title_second_section,
#             "chart_label": f'{pollutant} {POLLUTANT_MEASUREMENT_UNITS.get(label_key, "")}',
#             "pollutant": pollutant,
#             "start_date": start_date,
#             "end_date": end_date,
#             "frequency": frequency,
#         }
#
#         charts = []
#
#         sites = list(ms_model.filter_by(Organisation=org_name).in_filter_by(Parish=locations).exec(
#             {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 1}
#         ))
#
#         device_codes = [site["DeviceCode"] for site in sites]
#
#         device_data = list(dhm_model.get_all_filtered_data(
#             device_codes, start_date=start_date, end_date=end_date, frequency=frequency, pollutant=pollutant
#         ))
#
#         for device in sites:
#             device_code = device['DeviceCode']
#             division = device['Division']
#             parish = device['Parish']
#             location_code = device['LocationCode']
#
#             dataset = {}
#
#             site_data = list(filter(lambda data: data['deviceCode'] == device_code, device_data))
#
#             if chart_type.lower() == 'pie':
#                 category_count = generate_pie_chart_data(
#                     records=site_data,
#                     key='pollutant_value',
#                     pollutant=category_key
#                 )
#                 color = None
#                 try:
#                     labels, values = zip(*category_count.items())
#                 except ValueError:
#                     values = []
#                     labels = []
#                 background_colors = [PM_COLOR_CATEGORY.get(label, '#808080') for label in labels]
#                 dataset['pieBackgroundColors'] = background_colors
#             else:
#                 try:
#                     values, labels = zip(*[(data['pollutant_value'], data['time']) for data in site_data])
#                 except ValueError:
#                     values = []
#                     labels = []
#
#                 color = colors.pop()
#
#             dataset.update({
#                 'values': values,
#                 'labels': labels,
#                 'key_label': f'{parish} {pollutant}',
#                 'borderColor': color,
#                 'backgroundColor': color,
#                 'fill': False
#             })
#
#             chart_data = {
#                 "division": division,
#                 "location_code": location_code,
#                 "parish": parish,
#                 "dataset": dataset,
#             }
#
#             charts.append(chart_data)
#
#         results["charts"] = charts
#         return create_response("chart data successfully retrieved", data=results), Status.HTTP_200_OK


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
    @validate_request_json('pollutant|required:str', 'startDate|required:datetime', 'endDate|required:datetime')
    def post(self):
        tenant = request.args.get('tenant')
        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]

        events_model = EventsModel(tenant)
        site_model = SiteModel(tenant)
        sites = site_model.get_sites()
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
        'startDate|required:datetime', 'endDate|required:datetime'
    )
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        standard = json_data["standard"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]

        exc_model = ExceedanceModel(tenant)

        data = exc_model.get_exceedances(start_date, end_date, pollutant, standard)

        return create_response(
            "exceedance data successfully fetched",
            data=data,
        ), Status.HTTP_200_OK
